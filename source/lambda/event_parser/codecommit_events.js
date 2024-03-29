// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch events from AWS CodeCommit
 */

let transformCodeCommitEvents = (data, recordNumber) => {
  LOGGER.log('INFO', 'Start transforming CodeCommit CW Event ' + recordNumber.toString());

  let detailData = {};
  let requestParametersData = {};
  let transformedRecord = {};
  let transformedDetail = {};

  //Process event data
  for (let key in data) {
    //Keep all key values that are not under detail tag as they are common in all cloudwatch events
    if (key !== 'detail') {
      transformedRecord = getCWEventCommonData(key, data, transformedRecord);
    }
    //process key values under detail tag that are specific only for this event
    else {
      detailData = data['detail'];
      transformedDetail = getEventName(detailData, transformedDetail);
      transformedDetail = getCommandLineGitCommitData(detailData, transformedDetail);
      const consoleGitCommitData = getCodeCommitConsoleGitCommitData(detailData, transformedDetail, requestParametersData);
      // If empty json object is found, stop further processing but return empty json object to drop this record
      if (Object.keys(consoleGitCommitData[0]).length === 0) return {};
      requestParametersData = consoleGitCommitData[0];
      transformedDetail = consoleGitCommitData[1];
      transformedDetail = getCodeCommitConsoleCommitID(detailData, transformedDetail);
      transformedDetail = getCommandLineGitCommitAdditionalData(detailData, transformedDetail, requestParametersData);

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

/**
 * Keep all key values that are not under detail tag as they are common in all cloudwatch events
 * @param {string} key - key in the CodeCommit CloudWatch raw event
 * @param {json} data - CodeCommit CloudWatch raw event
 * @param {json} transformedRecord - Transformed CodeCommit record
 */
const getCWEventCommonData = (key, data, transformedRecord) => {
  if (!transformedRecord.hasOwnProperty(key)) {
    if (key !== 'detail-type') transformedRecord[key] = data[key];
    //rename key detail-type to detail_type to support athena query
    else transformedRecord['detail_type'] = data[key];
  }

  return transformedRecord;
};

/**
 * Get eventName from CodeCommit CloudWatch raw event data under detail key
 * @param {json} detailData - CodeCommit CloudWatch raw event data under detail key
 * @param {json} transformedDetail - Transformed CodeCommit record under detail key
 */
const getEventName = (detailData, transformedDetail) => {
  if (detailData.hasOwnProperty('eventName')) transformedDetail['eventName'] = detailData['eventName'];

  return transformedDetail;
};

/**
 * Process commits made from command line git commands
 * @param {json} detailData - CodeCommit CloudWatch raw event data under detail key
 * @param {json} transformedDetail - Transformed CodeCommit record under detail key
 */
const getCommandLineGitCommitData = (detailData, transformedDetail) => {
  if (!detailData['userIdentity']) return transformedDetail;

  let userIdentity = detailData['userIdentity'];
  if (userIdentity['userName'] != null) transformedDetail['authorName'] = userIdentity['userName'];
  //Fix missing userName in codecommit event when pushes are made by assumed role credentials
  else if (userIdentity['sessionContext']['sessionIssuer']['userName'] != null)
    transformedDetail['authorName'] = userIdentity['sessionContext']['sessionIssuer']['userName'];
  else if (userIdentity['principalId'] != null)
    transformedDetail['authorName'] = userIdentity['principalId'].split(':')[1];

  return transformedDetail;
};

/**
 * Process commits made from AWS CodeCommit console
 * @param {json} detailData - CodeCommit CloudWatch raw event data under detail key
 * @param {json} transformedDetail - Transformed CodeCommit record under detail key
 * @param {json} requestParametersData - data under requestParameters key
 */
const getCodeCommitConsoleGitCommitData = (detailData, transformedDetail, requestParametersData) => {
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
    return [requestParametersData, transformedDetail]
  }
  // If requestParameters is not found in source data, return empty json object to drop this record
  else {
    return [{},{}];
  }
}


/**
 * Get commit id for git commit made from AWS CodeCommit console
 * @param {json} detailData - CodeCommit CloudWatch raw event data under detail key
 * @param {json} transformedDetail - Transformed CodeCommit record under detail key
 * @param {json} requestParametersData - data under requestParameters key
 */
const getCodeCommitConsoleCommitID = (detailData, transformedDetail) => {
   //process commits made from aws codecommit console
   let responseElementsData = {}
   if (detailData.hasOwnProperty('responseElements') && detailData['responseElements'] != null) {
    responseElementsData = detailData['responseElements'];
    if (!transformedDetail.hasOwnProperty('commitId') && responseElementsData.hasOwnProperty('commitId'))
      transformedDetail['commitId'] = responseElementsData['commitId'];
  }
  return transformedDetail;
};

/**
 * Extract additional data from commits made from command line git commands
 * @param {json} detailData - CodeCommit CloudWatch raw event data under detail key
 * @param {json} transformedDetail - Transformed CodeCommit record under detail key
 * @param {json} requestParametersData - data under requestParameters key
 */
const getCommandLineGitCommitAdditionalData = (detailData, transformedDetail, requestParametersData) => {
  if (Object.keys(requestParametersData).length > 0 && requestParametersData.hasOwnProperty('references')) {
    let references = requestParametersData['references'][0];
    if (references.hasOwnProperty('commit') && !transformedDetail.hasOwnProperty('commitId'))
      transformedDetail['commitId'] = references['commit'];
    if (references.hasOwnProperty('ref') && !transformedDetail.hasOwnProperty('branchName'))
      transformedDetail['branchName'] = references['ref'].split('/').pop();
  }
  if (detailData.hasOwnProperty('additionalEventData')) {
    let additionalEventData = detailData['additionalEventData'];
    if (additionalEventData.hasOwnProperty('repositoryName') && !transformedDetail.hasOwnProperty('repositoryName'))
      transformedDetail['repositoryName'] = additionalEventData['repositoryName'];
  }
  return transformedDetail;
};

module.exports = {
  transformCodeCommitEvents: transformCodeCommitEvents
};
