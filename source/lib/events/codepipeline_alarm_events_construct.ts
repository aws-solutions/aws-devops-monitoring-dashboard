// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import {DefaultEventsRuleProps, overrideProps} from '@aws-solutions-constructs/core';

export interface CodePipelineAlarmEventsProps {
    firehoseArn: string;
    eventsRuleRole: iam.Role;
    solutionId: string;
}

export class CodePipelineAlarmEvents extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: CodePipelineAlarmEventsProps) {
        super(scope, id);

        /**
         * Create CloudWatch Events Rule for CodePipeline alarm events
         */
        const codePipelineAlarmEventPattern = {
            "source": [
                "aws.cloudwatch"
            ],
            "detail-type": [
                "CloudWatch Alarm State Change"
            ],
            "detail": {
                "state": {
                    "value": ["OK"]
                },
                "previousState": {
                    "value": ["ALARM"]
                },
                "configuration": {
                    "metrics": {
                        "metricStat": {
                            "metric": {
                                "namespace": [
                                    `CodePipeline/${props.solutionId}/Pipelines`
                                ]
                            }
                        }
                    }
                }
            }
        }

        const codePipelineAlarmAlarmTarget: events.IRuleTarget = {
            bind: () => ({
                id: '',
                arn: props.firehoseArn,
                role: props.eventsRuleRole
            })
        };

        const codePipelineAlarmEventRuleProps = {
            description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for AWS CodePipeline Alarm',
            eventPattern: codePipelineAlarmEventPattern,
            enabled: true
        }

        const defaultEventsRuleProps = DefaultEventsRuleProps([codePipelineAlarmAlarmTarget]);
        const eventsRuleProps = overrideProps(defaultEventsRuleProps, codePipelineAlarmEventRuleProps, true);

        new events.Rule(this, 'CodePipelineAlarmEventsRule', eventsRuleProps);

    }
}