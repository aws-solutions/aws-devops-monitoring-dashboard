// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import { overrideProps, DefaultEventsRuleProps} from '@aws-solutions-constructs/core';

export interface CanaryEventsProps {
  firehoseArn: string;
  eventsRuleRole: iam.Role;
}

export class CanaryEvents extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CanaryEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for Canary events
     */
    const canaryEventPattern = {
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
                  "CloudWatchSynthetics"
                ]
              }
            }
          }
        }
      }
    }

    const canaryAlarmTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.firehoseArn,
        role: props.eventsRuleRole
      })
    };

    const canaryEventRuleProps = {
      description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for Amazon CloudWatch Synthetics Canary Alarm',
      eventPattern: canaryEventPattern,
      enabled: true
    }

    const defaultEventsRuleProps = DefaultEventsRuleProps([canaryAlarmTarget]);
    const eventsRuleProps = overrideProps(defaultEventsRuleProps, canaryEventRuleProps, true);

    new events.Rule(this, 'CanaryEventsRule', eventsRuleProps);

  }
}