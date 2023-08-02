// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const manageBucketPolicy = require('../manage_s3_bucket_policy');

const accountPrincipalType = 'Account';
const accountPrincipalList = ['111111111111', '222222222222'];
const orgPrincipalType = 'Organization';
const orgPrincipalList = ['o-xxxxxxxx', 'o-yyyyyyyy'];
const bucketName = 'testBucketName';
const multiAcctBucketPSID = 'testAccount1';

const existingPS = [{
    Sid: "testAccount1",
    Effect: "Allow",
    Principal: {
      AWS: "testAccount1"
    },
    Action: "s3:GetBucketLocation",
    Resource: "arn:aws:s3:::bucket"
  },
  {
    Sid: "testAccount2",
    Effect: "Allow",
    Principal: {
      AWS: "testAccount2"
    },
    Action: "s3:GetBucketLocation",
    Resource: "arn:aws:s3:::bucket"
}];

const newPS = [{
  Sid: "testAccount1",
  Effect: "Allow",
  Principal: {
		AWS: "testAccount"
  },
  Action: "s3:GetBucketLocation",
  Resource: "arn:aws:s3:::bucket"
}];

jest.mock(
  '../lib/s3_bucket_policy',
  () => ({
    __esmodule: true,
    getS3BucketPolicy: jest.fn().mockReturnValue(existingPS),
    putS3BucketPolicy: jest.fn().mockReturnThis(),
    deleteS3BucketPolicy: jest.fn().mockReturnThis(),
    promise: jest.fn()
  }),
  { virual: true }
);

describe('Test managing s3 bucket policy', () => {
  it('should successfully put s3 bucket policy', async () => {
    const response = await manageBucketPolicy.putS3BucketPolicy(
        accountPrincipalType,
        accountPrincipalList,
        bucketName,
        multiAcctBucketPSID
    );
    expect(response).not.toBeNull();
  });
  it('should successfully get s3 bucket policy', async () => {
    const response = await manageBucketPolicy.getExistingS3BucketPolicy(bucketName);
    expect(response).not.toBeNull();
  });
  it('should successfully build s3 bucket policy statement', async () => {
    const response = await manageBucketPolicy.buildMultiAcctS3BucketPolicyStatement(
        orgPrincipalType,
        orgPrincipalList,
        bucketName,
        multiAcctBucketPSID
    );
    expect(response).not.toBeNull();
  });
  it('should successfully add s3 bucket policy statement', async () => {
    const response = await manageBucketPolicy.addMultiAcctBucketPolicyStatement(
        existingPS,
        newPS,
        multiAcctBucketPSID
    );
    expect(response).not.toBeNull();
  });
});
