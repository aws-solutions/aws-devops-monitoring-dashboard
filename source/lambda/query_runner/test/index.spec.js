// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const index = require('../index');

const queryResourceProperties = {
  MetricsDBName: "metrics_db",
  MetricsTableName: "metrics_table",
  CodeBuildMetricsTableName: "code_build_metrics_table",
  GitHubMetricsTableName: "git_hub_metrics_table",
  CodeCommitTagsGlueTableName: "code_commit_tags_table",
  CodeBuildTagsGlueTableName: "code_build_tags_table",
  CodePipelineTagsGlueTableName: "code_pipeline_tags_table",
  AthenaWorkGroup: "athena_work_group",
  DataDuration: "90",
  RepositoryList: "ALL",
  CodeBuildMetricsTableName: "code_build_metrics_table",
  CodeBuildMetricsTableName: "code_build_metrics_table",
};

const usageResourceProperties = {
  SendAnonymousUsageData: "yes",
  Version: "1.2.0",
  Region: "us-east-1",
  QuickSightPrincipalArn: "arn:aws:quicksight:us-east-1:accountID:user/default/userName",
  AthenaQueryDataDuration: "90",
  RepositoryList: "ALL",
  S3TransitionDays: "365",
  UseGitHubRepository: "no",
  UseWebhookSecret: "no",
  UseMultiAccount: "yes",
  PrincipalType: "Account",
  PrincipalCount: "2",
  SolutionId: "SO0103",
  UUID: "2820b493-864c-4ca1-99d3-7174fef7f374",
  MetricsURL: "https://example.com"
};

jest.mock(
  '../lib/metrics_helper',
  () => ({
    __esmodule: true,
    sendMetrics: jest.fn().mockImplementation((solutionId, solutionUUID, data, metricsURL) => {
      expect(solutionId).toBe('SO0103');
      expect(solutionUUID).toBe('2820b493-864c-4ca1-99d3-7174fef7f374');
      expect(metricsURL).toBe('https://example.com');
    })
  }),
  { virtual: true }
);

jest.mock(
  '../lib/execute_athena_query',
  () => ({
    __esmodule: true,
    executeAthenaQuery: jest.fn().mockImplementation((athenaDB, athenaWorkGroup, queryString) => {
      expect(queryString).toBe('queryString');
      expect(athenaDB).toBe('metrics_db');
      expect(athenaWorkGroup).toBe('AWSDevOpsDashboardWG-2820b493-864c-4ca1-99d3-7174fef7f374');
    })
  }),
  { virtual: true }
);

jest.mock(
  '../build_athena_query',
  () => ({
    __esmodule: true,
    buildAddAthenaPartitionQuery: jest.fn().mockImplementation((athenaDB, athenaTable) => {
      expect(athenaDB).toBe('metrics_db');
      expect(athenaTable).toBe('metrics_table');
      return 'queryString';
    })
  }),
  { virtual: true }
);

jest.mock(
  '../lib/cfn',
  () => ({
    __esmodule: true,
    send: jest.fn().mockReturnValue({})
  }),
  { virual: true }
);

jest.mock(
  'aws-sdk',
  () => ({
    __esmodule: true,
    Glue: jest.fn().mockImplementation(options => {
      expect(options.customUserAgent).toBe('/AwsSolutions/SO0103/v1.2.0');
      return {
        deletePartition: jest.fn().mockImplementation(data => {
          expect(data.DatabaseName).toBe('metrics_db');
          expect(data.TableName).toBe('metrics_table');
          const date = new Date();
          const expectedDate = date.toISOString().substring(0, 10);
          expect(data.PartitionValues[0]).toBe(expectedDate);
          return {
            promise: jest.fn().mockImplementation(() => Promise.resolve({}))
          };
        })
      };
    })
  }),
  { virual: true }
);

describe('Test index', () => {
  test('handle Create', async () => {
    await index.handler(
      {
        ResourceType: 'Custom::QueryRunner',
        RequestType: 'Create',
        ResourceProperties: queryResourceProperties
      },
      {}
    );
  });
  test('handle Update', async () => {
    await index.handler(
      {
        ResourceType: 'Custom::QueryRunner',
        RequestType: 'Update',
        ResourceProperties: queryResourceProperties
      },
      {}
    );
  });
  test('handle Delete', async () => {
    await index.handler(
      {
        ResourceType: 'Custom::QueryRunner',
        RequestType: 'Delete',
        ResourceProperties: queryResourceProperties
      },
      {}
    );
  });
  test ('send anonymous usage metrics', async () => {
    const response = await index.handler(
      {
        ResourceType: 'Custom::SendAnonymousUsageData',
        RequestType: 'Create',
        ResourceProperties: usageResourceProperties
      },
      {}
    );
  });
});
