// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SharingAccountStack } from '../lib/multi-account-resources/sharing_account/sharing_account_stack';
import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';

const SOLUTION_ID = 'SO0143';
const SOLUTION_NAME = 'DevOps Monitoring Dashboard on AWS';
const DIST_VERSION = 'v1.0.0';
const DIST_OUTPUT_BUCKET = 'devops_dashboard_test_bucket';
const DIST_SOLUTION_NAME = 'aws_devops_monitoring_dashboard';
const LAMBDA_RUNTIME_NODEJS = lambda.Runtime.NODEJS_14_X;

/*
 * Snapshot test for SharingAccountStack
 */
test('Snapshot test for primary SharingAccountStack', () => {
  const app = new cdk.App();
  const stack = new SharingAccountStack(app, 'SharingAccountStack', {
    description: `(${SOLUTION_ID})${SOLUTION_NAME}  - Sharing Account Template. Version: ${DIST_VERSION}`,
    solutionId: SOLUTION_ID,
    solutionVersion: DIST_VERSION,
    solutionName: SOLUTION_NAME,
    solutionDistBucket: DIST_OUTPUT_BUCKET,
    solutionDistName: DIST_SOLUTION_NAME,
    lambdaRuntimeNode: LAMBDA_RUNTIME_NODEJS
  });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
