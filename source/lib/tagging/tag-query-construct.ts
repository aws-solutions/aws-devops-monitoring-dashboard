#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';

export class TagQueryProps {
  codeCommitTagConfig: string;
  codeBuildTagConfig: string;
  codePipelineTagConfig: string;
  reportBucket: s3.IBucket;
  lambdaRuntimeNode: lambda.Runtime;
  logLevel?: string;
  uuid?: string;
  userAgentExtraString?: string;
  solutionId: string;
  solutionVersion: string;
  sendAnonymousUsageMetrics: string;
  metricsUrl: string;
  stackType: string;
}

export class TagQuery extends Construct {
  constructor(scope: Construct, id: string, props: TagQueryProps) {
    super(scope, id);

    const functionRole = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });

    const functionPolicy = new iam.Policy(this, 'Policy', {
      roles: [functionRole],
      statements: [
        new iam.PolicyStatement({
          sid: 'LogsStatement',
          effect: iam.Effect.ALLOW,
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: [
            cdk.Stack.of(this).formatArn({
              service: 'logs',
              resource: 'log-group',
              arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
              resourceName: '/aws/lambda/*'
            })
          ]
        }),
        new iam.PolicyStatement({
          sid: 'TagStatement',
          effect: iam.Effect.ALLOW,
          actions: ['tag:GetResources'],
          resources: ['*']
        }),
        new iam.PolicyStatement({
          sid: 'ReportStatement',
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:DeleteObject'],
          resources: [props.reportBucket.arnForObjects('TaggedResources/*')]
        })
      ]
    });
    NagSuppressions.addResourceSuppressions(functionPolicy, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions required for logging, GetResources, and uploading to S3.'
      }
    ]);
    addCfnSuppressRules(functionPolicy, [
      {
        id: 'W12',
        reason: 'This lambda requires wildcard permissions to write logs, query tag information, and upload reports'
      }
    ]);

    const lambdaFunction = new lambda.Function(this, 'TagQuery', {
      description:
        'DevOps Monitoring Dashboard on AWS solution - This function queries CodeCommit, CodeBuild, and CodePipeline resources for tag information.',
      timeout: cdk.Duration.minutes(15),
      environment: {
        LOG_LEVEL: props.logLevel ?? 'INFO',
        USER_AGENT_EXTRA: props.userAgentExtraString ?? '',
        SOLUTION_UUID: props.uuid || props.solutionId,
        SOLUTION_VERSION: props.solutionVersion,
        SOLUTION_ID: props.solutionId,
        METRICS_URL: props.metricsUrl,
        SEND_ANONYMOUS_USAGE_METRICS: props.sendAnonymousUsageMetrics,
        STACK_TYPE: props.stackType
      },
      role: functionRole,
      tracing: lambda.Tracing.ACTIVE,
      runtime: props.lambdaRuntimeNode,
      code: lambda.Code.fromAsset(`${__dirname}/../../lambda/tag_query`),
      handler: 'index.handler'
    });
    NagSuppressions.addResourceSuppressions(functionRole.node.findChild('DefaultPolicy'), [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions required for xray.'
      }
    ]);
    addCfnSuppressRules(functionRole.node.findChild('DefaultPolicy') as cdk.CfnResource, [
      {
        id: 'W12',
        reason: 'Wildcard permissions required for xray.'
      }
    ]);
    addCfnSuppressRules(lambdaFunction, [
      {
        id: 'W58',
        reason: 'Lambda has the required permission to write CloudWatch Logs through a custom policy.'
      },
      {
        id: 'W89',
        reason: 'This lambda does not need to be deployed inside a VPC'
      },
      {
        id: 'W92',
        reason: 'This lambda does not need reserved concurrent executions'
      }
    ]);

    const input = {
      ReportBucket: props.reportBucket.bucketName,
      CodeCommitTagConfig: props.codeCommitTagConfig,
      CodeBuildTagConfig: props.codeBuildTagConfig,
      CodePipelineTagConfig: props.codePipelineTagConfig
    };

    const invokeResource = new cdk.CustomResource(this, 'InvokeTagQuery', {
      serviceToken: lambdaFunction.functionArn,
      resourceType: 'Custom::InvokeTagQuery',
      properties: input
    });
    invokeResource.node.addDependency(functionPolicy);

    const rule = new events.Rule(this, 'Rule', {
      description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for querying tag information',
      schedule: events.Schedule.rate(cdk.Duration.minutes(15))
    });

    // Only enable the rule if there is work to do
    const conditionAnyTagConfigs = new cdk.CfnCondition(this, 'AnyTagConfigsCond', {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionAnd(
          cdk.Fn.conditionEquals(props.codeCommitTagConfig, ''),
          cdk.Fn.conditionEquals(props.codeBuildTagConfig, ''),
          cdk.Fn.conditionEquals(props.codePipelineTagConfig, '')
        )
      )
    });

    const cfnRule = rule.node.defaultChild as events.CfnRule;
    cfnRule.addPropertyOverride('State', cdk.Fn.conditionIf(conditionAnyTagConfigs.logicalId, 'ENABLED', 'DISABLED'));

    rule.addTarget(
      new targets.LambdaFunction(lambdaFunction, {
        event: events.RuleTargetInput.fromObject(input),
        // Let the function manage retries, we have a low TPS limit
        retryAttempts: 0
      })
    );
  }
}
