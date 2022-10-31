// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { overrideProps, DefaultEventsRuleProps } from '@aws-solutions-constructs/core';

export interface CodeDeployEventsProps {
  targetArn: string;
  eventsRuleRole: iam.Role;
  eventBus?: events.IEventBus;
}

export class CodeDeployEvents extends Construct {
  constructor(scope: Construct, id: string, props: CodeDeployEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for AWS CodeDeploy
     */
    const codeDeployEventRulePattern = {
      source: ['aws.codedeploy'],
      'detail-type': ['CodeDeploy Deployment State-change Notification']
    };

    const codeDeployEventRuleTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.targetArn,
        role: props.eventsRuleRole
      })
    };

    const codeDeployEventRuleProps = {
      description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for AWS CodeDeploy',
      eventPattern: codeDeployEventRulePattern,
      enabled: true
    };

    const defaultCodeDeployEventsRuleProps = DefaultEventsRuleProps([codeDeployEventRuleTarget]);
    let codeDeployEventsRuleProps = overrideProps(defaultCodeDeployEventsRuleProps, codeDeployEventRuleProps, true);

    // Use custom event bus for multi-account events ingestion
    if (props.eventBus !== undefined) {
      codeDeployEventsRuleProps = { ...codeDeployEventsRuleProps, eventBus: props.eventBus };
    }

    new events.Rule(this, 'CodeDeployEventsRule', codeDeployEventsRuleProps);
  }
}
