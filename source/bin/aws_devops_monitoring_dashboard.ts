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
 #!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import { CanaryStack } from '../lib/deployment-helper/canary_alarm';
import { DevOpsDashboardStack } from '../lib/aws_devops_monitoring_dashboard_stack';

// SOLUTION_* - set by solution_env.sh
const SOLUTION_ID = process.env['SOLUTION_ID'] || 'undefined';
const SOLUTION_NAME = process.env['SOLUTION_NAME'] || 'undefined';
 // DIST_* - set by build-s3-dist.sh
const DIST_VERSION = process.env['DIST_VERSION'] || '%%VERSION%%';
const DIST_OUTPUT_BUCKET = process.env['DIST_OUTPUT_BUCKET'] || '%%BUCKET%%';
const DIST_SOLUTION_NAME = process.env['DIST_SOLUTION_NAME'] || '%%SOLUTION%%';
const LAMBDA_RUNTIME_NODEJS = lambda.Runtime.NODEJS_12_X

const app = new cdk.App();

new CanaryStack(app, 'canary-alarm', {
	description: `(${SOLUTION_ID})${SOLUTION_NAME} - Create Canary Alarm Template. Version: ${DIST_VERSION}`,
	solutionId: SOLUTION_ID,
	solutionVersion: DIST_VERSION,
	solutionName: SOLUTION_NAME,
	solutionDistBucket: DIST_OUTPUT_BUCKET,
	solutionDistName: DIST_SOLUTION_NAME
})

/* Main stack for the solution */
const devopsDashboardStack = new DevOpsDashboardStack(app, 'aws-devops-monitoring-dashboard', {
	description: `(${SOLUTION_ID})${SOLUTION_NAME} - Main Template. Version: ${DIST_VERSION}`,
	solutionId: SOLUTION_ID,
	solutionVersion: DIST_VERSION,
	solutionName: SOLUTION_NAME,
	solutionDistBucket: DIST_OUTPUT_BUCKET,
	solutionDistName: DIST_SOLUTION_NAME,
	lambdaRuntimeNode: LAMBDA_RUNTIME_NODEJS
});

devopsDashboardStack.templateOptions.templateFormatVersion = "2010-09-09"
