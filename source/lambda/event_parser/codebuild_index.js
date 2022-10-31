// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const codeBuildMetrics = require('./codebuild_metrics');

/**
 * Transform AWS CloudWatch metrics
 * @param event
 * @param context
 * @param callback
 */
exports.handler = async (event, context, callback) => {
  let recordTotalCount = event.records.length;
  let recordCount = 0;
  let droppedCount = 0;

  LOGGER.log('INFO', 'Total incoming source events : ' + recordTotalCount.toString());

  const output = event.records.map(record => {
    try {
      const sourceData = Buffer.from(record.data, 'base64').toString('utf8');

      recordCount++;

      LOGGER.log('INFO', 'Decoded source event ' + recordCount.toString() + ': ' + sourceData);

      const transformedRecordString = codeBuildMetrics.transformCodeBuildCWMetrics(sourceData, recordCount);

      // Drop record and notify as needed
      if (transformedRecordString.length === 0) {
        droppedCount++;
        LOGGER.log('INFO', 'Drop event ' + recordCount.toString());
        return {
          recordId: record.recordId,
          result: 'Dropped',
          data: record.data
        };
      }

      LOGGER.log('INFO', 'Transformed event ' + recordCount.toString() + ': ' + transformedRecordString);

      return {
        recordId: record.recordId,
        result: 'Ok',
        data: new Buffer.from(transformedRecordString).toString('base64')
      };
    } catch (err) {
      LOGGER.log('WARN', 'Processing record ' + recordTotalCount.toString() + ' failed. Error: ' + err.message);
    }
  });

  LOGGER.log('INFO', 'Processed ' + recordTotalCount.toString() + ' event(s).');
  LOGGER.log('INFO', 'Dropped ' + droppedCount.toString() + ' event(s).');
  LOGGER.log('DEBUG', 'Payload for AWS Kinesis Data Firehose: ' + JSON.stringify(output, null, 2));

  callback(null, { records: output });
};
