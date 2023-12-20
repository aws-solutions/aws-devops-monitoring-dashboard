// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { mockClient } = require('aws-sdk-client-mock');
const { ResourceTypes, CodeBuildResourceInfo, TagConfig } = require('../lib/resource_info');
const { Reporter } = require('../reporter');
require('aws-sdk-client-mock-jest');

beforeEach(() => {
  process.env.AWS_REGION = 'us-east-1';
});

describe('Test Reporter', () => {
  const mockS3Client = mockClient(S3Client);
  const mockSTSClient = mockClient(STSClient);

  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    mockS3Client.reset();
    mockSTSClient.reset();
  });

  test('Validate onstructor', () => {
    const myReporter = new Reporter('a_bucket');
    expect(myReporter._bucket).toEqual('a_bucket');
  });

  test('upload report', async () => {
    const bucket = 'bucket_name';
    const filter = 'tag_key,tag_value;another_key,another_value';
    const expectedKey = `TaggedResources/CodeBuild/111111111111_us-east-1_project_tagged.json`;

    mockS3Client.on(PutObjectCommand).resolves([]);

    mockSTSClient.on(GetCallerIdentityCommand).resolves({
      Account: '111111111111',
      Arn: 'arn:aws:iam::111111111111/root'
    });

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

    const expectedBody = {
      account_id: '111111111111',
      region: 'us-east-1',
      resource_type: 'project',
      resource_name: 'test-project',
      tag: filter,
      create_time_stamp: expect.anything()
    };

    expect(mockS3Client).toHaveReceivedCommandTimes(PutObjectCommand, 1);
    const actualBody = JSON.parse(mockS3Client.call(0)['firstArg']['input']['Body']);
    const actualKey = mockS3Client.call(0)['firstArg']['input']['Key'];

    expect(actualKey).toEqual(expectedKey);
    expect(actualBody).toEqual(expectedBody);
    const timestamp = actualBody.create_time_stamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  });
});
