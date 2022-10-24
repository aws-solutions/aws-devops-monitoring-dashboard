// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const cfn = require('./lib/cfn');
const eventBridge = require('./lib/eventbridge');
const s3BucketPolicy = require('./manage_s3_bucket_policy');

/**
 * Manage multi-account permissions
 * @param event
 * @param context
 */
const handler = async (event, context) => {
  LOGGER.log('INFO', `Event received is ${JSON.stringify(event)}`);

  const resourceType = event.ResourceType;
  const requestType = event.RequestType;
  const resourceProperties = event['ResourceProperties'];

  try {
    // manage permissions
    if (resourceType === 'Custom::MonitoringAcctPermission') {
      await ManagePermission(requestType, resourceProperties, event);
    }

    // send cfn response
    if (requestType === 'Create' || requestType === 'Update' || requestType === 'Delete') {
      const response = {
        status: 'SUCCESS',
        data: {}
      };
      await cfn.send(event, context.logStreamName, response);
    }
  } catch (err) {
    LOGGER.log('ERROR', err);
    if (requestType === 'Create' || requestType === 'Update' || requestType === 'Delete') {
      const response = {
        status: 'FAILED',
        data: { Value: err.message + `\nMore information in CloudWatch Log Stream: ${context.logStreamName}` }
      };
      await cfn.send(event, context.logStreamName, response);
    }
  }
};

/**
 * Manage event bus permissions and s3 bucket policy for Create, Update and Delete request type
 * @param requestType
 * @param resourceProperties
 * @param event
 */
const ManagePermission = async (requestType, resourceProperties, event) => {
  try {
    LOGGER.log('INFO', `[ManagePermission] Start managing permission for request type ${requestType}`);

    const principalType = resourceProperties['PrincipalType'];
    const principalList = resourceProperties['PrincipalList'];
    const eventBusName = resourceProperties['EventBusName'];
    const metricsBucketName = resourceProperties['MetricsBucketName'];
    const multiAcctBucketPSID = `MultiAccountAccess-${resourceProperties['UUID']}`;

    let eventBridgeResponse = {};
    let s3Response = {};

    if (requestType === 'Create') {
      eventBridgeResponse = await AddEventBusPermission(principalType, principalList, eventBusName);
      s3Response = await s3BucketPolicy.putS3BucketPolicy(
        principalType,
        principalList,
        metricsBucketName,
        multiAcctBucketPSID
      );
    } else if (requestType === 'Update') {
      eventBridgeResponse = await UpdateEventBusPermission(principalType, principalList, eventBusName);
      s3Response = await s3BucketPolicy.putS3BucketPolicy(
        principalType,
        principalList,
        metricsBucketName,
        multiAcctBucketPSID
      );
    } else if (requestType === 'Delete') {
      eventBridgeResponse = await DeleteEventBusPermission(principalList, eventBusName);
      s3Response = await s3BucketPolicy.deleteS3BucketPolicy(metricsBucketName, multiAcctBucketPSID);
    }

    LOGGER.log(
      'INFO',
      `[ManagePermission] Response for managing permission on event bus ${eventBusName}: ${JSON.stringify(
        eventBridgeResponse
      )}`
    );
    LOGGER.log(
      'INFO',
      `[ManagePermission] Response for managing bucket policy on s3 bucket ${metricsBucketName}: ${JSON.stringify(
        s3Response
      )}`
    );
    LOGGER.log('INFO', `[ManagePermission] End managing permission for request type ${requestType}`);
  } catch (err) {
    LOGGER.log('ERROR', `Error when managing permission for request type ${requestType}: ${err.message}`);
    throw err;
  }
};

/**
 * Add permission to allow the specified AWS account or AWS organization to put events to the specified event bus
 * @param principalType
 * @param principalList
 * @param eventBusName
 */
const AddEventBusPermission = async (principalType, principalList, eventBusName) => {
  try {
    LOGGER.log('DEBUG', '[AddEventBusPermission] Start adding permission to event bus.');

    let response = {};

    for (const index in principalList) {
      LOGGER.log('DEBUG', `Principal: ${principalList[index]}`);
      response = await eventBridge.putPermission(principalType, principalList[index], eventBusName);
    }

    LOGGER.log('DEBUG', `[AddEventBusPermission] response: ${JSON.stringify(response)}`);
    LOGGER.log('DEBUG', '[AddEventBusPermission] End adding permission to event bus.');
  } catch (err) {
    LOGGER.log('ERROR', `Error when adding permission on event bus: ${err.message}`);
    throw err;
  }
};

/**
 * Remove permission that allows the specified AWS account or AWS organization to put events to the specified event bus
 * @param principalList
 * @param eventBusName
 */
const DeleteEventBusPermission = async (principalList, eventBusName) => {
  try {
    LOGGER.log('DEBUG', '[DeleteEventBusPermission] Start deleting permission from event bus.');

    let response = {};

    for (const index in principalList) {
      LOGGER.log('DEBUG', `Principal: ${principalList[index]}`);
      await eventBridge.removePermission(principalList[index], eventBusName);
    }

    LOGGER.log('DEBUG', `[DeleteEventBusPermission] response: ${JSON.stringify(response)}`);
    LOGGER.log('DEBUG', '[DeleteEventBusPermission] End deleting permission from event bus.');
  } catch (err) {
    LOGGER.log('ERROR', `Error when deleting permission from event bus: ${err.message}`);
    throw err;
  }
};

/**
 * Update permission: add or remove the permission to/from a specified AWS account or AWS organization
 * @param principalType
 * @param principalList
 * @param eventBusName
 * @param event
 */
const UpdateEventBusPermission = async (principalType, principalList, eventBusName) => {
  try {
    LOGGER.log('DEBUG', '[UpdateEventBusPermission] Start updating permission on event bus.');

    let response = {};
    const has = Object.prototype.hasOwnProperty;

    response = await eventBridge.describeEventBus(eventBusName);

    // If no policy exists, go ahead add new policy
    if (!has.call(response, 'Policy') && principalList.length > 0) {
      response = await AddEventBusPermission(principalType, principalList, eventBusName);
    } else {
      const eventBusPolicy = JSON.parse(response['Policy']);
      const oldPrincipalType =
        JSON.stringify(eventBusPolicy).indexOf('aws:PrincipalOrgID') > -1 ? 'Organization' : 'Account';
      const policyStatements = eventBusPolicy['Statement'];

      let oldPrincipalList = [];

      // Traverse policy statements and get principal id (stored as Sid) of each statement
      for (let ps in policyStatements) {
        LOGGER.log('DEBUG', `[UpdateEventBusPermission] ps: ${ps}`);
        LOGGER.log('DEBUG', `[UpdateEventBusPermission] policyStatements['Sid']: ${policyStatements[ps]['Sid']}`);
        if (has.call(policyStatements[ps], 'Sid')) oldPrincipalList.push(policyStatements[ps]['Sid']);
      }

      // When principal type remains the same, remove permission from deleted principals and then add it to new principals as needed.
      if (oldPrincipalType === principalType) {
        const deletePrincipalList = Array.from(GetSetDifference(new Set(oldPrincipalList), new Set(principalList)));
        if (deletePrincipalList.length > 0)
          response = await DeleteEventBusPermission(deletePrincipalList, eventBusName);

        const newPrincipalList = Array.from(GetSetDifference(new Set(principalList), new Set(oldPrincipalList)));
        if (newPrincipalList.length > 0)
          response = await AddEventBusPermission(principalType, newPrincipalList, eventBusName);
      }
      // when principal type is changed, remove all the old permissions and add new ones.
      else {
        if (oldPrincipalList.length > 0) response = await DeleteEventBusPermission(oldPrincipalList, eventBusName);
        if (principalList.length > 0)
          response = await AddEventBusPermission(principalType, principalList, eventBusName);
      }
    }

    LOGGER.log('DEBUG', `[UpdateEventBusPermission] response: ${JSON.stringify(response)}`);
    LOGGER.log('DEBUG', '[UpdateEventBusPermission] End updating permission on event bus.');
  } catch (err) {
    LOGGER.log('ERROR', `Error when updating permission on event bus: ${err.message}`);
    throw err;
  }
};

/**
 * Get difference between two sets
 * @param setA
 * @param setB
 */
const GetSetDifference = (setA, setB) =>
  // Get elements in setA but not in setB
  new Set([...setA].filter(element => !setB.has(element)));

module.exports = {
  handler,
  managePermission: ManagePermission,
  getSetDifference: GetSetDifference
};
