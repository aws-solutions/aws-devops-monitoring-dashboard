// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./logger'))();
const ipHelper = require('./ip_helper');
const secretsManager = require('./secrets_manager');
const crypto = require('crypto');

/**
 * Authorizes a GitHub request from the webhook
 * If a secret is present it is used for authorization. Otherwise, the sending IP address is used.
 * @param {object} request - the Request to authorize
 * @returns true if authorized, false otherwise
 */
const authorizeGitHubRequest = async request => {
  LOGGER.log('INFO', 'Begin authorizing GitHub Request.');
  let isAuthorized = false;

  if (hasHashSignature(request) && process.env.UseSecret === 'no') {
    LOGGER.log(
      'ERROR',
      'Configuration error. GitHub webhook contained a hash but no secret was found in the solution.'
    );
  } else if (process.env.UseSecret === 'yes') {
    const secret = await getGitHubWebhookSecret();

    isAuthorized = secret !== undefined && isValidHash(request, secret);
  } else {
    isAuthorized = isValidIpRange(request);
  }

  isAuthorized ? LOGGER.log('INFO', 'Authorized GitHub request') : LOGGER.log('ERROR', 'Unauthorized GitHub request');
  return isAuthorized;
};

/**
 * Gets the secret
 * @returns The secret as a string
 */
const getGitHubWebhookSecret = async () => secretsManager.getSecret(`${process.env.SolutionID}/GitHubWebhookSecretToken`);

/**
 * Validates the computed hash with the hash from the request
 * @param {object} request - The request object
 * @param {string} secret - The provided secret
 * @returns true if the hashes match, false otherwise
 */
const isValidHash = (request, secret) => {
  let headerHash;

  try {
    headerHash = request['additional-data']['input-parameters']['header']['X-Hub-Signature-256'];
  } catch (err) {
    LOGGER.log('ERROR', 'Missing request headers');
    return false;
  }

  if (headerHash === undefined) {
    LOGGER.log('ERROR', 'Missing GitHub Signature');
    return false;
  }

  const body = JSON.parse(JSON.stringify(request));
  delete body['additional-data'];
  const bodyString = JSON.stringify(body);

  const expectedHash = generateHash(bodyString, secret);

  return compareSignatures(expectedHash, headerHash);
};

/**
 * Hashes the provided data using the provided secret
 * @param {string} value - The value to be hashed
 * @param {string} secret - The secret to use when hashing
 * @returns The result of hashing, prefixed with "sha256="
 */
const generateHash = (value, secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(value).digest('hex');

/**
 * Cryptographically safe comparison of two hashes
 * @param {string} a - the first value to compare
 * @param {string} b - the second value to compare
 * @returns true if hashes match, false otherwise
 */
const compareSignatures = (a, b) => {
  let isEqual = false;

  try {
    isEqual = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (error) {
    LOGGER.log('ERROR', `Compare signatures failed. Error: ${error.message}`);
  }

  return isEqual;
};

/**
 * Validates the IP addresses in the given request object
 * @param {object} request - the request object
 * @returns true if the source IP falls in one of the ranges in allowed IPs, false otherwise
 */
const isValidIpRange = request => {
  let valid = false;

  let sourceIp = request['additional-data']['source-ip'];
  let allowedIpsString = request['additional-data']['allowed-ips'];

  sourceIp = !sourceIp ? sourceIp : sourceIp.trim();
  if (!sourceIp) {
    LOGGER.log('ERROR', 'Missing source-ip');
    return false;
  }

  allowedIpsString = !allowedIpsString ? allowedIpsString : allowedIpsString.replace(/\s/g, '');
  if (!allowedIpsString) {
    LOGGER.log('ERROR', 'Missing allowed-ips');
    return false;
  }

  const allowedIps = allowedIpsString.split(',');

  for (const ipRange of allowedIps) {
    if (ipHelper.isIpInRange(sourceIp, ipRange)) {
      valid = true;
      break;
    }
  }

  return valid;
};

/**
 * Checks the request headers for the signature header
 * @param {object} request - the request object
 * @returns true if the request contains the signature header, false if it does not
 */
const hasHashSignature = request => {
  let foundHash = false;
  try {
    const headerHash = request['additional-data']['input-parameters']['header']['X-Hub-Signature-256'];
    foundHash = !!headerHash;
  } catch (err) {
    foundHash = false;
  }
  return foundHash;
};

module.exports = {
  authorizeGitHubRequest: authorizeGitHubRequest
};
