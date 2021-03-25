/*****************************************************************************
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.   *
 *                                                                            *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may   *
 *  not use this file except in compliance with the License. A copy of the    *
 *  License is located at                                                     *
 *                                                                            *
 *      http://www.apache.org/licenses/LICENSE-2.0                            *
 *                                                                            *
 *  or in the 'license' file accompanying this file. This file is distributed *
 *  on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,        *
 *  express or implied. See the License for the specific language governing   *
 *  permissions and limitations under the License.                            *
 *****************************************************************************/

import * as cdk from '@aws-cdk/core';
import * as cw from '@aws-cdk/aws-cloudwatch';

export interface iAlarmProps {
  readonly canaryName: string,
  readonly evalPeriods: number,
  readonly alarmPeriods: number,
  readonly threshold: number,
  alarmName?: string,
  index?: number
}

export class AlarmConstruct extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: iAlarmProps) {
    super(scope, id);

    if (props.index === undefined)
    {
      props.index = 1
    }
    if (props.alarmName === undefined)
    {
      props.alarmName = "Synthetics-Alarm-" + props.canaryName + "-" + props.index
    }
    // Alarm State - the canary is "failed" when...
    // --------------------------------------------
    // If you choose to create alarms, they are created with the following
    // name convention:Synthetics-Alarm-canaryName-index
    let alarm = new cw.Alarm(this, "AppAlarm", {
      alarmName: props.alarmName,
      metric: new cw.Metric({
        namespace: 'CloudWatchSynthetics',
        metricName: 'SuccessPercent',
        dimensions: { CanaryName: props.canaryName }
      }),
      threshold: props.threshold,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: props.evalPeriods,
      datapointsToAlarm: props.alarmPeriods,
      alarmDescription: "Alarm when canary success is less than 100% on the most recent check."
    });

    const alarmResource = alarm.node.findChild('Resource') as cw.CfnAlarm;

    alarmResource.cfnOptions.metadata = {
        cfn_nag: {
            rules_to_suppress: [{
                id: 'W28',
                reason: 'Static names chosen intentionally to provide fixed name structure required in the solution'
            }]
        }
    };
  }
}