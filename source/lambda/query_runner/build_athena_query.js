// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Build an athena query to alter table add partition as needed
 * @param athenaDB
 * @param athenaTable
 */
const BuildAddAthenaPartitionQuery = (athenaDB, athenaTable) => {
  LOGGER.log('INFO', '[BuildAddAthenaPartitionQuery] Start');

  // Get today's date and time
  const currentTimeStamp = new Date();
  const year = currentTimeStamp.getFullYear();
  const month = currentTimeStamp.getMonth() + 1;
  const day = currentTimeStamp.getDate();

  // Create Athena partition using date on created_at. For example, created_at = '2022-03-01'
  const queryString = `ALTER TABLE ${athenaDB}.${athenaTable}
        ADD IF NOT EXISTS
        PARTITION(
            created_at = '${year.toString()}-${month.toString() < 10 ? '0' : ''}${month.toString()}-${
    day.toString() < 10 ? '0' : ''
  }${day.toString()}'
        )`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildAddAthenaPartitionQuery] END');

  return queryString;
};

/**
 * Build an athena query to create a view for code change activities
 * @param athenaDB
 * @param athenaTable
 * @param includedRepositoryList
 * @param dataDuration
 */
const BuildCodeChangeActivityQuery = (
  athenaDB,
  athenaTable,
  athenaCodeCommitTagsTable,
  includedRepositoryList,
  dataDuration
) => {
  LOGGER.log('INFO', '[BuildCodeChangeActivityQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  // Filter by customer entered repository list if configured
  const repoFilterString =
    includedRepositoryList.length > 0 && includedRepositoryList !== "'ALL'"
      ? `AND detail.repositoryName in (${includedRepositoryList})`
      : '';

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_change_activity_view AS
        WITH metrics AS (
          SELECT account, time, region,
          detail.eventName as event_name,
          detail.repositoryName as repository_name,
          detail.branchName as branch_name, 
          detail.authorName as author_name,
          detail.commitId as commit_id,
          created_at
          FROM ${athenaDB}.${athenaTable}
          WHERE source = 'aws.codecommit'
              AND ${dataDurationQueryString}
              ${repoFilterString}
        )
        SELECT metrics.account,
        metrics.time,
        metrics.region,
        metrics.event_name,
        metrics.repository_name,
        metrics.branch_name,
        metrics.author_name,
        metrics.commit_id,
        metrics.created_at,
        tags.tag
        FROM ${athenaDB}.${athenaCodeCommitTagsTable} AS tags
        RIGHT JOIN metrics
        ON tags.account_id = metrics.account AND tags.region = metrics.region AND tags.resource_name = metrics.repository_name;`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildCodeChangeActivityQuery] END');

  return queryString;
};

/**
 * Build an athena query to create a view for recovery time
 * @param athenaDB
 * @param athenaTable
 * @param dataDuration
 */
const BuildRecoveryTimeQuery = (athenaDB, athenaTable, dataDuration) => {
  LOGGER.log('INFO', '[BuildRecoveryTimeQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.recovery_time_detail_view AS
        SELECT account, time, region,
        detail.canaryAlarmName as alarm_name,
        detail.alarmType as alarm_type,
        detail.canaryAlarmAppName as application_name,
        detail.canaryAlarmRepoName as repository_name,
        detail.canaryAlarmCurrState as current_state,
        detail.canaryAlarmPrevState as previous_state,
        detail.canaryAlarmCurrStateTimeStamp as current_state_timestamp,
        detail.canaryAlarmPrevStateTimeStamp as previous_state_timestamp,
        detail.recoveryDurationMinutes as duration_minutes, created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.cloudwatch' 
            AND ${dataDurationQueryString};`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildRecoveryTimeQuery] END');

  return queryString;
};

/**
 * Build an athena query to create a view for application deployments
 * @param athenaDB
 * @param athenaTable
 * @param dataDuration
 */
const BuildDeploymentQuery = (athenaDB, athenaTable, dataDuration) => {
  LOGGER.log('INFO', '[BuildDeploymentQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_deployment_detail_view AS
        SELECT account, time, region,
        detail.deploymentId as deployment_id,
        detail.deploymentApplication as application,
        detail.deploymentState as state,
        created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.codedeploy' 
            AND ${dataDurationQueryString};`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildDeploymentQuery] END');

  return queryString;
};

/*
 * Build an athena query to create a view for code pipeline executions.
 */
const BuildCodePipelineQuery = (athenaDB, athenaTable, athenaCodePipelineTagsTable, dataDuration) => {
  LOGGER.log('INFO', '[BuildCodePipelineQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_pipeline_detail_view AS
        WITH metrics AS (
          SELECT account, time, region,
          detail.pipelineName as pipeline_name,
          detail.executionId as execution_id,
          detail.stage as stage,
          detail.action as action,
          detail.state as state,
          detail.externalExecutionId as external_execution_id,
          detail.actionCategory as action_category,
          detail.actionOwner as action_owner,
          detail.actionProvider as action_provider,
          created_at
          FROM ${athenaDB}.${athenaTable}
          WHERE source = 'aws.codepipeline'
              AND ${dataDurationQueryString}
        )
        SELECT metrics.account,
        metrics.time,
        metrics.region,
        metrics.pipeline_name,
        metrics.execution_id,
        metrics.stage,
        metrics.action,
        metrics.state,
        metrics.external_execution_id,
        metrics.action_category,
        metrics.action_owner,
        metrics.action_provider,
        metrics.created_at,
        tags.tag
        FROM ${athenaDB}.${athenaCodePipelineTagsTable} AS tags
        RIGHT JOIN metrics
        ON tags.account_id = metrics.account AND tags.region = metrics.region AND tags.resource_name = metrics.pipeline_name;`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildCodePipelineQuery] END');

  return queryString;
};

/**
 * Build an athena query to create a view for code build metrics
 * @param athenaDB
 * @param athenaTable
 * @param dataDuration
 */
const BuildCodeBuildQuery = (athenaDB, athenaTable, athenaCodeBuildTagsTable, dataDuration) => {
  LOGGER.log('INFO', '[BuildCodeBuildQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_build_detail_view AS
        WITH metrics AS (
          SELECT account_id as account, region, namespace, metric_name, timestamp,
          dimensions.ProjectName as project_name, dimensions.BuildId as build_id,
          dimensions.BuildNumber as build_number, value.count as count, value.sum as sum, 
          value.max as max, value.min as min, unit, created_at
          FROM ${athenaDB}.${athenaTable}
          WHERE namespace = 'AWS/CodeBuild' 
              AND ${dataDurationQueryString}
        )
        SELECT metrics.account,
        metrics.region,
        metrics.namespace,
        metrics.metric_name,
        metrics.timestamp,
        metrics.project_name,
        metrics.build_id,
        metrics.build_number,
        metrics.count,
        metrics.sum,
        metrics.max,
        metrics.min,
        metrics.unit,
        metrics.created_at,
        tags.tag
        FROM ${athenaDB}.${athenaCodeBuildTagsTable} AS tags
        RIGHT JOIN metrics
        ON tags.account_id = metrics.account AND tags.region = metrics.region AND tags.resource_name = metrics.project_name;`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildCodeBuildQuery] END');

  return queryString;
};

/**
 * Build an athena query to create a view for github metrics
 * @param athenaDB
 * @param athenaTable
 * @param dataDuration
 */
const BuildGitHubQuery = (athenaDB, athenaTable, dataDuration) => {
  LOGGER.log('INFO', '[BuildGitHubQuery] Start');

  const dataDurationQueryString = BuildDataDurationQuery(dataDuration);

  const queryString = `CREATE OR REPLACE VIEW ${athenaDB}.github_change_activity_view AS
        SELECT repository_name, branch_name, author_name, event_name, cast(cardinality(commit_id) as int) as commit_count, time, created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE ${dataDurationQueryString};`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildGitHubQuery] END');

  return queryString;
};

/**
 * Build a query string for data duration
 * @param dataDuration
 */
const BuildDataDurationQuery = dataDuration => {
  LOGGER.log('INFO', '[BuildDataDurationString] Start');

  const queryString = `created_at between date_add('day', -${dataDuration}, current_date) and current_date`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildDataDurationString] END');

  return queryString;
};

/**
 * Build athena query to drop a view
 * @param athenaDB
 * @param athenaView
 */
const BuildDropViewQuery = (athenaDB, athenaView) => {
  LOGGER.log('INFO', '[BuildDropViewQuery] Start');

  const queryString = `DROP VIEW IF EXISTS ${athenaDB}.${athenaView};`;

  LOGGER.log('INFO', 'Query string: \n' + queryString);
  LOGGER.log('INFO', '[BuildDropViewQuery] END');

  return queryString;
};

module.exports = {
  buildAddAthenaPartitionQuery: BuildAddAthenaPartitionQuery,
  buildCodeChangeActivityQuery: BuildCodeChangeActivityQuery,
  buildRecoveryTimeQuery: BuildRecoveryTimeQuery,
  buildDeploymentQuery: BuildDeploymentQuery,
  buildDropViewQuery: BuildDropViewQuery,
  buildDataDurationQuery: BuildDataDurationQuery,
  buildCodePipelineQuery: BuildCodePipelineQuery,
  buildCodeBuildQuery: BuildCodeBuildQuery,
  buildGitHubQuery: BuildGitHubQuery
};
