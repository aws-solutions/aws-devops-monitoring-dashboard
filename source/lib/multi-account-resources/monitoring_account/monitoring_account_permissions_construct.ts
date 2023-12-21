// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { CfnCustomResource } from 'aws-cdk-lib/aws-cloudformation';
import { CanaryEvents } from '../../events/canary_events_construct';
import { CodeDeployEvents } from '../../events/code_deploy_events_construct';
import { CodePipelineEvents } from '../../events/code_pipeline_events_construct';
import { CodeCommitEvents } from '../../events/code_commit_events_construct';
import { CodePipelineAlarmEvents } from '../../events/codepipeline_alarm_events_construct';

export interface MonitoringAcctPermissionProps {
  principalType: string;
  principalList: string[];
  lambdaRunTime: lambda.Runtime;
  uuid: string;
  userAgentExtra: string;
  multiAccountCond: cdk.CfnCondition;
  callingStack: cdk.Stack;
  metricsBucketName: string | undefined;
  eventsRuleTargetArn: string;
  eventsRuleRole: iam.Role;
  solutionId: string;
  solutionVersion: string;
}

export class MonitoringAcctPermission extends Construct {
  public readonly customEventBusArn: string;

  constructor(scope: Construct, id: string, props: MonitoringAcctPermissionProps) {
    super(scope, id);

    cdk.Aspects.of(this).add(new ApplyConditionAspect(props.multiAccountCond));

    const parentStack = props.callingStack;

    /**
     * Create custom event bus to receive events from other accounts
     */
    const customEventBus = new events.EventBus(this, 'DevOpsCustomEventBus', {
      eventBusName: 'DevOpsCustomEventBus-' + props.uuid
    });

    this.customEventBusArn = customEventBus.eventBusArn;

    /**
     * Create custom resource Lambda to manage event bus permissions for receiving events from other accounts
     */
    const cwLogsPS = new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      effect: iam.Effect.ALLOW,
      resources: [
        parentStack.formatArn({
          service: 'logs',
          resource: 'log-group',
          arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
          resourceName: '/aws/lambda/*'
        })
      ],
      sid: 'CreateCWLogs'
    });

    const eventsPS = new iam.PolicyStatement({
      actions: ['events:DescribeEventBus', 'events:RemovePermission', 'events:PutPermission'],
      effect: iam.Effect.ALLOW,
      resources: [customEventBus.eventBusArn],
      sid: 'CWEventBus'
    });

    const s3BucketPolicyPS = new iam.PolicyStatement({
      actions: ['s3:PutBucketPolicy', 's3:GetBucketPolicy', 's3:DeleteBucketPolicy'],
      effect: iam.Effect.ALLOW,
      resources: [
        parentStack.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: props.metricsBucketName ? props.metricsBucketName : '',
          arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME
        })
      ],
      sid: 'S3BucketPolicy'
    });

    const monitoringAcctPermissionLambdaPolicyName = 'MonitoringAcctPermissionLambdaPolicy-' + props.uuid;

    const monitoringAcctPermissionLambdaRole = new iam.Role(this, 'MonitoringAcctPermissionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [monitoringAcctPermissionLambdaPolicyName]: new iam.PolicyDocument({
          statements: [cwLogsPS, eventsPS, s3BucketPolicyPS]
        })
      }
    });

    NagSuppressions.addResourceSuppressions(monitoringAcctPermissionLambdaRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to partition, region, account and lambda resource.'
      }
    ]);

    const monitoringAcctPermissionLambda = new lambda.Function(this, 'MonitoringAcctPermissionLambda', {
      description:
        'DevOps Monitoring Dashboard on AWS solution - This function manages permissions in the central monitoring account that are required for processing metrics sent by other accounts.',
      environment: {
        LOG_LEVEL: 'INFO',
        UserAgentExtra: props.userAgentExtra
      },
      runtime: props.lambdaRunTime,
      code: lambda.Code.fromAsset(`${__dirname}/../../../lambda/multi_account_custom_resources`),
      handler: 'monitoring_account_permission_index.handler',
      role: monitoringAcctPermissionLambdaRole,
      timeout: cdk.Duration.seconds(300),
      logRetention: logs.RetentionDays.THREE_MONTHS
    });

    const refMonitoringAcctPermissionLambda = monitoringAcctPermissionLambda.node.findChild(
      'Resource'
    ) as lambda.CfnFunction;
    const lambdaCfnNag = [
      {
        id: 'W89',
        reason: 'There is no need to run this lambda in a VPC'
      },
      {
        id: 'W92',
        reason: 'There is no need for Reserved Concurrency'
      }
    ];
    addCfnSuppressRules(refMonitoringAcctPermissionLambda, lambdaCfnNag);

    const monitorAcctPermCustResource = new cdk.CustomResource(this, 'CustomResourceMonitoringAcctPermission', {
      resourceType: 'Custom::MonitoringAcctPermission',
      serviceToken: monitoringAcctPermissionLambda.functionArn,
      properties: {
        PrincipalType: props.principalType,
        PrincipalList: props.principalList,
        EventBusName: customEventBus.eventBusName,
        MetricsBucketName: props.metricsBucketName,
        UUID: props.uuid,
        version: props.solutionVersion
      }
    });

    const monitorAcctPermCustResourceCfnRef = monitorAcctPermCustResource.node.defaultChild as CfnCustomResource;
    monitorAcctPermCustResourceCfnRef.cfnOptions.updateReplacePolicy = cdk.CfnDeletionPolicy.RETAIN;

    /**
     * Create CloudWatch Events Rule for Canary events under custom event bus.
     * This is used to receive events from other accounts.
     */
    new CanaryEvents(this, 'CanaryEventsForCustomEventBus', {
      targetArn: props.eventsRuleTargetArn,
      eventsRuleRole: props.eventsRuleRole,
      eventBus: customEventBus
    });

    /**
     * Create CloudWatch Events Rule for CodePipeline Alarm events.
     * This is used to receive events from other accounts.
     */
    new CodePipelineAlarmEvents(this, 'CodePipelineAlarmEventsForCustomEventBus', {
      targetArn: props.eventsRuleTargetArn,
      eventsRuleRole: props.eventsRuleRole,
      solutionId: props.solutionId,
      eventBus: customEventBus
    });

    /**
     * Create CloudWatch Events Rule for CodeDeploy events under custom event bus.
     * This is used to receive events from other accounts
     */
    new CodeDeployEvents(this, 'CodeDeployEventsForCustomEventBus', {
      targetArn: props.eventsRuleTargetArn,
      eventsRuleRole: props.eventsRuleRole,
      eventBus: customEventBus
    });

    /**
     * Create CloudWatch Events Rule for CodePipeline events under custom event bus.
     * This is used to receive events from other accounts
     */
    new CodePipelineEvents(this, 'CodePipelineEventsForCustomEventBus', {
      targetArn: props.eventsRuleTargetArn,
      eventsRuleRole: props.eventsRuleRole,
      eventBus: customEventBus
    });

    /**
     * Create CloudWatch Events Rule for CodeCommit events under custom event bus.
     * This is used to receive events from other accounts
     */
    new CodeCommitEvents(this, 'CodeCommitEventsForCustomEventBus', {
      targetArn: props.eventsRuleTargetArn,
      eventsRuleRole: props.eventsRuleRole,
      eventBus: customEventBus
    });
  }
}

class ApplyConditionAspect implements cdk.IAspect {
  private readonly condition: cdk.CfnCondition;

  constructor(condition: cdk.CfnCondition) {
    this.condition = condition;
  }

  public visit(node: IConstruct): void {
    const resource = node as cdk.CfnResource;
    if (resource.cfnOptions) {
      resource.cfnOptions.condition = this.condition;
    }
  }
}
