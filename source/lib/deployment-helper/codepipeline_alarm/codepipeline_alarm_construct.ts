// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';

export interface PipelineMetricProps {
  readonly pipelineName: string;
  readonly paramCreateLogGroup: cdk.CfnParameter;
  readonly logGroupName: string;
  readonly metricNameSpace: string;
  readonly alarmName: string;
}

export class PipelineAlarmConstruct extends Construct {
  constructor(scope: Construct, id: string, props: PipelineMetricProps) {
    super(scope, id);

    /**
     * Create CloudWatch log group if YES is selected for creating new log group
     */
    const pipelineLogGroup = new logs.LogGroup(this, 'PipelineLogGroup', {
      logGroupName: props.logGroupName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.THREE_MONTHS
    });

    const condCreateLogGroupTrue = new cdk.CfnCondition(this, 'CreateLogGroupTrue', {
      expression: cdk.Fn.conditionEquals('YES', props.paramCreateLogGroup)
    });

    const pipelineLogGroupCfnRef = pipelineLogGroup.node.defaultChild as logs.CfnLogGroup;
    pipelineLogGroupCfnRef.cfnOptions.condition = condCreateLogGroupTrue;

    addCfnSuppressRules(pipelineLogGroupCfnRef, [
      {
        id: 'W84',
        reason: 'CloudWatch LogGroups are encrypted by default.'
      }
    ]);

    // Get iLogGroup reference - works for new or existing log group
    const pipelineIlogGroup: logs.ILogGroup = logs.LogGroup.fromLogGroupName(
      this,
      'PipelineILogGroup',
      props.logGroupName
    );

    /**
     * Create CloudWatch Events Rule for AWS CodePipeline execution state change
     */
    const pipelineEventRulePattern = {
      source: ['aws.codepipeline'],
      'detail-type': ['CodePipeline Pipeline Execution State Change'],
      detail: {
        state: ['FAILED', 'SUCCEEDED']
      }
    };

    const pipelineEventsRule = new events.Rule(this, 'PipelineEventsRule', {
      eventPattern: pipelineEventRulePattern
    });

    pipelineEventsRule.addTarget(new targets.CloudWatchLogGroup(pipelineIlogGroup));

    /**
     * Create CloudWatch Metric Filter for AWS CodePipeline failed executions
     */
    const metricName = `FailedExecution-${props.pipelineName}`;
    const metricFilter = new logs.MetricFilter(this, 'FailedPipelineExecutionMetricFilter', {
      filterPattern: {
        logPatternString: '{($.detail.state = "FAILED")}'
      },
      logGroup: pipelineIlogGroup,
      metricName: metricName,
      metricNamespace: props.metricNameSpace,
      defaultValue: 0,
      metricValue: '1'
    });

    const metricFilter_cfn_ref = metricFilter.node.defaultChild as logs.CfnMetricFilter;
    metricFilter_cfn_ref.addDependency(pipelineLogGroupCfnRef);

    /**
     * Create CloudWatch alarm for AWS CodePipeline failed execution metric
     */
    const alarm = new cw.Alarm(this, 'AppAlarm', {
      alarmName: props.alarmName,
      metric: new cw.Metric({
        namespace: props.metricNameSpace,
        metricName: metricName,
        period: cdk.Duration.minutes(1),
        statistic: 'Sum'
      }),
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cw.TreatMissingData.IGNORE,
      alarmDescription: 'Goes to alarm state when there is one failed code pipeline execution on the most recent check.'
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
