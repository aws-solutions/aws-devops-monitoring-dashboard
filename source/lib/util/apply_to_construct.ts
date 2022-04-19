/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance     *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import { CfnFunction } from '@aws-cdk/aws-lambda';
import { Construct, Stack } from '@aws-cdk/core';
import { CfnPolicy } from '@aws-cdk/aws-iam';
import { addCfnSuppressRules } from "@aws-solutions-constructs/core";

export function ApplyCfnSuppressRulesToLogRententionResourc(scope: Construct, id: string) {

  // Add rules to suppress to log retention lambda
  let logRetentionLambda = Stack.of(scope).node.tryFindChild(id)?.node.findChild('Resource') as CfnFunction;
  if (logRetentionLambda) {
    addCfnSuppressRules(logRetentionLambda, [
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
    ]);
  }

  // Add rules to suppress to log retention lambda policy
  let logRetentionPolicy = Stack.of(scope).node.tryFindChild(id)?.node.tryFindChild('ServiceRole')?.node.findChild('DefaultPolicy').node.findChild('Resource') as CfnPolicy;
  if (logRetentionPolicy) {
    addCfnSuppressRules(logRetentionPolicy, [
      {
        id: 'W12',
        reason: 'Resource * is required by the Lambda Execution role, so that the Lambda can add ResourcePolicies to all required resources.'
      },
    ]);
  }
}