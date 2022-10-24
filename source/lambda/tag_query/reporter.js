#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const STS = require('aws-sdk/clients/sts');
const { getServiceFromResourceType, getTypeFromResourceType } = require('./lib/resource_info');
const LOGGER = new (require('./lib/logger'))();

class Reporter {
  constructor(bucket, tagConfigs) {
    this._s3 = new AWS.S3({ customUserAgent: process.env.USER_AGENT_EXTRA });
    this._bucket = bucket;
    this._prefix = 'TaggedResources';
    this._region = process.env.AWS_REGION;
    this._tagConfigs = tagConfigs;
    this._reports = {};
    this._account = undefined;
    this._partition = undefined;
  }

  addResource(resource) {
    // Athena timestamp is SQL not ISO: https://docs.aws.amazon.com/athena/latest/ug/data-types.html
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const key = this._getKey(resource);
    const report = {
      account_id: resource.account,
      region: this._region,
      resource_type: resource.type,
      resource_name: resource.name,
      tag: resource.tagString,
      create_time_stamp: now
    };
    if (!(key in this._reports)) {
      this._reports[key] = [];
    }
    this._reports[key].push(JSON.stringify(report));
  }

  _getKey(resource) {
    // MetricsBucketName/TaggedResources/CodeBuild/111111111111_us-east-1_project_tagged.json
    return `${this._prefix}/${resource.service}/${resource.account}_${this._region}_${resource.type}_tagged.json`;
  }

  async _getKeyFromResourceType(resourceType) {
    if (!this._account) {
      const sts = new STS({ customUserAgent: process.env.USER_AGENT_EXTRA });
      const response = await sts.getCallerIdentity().promise();
      this._account = response.Account;
      this._partition = response.Arn.split(':')[1];
    }
    const service = getServiceFromResourceType(resourceType);
    const type = getTypeFromResourceType(resourceType);
    return `${this._prefix}/${service}/${this._account}_${this._region}_${type}_tagged.json`;
  }

  async uploadReports() {
    const unconfiguredResources = [];
    for (const tagConfig of this._tagConfigs) {
      if (tagConfig.tagConfig) {
        // For each configured resource type, add key to _reports to ensure we upload something, even an empty file
        const key = await this._getKeyFromResourceType(tagConfig.resourceType);
        if (!this._reports[key]) {
          this._reports[key] = [];
        }
      } else {
        // For each unconfigured resource type, add to list of files to delete
        unconfiguredResources.push(await this._getKeyFromResourceType(tagConfig.resourceType));
      }
    }

    let savedError = undefined;

    for (const [key, report] of Object.entries(this._reports)) {
      const params = {
        Body: report.join('\n'),
        Bucket: this._bucket,
        Key: key
      };
      try {
        await this._s3.putObject(params).promise();
      } catch (err) {
        LOGGER.log('ERROR', `Error uploading report ${key} in ${this._bucket}`);
        if (!savedError) {
          savedError = err;
        }
      }
    }

    for (const key of unconfiguredResources) {
      try {
        await this._s3.deleteObject({ Bucket: this._bucket, Key: key }).promise();
      } catch (err) {
        LOGGER.log('ERROR', `Error deleting report ${key} in ${this._bucket}`);
        if (!savedError) {
          savedError = err;
        }
      }
    }

    if (savedError) {
      throw savedError;
    }
  }
}

exports.Reporter = Reporter;
