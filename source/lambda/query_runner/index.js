// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const cfn = require('./lib/cfn');
const buildAthenaQuery = require('./build_athena_query');
const exeAthenaQuery = require('./lib/execute_athena_query');
const metricsHelper = require('./lib/metrics_helper');
const { Glue } = require('@aws-sdk/client-glue');

/**
 * Execute Athena query as configured for different data sources
 * @param event lambda events
 * @param context lambda context
 */
exports.handler = async (event, context) => {
  LOGGER.log('INFO', `Event received is ${JSON.stringify(event)}`);

  const resourceType = event.ResourceType;
  const requestType = event.RequestType;
  const resourceProperties = event['ResourceProperties'];

  try {
    // run Athena queries
    if (resourceType === 'Custom::QueryRunner') {
      if (requestType === 'Update') {
        await deletePartitionForUpdate(requestType, resourceProperties);
      }
      await QueryRunner(requestType, resourceProperties);
    }
    // send anonymous metrics
    else if (resourceType === 'Custom::SendAnonymousUsageData') {
      await SendAnonymousUsageData(requestType, resourceProperties);
    }

    // send cfn response
    if (requestType === 'Create' || requestType === 'Update' || requestType == 'Delete') {
      return await cfn.send(event, context, 'SUCCESS');
    }
  } catch (err) {
    LOGGER.log('ERROR', err);
    if (requestType === 'Create' || requestType === 'Update' || requestType == 'Delete') {
      await cfn.send(
        event,
        context,
        'FAILED',
        err.message + `\nMore information in CloudWatch Log Stream: ${context.logStreamName}`
      );
    }
  }
};

/**
 * Run Athena queries
 * @param requestType Create, Update or Delete
 * @param resourceProperties resource properties included in the lambda event
 */
const QueryRunner = async (requestType, resourceProperties) => {
  try {
    LOGGER.log('INFO', 'Start query runner lambda function');
    let queryString = '';
    const athenaDB = resourceProperties['MetricsDBName'];
    const athenaTable = resourceProperties['MetricsTableName'];
    const athenaCodeBuildTable = resourceProperties['CodeBuildMetricsTableName'];
    const athenaGitHubTable = resourceProperties['GitHubMetricsTableName'];
    const athenaCodeCommitTagsTable = resourceProperties['CodeCommitTagsGlueTableName'];
    const athenaCodeBuildTagsTable = resourceProperties['CodeBuildTagsGlueTableName'];
    const athenaCodePipelineTagsTable = resourceProperties['CodePipelineTagsGlueTableName'];
    const athenaWorkGroup = resourceProperties['AthenaWorkGroup'];
    const dataDuration = resourceProperties['DataDuration'];
    const repositoryList = resourceProperties['RepositoryList'];
    const athenaViews = [
      'code_change_activity_view',
      'code_deployment_detail_view',
      'recovery_time_detail_view',
      'code_pipeline_detail_view',
      'code_build_detail_view',
      'github_change_activity_view'
    ];

    // Create Athena views at stack creation or update
    if (requestType === 'Create' || requestType === 'Update') {
      LOGGER.log('INFO', 'Add Athena Partition and Build Athena Views');

      // First run query to add athena partitions to devops metrics table as needed
      queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaTable);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // First run query to add athena partitions to codebuild metrics table as needed
      queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaCodeBuildTable);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // First run query to add athena partitions to github metrics table as needed
      queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaGitHubTable);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for codecommit events
      queryString = buildAthenaQuery.buildCodeChangeActivityQuery(
        athenaDB,
        athenaTable,
        athenaCodeCommitTagsTable,
        repositoryList,
        dataDuration
      );
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for canary alarm events
      queryString = buildAthenaQuery.buildRecoveryTimeQuery(athenaDB, athenaTable, dataDuration);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for deployment events
      queryString = buildAthenaQuery.buildDeploymentQuery(athenaDB, athenaTable, dataDuration);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for codepipeline events
      queryString = buildAthenaQuery.buildCodePipelineQuery(
        athenaDB,
        athenaTable,
        athenaCodePipelineTagsTable,
        dataDuration
      );
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for codebuild events
      queryString = buildAthenaQuery.buildCodeBuildQuery(
        athenaDB,
        athenaCodeBuildTable,
        athenaCodeBuildTagsTable,
        dataDuration
      );
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

      // Run query to build view for github events
      queryString = buildAthenaQuery.buildGitHubQuery(athenaDB, athenaGitHubTable, dataDuration);
      await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);
    }
    // Drop Athena views at stack deletion
    else if (requestType === 'Delete') {
      LOGGER.log('INFO', 'Delete Athena Views');
      for (let i in athenaViews) {
        queryString = buildAthenaQuery.buildDropViewQuery(athenaDB, athenaViews[i]);
        await exeAthenaQuery.executeAthenaQuery(athenaDB, 'primary', queryString);
      }
    }
    LOGGER.log('INFO', 'End query runner lambda function');
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

/**
 * Send Anonymous Usage Metrics
 * @param requestType   Create, Update or Delete
 * @param resourceProperties  resource properties included in the lambda event
 */
const SendAnonymousUsageData = async (requestType, resourceProperties) => {
  try {
    if (resourceProperties['SendAnonymousUsageData'].toLowerCase() === 'yes') {
      LOGGER.log('INFO', '[SendAnonymousUsageData] Start sending anonymous metrics');

      let data = {
        version: resourceProperties['Version'],
        data_type: 'custom_resource',
        region: resourceProperties['Region'],
        request_type: requestType,
        quicksight_deployed:
          resourceProperties.hasOwnProperty('QuickSightPrincipalArn') &&
          resourceProperties['QuickSightPrincipalArn'] !== undefined
            ? 'yes'
            : 'no',
        athena_query_data_duration: resourceProperties['AthenaQueryDataDuration'],
        repository: resourceProperties['RepositoryList'] === "'ALL'" ? 'all' : 'customer list',
        s3_transition_days: resourceProperties['S3TransitionDays'],
        use_github_repository: resourceProperties['UseGitHubRepository'],
        use_github_webhook_secret_token: resourceProperties['UseWebhookSecret'],
        use_multiple_account: resourceProperties['UseMultiAccount']
      };

      if (resourceProperties['UseMultiAccount'] === 'yes') {
        data = {
          ...data,
          principal_type: resourceProperties['PrincipalType'],
          principal_count: resourceProperties['PrincipalCount']
        };
      }

      LOGGER.log('INFO', `[SendAnonymousUsageData] data: ${JSON.stringify(data)}`);

      const response = await metricsHelper.sendMetrics(
        resourceProperties['SolutionId'],
        resourceProperties['UUID'],
        data,
        resourceProperties['MetricsURL']
      );

      LOGGER.log('INFO', `[SendAnonymousUsageData] response: ${JSON.stringify(response, null, 2)}`);
      LOGGER.log('INFO', '[SendAnonymousUsageData] End sending anonymous metrics');

      return response;
    }
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

const deletePartitionForUpdate = async (requestType, resourceProperties) => {
  try {
    const userAgentExtra = process.env.UserAgentExtra;
    let options = {};
    if (userAgentExtra) {
      options = { customUserAgent: userAgentExtra };
    }
    LOGGER.log('INFO', JSON.stringify(options, null, 2));
    const glue = new Glue(options);
    const athenaDB = resourceProperties['MetricsDBName'];
    const athenaTable = resourceProperties['MetricsTableName'];
    const currentDate = new Date();
    const dateStringForPartition = currentDate.toISOString().substring(0, 10);

    const response = await glue
      .deletePartition({
        DatabaseName: athenaDB,
        PartitionValues: [dateStringForPartition],
        TableName: athenaTable
      });
    LOGGER.log('INFO', requestType + ':\n ' + JSON.stringify(response, null, 2));
  } catch (error) {
    LOGGER.log('ERROR', error);
  }
  return Promise.resolve();
};
