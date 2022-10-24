// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import { CanaryStack } from '../lib/deployment-helper/canary_alarm/canary_alarm_stack';
import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';

const SOLUTION_ID = 'SO0143';
const SOLUTION_NAME = 'DevOps Monitoring Dashboard on AWS';
const DIST_VERSION = 'v1.0.0';
const DIST_OUTPUT_BUCKET = 'devops_dashboard_test_bucket';
const DIST_SOLUTION_NAME = 'aws_devops_monitoring_dashboard';

/*
 * Snapshot test for Canary Alarm.
 */
test('Snapshot test for canary alarm', () => {
  const app = new cdk.App();
  const stack = new CanaryStack(app, 'CanaryAlarm', {
    solutionId: SOLUTION_ID,
    solutionVersion: DIST_VERSION,
    solutionName: SOLUTION_NAME,
    solutionDistBucket: DIST_OUTPUT_BUCKET,
    solutionDistName: DIST_SOLUTION_NAME
  });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
