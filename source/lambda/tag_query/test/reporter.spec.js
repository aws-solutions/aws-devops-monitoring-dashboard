// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const STS = require('aws-sdk/clients/sts');
const { ResourceTypes, CodeBuildResourceInfo, TagConfig } = require('../lib/resource_info');
const { Reporter } = require('../reporter');

jest.mock('aws-sdk', () => ({
  __esmodule: true,
  S3: jest.fn()
}));

jest.mock('aws-sdk/clients/sts');
STS.mockImplementation(() => ({
  getCallerIdentity: () => ({
    promise: () => ({
      Account: '111111111111',
      Arn: 'arn:aws:iam::111111111111/root'
    })
  })
}));

const mockPutObject = jest.fn().mockImplementation(() => ({
  promise: () => ({})
}));

AWS.S3.mockImplementation(() => ({ putObject: mockPutObject }));

beforeEach(() => {
  process.env.AWS_REGION = 'us-east-1';
});

describe('Test Reporter', () => {
  test('constructor', () => {
    new Reporter('a_bucket');
  });

  test('upload report', async () => {
    const bucket = 'bucket_name';
    const filter = 'tag_key,tag_value;another_key,another_value';
    const reporter = new Reporter(bucket, [new TagConfig(ResourceTypes.CodeBuildProject, filter)]);
    const resource = new CodeBuildResourceInfo(
      'arn:aws:codebuild:us-east-1:111111111111:project/test-project',
      [
        { Key: 'tag_key', Value: 'tag_value' },
        { Key: 'another_key', Value: 'another_value' }
      ],
      filter
    );
    await reporter.addResource(resource);
    await reporter.uploadReports();
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    const expectedKey = `TaggedResources/CodeBuild/111111111111_us-east-1_project_tagged.json`;
    expect(mockPutObject).toHaveBeenCalledWith({ Bucket: bucket, Key: expectedKey, Body: expect.anything() });
    const expectedBody = {
      account_id: '111111111111',
      region: 'us-east-1',
      resource_type: 'project',
      resource_name: 'test-project',
      tag: filter,
      create_time_stamp: expect.anything()
    };
    const actualBody = JSON.parse(mockPutObject.mock.calls[0][0].Body);
    expect(actualBody).toStrictEqual(expectedBody);
    const timestamp = actualBody.create_time_stamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  });
});
