// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch events from AWS Synthetic Canary Alarm
 */

const TransformSyntheticCanaryAlarmEvents = (data, recordNumber) => {
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
      if (key !== 'detail-type') transformedRecord[key] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;
      //rename key detail-type to detail_type to support athena query
      else transformedRecord['detail_type'] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;
    }
    //process key values under detail tag that are specific only to current event
    else {
      detailData = data['detail'];

      // extract current state data from alarm name
      const currentState = detailData['state'];
      transformedDetail['canaryAlarmCurrState'] = currentState['value'];
      transformedDetail['canaryAlarmCurrStateTimeStamp'] = //convert to Athena's timestamp format: yyyy-mm-ddThh:mm:ssZ
        currentState.hasOwnProperty('timestamp')
          ? new Date(currentState['timestamp']).toISOString().substring(0, 19) + 'Z'
          : '';

      // extract previous state data from alarm name
      const previousState = detailData['previousState'];
      transformedDetail['canaryAlarmPrevState'] = previousState['value'];
      transformedDetail['canaryAlarmPrevStateTimeStamp'] = //convert to Athena's timestamp format: yyyy-mm-ddThh:mm:ssZ
        previousState.hasOwnProperty('timestamp')
          ? new Date(previousState['timestamp']).toISOString().substring(0, 19) + 'Z'
          : '';

      // get MTTR canary alarm name: SolutionId-[AppName]-[RepoName]-MTTR
      const alarmName = detailData['alarmName'];
      transformedDetail['canaryAlarmName'] = alarmName;

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

      // extract namespace as alarm type
      const alarmType = detailData['configuration']['metrics'][0]['metricStat']['metric']['namespace'];
      transformedDetail['alarmType'] = alarmType === 'CloudWatchSynthetics' ? 'Canary' : 'CodePipeline';

      // calculate recovery duration minutes
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
    } //end else
  } //end for loop

  transformedRecord['detail'] = transformedDetail;

  LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
  LOGGER.log('INFO', 'End transforming Synthetic Canary Alarm CW Event ' + recordNumber.toString());

  return transformedRecord;
};

module.exports = {
  transformSyntheticCanaryAlarmEvents: TransformSyntheticCanaryAlarmEvents
};
