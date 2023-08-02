// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const s3BucketPolicy = require('../lib/s3_bucket_policy');

const bucketName = 'testBucketName';

jest.mock(
  'aws-sdk',
  () => {
    const mockS3Service = {
      deleteBucketPolicy: jest.fn().mockReturnThis(),
      promise: jest.fn()
    };
    return {
      __esmodule: true,
      S3: jest.fn(() => mockS3Service)
    };
  },
  { virual: true }
);

describe('Test s3 bucket policy', () => {
  it('should delete s3 bucket policy', async () => {
    const response = await s3BucketPolicy.deleteS3BucketPolicy(bucketName);
    expect(response).not.toBeNull();
  });
});

