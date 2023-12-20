// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExecutionRole } from './lambda-role-cloudwatch-construct';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { NagSuppressions } from 'cdk-nag';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export interface SolutionHelperProps {
  readonly solutionId: string;
  readonly version: string;
  readonly quickSightPrincipalARN: string;
  readonly athenaQueryDataDuration: string;
  readonly codeCommitRepo: string;
}

export class SolutionHelper extends Construct {
  private readonly _UuidCustomResource: cdk.CustomResource;
  public readonly solutionHelperLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: SolutionHelperProps) {
    super(scope, id);

    const helperRole = new ExecutionRole(this, 'HelperRole');

    const helperFunction = new lambda.Function(this, 'SolutionHelper', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.handler',
      description: 'DevOps Monitoring Dashboard on AWS solution - This function generates UUID for each deployment.',
      role: helperRole.Role,
      code: lambda.Code.fromAsset(`${__dirname}/../../lambda/solution_helper`),
      timeout: cdk.Duration.seconds(300),
      environment: {
        UserAgentExtra: `AwsSolution/${props.solutionId}/${props.version}`
      },
      logRetention: RetentionDays.THREE_MONTHS
    });

    const refhelperFunction = helperFunction.node.findChild('Resource') as lambda.CfnFunction;
    addCfnSuppressRules(refhelperFunction, [
      {
        id: 'W89',
        reason: 'There is no need to run this lambda in a VPC'
      },
      {
        id: 'W92',
        reason: 'There is no need for Reserved Concurrency'
      }
    ]);
    
    NagSuppressions.addResourceSuppressions(helperFunction, [
      {
        id: 'AwsSolutions-L1',
        reason: 'Running Python 3.11.'
      }
    ]);

    this.solutionHelperLambda = helperFunction;

    this._UuidCustomResource = new cdk.CustomResource(this, 'CreateUniqueID', {
      serviceToken: helperFunction.functionArn,
      properties: {
        Resource: 'UUID'
      },
      resourceType: 'Custom::CreateUUID'
    });
  }

  public get UUIDCustomResource(): cdk.CustomResource {
    return this._UuidCustomResource;
  }
}
