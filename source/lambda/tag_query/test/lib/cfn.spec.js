// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');
const cfn = require('../../lib/cfn.js');

const event = {
  LogicalResourceId: 'testLRId',
  StackId: 'testStackId',
  RequestId: 'testRequestId',
  ResponseURL: 'http://example.com'
};

const logStreamName = 'testLSName';
const responseData = { status: 200, data: 'testData' };

jest.mock('axios');
axios.put.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

describe('Test sending CFN response', () => {
  it('should call axios.put to send CFN response', async () => {
    await cfn.send(event, logStreamName, responseData);
    expect(axios.put).toHaveBeenCalled();
  });
});
