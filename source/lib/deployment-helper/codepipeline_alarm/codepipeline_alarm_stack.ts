// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * @description
 * Creates a Canary that monitors an http or https url, and an alarm that will
 * send a signal to the solution each time the app is not 100% available.
 * Optionally, an S3 bucket for canary artifacts and access logging bucket are
 * created.
 * @author @aws-solutions
 */

import * as cdk from '@aws-cdk/core';
import {PipelineAlarmConstruct} from './codepipeline_alarm_construct';
import * as lambda from "@aws-cdk/aws-lambda";
import {addCfnSuppressRules} from "@aws-solutions-constructs/core";
import * as iam from "@aws-cdk/aws-iam";

export interface PipelineAlarmProps extends cdk.StackProps {
  readonly solutionId: string;
  readonly solutionVersion: string;
}

export class PipelineAlarmStack extends cdk.Stack {

  /**
   * @constructor
   * @param {cdk.Construct} scope - parent of the construct
   * @param {string} id - identifier for the object
   */
  constructor(scope: cdk.Construct, id: string, props: PipelineAlarmProps) {
    super(scope, id, props);

    //=========================================================================
    // PARAMETERS
    //=========================================================================

    /**
     * @description name of the CodePipeline
     * @type {cdk.CfnParameter}
     */
     const paramCodePipelineName = new cdk.CfnParameter(this, 'CodePipelineName', {
      description: "Name of the CodePipeline. Change the default value as needed.",
      type: "String"
    });

    /**
     * @description Create a new log group? YES or NO. A new log group is created during initial stack deployment.
     * For subsequent stack updates, recommend to select NO to reuse the existing log group.
     * @type {cdk.CfnParameter}
     */
    const paramCreateLogGroup= new cdk.CfnParameter(this, 'CreateLogGroup', {
      description: 'Create a new log group? Select YES to create a new log group if this is the first time you deploy the stack. For subsequent stack update, recommend to select NO to reuse the existing log group. Specify the Log group name below.',
      type: "String",
      default: "YES",
      allowedValues: [
        "YES",
        "NO",
      ]
    });

    /**
     * @description Name of the CodePipeline log group to which the pipeline events are sent
     * @type {cdk.CfnParameter}
     */
    const paramLogGroupName = new cdk.CfnParameter(this, 'LogGroupName', {
      description: "Name of the CodePipeline log group to which the pipeline events are sent. Change the default value as needed.",
      type: "String",
      default: "my-codepipeline-log-group"
    });

    /**
     * @description name of the source repository for the code pipeline
     * monitored
     * @type {cdk.CfnParameter}
     */
    const paramRepoName = new cdk.CfnParameter(this, 'RepoName', {
      description: "Name of source repository for the code pipeline. It will be part of the alarm name. Change the default value as needed.",
      type: "String"
    });

    const parameterMetaData = {
      "AWS::CloudFormation::Interface": {
        "ParameterGroups": [
          {
            "Label": {
              "default": "Events Rule Configuration"
            },
            "Parameters": [
              "CodePipelineName",
              "CreateLogGroup",
              "LogGroupName"
            ]
          },
          {
            "Label": {
              "default": "Alarm Configuration"
            },
            "Parameters": [
              "RepoName",
            ]
          }
        ],
        "ParameterLabels": {
          "CodePipelineName": {
            "default": "CodePipeline Name"
          },
          "CreateLogGroup": {
            "default": "Create a new log Group?"
          },
          "LogGroupName": {
            "default": "Log Group Name"
          },
          "RepoName": {
            "default": "Repository Name"
          }
        }
      }
    };
    this.templateOptions.metadata = parameterMetaData;

    const alarmName = props.solutionId + '-[' + paramCodePipelineName.valueAsString + ']-[' + paramRepoName.valueAsString + ']-MTTR'

    const metricNameSpaceMapping = new cdk.CfnMapping(this, 'CodePipelineMetrics', {
      mapping: {
        'CodePipelineMetrics': {
          'NameSpace': `CodePipeline/${props.solutionId}/Pipelines`,
        }
      }
    });

    new PipelineAlarmConstruct(this, "CodePipelineAlarm", {
      pipelineName: paramCodePipelineName.valueAsString,
      paramCreateLogGroup: paramCreateLogGroup,
      logGroupName: paramLogGroupName.valueAsString,
      metricNameSpace: metricNameSpaceMapping.findInMap('CodePipelineMetrics', 'NameSpace'),
      alarmName: alarmName,
    });

    class AddCfnSuppressRules implements cdk.IAspect {
      public visit(node: cdk.IConstruct): void {
        if (node instanceof lambda.CfnFunction) {
          addCfnSuppressRules(node, [
            {
              id: 'W58',
              reason: 'Lambda has the required permission to write CloudWatch Logs through a custom policy.'
            },
            {
              id: 'W89',
              reason: 'No need to deploy this Lambda to a VPC.'
            },
            {
              id: 'W92',
              reason: 'No need for simultaneous executions.'
            }
          ]);

        } else if (node instanceof iam.CfnPolicy) {
          addCfnSuppressRules(node, [
            {
              id: 'W12',
              reason: 'Resource * is required by the Lambda Execution role, so that the Lambda can add ResourcePolicies to all required resources.'
            },
          ]);
        }
      }
    }

    cdk.Aspects.of(this).add(new AddCfnSuppressRules());

    //=========================================================================
    // OUTPUTS
    //=========================================================================
    new cdk.CfnOutput(this, 'SolutionVersion', {
      value: props.solutionVersion,
      description: 'Version for AWS DevOps Monitoring Dashboard Solution'
    })

    new cdk.CfnOutput(this, 'Log Group Name', {
      value: paramLogGroupName.valueAsString,
      description: 'Name of the log group'
    })

    new cdk.CfnOutput(this, 'Alarm Name', {
      value: alarmName,
      description: 'Name of the CodePipeline alarm'
    })
  }
}
