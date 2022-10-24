// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const codeCommitEvents = require('./codecommit_events');
const synCanaryAlarmEvents = require('./synthetic_canary_alarm_events');
const codeDeployEvents = require('./codedeploy_events');
const codePipelineEvents = require('./codepipeline_events');

/**
 * Transform AWS CloudWatch event data
 * @param event
 * @param context
 * @param callback
 */
exports.handler = async (event, context, callback) => {
  /* Process the list of records and transform them */
  let recordTotalCount = event.records.length;
  let recordCount = 0;
  let droppedCount = 0;
  let transformedRecord = {};

  LOGGER.log('INFO', 'Total incoming source events : ' + recordTotalCount.toString());

  const output = event.records.map(record => {
    try {
      const sourceData = Buffer.from(record.data, 'base64').toString('utf8');

      recordCount++;

      LOGGER.log('INFO', 'Decoded source event ' + recordCount.toString() + ': ' + sourceData);

      const parsedData = JSON.parse(sourceData);

      // Transform codecommit cloudwatch events data
      if (parsedData['source'] === 'aws.codecommit') {
        transformedRecord = codeCommitEvents.transformCodeCommitEvents(parsedData, recordCount);
      }
      // Transform synthetic canary alarm cloudwatch events data
      else if (parsedData['source'] === 'aws.cloudwatch') {
        transformedRecord = synCanaryAlarmEvents.transformSyntheticCanaryAlarmEvents(parsedData, recordCount);
      }
      // Transform codedeploy cloudwatch events data
      else if (parsedData['source'] === 'aws.codedeploy') {
        transformedRecord = codeDeployEvents.transformCodeDeployEvents(parsedData, recordCount);
      } else if (parsedData['source'] === 'aws.codepipeline') {
        transformedRecord = codePipelineEvents.transformCodePipelineEvents(parsedData, recordCount);
      }
      // Drop record and notify as needed
      if (Object.keys(transformedRecord).length === 0) {
        droppedCount++;
        LOGGER.log('INFO', 'Drop event ' + recordCount.toString());
        return {
          recordId: record.recordId,
          result: 'Dropped',
          data: record.data
        };
      }

      LOGGER.log(
        'INFO',
        'Transformed event ' + recordCount.toString() + ': ' + JSON.stringify(transformedRecord, null, 2)
      );

      let transformedRecordString = JSON.stringify(transformedRecord);

      //add new line break between records
      if (recordCount < recordTotalCount) transformedRecordString = transformedRecordString + '\n';

      return {
        recordId: record.recordId,
        result: 'Ok',
        data: new Buffer.from(transformedRecordString).toString('base64')
      };
    } catch (err) {
      LOGGER.log('INFO', 'Processing record ' + recordTotalCount.toString() + ' failed. Error: ' + err.message);
    }
  });

  LOGGER.log('INFO', 'Processed ' + recordTotalCount.toString() + ' event(s).');
  LOGGER.log('INFO', 'Dropped ' + droppedCount.toString() + ' event(s).');
  LOGGER.log('DEBUG', 'Payload for AWS Kinesis Firehose: ' + JSON.stringify(output, null, 2));

  callback(null, { records: output });
};
