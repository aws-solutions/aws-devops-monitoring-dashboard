/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

/**
 * @description
 * Creates a Canary that monitors an http or https url, and an alarm that will
 * send a signal to the solution each time the app is not 100% available.
 * Optionally, an S3 bucket for canary artifacts and access logging bucket are
 * created.
 * @author @aws-solutions
 */

import * as cdk from '@aws-cdk/core';
import * as synth from '@aws-cdk/aws-synthetics';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { CfnOutput } from '@aws-cdk/core';
import { applySecureBucketPolicy } from '@aws-solutions-constructs/core';
import { AlarmConstruct } from './alarm_construct';

export interface iCanaryProps extends cdk.StackProps {
  readonly solutionId: string;
  readonly solutionVersion?: string;
  readonly solutionDistBucket?: string;
  readonly solutionDistName?: string;
  readonly solutionName: string;
}

export class CanaryStack extends cdk.Stack {
  /**
   * @constructor
   * @param {cdk.Construct} scope - parent of the construct
   * @param {string} id - identifier for the object
   */
  constructor(scope: cdk.Construct, id: string, props: iCanaryProps) {
    super(scope, id, props);
    //=========================================================================
    // PARAMETERS
    //=========================================================================
    /**
     * @description name of the CodeCommit repository for the application to be
     * monitored
     * @type {cdk.CfnParameter}
     */
    const paramRepoName = new cdk.CfnParameter(this, 'RepoName', {
      description: "Name of CodeCommit repository for the application.",
      type: "String"
    });

    /**
     * @description name of the application
     * @type {cdk.CfnParameter}
     */
    const paramAppName = new cdk.CfnParameter(this, 'AppName', {
      description: "Name of the application that canary monitors.",
      type: "String"
    });

    /**
     * @description url to monitor via a synthetic transaction
     * @type {cdk.CfnParameter}
     */
    const paramCanaryUrl = new cdk.CfnParameter(this, 'URL', {
      description: "Application or endpoint URL you want to monitor with the canary (for example, https://www.example.com). The canary will check the site every 5 minutes.",
      type: "String"
    });

    /**
     * @description name of the canary (synthetic transaction)
     * @type {cdk.CfnParameter}
     */
    const paramCanaryName = new cdk.CfnParameter(this, 'CanaryName', {
      description: "Name of your Canary (new or existing) so users can easily understand what it is in the console.",
      type: "String",
      default: "mycanary",
      allowedPattern: "^[0-9a-z_\-]+$"
    });

    /**
     * @description milliseconds to wait for a response
     * @type {cdk.CfnParameter}
     */
    const paramResponseThresh = new cdk.CfnParameter(this, 'ResponseThreshold', {
      description: "Number of milliseconds to wait for a url response before considering the canary failed.",
      type: "String",
      default: "15000",
      allowedPattern: "^[0-9]+$"
    });

    /**
     * @description canary interval, in minutes
     * @type {cdk.CfnParameter}
     */
    const paramCanaryInterval = new cdk.CfnParameter(this, 'Interval', {
      description: "Interval, in minutes.",
      type: "String",
      default: "5"
    });

    /**
     * @description threshold for SuccessPercent
     * @type {cdk.CfnParameter}
     */
    const paramThreshold = new cdk.CfnParameter(this, 'PercentThreshold', {
      description: "Threshold for Success (percentage). Any value less than this value will result in an alarm being triggered.",
      type: "Number",
      default: 100
    });

    /**
     * @description number of eval periods to compare to threshold
     * @type {cdk.CfnParameter}
     */
    const paramEvalPeriods = new cdk.CfnParameter(this, 'EvalPeriods', {
      description: "Number of periods to compare to the threshold.",
      type: "Number",
      default: 1
    });

    /**
     * @description number of periods before alarming when below threshold
     * @type {cdk.CfnParameter}
     */
    const paramAlarmPeriods = new cdk.CfnParameter(this, 'AlarmPeriods', {
      description: "Number of collection periods over which the threshold is exceeded before alarming. \
        This value must be less than or equal to Evaluation Periods",
      type: "Number",
      default: 1
    });

    /**
     * @description should artifact bucket be created?
     * @type {cdk.CfnParameter}
     */
    const paramCreateBucket = new cdk.CfnParameter(this, 'CreateBucket', {
      description: "Canaries store artifacts in an S3 bucket. Should this \
        canary create a new bucket? Enter the bucket name (new or existing) below.",
      type: "String",
      default: "No",
      allowedValues: [
        "No",
        "Yes",
      ]
    });

    /**
     * @description should canary be created?
     * @type {cdk.CfnParameter}
     */
    const paramCreateCanary = new cdk.CfnParameter(this, 'CreateCanary', {
      description: "Should a new canary be created? If yes, a canary with the name specified above will be created. If no, just skip the rest of Canary Configuration and move on to Application Monitoring.",
      type: "String",
      default: "Yes",
      allowedValues: [
        "No",
        "Yes",
      ]
    });

    /**
     * @description bucket to store canary artifacts. Can be an existing bucket.
     * @type {cdk.CfnParameter}
     */
    const paramBucketName = new cdk.CfnParameter(this, 'BucketName', {
      description: "Name of the bucket (new or existing) for logging \
        Canary artifacts. Each Canary will log to this bucket to a different \
        prefix.",
      type: "String"
    });

    const parameterMetaData = {
      "AWS::CloudFormation::Interface": {
        "ParameterGroups": [
          {
            "Label": {
              "default": "Canary Configuration"
            },
            "Parameters": [
              "CanaryName",
              "CreateCanary",
              "URL",
              "Interval",
              "ResponseThreshold",
              "CreateBucket",
              "BucketName"
            ]
          },
          {
            "Label": {
              "default": "Application Monitoring"
            },
            "Parameters": [
              "AppName",
              "RepoName",
            ]
          },
          {
            "Label": {
              "default": "Alarm Configuration"
            },
            "Parameters": [
              "PercentThreshold",
              "EvalPeriods",
              "AlarmPeriods"
            ]
          }
        ],
        "ParameterLabels": {
          "URL": {
            "default": "URL"
          },
          "CanaryName": {
            "default": "Canary Name"
          },
          "CreateCanary": {
            "default": "Create New Canary?"
          },
          "CanaryInterval": {
            "default": "Canary Interval"
          },
          "CreateBucket": {
            "default": "Create Artifact Bucket?"
          },
          "BucketName": {
            "default": "Artifact Bucket Name"
          },
          "PercentThreshold": {
            "default": "% Success Threshold (<)"
          },
          "ResponseThreshold": {
            "default": "Response Threshold (ms)"
          },
          "EvalPeriods": {
            "default": "Evaluation Periods"
          },
          "AlarmPeriods": {
            "default": "Alarm Periods"
          },
          "AppName": {
            "default": "Application Name"
          },
          "RepoName": {
            "default": "Repository Name"
          }
        }
      }
    };
    this.templateOptions.metadata = parameterMetaData;

    //=========================================================================
    // CONDITIONS
    //=========================================================================
    const cndCanaryBucket = new cdk.CfnCondition(this, "CanaryBucketCondition", {
      expression: cdk.Fn.conditionEquals(paramCreateBucket, "Yes")
    });

    const cndCreateCanary = new cdk.CfnCondition(this, "CreateCanaryCondition", {
      expression: cdk.Fn.conditionEquals(paramCreateCanary, "Yes")
    });

    const cndCreateBucket = new cdk.CfnCondition(this, "CreateBucketCondition", {
      expression: cdk.Fn.conditionAnd(cndCanaryBucket, cndCreateCanary)
    });

    //=========================================================================
    // RESOURCES
    //=========================================================================
    // ArtifactBucket
    // --------------
    let ArtifactBucketCfg = {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      bucketName: paramBucketName.valueAsString
    } as s3.BucketProps;

    const bktArtifact = new s3.Bucket(this, "ArtifactBucket", ArtifactBucketCfg);

    applySecureBucketPolicy(bktArtifact);
    cdk.Tags.of(bktArtifact).add('Name', props.solutionName + ' Canary Artifacts')
    {
      let childToMod = bktArtifact.node.defaultChild as s3.CfnBucket;
      childToMod.addPropertyDeletionOverride('LifecycleConfiguration.Rules')
      childToMod.cfnOptions.condition = cndCreateBucket;
    }
    {
      let intermediate = bktArtifact.node.findChild('Policy') as s3.BucketPolicy;
      let childToMod = intermediate.node.defaultChild as s3.CfnBucketPolicy;
      childToMod.cfnOptions.condition = cndCreateBucket;
    }

    const bktArtifactResource = bktArtifact.node.findChild('Resource') as s3.CfnBucket;

    bktArtifactResource.cfnOptions.metadata = {
         cfn_nag: {
            rules_to_suppress: [{
                id: 'W35',
                reason: 'This bucket is used by canary to store artifacts and no access loging bucket is needed.'
            }]
        }
    };

    // Get iBucket reference - works whether bucket was created or not
    //
    let artifactBucket: s3.IBucket = s3.Bucket.fromBucketAttributes(this, "ArtifactiBucket", {
        bucketName: paramBucketName.valueAsString
    });

    const canaryCode = [
      "var synthetics = require('Synthetics');",
      "const log = require('SyntheticsLogger');",
      "",
      "const pageLoadBlueprint = async function () {",
      "",
      "  const URL = \"" + paramCanaryUrl.valueAsString + "\";",
      "",
      "  let page = await synthetics.getPage();",
      "  const response = await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});",
      "  //Wait for page to render.",
      "  //Increase or decrease wait time based on endpoint being monitored.",
      "  await page.waitFor(" + paramResponseThresh.valueAsString + ");",
      "  // This will take a screenshot that will be included in test output artifacts",
      "  await synthetics.takeScreenshot('loaded', 'loaded');",
      "  let pageTitle = await page.title();",
      "  log.info('Page title: ' + pageTitle);",
      "  if (response.status() !== 200) {",
      "      throw \"Failed to load page!\";",
      "  }",
      "};",
      "",
      "exports.handler = async () => {",
      "    return await pageLoadBlueprint();",
      "};"
    ]

    // Note: undate SYNTHETICS_1_0 to SYNTHETICS_2_0 as soon as CDK supports it
    const canary = new synth.Canary(this, 'HttpCanary', {
      canaryName: paramCanaryName.valueAsString,
      schedule: synth.Schedule.rate(cdk.Duration.minutes(5)),
      test: synth.Test.custom({
        code: synth.Code.fromInline(canaryCode.join("\n")),
        handler: 'index.handler'
      }),
      artifactsBucketLocation: {
        bucket: artifactBucket,
        prefix: cdk.Aws.STACK_NAME
      },
      runtime: synth.Runtime.SYNTHETICS_1_0
    });
    (canary.node.defaultChild as synth.CfnCanary).addPropertyOverride(
      "Schedule", {
          "DurationInSeconds": "0",
          "Expression": "rate(" + paramCanaryInterval.valueAsString + " minutes)"
      }
    );
    (canary.node.defaultChild as synth.CfnCanary).addPropertyOverride(
      "RuntimeVersion", "syn-nodejs-puppeteer-3.1"
    );

    const canaryServiceRoleResource = canary.node.findChild('ServiceRole').node.findChild('Resource') as iam.CfnRole;

    canaryServiceRoleResource.cfnOptions.metadata = {
         cfn_nag: {
            rules_to_suppress: [{
                id: 'W11',
                reason: 'Resource * is required by the canary service role.'
            }]
        }
    };

    let refCanary = canary.node.defaultChild as synth.CfnCanary
    refCanary.cfnOptions.condition = cndCreateCanary;

    // Alarm State - the canary is "failed" when...
    // --------------------------------------------
    const alarmName = props.solutionId + '-[' + paramAppName.valueAsString + ']-[' + paramRepoName.valueAsString + ']-MTTR'
    new AlarmConstruct(this, "Alarm", {
      canaryName: paramCanaryName.valueAsString,
      alarmName: alarmName,
      evalPeriods: paramEvalPeriods.valueAsNumber,
      alarmPeriods: paramAlarmPeriods.valueAsNumber,
      threshold: paramThreshold.valueAsNumber
    });


    //=========================================================================
    // OUTPUTS
    //=========================================================================
    new CfnOutput(this, 'SolutionVersion', {
      value: props.solutionVersion?props.solutionVersion:'',
      description: 'Version for AWS DevOps Monitoring Dashboard Solution'
    })

    new CfnOutput(this, 'Canary Name', {
      value: paramCanaryName.valueAsString,
      description: 'Name of the Canary'
    })

    new CfnOutput(this, 'Alarm Name', {
      value: alarmName,
      description: 'Name of the Canary Alarm'
    })

  }
}
