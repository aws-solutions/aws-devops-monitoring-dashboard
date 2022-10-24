// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { overrideProps, DefaultEventsRuleProps } from '@aws-solutions-constructs/core';

export interface CodePipelineEventsProps {
  targetArn: string;
  eventsRuleRole: iam.Role;
  eventBus?: events.IEventBus;
}

export class CodePipelineEvents extends Construct {
  constructor(scope: Construct, id: string, props: CodePipelineEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for AWS CodePipeline
     */
    const codeDeployEventRulePattern = {
      source: ['aws.codepipeline'],
      'detail-type': ['CodePipeline Action Execution State Change']
    };

    const codeDeployEventRuleTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.targetArn ? props.targetArn : '',
        role: props.eventsRuleRole
      })
    };

    const codePipelineEventRuleProps = {
      description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for AWS CodePipeline',
      eventPattern: codeDeployEventRulePattern,
      enabled: true
    };

    const defaultCodePipelineEventsRuleProps = DefaultEventsRuleProps([codeDeployEventRuleTarget]);
    let codePipelineEventsRuleProps = overrideProps(
      defaultCodePipelineEventsRuleProps,
      codePipelineEventRuleProps,
      true
    );

    // Use custom event bus for multi-account events ingestion
    if (props.eventBus !== undefined) {
      codePipelineEventsRuleProps = { ...codePipelineEventsRuleProps, eventBus: props.eventBus };
    }

    new events.Rule(this, 'CodePipelineEventsRule', codePipelineEventsRuleProps);
  }
}
