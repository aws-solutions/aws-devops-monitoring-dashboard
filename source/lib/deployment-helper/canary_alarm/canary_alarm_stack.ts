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

import { Aws, CfnCondition, CfnOutput, CfnParameter, Fn, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnCanary } from 'aws-cdk-lib/aws-synthetics';
import { Canary, Code, Runtime, Schedule, Test } from '@aws-cdk/aws-synthetics-alpha';
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  BucketProps,
  CfnBucket,
  CfnBucketPolicy,
  IBucket
} from 'aws-cdk-lib/aws-s3';
import { AnyPrincipal, CfnRole, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AlarmConstruct } from './alarm_construct';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { NagSuppressions } from 'cdk-nag';

export interface CanaryProps extends StackProps {
  readonly solutionId: string;
  readonly solutionVersion?: string;
  readonly solutionDistBucket?: string;
  readonly solutionDistName?: string;
  readonly solutionName: string;
}

export class CanaryStack extends Stack {
  /**
   * @function Object() { [native code] }
   * @param {Construct} scope - parent of the construct
   * @param props
   * @param {string} id - identifier for the object
   */
  constructor(scope: Construct, id: string, props: CanaryProps) {
    super(scope, id, props);
    //=========================================================================
    // PARAMETERS
    //=========================================================================
    /**
     * @description name of the CodeCommit repository for the application to be
     * monitored
     * @type {CfnParameter}
     */
    const paramRepoName = new CfnParameter(this, 'RepoName', {
      description: 'Name of CodeCommit repository for the application.',
      type: 'String'
    });

    /**
     * @description name of the application
     * @type {CfnParameter}
     */
    const paramAppName = new CfnParameter(this, 'AppName', {
      description: 'Name of the application that canary monitors.',
      type: 'String'
    });

    /**
     * @description url to monitor via a synthetic transaction
     * @type {CfnParameter}
     */
    const paramCanaryUrl = new CfnParameter(this, 'URL', {
      description:
        'Application or endpoint URL you want to monitor with the canary (for example, https://www.example.com). The canary will check the site every 5 minutes.',
      type: 'String'
    });

    /**
     * @description name of the canary (synthetic transaction)
     * @type {CfnParameter}
     */
    const paramCanaryName = new CfnParameter(this, 'CanaryName', {
      description: 'Name of your Canary (new or existing) so users can easily understand what it is in the console.',
      type: 'String',
      default: 'mycanary',
      allowedPattern: '^[0-9a-z_-]+$'
    });

    /**
     * @description milliseconds to wait for a response
     * @type {CfnParameter}
     */
    const paramResponseThresh = new CfnParameter(this, 'ResponseThreshold', {
      description: 'Number of milliseconds to wait for a url response before considering the canary failed.',
      type: 'String',
      default: '15000',
      allowedPattern: '^[0-9]+$'
    });

    /**
     * @description canary interval, in minutes
     * @type {CfnParameter}
     */
    const paramCanaryInterval = new CfnParameter(this, 'Interval', {
      description: 'Interval, in minutes.',
      type: 'Number',
      default: 5
    });

    /**
     * @description threshold for SuccessPercent
     * @type {CfnParameter}
     */
    const paramThreshold = new CfnParameter(this, 'PercentThreshold', {
      description:
        'Threshold for Success (percentage). Any value less than this value will result in an alarm being triggered.',
      type: 'Number',
      default: 100
    });

    /**
     * @description number of eval periods to compare to threshold
     * @type {CfnParameter}
     */
    const paramEvalPeriods = new CfnParameter(this, 'EvalPeriods', {
      description: 'Number of periods to compare to the threshold.',
      type: 'Number',
      default: 1
    });

    /**
     * @description number of periods before alarming when below threshold
     * @type {CfnParameter}
     */
    const paramAlarmPeriods = new CfnParameter(this, 'AlarmPeriods', {
      description:
        'Number of collection periods over which the threshold is exceeded before alarming. ' +
        'This value must be less than or equal to Evaluation Periods',
      type: 'Number',
      default: 1
    });

    /**
     * @description should artifact bucket be created?
     * @type {CfnParameter}
     */
    const paramCreateBucket = new CfnParameter(this, 'CreateBucket', {
      description:
        'Canaries store artifacts in an S3 bucket. ' +
        'Should this canary create a new bucket? Enter the bucket name (new or existing) below.',
      type: 'String',
      default: 'No',
      allowedValues: ['No', 'Yes']
    });

    /**
     * @description should canary be created?
     * @type {CfnParameter}
     */
    const paramCreateCanary = new CfnParameter(this, 'CreateCanary', {
      description:
        'Should a new canary be created? If yes, a canary with the name specified above will be created. If no, just skip the rest of Canary Configuration and move on to Application Monitoring.',
      type: 'String',
      default: 'Yes',
      allowedValues: ['No', 'Yes']
    });

    /**
     * @description bucket to store canary artifacts. Can be an existing bucket.
     * @type {CfnParameter}
     */
    const paramBucketName = new CfnParameter(this, 'BucketName', {
      description:
        'Name of the bucket (new or existing) for logging Canary artifacts. ' +
        'Each Canary will log to this bucket to a different prefix.',
      type: 'String'
    });

    const parameterMetaData = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: {
              default: 'Canary Configuration'
            },
            Parameters: [
              'CanaryName',
              'CreateCanary',
              'URL',
              'Interval',
              'ResponseThreshold',
              'CreateBucket',
              'BucketName'
            ]
          },
          {
            Label: {
              default: 'Application Monitoring'
            },
            Parameters: ['AppName', 'RepoName']
          },
          {
            Label: {
              default: 'Alarm Configuration'
            },
            Parameters: ['PercentThreshold', 'EvalPeriods', 'AlarmPeriods']
          }
        ],
        ParameterLabels: {
          URL: {
            default: 'URL'
          },
          CanaryName: {
            default: 'Canary Name'
          },
          CreateCanary: {
            default: 'Create New Canary?'
          },
          CanaryInterval: {
            default: 'Canary Interval'
          },
          CreateBucket: {
            default: 'Create Artifact Bucket?'
          },
          BucketName: {
            default: 'Artifact Bucket Name'
          },
          PercentThreshold: {
            default: '% Success Threshold (<)'
          },
          ResponseThreshold: {
            default: 'Response Threshold (ms)'
          },
          EvalPeriods: {
            default: 'Evaluation Periods'
          },
          AlarmPeriods: {
            default: 'Alarm Periods'
          },
          AppName: {
            default: 'Application Name'
          },
          RepoName: {
            default: 'Repository Name'
          }
        }
      }
    };
    this.templateOptions.metadata = parameterMetaData;

    //=========================================================================
    // CONDITIONS
    //=========================================================================
    const cndCanaryBucket = new CfnCondition(this, 'CanaryBucketCondition', {
      expression: Fn.conditionEquals(paramCreateBucket, 'Yes')
    });

    const cndCreateCanary = new CfnCondition(this, 'CreateCanaryCondition', {
      expression: Fn.conditionEquals(paramCreateCanary, 'Yes')
    });

    const cndCreateBucket = new CfnCondition(this, 'CreateBucketCondition', {
      expression: Fn.conditionAnd(cndCanaryBucket, cndCreateCanary)
    });

    //=========================================================================
    // RESOURCES
    //=========================================================================
    // ArtifactBucket
    // --------------
    const ArtifactBucketCfg: BucketProps = {
      encryption: BucketEncryption.S3_MANAGED,
      versioned: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      bucketName: paramBucketName.valueAsString
    };

    const bktArtifact = new Bucket(this, 'ArtifactBucket', ArtifactBucketCfg);

    bktArtifact.addToResourcePolicy(
      new PolicyStatement({
        sid: 'HttpsOnly',
        resources: [bktArtifact.bucketArn, bktArtifact.arnForObjects('*')],
        actions: ['s3:*'],
        principals: [new AnyPrincipal()],
        effect: Effect.DENY,
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false'
          }
        }
      })
    );

    Tags.of(bktArtifact).add('Name', props.solutionName + ' Canary Artifacts');

    const cfnArtifactBucket = <CfnBucket>bktArtifact.node.defaultChild;
    cfnArtifactBucket.addPropertyDeletionOverride('LifecycleConfiguration.Rules');
    cfnArtifactBucket.cfnOptions.condition = cndCreateBucket;

    const cfnBucketPolicy = <CfnBucketPolicy>bktArtifact.node.findChild('Policy').node.defaultChild;
    cfnBucketPolicy.cfnOptions.condition = cndCreateBucket;

    const bktArtifactResource = bktArtifact.node.findChild('Resource') as CfnBucket;
    addCfnSuppressRules(bktArtifactResource, [
      {
        id: 'W35',
        reason: 'This bucket is used by canary to store artifacts and no access logging bucket is needed.'
      }
    ]);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(bktArtifactResource, [
      {
        id: 'AwsSolutions-S1',
        reason: 'This bucket is used by canary to store artifacts and no access logging bucket is needed.'
      }
    ]);

    // Get iBucket reference - works whether bucket was created or not
    //
    const artifactBucket: IBucket = Bucket.fromBucketAttributes(this, 'ArtifactsBucket', {
      bucketName: paramBucketName.valueAsString
    });

    const canaryCode = [
      "var synthetics = require('Synthetics');",
      "const log = require('SyntheticsLogger');",
      '',
      'const pageLoadBlueprint = async function () {',
      '',
      '  const URL = "' + paramCanaryUrl.valueAsString + '";',
      '',
      '  let page = await synthetics.getPage();',
      "  const response = await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});",
      '  //Wait for page to render.',
      '  //Increase or decrease wait time based on endpoint being monitored.',
      '  await page.waitFor(' + paramResponseThresh.valueAsString + ');',
      '  // This will take a screenshot that will be included in test output artifacts',
      "  await synthetics.takeScreenshot('loaded', 'loaded');",
      '  let pageTitle = await page.title();',
      "  log.info('Page title: ' + pageTitle);",
      '  if (response.status() !== 200) {',
      '      throw "Failed to load page!";',
      '  }',
      '};',
      '',
      'exports.handler = async () => {',
      '    return await pageLoadBlueprint();',
      '};'
    ];

    const intervalCondition = new CfnCondition(this, 'IntervalEqualsOne', {
      expression: Fn.conditionEquals(paramCanaryInterval.valueAsNumber, 1)
    });
    const scheduleExpression = Fn.conditionIf(
      intervalCondition.logicalId,
      'rate(1 minute)',
      `rate(${Fn.ref(paramCanaryInterval.logicalId)} minutes)`
    );

    const canary = new Canary(this, 'HttpCanary', {
      canaryName: paramCanaryName.valueAsString,
      schedule: Schedule.expression(scheduleExpression.toString()),
      test: Test.custom({
        code: Code.fromInline(canaryCode.join('\n')),
        handler: 'index.handler'
      }),
      artifactsBucketLocation: {
        bucket: artifactBucket,
        prefix: Aws.STACK_NAME
      },
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_8
    });

    const canaryServiceRoleResource = canary.node.findChild('ServiceRole').node.findChild('Resource') as CfnRole;
    addCfnSuppressRules(canaryServiceRoleResource, [
      {
        id: 'W11',
        reason: 'Resource * is required by the canary service role.'
      }
    ]);
    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(canaryServiceRoleResource, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Resource * is required by the canary service role.'
      }
    ]);

    const refCanary = canary.node.defaultChild as CfnCanary;
    refCanary.cfnOptions.condition = cndCreateCanary;

    // Alarm State - the canary is "failed" when...
    // --------------------------------------------
    const alarmName =
      props.solutionId + '-[' + paramAppName.valueAsString + ']-[' + paramRepoName.valueAsString + ']-MTTR';
    new AlarmConstruct(this, 'Alarm', {
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
      value: props.solutionVersion ? props.solutionVersion : '',
      description: 'Version for DevOps Monitoring Dashboard on AWS Solution'
    });

    new CfnOutput(this, 'Canary Name', {
      value: paramCanaryName.valueAsString,
      description: 'Name of the Canary'
    });

    new CfnOutput(this, 'Alarm Name', {
      value: alarmName,
      description: 'Name of the Canary Alarm'
    });
  }
}
