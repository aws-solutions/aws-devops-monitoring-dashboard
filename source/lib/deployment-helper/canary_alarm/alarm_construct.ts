// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';

export interface AlarmProps {
  readonly canaryName: string;
  readonly evalPeriods: number;
  readonly alarmPeriods: number;
  readonly threshold: number;
  alarmName?: string;
  index?: number;
}

export class AlarmConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AlarmProps) {
    super(scope, id);

    if (props.index === undefined) {
      props.index = 1;
    }
    if (props.alarmName === undefined) {
      props.alarmName = 'Synthetics-Alarm-' + props.canaryName + '-' + props.index;
    }
    // Alarm State - the canary is "failed" when...
    // --------------------------------------------
    // If you choose to create alarms, they are created with the following
    // name convention:Synthetics-Alarm-canaryName-index
    const alarm = new cw.Alarm(this, 'AppAlarm', {
      alarmName: props.alarmName,
      metric: new cw.Metric({
        namespace: 'CloudWatchSynthetics',
        metricName: 'SuccessPercent',
        dimensionsMap: { CanaryName: props.canaryName }
      }),
      threshold: props.threshold,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: props.evalPeriods,
      datapointsToAlarm: props.alarmPeriods,
      alarmDescription: 'Alarm when canary success is less than 100% on the most recent check.'
    });

    const alarmResource = alarm.node.findChild('Resource') as cw.CfnAlarm;
    addCfnSuppressRules(alarmResource, [
      {
        id: 'W28',
        reason: 'Static names chosen intentionally to provide fixed name structure required in the solution'
      }
    ]);
  }
}
