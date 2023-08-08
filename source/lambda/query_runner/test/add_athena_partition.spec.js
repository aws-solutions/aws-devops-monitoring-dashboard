// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const add_athena_partition = require('../add_athena_partition');

jest.mock(
  'aws-sdk',
  () => ({
    __esmodule: true,
    CloudWatch: jest.fn().mockReturnValue({
      getMetricStatistics: jest.fn().mockImplementation(data => {
        console.log('inside the cloudwatch getMetricsStatistics method');
        expect(data['Namespace']).toBe('AWS/Athena');
        expect(data['Dimensions'][0]['Name']).toBe('QueryState');
        expect(data['Dimensions'][0]['Value']).toBe('SUCCEEDED');
        expect(data['Dimensions'][1]['Name']).toBe('QueryType');
        expect(data['Dimensions'][1]['Value']).toBe('DML');
        expect(data['Dimensions'][2]['Name']).toBe('WorkGroup');
        expect(data['Dimensions'][2]['Value']).toBe('AWSDevOpsDashboardWG-2820b493-864c-4ca1-99d3-7174fef7f374');
      })
    }),

    Athena: jest.fn().mockImplementation(options => {})
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

describe('Test suite for add athena partition.', () => {
  test('add partition', async () => {
    await add_athena_partition.handler();
  });
});
