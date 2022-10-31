#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const tagQuery = require('./tag_query');
const { Reporter } = require('./reporter');
const cfn = require('./lib/cfn');
const metricsHelper = require('./lib/metrics_helper');
const { ResourceTypes, TagConfig } = require('./lib/resource_info');
const LOGGER = new (require('./lib/logger'))();

async function handler(event, context) {
  LOGGER.log('INFO', `Event received is ${JSON.stringify(event)}`);
  const requestFromCfn = 'ResponseURL' in event;
  if (requestFromCfn) {
    await handleRequestFromCfn(event, context);
  } else {
    const tagConfigs = [
      new TagConfig(ResourceTypes.CodeCommitRepository, event.CodeCommitTagConfig),
      new TagConfig(ResourceTypes.CodeBuildProject, event.CodeBuildTagConfig),
      new TagConfig(ResourceTypes.CodePipelinePipeline, event.CodePipelineTagConfig)
    ];
    await queryTagsAndUploadReports(tagConfigs, event.ReportBucket);
  }
}

async function handleRequestFromCfn(event, context) {
  LOGGER.log('INFO', `Request from CloudFormation stack ${event.StackId} for resource ${event.LogicalResourceId}`);
  try {
    const requestType = event.RequestType;
    LOGGER.log('INFO', `Request type: ${requestType}`);
    if (requestType === 'Create' || requestType === 'Update') {
      const tagConfigs = [
        new TagConfig(ResourceTypes.CodeCommitRepository, event.ResourceProperties.CodeCommitTagConfig),
        new TagConfig(ResourceTypes.CodeBuildProject, event.ResourceProperties.CodeBuildTagConfig),
        new TagConfig(ResourceTypes.CodePipelinePipeline, event.ResourceProperties.CodePipelineTagConfig)
      ];
      await queryTagsAndUploadReports(tagConfigs, event.ResourceProperties.ReportBucket);
    }
    await submitOperationalMetrics(event);
    LOGGER.log('INFO', 'Successfully queried tag information - sending response to CloudFormation');
    await cfn.send(event, context.logStreamName, { status: 'SUCCESS' });
  } catch (err) {
    LOGGER.log('ERROR', err);
    const responseData = `${err.message}\nMore information in CloudWatch Log Stream: ${context.logStreamName}`;
    await cfn.send(event, context.logStreamName, { status: 'FAILED', data: responseData });
  }
}

async function queryTagsAndUploadReports(tagConfigs, reportBucket) {
  LOGGER.log('INFO', 'Querying tag information');
  LOGGER.log('INFO', `Tag configurations: ${tagConfigs}`);
  LOGGER.log('INFO', `Report bucket: ${reportBucket}`);

  const tagQueryEngine = new tagQuery.TagQueryEngine(tagConfigs);
  const resources = await tagQueryEngine.getResources();
  // Check if the query engine encountered an error, but try to do as much work as possible
  let savedError = tagQueryEngine.getSavedError();

  LOGGER.log('INFO', 'Building and uploading reports');

  const reporter = new Reporter(reportBucket, tagConfigs);
  for (const resource of resources) {
    try {
      reporter.addResource(resource);
    } catch (err) {
      LOGGER.log('ERROR', `Error uploading report for ${resource.name}: ${err}`);
      // Upload as many reports as possible
      if (savedError === undefined) {
        // But persist an error if we encounter it so we can still fail the function
        savedError = err;
      }
    }
  }

  await reporter.uploadReports();

  if (savedError !== undefined) {
    // Fail the function if we encountered an error
    throw savedError;
  }
}

async function submitOperationalMetrics(event) {
  try {
    const metricsEnabled = process.env.SEND_ANONYMOUS_USAGE_METRICS;
    if (metricsEnabled && metricsEnabled.toLowerCase() === 'yes') {
      LOGGER.log('INFO', 'Sending anonymous usage metrics');
      const separator = TagConfig.tagConfigSeparator;
      let data = {
        version: process.env.SOLUTION_VERSION,
        data_type: 'custom_resource',
        region: process.env.AWS_REGION,
        request_type: event.RequestType,
        code_commit_tags_count:
          event.ResourceProperties.CodeCommitTagConfig.length > 0
            ? event.ResourceProperties.CodeCommitTagConfig.split(separator).length.toString()
            : '0',
        code_build_tags_count:
          event.ResourceProperties.CodeBuildTagConfig.split(separator).length > 0
            ? event.ResourceProperties.CodeBuildTagConfig.split(separator).length.toString()
            : '0',
        code_pipeline_tags_count:
          event.ResourceProperties.CodePipelineTagConfig.split(separator).length > 0
            ? event.ResourceProperties.CodePipelineTagConfig.split(separator).length.toString()
            : '0',
        stack: process.env.STACK_TYPE
      };

      LOGGER.log('INFO', `Anonymous metrics data: ${JSON.stringify(data)}`);

      const response = await metricsHelper.sendMetrics(
        process.env.SOLUTION_ID,
        process.env.SOLUTION_UUID,
        data,
        process.env.METRICS_URL
      );

      LOGGER.log('INFO', `Anonymous metrics response: ${JSON.stringify(response, null, 2)}`);
    }
  } catch (err) {
    LOGGER.log('WARN', `Sending anonymous usage metrics failed: ${err}`);
  }
}

exports.handler = handler;
