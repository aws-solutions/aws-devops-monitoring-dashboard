// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const githubAuthorizer = require('./lib/github_authorizer');
const githubEvents = require('./github_events');

/**
 * Transform GitHub Events
 * @param event
 * @param _
 * @param __
 */
exports.handler = async (event, _, __) => {
  let recordTotalCount = event.records.length;
  let droppedCount = 0;

  LOGGER.log('INFO', 'Total incoming source events: ' + recordTotalCount.toString());
  LOGGER.log('DEBUG', 'Source event: ' + JSON.stringify(event));

  const output = await Promise.all(
    event.records.map(async (record, index) => {
      const currentRecord = index + 1;

      try {
        const sourceData = Buffer.from(record.data, 'base64').toString('utf8');

        LOGGER.log('INFO', 'Decoded source data ' + currentRecord.toString() + ': ' + sourceData);

        const parsedData = JSON.parse(sourceData);

        const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(parsedData);

        if (!isAuthorized) {
          droppedCount++;
          LOGGER.log('INFO', `Drop event ${currentRecord.toString()}. GitHub not Authorized.`);
          return {
            recordId: record.recordId,
            result: 'Dropped',
            data: record.data
          };
        }

        const transformedRecord = githubEvents.transformGitHubEvents(parsedData, currentRecord);

        // Drop record and notify as needed
        if (Object.keys(transformedRecord).length === 0) {
          droppedCount++;
          LOGGER.log('INFO', 'Drop event ' + currentRecord.toString());
          return {
            recordId: record.recordId,
            result: 'Dropped',
            data: record.data
          };
        }

        LOGGER.log(
          'INFO',
          'Transformed event ' + currentRecord.toString() + ': ' + JSON.stringify(transformedRecord, null, 2)
        );

        const transformedRecordString = JSON.stringify(transformedRecord);

        return {
          recordId: record.recordId,
          result: 'Ok',
          data: new Buffer.from(transformedRecordString).toString('base64')
        };
      } catch (err) {
        LOGGER.log('ERROR', 'Processing record ' + currentRecord.toString() + ' failed. Error: ' + err.message);
      }
    })
  );

  LOGGER.log('INFO', 'Processed ' + recordTotalCount.toString() + ' event(s).');
  LOGGER.log('INFO', 'Dropped ' + droppedCount.toString() + ' event(s).');
  LOGGER.log('DEBUG', 'Payload for AWS Kinesis Data Firehose: ' + JSON.stringify(output, null, 2));

  return { records: output };
};
