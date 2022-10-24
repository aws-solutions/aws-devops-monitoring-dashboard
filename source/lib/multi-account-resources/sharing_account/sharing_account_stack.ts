// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CfnPolicy, Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CanaryEvents } from '../../events/canary_events_construct';
import { CodeDeployEvents } from '../../events/code_deploy_events_construct';
import { CodePipelineEvents } from '../../events/code_pipeline_events_construct';
import { CodeCommitEvents } from '../../events/code_commit_events_construct';
import { CodePipelineAlarmEvents } from '../../events/codepipeline_alarm_events_construct';
import { CodeBuildEvents } from '../../events/code_build_events_construct';
import { GlueDatabase } from '../../database/database_construct';
import { ApplyCfnSuppressRulesToLogRetentionResource } from '../../util/apply_to_construct';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { TagQuery } from '../../tagging/tag-query-construct';

export interface SharingAccountStackProps extends cdk.StackProps {
  solutionId: string;
  solutionVersion: string;
  solutionName: string;
  solutionDistBucket?: string;
  solutionDistName?: string;
  lambdaRuntimeNode: lambda.Runtime;
}

/**
 * @constructor
 * @param {Construct} scope - parent of the construct
 * @param {string} id - identifier for the object
 */
export class SharingAccountStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SharingAccountStackProps) {
    super(scope, id, props);

    //=========================================================================
    // PARAMETERS
    //=========================================================================

    /**
     * @description ARN of the custom event bus in the monitoring account
     * @type {cdk.CfnParameter}
     */
    const paramMonitorAcctCustomEventBusARN = new cdk.CfnParameter(this, 'MonitorAcctCustomEventBusARN', {
      description:
        "ARN of the custom Amazon EventBridge Event Bus in the monitoring account where the events are sent. To find the ARN, sign in the AWS CloudFormation console in the monitoring account, select the solution's main CloudFormation stack you deployed, open Outputs tab, then copy the value for CustomEventBusArn. E.g., arn:aws:events:Region:Account:event-bus/EventBusName",
      type: 'String',
      default: ''
    });

    /**
     * @description ARN of the S3 bucket storing DevOps metrics in the monitoring account
     * @type {cdk.CfnParameter}
     */
    const paramMonitorAcctMetricsBucketARN = new cdk.CfnParameter(this, 'MonitorAcctMetricsBucketARN', {
      description:
        "Enter the ARN of the S3 bucket in the monitoring account where DevOps metrics are stored. To find the ARN, sign in the AWS CloudFormation console in the monitoring account, select the solution's main CloudFormation stack you deployed, open Outputs tab, then copy the value for DevOpsMetricsS3Bucket. E.g., arn:aws:s3:::aws-devops-metrics-xxxxxx.",
      type: 'String',
      default: ''
    });

    /**
     * @description The AWS account number of the monitoring account
     * @type {cdk.CfnParameter}
     */
    const paramMonitorAcctNumber = new cdk.CfnParameter(this, 'MonitorAcctNumber', {
      description:
        "Enter the AWS account number of the monitoring account where the solution's main template is deployed to receive data from other accounts.",
      type: 'String',
      default: ''
    });

    /**
     * @description The AWS region of the monitoring account
     * @type {cdk.CfnParameter}
     */
    const paramMonitorAcctRegion = new cdk.CfnParameter(this, 'MonitorAcctRegion', {
      description:
        "Enter the AWS region of the monitoring account where the solution's main template is deployed to receive data from other accounts. E.g., us-east-1.",
      type: 'String',
      default: ''
    });

    const paramSolutionUuid = new cdk.CfnParameter(this, 'SolutionUUID', {
      description:
        "The generated solution UUID from the monitoring stack. Used for anonymous usage metrics. To find the ARN, sign in the AWS CloudFormation console in the monitoring account, select the solution's main CloudFormation stack you deployed, open Outputs tab, then copy the value for SolutionUUID. E.g., 3089cafd-60ee-4b65-b368-1cb38060f3b1",
      type: 'String',
      allowedPattern: '^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$'
    });

    const tagConfigDescription =
      'Enter a semicolon-separated list of tags, using a comma as a separator between the tag key and value (e.g. "env,prod;anotherKey,anotherValue"). Omitting a value will result in a filter that captures all values for that tag.';

    const paramUseCodeCommitTags = new cdk.CfnParameter(this, 'TagsConfigCodeCommit', {
      description: tagConfigDescription,
      type: 'String'
    });

    const paramUseCodeBuildTags = new cdk.CfnParameter(this, 'TagsConfigCodeBuild', {
      description: tagConfigDescription,
      type: 'String'
    });

    const paramUseCodePipelineTags = new cdk.CfnParameter(this, 'TagsConfigCodePipeline', {
      description: tagConfigDescription,
      type: 'String'
    });

    const SharingAccountStackMetadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: {
              default: 'Monitoring Account Configuration'
            },
            Parameters: [
              'MonitorAcctCustomEventBusARN',
              'MonitorAcctMetricsBucketARN',
              'MonitorAcctNumber',
              'MonitorAcctRegion',
              'SolutionUUID'
            ]
          },
          {
            Label: {
              default: 'Tag Configuration'
            },
            Parameters: ['TagsConfigCodeCommit', 'TagsConfigCodeBuild', 'TagsConfigCodePipeline']
          }
        ],
        ParameterLabels: {
          MonitorAcctCustomEventBusARN: {
            default: 'ARN of the custom event bus in the monitoring account'
          },
          MonitorAcctMetricsBucketARN: {
            default: 'ARN of the DevOps metrics S3 bucket in the monitoring account'
          },
          MonitorAcctNumber: {
            default: 'AWS account number of the monitoring account'
          },
          MonitorAcctRegion: {
            default: "AWS region of the monitoring account where the solution's main template is deployed"
          },
          SolutionUUID: {
            default: 'Solution UUID'
          },
          TagsConfigCodeCommit: {
            default: 'Tag Configuration for filtering on CodeCommit Repositories'
          },
          TagsConfigCodeBuild: {
            default: 'Tag Configuration for filtering on CodeBuild Projects'
          },
          TagsConfigCodePipeline: {
            default: 'Tag Configuration for filtering on CodePipeline Pipelines'
          }
        }
      }
    };

    this.templateOptions.metadata = SharingAccountStackMetadata;

    //=========================================================================
    // MAPPINGS
    //=========================================================================
    const metricsMapping = new cdk.CfnMapping(this, 'AnonymousData', {
      mapping: {
        SendAnonymousUsageData: {
          Data: 'Yes',
          MetricsURL: 'https://metrics.awssolutionsbuilder.com/generic'
        }
      }
    });

    const userAgentExtraString = new cdk.CfnMapping(this, 'UserAgentExtra');
    userAgentExtraString.setValue('UserAgentExtra', 'Key', `AwsSolution/${props.solutionId}/${props.solutionVersion}`);

    //=========================================================================
    // RESOURCES
    //=========================================================================

    /**
     * Create an IAM role with permission to put CloudWatch events to custom event bus
     */
    const putEventsPS = new PolicyStatement({
      actions: ['events:PutEvents'],
      effect: Effect.ALLOW,
      resources: [paramMonitorAcctCustomEventBusARN.valueAsString],
      sid: 'putEventsPS'
    });

    const invokeEventBusRole = new Role(this, 'InvokeEventBusRole', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        InvokeEventBusPolicy: new PolicyDocument({
          statements: [putEventsPS]
        })
      }
    });

    /**
     * Create CloudWatch Events Rule for Canary events
     */
    new CanaryEvents(this, 'CanaryEvents', {
      targetArn: paramMonitorAcctCustomEventBusARN.valueAsString,
      eventsRuleRole: invokeEventBusRole
    });

    /**
     * Create CloudWatch Events Rule for CodePipeline Alarm events
     */
    new CodePipelineAlarmEvents(this, 'CodePipelineAlarmEvents', {
      targetArn: paramMonitorAcctCustomEventBusARN.valueAsString,
      eventsRuleRole: invokeEventBusRole,
      solutionId: props.solutionId
    });

    /**
     * Create CloudWatch Events Rule for AWS CodeDeploy
     */
    new CodeDeployEvents(this, 'CodeDeployEvents', {
      targetArn: paramMonitorAcctCustomEventBusARN.valueAsString,
      eventsRuleRole: invokeEventBusRole
    });

    /**
     * Create CloudWatch Events Rule for AWS CodePipeline
     */
    new CodePipelineEvents(this, 'CodePipelineEvents', {
      targetArn: paramMonitorAcctCustomEventBusARN.valueAsString,
      eventsRuleRole: invokeEventBusRole
    });

    /**
     * Create CloudWatch Events Rule for AWS CodeCommit
     */
    new CodeCommitEvents(this, 'CodeCommitEvents', {
      targetArn: paramMonitorAcctCustomEventBusARN.valueAsString,
      eventsRuleRole: invokeEventBusRole
    });

    /**
     * Create AWS resources needed to process CloudWatch Metrics for AWS CodeBuild, including:
     * CloudWatch Metric stream, Kinesis Data Firehose with lambda transformation
     */
    const metricsBucket: s3.Bucket = (s3.Bucket.fromBucketArn as any)(
      this,
      'DevOpsMetricsBucket',
      paramMonitorAcctMetricsBucketARN.valueAsString
    );

    const codebuildEvents = new CodeBuildEvents(this, 'CodeBuildEvents', {
      metricsBucket: metricsBucket,
      lambdaRunTime: props.lambdaRuntimeNode,
      uuid: props.solutionId,
      metricsGlueDBName: 'aws_devops_metrics_db_' + props.solutionId.toLowerCase(),
      codeBuildMetricsGlueTableName: 'aws_codebuild_metrics_table',
      callingStack: this,
      userAgentExtra: userAgentExtraString.findInMap('UserAgentExtra', 'Key'),
      monitoringAcctNumber: paramMonitorAcctNumber.valueAsString,
      monitoringAcctRegion: paramMonitorAcctRegion.valueAsString
    });

    const cfnRefFirehosePolicy = codebuildEvents.node.findChild('CodeBuild').node.findChild('KinesisFirehosePolicy')
      .node.defaultChild as CfnPolicy;

    const firehosePolicyCfnNag = [
      {
        id: 'W76',
        reason: 'This role needs all required permissions'
      }
    ];
    addCfnSuppressRules(cfnRefFirehosePolicy, firehosePolicyCfnNag);

    ApplyCfnSuppressRulesToLogRetentionResource(this, 'LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a');

    new TagQuery(this, 'TagQuery', {
      codeCommitTagConfig: paramUseCodeCommitTags.valueAsString,
      codeBuildTagConfig: paramUseCodeBuildTags.valueAsString,
      codePipelineTagConfig: paramUseCodePipelineTags.valueAsString,
      reportBucket: metricsBucket,
      lambdaRuntimeNode: props.lambdaRuntimeNode,
      userAgentExtraString: userAgentExtraString.findInMap('UserAgentExtra', 'Key'),
      uuid: paramSolutionUuid.valueAsString,
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      sendAnonymousUsageMetrics: metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
      metricsUrl: metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL'),
      stackType: 'sharing'
    });

    /**
     * Create AWS Glue database and table for CodeBuild metric
     */
    new GlueDatabase(this, 'GlueAthenaDatabase', {
      solutionId: props.solutionId,
      metricsBucket: metricsBucket,
      metricsBucketName: metricsBucket.bucketName,
      callingStack: 'sharing'
    });

    //=========================================================================
    // OUTPUTS
    //=========================================================================
    new cdk.CfnOutput(this, 'SolutionVersion', {
      value: props.solutionVersion,
      description: 'Version for DevOps Monitoring Dashboard on AWS solution'
    });
  }
}
