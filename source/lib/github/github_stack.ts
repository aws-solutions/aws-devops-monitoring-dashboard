#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { GitHubEvents } from './github_construct';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ApplyCfnSuppressRulesToLogRetentionResource } from '../util/apply_to_construct';

export interface GitHubNestedStackProps extends NestedStackProps {
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly solutionName: string;
  readonly solutionDistBucket?: string;
  readonly solutionDistName?: string;
  readonly lambdaRuntimeNode: Runtime;
  readonly webhookSecretToken: string;
  readonly allowedIPs: string;
  readonly metricsBucket: Bucket | undefined;
  readonly uuid: string;
  readonly metricsGlueDBName: string;
  readonly gitHubMetricsGlueTableName: string;
}

export class GitHubStack extends NestedStack {
  private _gitHubEvents: GitHubEvents;

  constructor(scope: Construct, id: string, props: GitHubNestedStackProps) {
    super(scope, id, props);

    /**
     * Invoke github construct to create AWS resources
     */
    this._gitHubEvents = new GitHubEvents(this, 'GitHubEvents', {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionName: props.solutionName,
      solutionDistBucket: props.solutionDistBucket || '',
      solutionDistName: props.solutionDistName || '',
      lambdaRuntimeNode: props.lambdaRuntimeNode,
      webhookSecretToken: props.webhookSecretToken,
      allowedIPs: props.allowedIPs,
      metricsBucket: props.metricsBucket,
      uuid: props.uuid,
      metricsGlueDBName: props.metricsGlueDBName,
      gitHubMetricsGlueTableName: props.gitHubMetricsGlueTableName,
      userAgentExtra: `AwsSolution/${props.solutionId}/${props.solutionVersion}`,
      callingStack: this
    });

    ApplyCfnSuppressRulesToLogRetentionResource(this, 'LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a');
  }

  public get apiEndpointOutput(): string {
    return this._gitHubEvents.apiEndpoint;
  }
}
