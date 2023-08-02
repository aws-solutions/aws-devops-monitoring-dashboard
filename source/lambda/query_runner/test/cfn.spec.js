// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');
const cfn = require('../lib/cfn.js');

const event = {
  LogicalResourceId: 'testLRId',
  StackId: 'testStackId',
  RequestId: 'testRequestId',
  ResponseURL: 'http://example.com'
};
const context = {logStreamName: 'testLSName'}
const responseData = {Data: 'testData'}
const responseStatus = '200'

jest.mock("axios");
axios.mockImplementation(() => Promise.resolve({status: 200, data:{}}));

describe('Test sending CFN response', () => {
  it('should call axios.put to send CFN response', async () => {
    await cfn.send(event, context, responseStatus, responseData);
    expect(axios).toHaveBeenCalled();
  });
});
