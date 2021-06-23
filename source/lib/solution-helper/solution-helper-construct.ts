/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { ExecutionRole } from './lambda-role-cloudwatch-construct';


export interface SolutionHelperProps {
  readonly solutionId: string;
  readonly version: string;
  readonly quickSightPrincipalARN: string;
  readonly athenaQueryDataDuration: string;
  readonly codeCommitRepo: string;
}

export class SolutionHelper extends cdk.Construct {
    private readonly _UuidCustomResource: cdk.CustomResource;
    public readonly solutionHelperLambda: lambda.Function;

    constructor(scope: cdk.Construct, id: string, props: SolutionHelperProps) {
        super(scope, id);

        const helperRole = new ExecutionRole(this, 'HelperRole');

        const helperFunction = new lambda.Function(this, 'SolutionHelper', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'lambda_function.handler',
            description: 'AWS DevOps Monitoring Dashboard Solution - This function generates UUID for each deployment.',
            role: helperRole.Role,
            code: lambda.Code.fromAsset(`${__dirname}/../../lambda/solution_helper`),
            timeout: cdk.Duration.seconds(300),
            environment: {
                UserAgentExtra: `AwsSolution/${props.solutionId}/${props.version}`
            }
        });

        const refhelperFunction =  helperFunction.node.findChild('Resource') as lambda.CfnFunction;
        refhelperFunction.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W89',
                        reason: 'There is no need to run this lambda in a VPC'
                    },
                    {
                        id: 'W92',
                        reason: 'There is no need for Reserved Concurrency'
                    }
                ]
            }
        };

        this.solutionHelperLambda = helperFunction;

        this._UuidCustomResource = new cdk.CustomResource(this, 'CreateUniqueID', {
            serviceToken: helperFunction.functionArn,
            properties: {
                'Resource': 'UUID'
            },
            resourceType: 'Custom::CreateUUID'
        });
    }

    public get UUIDCustomResource(): cdk.CustomResource {
      return this._UuidCustomResource;
    }

}
