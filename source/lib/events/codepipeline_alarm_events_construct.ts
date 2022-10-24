// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { DefaultEventsRuleProps, overrideProps } from '@aws-solutions-constructs/core';

export interface CodePipelineAlarmEventsProps {
  targetArn: string;
  eventsRuleRole: iam.Role;
  solutionId: string;
  eventBus?: events.IEventBus;
}

export class CodePipelineAlarmEvents extends Construct {
  constructor(scope: Construct, id: string, props: CodePipelineAlarmEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for CodePipeline alarm events
     */
    const codePipelineAlarmEventPattern = {
      source: ['aws.cloudwatch'],
      'detail-type': ['CloudWatch Alarm State Change'],
      detail: {
        state: {
          value: ['OK']
        },
        previousState: {
          value: ['ALARM']
        },
        configuration: {
          metrics: {
            metricStat: {
              metric: {
                namespace: [`CodePipeline/${props.solutionId}/Pipelines`]
              }
            }
          }
        }
      }
    };

    const codePipelineAlarmAlarmTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.targetArn,
        role: props.eventsRuleRole
      })
    };

    const codePipelineAlarmEventRuleProps = {
      description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for AWS CodePipeline Alarm',
      eventPattern: codePipelineAlarmEventPattern,
      enabled: true
    };

    const defaultEventsRuleProps = DefaultEventsRuleProps([codePipelineAlarmAlarmTarget]);
    let eventsRuleProps = overrideProps(defaultEventsRuleProps, codePipelineAlarmEventRuleProps, true);

    // Use custom event bus for multi-account events ingestion
    if (props.eventBus !== undefined) {
      eventsRuleProps = { ...eventsRuleProps, eventBus: props.eventBus };
    }

    new events.Rule(this, 'CodePipelineAlarmEventsRule', eventsRuleProps);
  }
}
