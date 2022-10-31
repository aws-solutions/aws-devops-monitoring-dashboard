// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const LOGGER = new (require('./logger'))();

const userAgentExtra = process.env.UserAgentExtra;
const options = userAgentExtra ? { customUserAgent: userAgentExtra } : {};
const s3 = new AWS.S3(options);

/**
 * Get s3 bucket policy given a bucket name
 * @param bucketName
 */
const GetS3BucketPolicy = async bucketName => {
  try {
    LOGGER.log('INFO', `[GetS3BucketPolicy] Start getting bucket policy on s3 bucket ${bucketName}`);

    let params = {
      Bucket: bucketName
    };

    const response = await s3.getBucketPolicy(params).promise();

    LOGGER.log('INFO', `[GetS3BucketPolicy] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[GetS3BucketPolicy] END getting s3 bucket policy.');

    return response;
  } catch (err) {
    if (err.code !== 'NoSuchBucketPolicy') {
      LOGGER.log('ERROR', `[GetS3BucketPolicy] Error when getting s3 bucket policy: ${err.message}`);
      throw err;
    }
  }
};

/**
 * Put s3 bucket policy on a bucket
 * @param bucketName
 * @param bucketPolicy
 */
const PutS3BucketPolicy = async (bucketName, bucketPolicy) => {
  try {
    LOGGER.log('INFO', `[PutS3BucketPolicy] Start putting bucket policy ${bucketPolicy} on s3 bucket ${bucketName}.`);

    const params = {
      Bucket: bucketName,
      Policy: bucketPolicy
    };

    const response = await s3.putBucketPolicy(params).promise();

    LOGGER.log('DEBUG', `[PutS3BucketPolicy] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[PutS3BucketPolicy] End putting bucket policy on s3 bucket .');

    return response;
  } catch (err) {
    LOGGER.log('ERROR', `[PutS3BucketPolicy] Error when putting bucket policy on s3 bucket : ${err.message}`);
    throw err;
  }
};

/**
 * Delete s3 bucket policy from a bucket
 * @param bucketName
 */
const DeleteS3BucketPolicy = async bucketName => {
  try {
    LOGGER.log('INFO', `[DeleteS3BucketPolicy] Start deleting bucket policy from s3 bucket ${bucketName}`);

    const params = {
      Bucket: bucketName
    };

    const response = await s3.deleteBucketPolicy(params).promise();

    LOGGER.log('DEBUG', `[DeleteS3BucketPolicy] Response: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[DeleteS3BucketPolicy] END deleting s3 bucket policy.');

    return response;
  } catch (err) {
    if (err.code !== 'NoSuchBucketPolicy') {
      LOGGER.log(
        'ERROR',
        `[DeleteS3BucketPolicy] Error when deleting bucket policy from s3 bucket ${bucketName}: ${err.message}`
      );
      throw err;
    }
  }
};

module.exports = {
  putS3BucketPolicy: PutS3BucketPolicy,
  getS3BucketPolicy: GetS3BucketPolicy,
  deleteS3BucketPolicy: DeleteS3BucketPolicy
};
