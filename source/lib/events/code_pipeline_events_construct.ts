// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

 import * as cdk from '@aws-cdk/core';
 import * as iam from '@aws-cdk/aws-iam';
 import * as events from '@aws-cdk/aws-events';
 import { overrideProps, DefaultEventsRuleProps} from '@aws-solutions-constructs/core';
 
 export interface CodePipelineEventsProps {
   firehoseArn: string;
   eventsRuleRole: iam.Role;
 }
 
 export class CodePipelineEvents extends cdk.Construct {
   constructor(scope: cdk.Construct, id: string, props: CodePipelineEventsProps) {
     super(scope, id);
 
     /**
      * Create CloudWatch Events Rule for AWS CodePipeline
      */
     let codeDeployEventRulePattern = {
       "source": [
         "aws.codepipeline"
       ],
       "detail-type": [
         "CodePipeline Action Execution State Change"
       ]
     }
 
     let codeDeployEventRuleTarget: events.IRuleTarget = {
       bind: () => ({
         id: '',
         arn: props.firehoseArn,
         role: props.eventsRuleRole
       })
     };
 
     let codePipelineEventRuleProps = {
       description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for AWS CodePipeline',
       eventPattern: codeDeployEventRulePattern,
       enabled: true
     }
 
     const defaultCodePipelineEventsRuleProps = DefaultEventsRuleProps([codeDeployEventRuleTarget]);
     const codePipelineEventsRuleProps = overrideProps(defaultCodePipelineEventsRuleProps, codePipelineEventRuleProps, true);
 
     new events.Rule(this, 'CodePipelineEventsRule', codePipelineEventsRuleProps);
   }
 }