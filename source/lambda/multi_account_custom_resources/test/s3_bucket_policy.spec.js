// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';
const mockS3Service = {
  deleteBucketPolicy: jest.fn(),
  getBucketPolicy: jest.fn(),
};
const s3BucketPolicy = require('../lib/s3_bucket_policy');
const { ServiceException } = require('@smithy/smithy-client');
const bucketName = 'testBucketName';
jest.mock(
  '@aws-sdk/client-s3',
  () => ({
      __esmodule: true,
      S3: jest.fn(() => mockS3Service),
  })
);

describe('Test s3 bucket policy', () => {
  beforeEach(() => {
    mockS3Service.getBucketPolicy.mockReset();
    mockS3Service.deleteBucketPolicy.mockReset();
  });

  it('should delete s3 bucket policy', async () => {
    const response = await s3BucketPolicy.deleteS3BucketPolicy(bucketName);
    expect(response).not.toBeNull();
  });
  it('should return undefined when getting bucket policy that does not exist', async () => {
    const mockError = new ServiceException({name: 'NoSuchBucketPolicy'});
    mockS3Service.getBucketPolicy.mockImplementation(async () => { throw mockError });
    try {
      await s3BucketPolicy.getS3BucketPolicy(bucketName);
    } catch (err) {
      expect(err).toEqual(mockError);
    }
  });
  it('should throw error when deleting bucket policy returns exception other than NoSuchBucketPolicy', async () => {
    const mockError = new ServiceException({name: 'OtherException'});
    mockS3Service.deleteBucketPolicy.mockImplementation(async () => { throw mockError });
    expect(s3BucketPolicy.deleteS3BucketPolicy(bucketName)).rejects.toThrow(mockError);
  });
});

