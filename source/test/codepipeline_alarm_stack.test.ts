// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


import * as cdk from '@aws-cdk/core';
import {Stack} from '@aws-cdk/core';
import {PipelineAlarmStack} from '../lib/deployment-helper/codepipeline_alarm/codepipeline_alarm_stack'
import {expect as expectCDK, haveResourceLike, SynthUtils} from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';

const SOLUTION_ID = 'SO0143';
const SOLUTION_NAME = 'AWS DevOps Monitoring Dashboard'
const DIST_VERSION = 'v1.0.0'
const DIST_OUTPUT_BUCKET = 'devops_dashboard_test_bucket'
const DIST_SOLUTION_NAME = 'aws_devops_monitoring_dashboard'

/*
 * Snapshot test for codepipeline alarm stack.
 */
test('Snapshot test for codepipeline alarm stack', () => {
    const app = new cdk.App()
    const stack = new PipelineAlarmStack(app, 'CodePipelineAlarm', {
        solutionId: SOLUTION_ID,
        solutionVersion: DIST_VERSION
    })
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
})

describe('PipelineAlarmStack', () => {

    let stack: Stack;

    beforeAll(() => {
        const app = new cdk.App();

        stack = new PipelineAlarmStack(app, 'CodePipelineAlarm', {
            solutionId: SOLUTION_ID,
            solutionVersion: DIST_VERSION
        });
    })

    const logGroupNameRef = {
        "Ref": "LogGroupName"
    };

    test('it has a CloudWatch Alarm that checks for pipeline failures', () => {
        expectCDK(stack).to(haveResourceLike("AWS::CloudWatch::Alarm", {
            "ComparisonOperator": "GreaterThanOrEqualToThreshold",
            "Threshold": 1,
        }));
    });

    test('it has a LogGroup for CodePipeline alarms', () => {
        expectCDK(stack).to(haveResourceLike("AWS::Logs::LogGroup", {
            "LogGroupName": logGroupNameRef,
            "RetentionInDays": 90
        }));
    });

    test('it has an EventsRule for CodePipeline execution state changes', () => {
        expectCDK(stack).to(haveResourceLike("AWS::Events::Rule", {
            "State": "ENABLED"
        }));
    });

    test('it has a MetricFilter checking for pipeline failures in the log group', () => {
        expectCDK(stack).to(haveResourceLike("AWS::Logs::MetricFilter", {
            "LogGroupName": logGroupNameRef,
            "FilterPattern": "{($.detail.state = \"FAILED\")}"
        }));
    });

})
