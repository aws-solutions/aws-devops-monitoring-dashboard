// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch events from AWS CodeCommit
 */

let TransformCodeCommitEvents = (data, recordNumber) => {
  LOGGER.log('INFO', 'Start transforming CodeCommit CW Event ' + recordNumber.toString());

  let detailData = {};
  let requestParametersData = {};
  let responseElementsData = {};
  let transformedRecord = {};
  let transformedDetail = {};

  //Process event data
  for (let key in data) {
    //Keep all key values that are not under detail tag as they are common in all cloudwatch events
    if (key !== 'detail') {
      if (!transformedRecord.hasOwnProperty(key)) {
        if (key !== 'detail-type') transformedRecord[key] = data[key];
        //rename key detail-type to detail_type to support athena query
        else transformedRecord['detail_type'] = data[key];
      }
    }
    //process key values under detail tag that are specific only for this event
    else {
      detailData = data['detail'];
      if (detailData.hasOwnProperty('eventName')) transformedDetail['eventName'] = detailData['eventName'];

      //process commits made from command line git commands
      if (detailData.hasOwnProperty('userIdentity') && detailData['userIdentity'] != null) {
        let userIdentity = detailData['userIdentity'];
        if (userIdentity['userName'] != null) transformedDetail['authorName'] = userIdentity['userName'];
      }

      //process commits made from aws codecommit console
      if (detailData.hasOwnProperty('requestParameters') && detailData['requestParameters'] != null) {
        requestParametersData = detailData['requestParameters'];
        if (requestParametersData.hasOwnProperty('repositoryName'))
          transformedDetail['repositoryName'] = requestParametersData['repositoryName'];
        if (requestParametersData.hasOwnProperty('branchName'))
          transformedDetail['branchName'] = requestParametersData['branchName'];
        if (requestParametersData.hasOwnProperty('name'))
          transformedDetail['authorName'] = requestParametersData['name'];
        if (requestParametersData.hasOwnProperty('commitId'))
          transformedDetail['commitId'] = requestParametersData['commitId'];
      }
      // If requestParameters is not found in source data,  stop further processing but return empty json object to drop this record
      else {
        return {};
      }

      //process commits made from aws codecommit console
      if (detailData.hasOwnProperty('responseElements') && detailData['responseElements'] != null) {
        responseElementsData = detailData['responseElements'];
        if (!transformedDetail.hasOwnProperty('commitId') && responseElementsData.hasOwnProperty('commitId'))
          transformedDetail['commitId'] = responseElementsData['commitId'];
      }

      //process commits made from command line git commands
      if (Object.keys(requestParametersData).length > 0 && requestParametersData.hasOwnProperty('references')) {
        let references = requestParametersData['references'][0];
        if (references.hasOwnProperty('commit') && !transformedDetail.hasOwnProperty('commitId'))
          transformedDetail['commitId'] = references['commit'];
        if (references.hasOwnProperty('ref') && !transformedDetail.hasOwnProperty('branchName'))
          transformedDetail['branchName'] = references['ref'].split('/').pop();
      }

      //process commits made from command line git commands
      if (detailData.hasOwnProperty('additionalEventData')) {
        let additionalEventData = detailData['additionalEventData'];
        if (additionalEventData.hasOwnProperty('repositoryName') && !transformedDetail.hasOwnProperty('repositoryName'))
          transformedDetail['repositoryName'] = additionalEventData['repositoryName'];
      }

      // if no commit Id (possibly due to codecommit error or other reasons), return empty json object to drop this record
      if (!transformedDetail.hasOwnProperty('commitId')) {
        return {};
      }
    } //end else
  } //end for loop

  transformedRecord['detail'] = transformedDetail;

  LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
  LOGGER.log('INFO', 'End transforming CodeCommit CW Event ' + recordNumber.toString());

  return transformedRecord;
};

module.exports = {
  transformCodeCommitEvents: TransformCodeCommitEvents
};
