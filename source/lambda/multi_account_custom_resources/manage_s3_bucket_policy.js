// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();
const s3BucketPolicy = require('./lib/s3_bucket_policy');

/**
 * Put s3 bucket policy that grants write permissions for the metrics s3 bucket to other accounts or organizations
 * @param principalType
 * @param principalList
 * @param bucketName
 * @param multiAcctBucketPSID SID for the multi-account bucket policy statement
 */
const PutS3BucketPolicy = async (principalType, principalList, bucketName, multiAcctBucketPSID) => {
  try {
    LOGGER.log('INFO', `[PutS3BucketPolicy] Start putting bucket policy on s3 bucket ${bucketName}.`);

    const existingPS = await GetExistingS3BucketPolicy(bucketName);
    LOGGER.log('INFO', `[PutS3BucketPolicy] Old policy: ${JSON.stringify(existingPS)}`);

    const multiAcctPS = await BuildMultiAcctS3BucketPolicyStatement(
      principalType,
      principalList,
      bucketName,
      multiAcctBucketPSID
    );
    const finalPS = await AddMultiAcctBucketPolicyStatement(existingPS, multiAcctPS, multiAcctBucketPSID);
    LOGGER.log('INFO', `[PutS3BucketPolicy] New policy: ${finalPS}`);

    const response = await s3BucketPolicy.putS3BucketPolicy(bucketName, finalPS);

    LOGGER.log('DEBUG', `[PutS3BucketPolicy] Response for putting s3 bucket policy: ${JSON.stringify(response)}`);
    LOGGER.log('INFO', '[PutS3BucketPolicy] End putting bucket policy.');

    return response;
  } catch (err) {
    LOGGER.log(
      'ERROR',
      `[PutS3BucketPolicy] Error when putting bucket policy on s3 bucket ${bucketName}: ${err.message}`
    );
    throw err;
  }
};

/**
 * Delete the multi-account bucket policy from the metrics s3 bucket
 * @param bucketName
 */
const DeleteS3BucketPolicy = async (bucketName, multiAcctBucketPSID) => {
  try {
    LOGGER.log(
      'INFO',
      `[DeleteS3BucketPolicy] Start deleting the multi-account bucket policy from the metrics s3 bucket ${bucketName}.`
    );

    let response = {};

    const existingPS = await GetExistingS3BucketPolicy(bucketName);
    LOGGER.log('INFO', `[DeleteS3BucketPolicy] Old policy: ${JSON.stringify(existingPS)}`);

    const finalPS = await RemoveMultiAcctBucketPolicyStatement(existingPS, multiAcctBucketPSID);
    LOGGER.log('INFO', `[DeleteS3BucketPolicy] New policy: ${JSON.stringify(finalPS)}`);

    if (finalPS === undefined) return response;

    // Delete the entire bucket policy if it contains only the multi-account policy statement
    if (Object.keys(JSON.parse(finalPS)['Statement']).length === 0) {
      response = await s3BucketPolicy.deleteS3BucketPolicy(bucketName);
    } else {
      // Delete only the multi-account policy statement from the bucket policy if it contains other policy statements
      response = await PutS3BucketPolicy(bucketName, finalPS);
    }

    LOGGER.log(
      'DEBUG',
      `[DeleteS3BucketPolicy] Response for deleting the multi-account bucket policy from the metrics s3 bucket: ${JSON.stringify(
        response
      )}`
    );

    LOGGER.log('INFO', '[DeleteS3BucketPolicy] End deleting the multi-account bucket policy.');

    return response;
  } catch (err) {
    LOGGER.log(
      'ERROR',
      `[DeleteS3BucketPolicy] Error when deleting the multi-account bucket policy from s3 bucket ${bucketName}: ${err.message}`
    );
    throw err;
  }
};

/**
 * Get the bucket policy on the metrics s3 bucket
 * @param bucketName
 */
const GetExistingS3BucketPolicy = async bucketName => {
  try {
    LOGGER.log('DEBUG', `[GetExistingS3BucketPolicy] Start getting bucket policy on s3 bucket ${bucketName}.`);

    const response = await s3BucketPolicy.getS3BucketPolicy(bucketName);
    let policyStatements = {};

    if (response !== undefined) {
      const policy = JSON.parse(response.Policy);
      policyStatements = policy['Statement'];
    }

    LOGGER.log(
      'DEBUG',
      `[GetExistingS3BucketPolicy] Response for getting s3 bucket policy: ${JSON.stringify(response)}`
    );
    LOGGER.log('DEBUG', `[GetExistingS3BucketPolicy] End getting bucket policy on s3 bucket ${bucketName}.`);

    return policyStatements;
  } catch (err) {
    // If no bucket policy exists, don't fail but return empty json object
    if (err.statusCode === 404) return {};
  }
};

/**
 * Build a policy statement that grants write permissions for the metrics s3 bucket to other accounts or organizations
 * @param principalType
 * @param principalList
 * @param bucketName
 */
const BuildMultiAcctS3BucketPolicyStatement = async (principalType, principalList, bucketName, multiAcctBucketPSID) => {
  try {
    LOGGER.log(
      'DEBUG',
      `[BuildMultiAcctS3BucketPolicyStatement] Start building s3 bucket policy statement that allows other ${principalType} to access the metrics S3 bucket ${bucketName}.`
    );

    let policyStatement = {
      Sid: multiAcctBucketPSID,
      Effect: 'Allow',
      Action: [
        's3:AbortMultipartUpload',
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:PutObject',
        's3:PutObjectAcl',
        's3:DeleteObject'
      ],
      Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`]
    };

    // If principal type is Account, add the list of accounts as principal
    if (principalType === 'Account') {
      policyStatement.Principal = { AWS: principalList };
    } else {
      // If principal type is organization, add the list of org ids to condition
      policyStatement.Principal = '*';
      policyStatement.Condition = {
        'ForAnyValue:StringEquals': {
          'aws:PrincipalOrgID': principalList
        }
      };
    }

    LOGGER.log('DEBUG', `[BuildMultiAcctS3BucketPolicyStatement] response: ${JSON.stringify(policyStatement)}`);
    LOGGER.log(
      'DEBUG',
      '[BuildMultiAcctS3BucketPolicyStatement] End building s3 bucket policy statement for multi-account access.'
    );

    return policyStatement;
  } catch (err) {
    LOGGER.log('ERROR', `End building S3 bucket policy statement for multi-account access: ${err.message}`);
    throw err;
  }
};

/**
 * Add the multi-account bucket policy statement to existing policy statements
 * @param policyStatements
 * @param multiAcctBucketPS
 * @param multiAcctBucketPSID
 */
const AddMultiAcctBucketPolicyStatement = async (policyStatements, multiAcctBucketPS, multiAcctBucketPSID) => {
  // If no bucket policy exists, simply add the new policy statement
  if (policyStatements === undefined || Object.keys(policyStatements).length === 0) {
    policyStatements = multiAcctBucketPS;
  } else {
    LOGGER.log(
      'DEBUG',
      `[AddMultiAcctBucketPolicyStatement] Policy before change: ${JSON.stringify(policyStatements)}`
    );

    const has = Object.prototype.hasOwnProperty; // cache the lookup once, in module scope.
    let multiAcctBucketPSExist = false;

    for (const ps in policyStatements) {
      if (has.call(policyStatements[ps], 'Sid') && policyStatements[ps]['Sid'] === multiAcctBucketPSID) {
        multiAcctBucketPSExist = true;
        LOGGER.log(
          'DEBUG',
          `[AddMultiAcctBucketPolicyStatement] Found ${multiAcctBucketPSID}: ${policyStatements[ps]}`
        );
        // Replace the old policy statement with the new one
        policyStatements.splice(ps, 1, multiAcctBucketPS);
        break;
      }
    }
    // If the multi-account policy statement doesn't already exist, add it
    if (!multiAcctBucketPSExist) {
      policyStatements.splice(policyStatements.size, 0, multiAcctBucketPS);
    }
  }

  const finalPolicyStatements = {
    Statement: policyStatements
  };

  LOGGER.log(
    'DEBUG',
    `[AddMultiAcctBucketPolicyStatement] Final policy after change: ${JSON.stringify(policyStatements)}`
  );

  return JSON.stringify(finalPolicyStatements);
};

/**
 * Remove the multi-account policy statement from the metrics s3 bucket
 * @param policyStatements The bucket policy statements of the metrics s3 bucket
 * @param multiAcctBucketPSID SID of the multi-account bucket policy statement
 */
const RemoveMultiAcctBucketPolicyStatement = async (policyStatements, multiAcctBucketPSID) => {
  if (Object.keys(policyStatements).length === 0) {
    LOGGER.log('DEBUG', '[RemoveMultiAcctBucketPolicyStatement] No bucket policy exists. Do nothing');
    return undefined;
  } else {
    LOGGER.log(
      'DEBUG',
      `[RemoveMultiAcctBucketPolicyStatement] Policy before change: ${JSON.stringify(policyStatements)}`
    );

    const has = Object.prototype.hasOwnProperty; // cache the lookup once, in module scope.
    let multiAcctBucketPSExist = false;
    for (const ps in policyStatements) {
      if (has.call(policyStatements[ps], 'Sid') && policyStatements[ps]['Sid'] === multiAcctBucketPSID) {
        multiAcctBucketPSExist = true;
        LOGGER.log(
          'DEBUG',
          `[RemoveMultiAcctBucketPolicyStatement] Found ${multiAcctBucketPSID}: ${policyStatements[ps]}`
        );
        // Delete the bucket policy statement
        policyStatements.splice(ps, 1);
        break;
      }
    }
    if (!multiAcctBucketPSExist) return undefined;
  }

  const finalPolicyStatement = {
    Statement: policyStatements
  };

  LOGGER.log(
    'DEBUG',
    `[AddMultiAcctBucketPolicyStatement] Final policy after change: ${JSON.stringify(finalPolicyStatement)}`
  );

  return JSON.stringify(finalPolicyStatement);
};

module.exports = {
  putS3BucketPolicy: PutS3BucketPolicy,
  deleteS3BucketPolicy: DeleteS3BucketPolicy,
  getExistingS3BucketPolicy: GetExistingS3BucketPolicy,
  buildMultiAcctS3BucketPolicyStatement: BuildMultiAcctS3BucketPolicyStatement,
  addMultiAcctBucketPolicyStatement: AddMultiAcctBucketPolicyStatement,
  removeMultiAcctBucketPolicyStatement: RemoveMultiAcctBucketPolicyStatement
};
