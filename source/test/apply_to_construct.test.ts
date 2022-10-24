// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourcePart, SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument, CfnRole } from 'aws-cdk-lib/aws-iam';
import { ApplyCfnSuppressRulesToLogRetentionResource } from '../lib/util/apply_to_construct';

test('adding cfn suppressing rules to lambda', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app);

  const cwLogsPS = new PolicyStatement({
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    effect: Effect.ALLOW,
    resources: [
      stack.formatArn({
        service: 'logs',
        resource: 'log-group',
        arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
        resourceName: '/aws/lambda/*'
      })
    ],
    sid: 'CreateCWLogs'
  });

  const lambdaRole = new Role(stack, 'ServiceRole', {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    path: '/',
    inlinePolicies: {
      LambdaPolicyName: new PolicyDocument({
        statements: [cwLogsPS]
      })
    }
  });

  const cfnLambdaRole = lambdaRole.node.defaultChild as CfnRole;

  cfnLambdaRole.overrideLogicalId('ServiceRole');

  new lambda.Function(stack, 'testFunction', {
    code: lambda.Code.fromInline('exports.handler = (event, context, callback) => {}'),
    runtime: lambda.Runtime.NODEJS_14_X,
    handler: 'index.handler',
    role: lambdaRole
  });

  ApplyCfnSuppressRulesToLogRetentionResource(stack, 'testFunction');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();

  expect(stack).toHaveResourceLike(
    'AWS::Lambda::Function',
    {
      Metadata: {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W58',
              reason: 'Lambda has the required permission to write CloudWatch Logs through a custom policy.'
            },
            {
              id: 'W89',
              reason: 'There is no need to deploy this Lambda to a VPC.'
            },
            {
              id: 'W92',
              reason: 'There is no need for Reserved Concurrency.'
            }
          ]
        }
      }
    },
    ResourcePart.CompleteDefinition
  );
});
