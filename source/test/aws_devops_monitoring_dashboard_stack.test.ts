/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import devopsDashboardStack = require('../lib/aws_devops_monitoring_dashboard_stack');
import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';

const SOLUTION_ID = 'SO0143';
const SOLUTION_NAME = 'AWS DevOps Monitoring Dashboard'
const DIST_VERSION = 'v1.0.0'
const DIST_OUTPUT_BUCKET = 'devops_dashboard_test_bucket'
const DIST_SOLUTION_NAME = 'aws_devops_monitoring_dashboard'
const LAMBDA_RUNTIME_NODEJS = lambda.Runtime.NODEJS_12_X

/*
 * Snapshot test for devopsDashboardStack
 */
test('Snapshot test for primary devopsDashboardStack', () => {
  const app = new cdk.App();
  const stack = new devopsDashboardStack.DevOpsDashboardStack(app, 'DevopsDashboardStack', {
    description: `(${SOLUTION_ID})${SOLUTION_NAME}  - Main Template. Version: ${DIST_VERSION}`,
    solutionId: SOLUTION_ID,
    solutionVersion: DIST_VERSION,
    solutionName: SOLUTION_NAME,
    solutionDistBucket: DIST_OUTPUT_BUCKET,
    solutionDistName: DIST_SOLUTION_NAME,
    lambdaRuntimeNode: LAMBDA_RUNTIME_NODEJS
  });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});