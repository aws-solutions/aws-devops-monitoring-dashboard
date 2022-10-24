// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch events from AWS CodeDeploy
 */

const TransformCodeDeployEvents = (data, recordNumber) => {
  LOGGER.log('INFO', 'Start transforming CodeDeploy CW Event ' + recordNumber.toString());

  let detailData = {};
  let transformedRecord = {};
  let transformedDetail = {};

  //Process event data
  for (let key in data) {
    //Keep all key values that are not under detail tag and are common in all cloudwatch events
    if (key !== 'detail') {
      if (key !== 'detail-type') transformedRecord[key] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;
      //rename key detail-type to detail_type to support athena query
      else transformedRecord['detail_type'] = !transformedRecord.hasOwnProperty(key) ? data[key] : null;
    }
    //process key values under detail tag that are specific only for this event
    else {
      detailData = data['detail'];
      transformedDetail['deploymentState'] = detailData.hasOwnProperty('state') ? detailData['state'] : '';

      // filter out deployments that are not completed
      if (transformedDetail['deploymentState'] !== 'SUCCESS' && transformedDetail['deploymentState'] !== 'FAILURE')
        return {};

      transformedDetail['deploymentId'] = detailData.hasOwnProperty('deploymentId') ? detailData['deploymentId'] : '';
      transformedDetail['deploymentApplication'] = detailData.hasOwnProperty('application')
        ? detailData['application']
        : '';
    } //end else
  } //end for loop

  transformedRecord['detail'] = transformedDetail;

  LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
  LOGGER.log('INFO', 'End transforming CodeDeploy CW Event ' + recordNumber.toString());

  return transformedRecord;
};

module.exports = {
  transformCodeDeployEvents: TransformCodeDeployEvents
};
