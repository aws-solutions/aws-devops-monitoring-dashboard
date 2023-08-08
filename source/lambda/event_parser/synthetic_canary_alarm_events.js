// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch events from AWS Synthetic Canary Alarm
 */

const transformSyntheticCanaryAlarmEvents = (data, recordNumber) => {
  LOGGER.log('INFO', 'Start transforming Synthetic Canary Alarm CW Event ' + recordNumber.toString());

  let detailData = {};
  let transformedRecord = {};
  let transformedDetail = {};

  // If it is NOT the alarm for calculating MTTR used by the solution, stop processing but return empty record
  const resources = data.hasOwnProperty('resources') ? data['resources'].toString() : '';
  if (resources.indexOf(process.env.SOLUTION_ID) === -1 && resources.indexOf('-MTTR') === -1) {
    return transformedRecord;
  }

  //Process event data
  for (let key in data) {
    //Keep key values that are not under detail tag (common in all cloudwatch events)
    if (key !== 'detail') {
      transformedRecord = getCWEventCommonData(key, data, transformedRecord);
    }
    //process key values under detail tag that are specific only to current event
    else {
      detailData = data['detail'];
      transformedDetail = getCWAlarmDetailData(detailData, transformedDetail);
    } //end else
  } //end for loop

  transformedRecord['detail'] = transformedDetail;

  LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
  LOGGER.log('INFO', 'End transforming Synthetic Canary Alarm CW Event ' + recordNumber.toString());

  return transformedRecord;
};

/**
 * Keep all key values that are not under detail tag as they are common in all cloudwatch events
 * @param {string} key - key in the CloudWatch alarm alarm raw event
 * @param {json} data - CloudWatch alarm raw event
 * @param {json} transformedRecord - Record transformed from cw alarm raw event
 */
const getCWEventCommonData = (key, data, transformedRecord) => {
  if (key !== 'detail-type') transformedRecord[key] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;
  //rename key detail-type to detail_type to support athena query
  else transformedRecord['detail_type'] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;

  return transformedRecord;
};

/**
 * Process key values under detail tag that are specifically for this event
 * @param {json} detailData - CloudWatch alarm raw event data under detail key
 * @param {json} transformedDetail - Transformed record under detail key in CloudWatch alarm raw event
 */
const getCWAlarmDetailData = (detailData, transformedDetail) => {
  transformedDetail = getAlarmState(detailData, transformedDetail)

  // get MTTR alarm name: SolutionId-[AppName]-[RepoName]-MTTR
  const alarmName = detailData['alarmName'];
  transformedDetail['canaryAlarmName'] = alarmName;

  // extract application and repository name from alarm name
  transformedDetail = extractDataFromAlarmName(alarmName, transformedDetail)

  // extract alarm type from namespace
  const alarmType = detailData['configuration']['metrics'][0]['metricStat']['metric']['namespace'];
  transformedDetail['alarmType'] = alarmType === 'CloudWatchSynthetics' ? 'Canary' : 'CodePipeline';

  // calculate recovery duration minutes
  transformedDetail = calculateRecoveryTime(transformedDetail);

  return transformedDetail;
};

/**
 * Get current and previous alarm state data
 * @param {json} detailData - CloudWatch alarm raw event data under detail key
 * @param {json} transformedDetail - Transformed record under detail key in CloudWatch alarm raw event
 */
const getAlarmState = (detailData, transformedDetail) => {
  // extract current state data
  const currentState = detailData['state'];
  transformedDetail['canaryAlarmCurrState'] = currentState['value'];
  transformedDetail['canaryAlarmCurrStateTimeStamp'] = //convert to Athena's timestamp format: yyyy-mm-ddThh:mm:ssZ
    currentState.hasOwnProperty('timestamp')
      ? new Date(currentState['timestamp']).toISOString().substring(0, 19) + 'Z'
      : '';

  // extract previous state data
  const previousState = detailData['previousState'];
  transformedDetail['canaryAlarmPrevState'] = previousState['value'];
  transformedDetail['canaryAlarmPrevStateTimeStamp'] = //convert to Athena's timestamp format: yyyy-mm-ddThh:mm:ssZ
    previousState.hasOwnProperty('timestamp')
      ? new Date(previousState['timestamp']).toISOString().substring(0, 19) + 'Z'
      : '';

  return transformedDetail;
};

/**
 * Extract application and repository name from alarm name
 * @param {string} alarmName - CloudWatch alarm name
 * @param {json} transformedDetail - Transformed record under detail key in CloudWatch alarm raw event
 */
const extractDataFromAlarmName = (alarmName, transformedDetail) => {
  // extract application name from alarm name
  let startIndex = alarmName.indexOf('[');
  let endIndex = alarmName.indexOf(']');
  transformedDetail['canaryAlarmAppName'] =
    startIndex !== -1 && endIndex !== -1 ? alarmName.substring(startIndex + 1, endIndex) : '';

  // extract repository name from alarm name
  startIndex = alarmName.lastIndexOf('[');
  endIndex = alarmName.lastIndexOf(']');
  transformedDetail['canaryAlarmRepoName'] =
    startIndex !== -1 && endIndex !== -1 ? alarmName.substring(startIndex + 1, endIndex) : '';

  return transformedDetail;
};

/**
 * Calculate recovery duration minutes
 * @param {json} transformedDetail - Transformed record under detail key in CloudWatch alarm raw event
 */
const calculateRecoveryTime = (transformedDetail) => {
  let durationMinutes = -1;
  if (
    transformedDetail['canaryAlarmCurrStateTimeStamp'].length > 0 &&
    transformedDetail['canaryAlarmPrevStateTimeStamp'].length > 0
  ) {
    const startTime = new Date(transformedDetail['canaryAlarmPrevStateTimeStamp']);
    const endTime = new Date(transformedDetail['canaryAlarmCurrStateTimeStamp']);
    const difference = endTime.getTime() - startTime.getTime(); // This will give difference in milliseconds
    durationMinutes = Math.round(difference / 60000);
  }
  transformedDetail['recoveryDurationMinutes'] = durationMinutes;

  return transformedDetail;
};

module.exports = {
  transformSyntheticCanaryAlarmEvents: transformSyntheticCanaryAlarmEvents
};
