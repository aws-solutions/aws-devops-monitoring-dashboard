// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const LOGGER = new (require('./logger'))();

let options = {};
const userAgentExtra = process.env.UserAgentExtra;
if (userAgentExtra) {
  options = { customUserAgent: userAgentExtra };
}
const athena = new AWS.Athena(options);

/**
 * Execute Athena Query
 * @param dbName
 * @param workGroup
 * @param queryString
 */
const ExecuteAthenaQuery = async (dbName, workGroup, queryString) => {
  try {
    LOGGER.log('INFO', '[ExecuteAthenaQuery] Start');

    const params = {
      QueryString: queryString.toString(),
      QueryExecutionContext: { Database: dbName },
      WorkGroup: workGroup
    };

    LOGGER.log('INFO', 'Query params: ' + JSON.stringify(params, null, 2));
    LOGGER.log('INFO', 'Query string: \n' + queryString.toString());

    const response = await athena.startQueryExecution(params).promise();
    const queryExecutionId = response.QueryExecutionId;

    LOGGER.log('INFO', '[ExecuteAthenaQuery] response: ' + JSON.stringify(response));
    LOGGER.log('INFO', '[ExecuteAthenaQuery] queryExecutionId: ' + queryExecutionId);
    LOGGER.log('INFO', '[ExecuteAthenaQuery] END');

    return queryExecutionId;
  } catch (err) {
    LOGGER.log('ERROR', err);
  }
};

module.exports = {
  executeAthenaQuery: ExecuteAthenaQuery
};
