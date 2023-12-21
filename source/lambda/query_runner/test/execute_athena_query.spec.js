// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';


const executeQuery = require('../lib/execute_athena_query');

const dbName = "metrics_db"
const workGroup = "AWSDevOpsDashboardWG-2820b493-864c-4ca1-99d3-7174fef7f374"
const queryString = "select 1 from metrics_db.table"

jest.mock(
  '@aws-sdk/client-athena',
  () => {
    const mockAthenaService = {
      startQueryExecution: jest.fn().mockReturnThis(),
      promise: jest.fn()
    };
    return {
      __esmodule: true,
      Athena: jest.fn(() => mockAthenaService),
    };
  },
  { virual: true }
);

describe('Test executing athena query.', () => {
  it('should successfully execute Athena query', async () => {
    const response = await executeQuery.executeAthenaQuery(
        dbName,
        workGroup,
        queryString
    );
    expect(response).not.toBeNull();
  });
});
