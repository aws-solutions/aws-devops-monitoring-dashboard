// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { overrideProps, DefaultEventsRuleProps } from '@aws-solutions-constructs/core';

export interface CanaryEventsProps {
  targetArn: string;
  eventsRuleRole: iam.Role;
  eventBus?: events.IEventBus;
}

export class CanaryEvents extends Construct {
  constructor(scope: Construct, id: string, props: CanaryEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for Canary events
     */
    const canaryEventPattern = {
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
                namespace: ['CloudWatchSynthetics']
              }
            }
          }
        }
      }
    };

    const canaryAlarmTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.targetArn,
        role: props.eventsRuleRole
      })
    };

    const canaryEventRuleProps = {
      description:
        'DevOps Monitoring Dashboard on AWS solution - Event rule for Amazon CloudWatch Synthetics Canary Alarm',
      eventPattern: canaryEventPattern,
      enabled: true
    };

    const defaultEventsRuleProps = DefaultEventsRuleProps([canaryAlarmTarget]);
    const eventsRuleProps = overrideProps(defaultEventsRuleProps, canaryEventRuleProps, true);

    // Use custom event bus for multi-account events ingestion
    if (props.eventBus !== undefined) {
      eventsRuleProps.eventBus = props.eventBus;
    }

    new events.Rule(this, 'CanaryEventsRule', eventsRuleProps);
  }
}
