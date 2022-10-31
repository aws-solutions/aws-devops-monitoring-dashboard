// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const LOGGER = new (require('./logger'))();

const userAgentExtra = process.env.UserAgentExtra;
const options = userAgentExtra ? { customUserAgent: userAgentExtra } : {};
const eventBridge = new AWS.EventBridge(options);

/**
 * Add permission to allow the specified AWS account or AWS organization to put events to the specified event bus
 * @param principalType
 * @param principal
 * @param eventBusName
 */
const PutPermission = async (principalType, principal, eventBusName) => {
  try {
    LOGGER.log('INFO', `[PutPermission] Start putting permission on event bus ${eventBusName} for ${principal}.`);

    let params = {
      Action: 'events:PutEvents',
      EventBusName: eventBusName,
      StatementId: principal
    };

    if (principalType === 'Account') {
      params = { ...params, Principal: principal };
    }
    // When principal type is AWS Organization, add a condition to grant permission to all the accounts within the organization.
    else {
      params = {
        ...params,
        Principal: '*',
        Condition: {
          Key: 'aws:PrincipalOrgID',
          Type: 'StringEquals',
          Value: principal
        }
      };
    }

    const response = await eventBridge.putPermission(params).promise();

    LOGGER.log('DEBUG', `[PutPermission] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[PutPermission] End putting permission on event bus.');

    return response;
  } catch (err) {
    LOGGER.log('ERROR', `[PutPermission]Error when putting permission on event bus: ${err.message}`);
    throw err;
  }
};

/**
 * Remove permission that allows the specified AWS account or AWS organization to put events to the specified event bus
 * @param principal
 * @param eventBusName
 */
const RemovePermission = async (principal, eventBusName) => {
  try {
    LOGGER.log('INFO', `[RemovePermission] Start removing permission from event bus ${eventBusName} for ${principal}.`);

    let params = {
      EventBusName: eventBusName,
      StatementId: principal,
      RemoveAllPermissions: false
    };

    const response = await eventBridge.removePermission(params).promise();

    LOGGER.log('DEBUG', `[RemovePermission] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[RemovePermission] END removing permission from event bus.');

    return response;
  } catch (err) {
    if (err.code !== 'ResourceNotFoundException') {
      LOGGER.log('ERROR', `[RemovePermission] Error when removing permission from event bus: ${err.message}`);
      throw err;
    }
  }
};

/**
 * Displays details about an event bus, including name, ARN, policy, etc.
 * @param eventBusName
 */
const DescribeEventBus = async eventBusName => {
  try {
    LOGGER.log('DEBUG', `[DescribeEventBus] Start describing event bus ${eventBusName}.`);

    const params = {
      Name: eventBusName
    };

    const response = await eventBridge.describeEventBus(params).promise();

    LOGGER.log('INFO', `[DescribeEventBus] Response: ${JSON.stringify(response)}`);
    LOGGER.log('DEBUG', '[DescribeEventBus] End describing event bus.');

    return response;
  } catch (err) {
    LOGGER.log('ERROR', `[DescribeEventBus]Error when describing event bus: ${err.message}`);
    throw err;
  }
};

module.exports = {
  putPermission: PutPermission,
  removePermission: RemovePermission,
  describeEventBus: DescribeEventBus
};
