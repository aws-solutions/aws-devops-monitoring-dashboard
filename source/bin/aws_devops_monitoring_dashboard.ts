#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CanaryStack } from '../lib/deployment-helper/canary_alarm/canary_alarm_stack';
import { PipelineAlarmStack } from '../lib/deployment-helper/codepipeline_alarm/codepipeline_alarm_stack';
import { DevOpsDashboardStack } from '../lib/aws_devops_monitoring_dashboard_stack';
import { SharingAccountStack } from '../lib/multi-account-resources/sharing_account/sharing_account_stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { AppRegister } from '../lib/app-registry/app_register';

// SOLUTION_* - set by solution_env.sh
const SOLUTION_ID = process.env['SOLUTION_ID'] || 'undefined';
const SOLUTION_NAME = process.env['SOLUTION_NAME'] || 'undefined';
// DIST_* - set by build-s3-dist.sh
const DIST_VERSION = process.env['DIST_VERSION'] || '%%VERSION%%';
const DIST_OUTPUT_BUCKET = process.env['DIST_OUTPUT_BUCKET'] || '%%BUCKET%%';
const DIST_SOLUTION_NAME = process.env['DIST_SOLUTION_NAME'] || '%%SOLUTION%%';
const LAMBDA_RUNTIME_NODEJS = lambda.Runtime.NODEJS_22_X;
const TEMPLATE_FORMAT_VERSION = '2010-09-09';

const app = new cdk.App();
cdk.Aspects.of(app).add(new AwsSolutionsChecks());

const canaryStack = new CanaryStack(app, 'canary-alarm', {
  synthesizer: new cdk.DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  description: `(${SOLUTION_ID}C) ${SOLUTION_NAME} - Create Canary Alarm Template. Version: ${DIST_VERSION}`,
  solutionId: SOLUTION_ID,
  solutionVersion: DIST_VERSION,
  solutionName: SOLUTION_NAME,
  solutionDistBucket: DIST_OUTPUT_BUCKET,
  solutionDistName: DIST_SOLUTION_NAME
});

/* Main stack for the solution */
const devopsDashboardStack = new DevOpsDashboardStack(app, 'aws-devops-monitoring-dashboard', {
  synthesizer: new cdk.DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  description: `(${SOLUTION_ID}) ${SOLUTION_NAME} - Main Template (Monitoring Account). Version: ${DIST_VERSION}`,
  solutionId: SOLUTION_ID,
  solutionVersion: DIST_VERSION,
  solutionName: SOLUTION_NAME,
  solutionDistBucket: DIST_OUTPUT_BUCKET,
  solutionDistName: DIST_SOLUTION_NAME,
  lambdaRuntimeNode: LAMBDA_RUNTIME_NODEJS,
});

/* Stack for creating codepipeline alarm */
const pipelineAlarmStack = new PipelineAlarmStack(app, 'pipeline-alarm', {
  synthesizer: new cdk.DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  description: `(${SOLUTION_ID}P) ${SOLUTION_NAME} - Create CodePipeline Alarm Template. Version: ${DIST_VERSION}`,
  solutionId: SOLUTION_ID,
  solutionVersion: DIST_VERSION
});

/* Stack for creating sharing account resources */
const sharingAccountStack = new SharingAccountStack(app, 'sharing-account-stack', {
  synthesizer: new cdk.DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  description: `(${SOLUTION_ID}S) ${SOLUTION_NAME} - Sharing Account Template. Version: ${DIST_VERSION}`,
  solutionId: SOLUTION_ID,
  solutionVersion: DIST_VERSION,
  solutionName: SOLUTION_NAME,
  solutionDistBucket: DIST_OUTPUT_BUCKET,
  solutionDistName: DIST_SOLUTION_NAME,
  lambdaRuntimeNode: LAMBDA_RUNTIME_NODEJS,
});

const appRegister = new AppRegister({
  solutionId: SOLUTION_ID,
  solutionName: SOLUTION_NAME,
  solutionVersion: DIST_VERSION,
  appRegistryApplicationName: 'devops-monitoring-dashboard-on-aws',
  applicationType: 'AWS-Solutions',
  attributeGroupName: 'Solution-Metadata'
});

appRegister.applyAppRegistryToStacks(
  devopsDashboardStack as cdk.Stack,
  [], // Do not associate spoke (sharing) stack because cross-region associations are not supported currently
  devopsDashboardStack.getNestedStacks()
);

devopsDashboardStack.templateOptions.templateFormatVersion = TEMPLATE_FORMAT_VERSION;
canaryStack.templateOptions.templateFormatVersion = TEMPLATE_FORMAT_VERSION;
pipelineAlarmStack.templateOptions.templateFormatVersion = TEMPLATE_FORMAT_VERSION;
sharingAccountStack.templateOptions.templateFormatVersion = TEMPLATE_FORMAT_VERSION;
