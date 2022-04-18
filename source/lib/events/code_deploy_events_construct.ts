// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import { overrideProps, DefaultEventsRuleProps} from '@aws-solutions-constructs/core';

export interface CodeDeployEventsProps {
  firehoseArn: string;
  eventsRuleRole: iam.Role;
}

export class CodeDeployEvents extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CodeDeployEventsProps) {
    super(scope, id);

    /**
     * Create CloudWatch Events Rule for AWS CodeDeploy
     */
    let codeDeployEventRulePattern = {
      "source": [
        "aws.codedeploy"
      ],
      "detail-type": [
        "CodeDeploy Deployment State-change Notification"
      ]
    }

    let codeDeployEventRuleTarget: events.IRuleTarget = {
      bind: () => ({
        id: '',
        arn: props.firehoseArn,
        role: props.eventsRuleRole
      })
    };

    let codeDeployEventRuleProps = {
      description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for AWS CodeDeploy',
      eventPattern: codeDeployEventRulePattern,
      enabled: true
    }

    const defaultCodeDeployEventsRuleProps = DefaultEventsRuleProps([codeDeployEventRuleTarget]);
    const codeDeployEventsRuleProps = overrideProps(defaultCodeDeployEventsRuleProps, codeDeployEventRuleProps, true);

    new events.Rule(this, 'CodeDeployEventsRule', codeDeployEventsRuleProps);
  }
}