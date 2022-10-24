// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { overrideProps, DefaultEventsRuleProps } from '@aws-solutions-constructs/core';

export interface CodeCommitEventsProps {
  targetArn: string;
  eventsRuleRole: iam.Role;
  eventBus?: events.IEventBus;
}

export class CodeCommitEvents extends Construct {
  constructor(scope: Construct, id: string, props: CodeCommitEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for AWS CodePipeline
     */
    const codeCommitEventRulePattern = {
      'detail-type': ['AWS API Call via CloudTrail'],
      source: ['aws.codecommit'],
      detail: {
        eventName: ['PutFile', 'DeleteFile', 'UpdateFile', 'GitPush']
      }
    };

    const codeCommitEventRuleTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.targetArn ? props.targetArn : '',
        role: props.eventsRuleRole
      })
    };

    const codeCommitEventRuleProps = {
      description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for AWS CodeCommit',
      eventPattern: codeCommitEventRulePattern,
      enabled: true
    };

    const defaultCodeCommitEventsRuleProps = DefaultEventsRuleProps([codeCommitEventRuleTarget]);
    let CodeCommitEventsRuleProps = overrideProps(defaultCodeCommitEventsRuleProps, codeCommitEventRuleProps, true);

    // Use custom event bus for multi-account events ingestion
    if (props.eventBus !== undefined) {
      CodeCommitEventsRuleProps = { ...CodeCommitEventsRuleProps, eventBus: props.eventBus };
    }

    new events.Rule(this, 'CodeCommitEventsRule', CodeCommitEventsRuleProps);
  }
}
