// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./logger'))();
const AWS = require('aws-sdk');

const options = {
  customUserAgent: process.env.userAgentExtra
};
const secretsManager = new AWS.SecretsManager(options);

const secretMap = new Map();

/**
 * Retrieve the secret with the provided secretId. Returns the secret or undefined if one isn't found.
 * @param {string} secretId - the ID of the secret to retrieve
 * @returns The SecretString if found, otherwise undefined
 */
const getSecret = async secretId => {
  if (secretMap.has(secretId)) {
    return secretMap.get(secretId);
  }

  const params = {
    SecretId: secretId
  };
  let secret;

  try {
    const response = await secretsManager.getSecretValue(params).promise();
    secret = response.SecretString;
    secretMap.set(secretId, secret);
  } catch (error) {
    LOGGER.log('ERROR', `Error when retrieving secret. ${error.message}`);
  }

  return secret;
};

module.exports = {
  getSecret: getSecret
};
