// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');

/**
 * Send custom resource response.
 * @param {object} event - Custom resource event
 * @param {string} logStreamName - Custom resource log stream name
 * @param {object} response - Response object { status: "SUCCESS|FAILED", data: any }
 */
async function sendResponse(event, logStreamName, response) {
  const responseBody = JSON.stringify({
    Status: response.status,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
    PhysicalResourceId: logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.data
  });

  console.log(`RESPONSE BODY: ${responseBody}`);

  const config = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  await axios.put(event.ResponseURL, responseBody, config);
}

module.exports = {
  send: sendResponse
};
