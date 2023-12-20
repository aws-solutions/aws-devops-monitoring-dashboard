// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');

const userAgentExtra = process.env['UserAgentExtra'];
let options = {};
if (userAgentExtra) {
  options = { customUserAgent: userAgentExtra };
}

const cloudwatch = new CloudWatch(options);

const LOGGER = new (require('./lib/logger'))();
const buildAthenaQuery = require('./build_athena_query');
const exeAthenaQuery = require('./lib/execute_athena_query');
const metricsHelper = require('./lib/metrics_helper');

const athenaDB = process.env.MetricsDBName;
const athenaTable = process.env.MetricsTableName;
const athenaCodeBuildTable = process.env.CodeBuildMetricsTableName;
const athenaGitHubTable = process.env.GitHubMetricsTableName;
const athenaWorkGroup = process.env.AthenaWorkGroup;
const sendAnonymousUsageData = process.env.SendAnonymousUsageData;
const solutionId = process.env.SolutionId;
const solutionVersion = process.env.Version;
const solutionUUID = process.env.UUID;
const solutionRegion = process.env.Region;
const metricsURL = process.env.MetricsURL;

/**
 * Call functions to add athena partitions and send anonymous usage metrics
 * @param event
 */
exports.handler = async event => {
  LOGGER.log(`Event received is ${JSON.stringify(event)}`);
  try {
    await AddPartition();
    await SendAnonymousUsageData();
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

/**
 * Execute Athena query to add partitions
 */
const AddPartition = async () => {
  try {
    LOGGER.log('INFO', 'Start adding athena partition lambda function');

    // Run query to add athena partitions to devops metrics table as needed
    let queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaTable);
    await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

    // Run query to add athena partitions to codebuild metrics table as needed
    queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaCodeBuildTable);
    await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

    // Run query to add athena partitions to github metrics table as needed
    queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaGitHubTable);
    await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

    LOGGER.log('INFO', 'End adding athena partition lambda function.');
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

/**
 * Send Anonymous Usage Metrics
 */
const SendAnonymousUsageData = async () => {
  try {
    if (sendAnonymousUsageData.toLowerCase() === 'yes') {
      LOGGER.log('INFO', '[SendAnonymousUsageData] Start sending anonymous metrics');

      const queryCount = await GetAthenaQueryExecutionsCount();

      const data = {
        version: solutionVersion,
        data_type: 'add_athena_partition_lambda',
        region: solutionRegion,
        athena_query_executions_count: queryCount.toString()
      };

      LOGGER.log(`[SendAnonymousUsageData] data: ${JSON.stringify(data)}`);

      const response = await metricsHelper.sendMetrics(solutionId, solutionUUID, data, metricsURL);

      LOGGER.log('INFO', `[SendAnonymousUsageData] response: ${JSON.stringify(response, null, 2)}`);
      LOGGER.log('INFO', '[SendAnonymousUsageData] End sending anonymous metrics');

      return response;
    }
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

/**
 * Get the count of successful Athena query executions in the solution's Athena work group
 * that are triggered by QuickSight dashboard loading within a certain period of time (24 hours)
 */
const GetAthenaQueryExecutionsCount = async () => {
  LOGGER.log('INFO', '[GetAthenaQueryExecutionsCount] Start getting Athena query executions count');

  const end_time = new Date();
  let start_time = new Date();
  // set start time to one day (24 hours) ago
  start_time = new Date(start_time.setHours(start_time.getHours() - 24));
  const params = {
    EndTime: end_time,
    MetricName: 'ProcessedBytes',
    Namespace: 'AWS/Athena',
    Period: 3600 * 24, //set period to past 24 hours
    StartTime: start_time,
    Statistics: ['SampleCount'],
    Dimensions: [
      {
        Name: 'QueryState',
        Value: 'SUCCEEDED'
      },
      {
        Name: 'QueryType',
        Value: 'DML'
      },
      {
        Name: 'WorkGroup',
        Value: athenaWorkGroup
      }
    ]
  };

  let queryExecutionCount = 0;

  try {
    const response = await cloudwatch.getMetricStatistics(params);

    if (response.Datapoints && response.Datapoints.length > 0) {
      for (const dataPoint of response.Datapoints) {
        queryExecutionCount += dataPoint.SampleCount;
      }
      // subtract 1 query execution used to add daily athena partition instead of loading QuickSight dashboard
      queryExecutionCount = queryExecutionCount - 1 >= 0 ? queryExecutionCount - 1 : 0;
    }

    LOGGER.log('INFO', `[GetAthenaQueryExecutionsCount] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', `[GetAthenaQueryExecutionsCount] Query Executions Count: ${queryExecutionCount.toString()}`);
  } catch (error) {
    LOGGER.log('ERROR', error);
  }

  LOGGER.log('INFO', '[GetAthenaQueryExecutionsCount] End getting Athena query executions count');

  return queryExecutionCount;
};
