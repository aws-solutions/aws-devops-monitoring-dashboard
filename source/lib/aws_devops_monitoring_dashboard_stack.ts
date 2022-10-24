#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as glue from '@aws-cdk/aws-glue-alpha';
import { NagSuppressions } from 'cdk-nag';
import {
  EventbridgeToKinesisFirehoseToS3,
  EventbridgeToKinesisFirehoseToS3Props
} from '@aws-solutions-constructs/aws-eventbridge-kinesisfirehose-s3';
import { EventbridgeToLambda, EventbridgeToLambdaProps } from '@aws-solutions-constructs/aws-eventbridge-lambda';
import { QuickSightStack } from './quicksight-custom-resources/quicksight-stack';
import { SolutionHelper } from './solution-helper/solution-helper-construct';
import { CanaryEvents } from './events/canary_events_construct';
import { CodeDeployEvents } from './events/code_deploy_events_construct';
import { CodePipelineEvents } from './events/code_pipeline_events_construct';
import { CodeBuildEvents } from './events/code_build_events_construct';
import { GlueDatabase } from './database/database_construct';
import { GitHubStack } from './github/github_stack';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { CodePipelineAlarmEvents } from './events/codepipeline_alarm_events_construct';
import { ApplyCfnSuppressRulesToLogRetentionResource } from './util/apply_to_construct';
import { MonitoringAcctPermission } from './multi-account-resources/monitoring_account/monitoring_account_permissions_construct';
import { TagQuery } from './tagging/tag-query-construct';

export interface DevOpsDashboardStackProps extends cdk.StackProps {
  solutionId: string;
  solutionVersion: string;
  solutionName: string;
  solutionDistBucket?: string;
  solutionDistName?: string;
  lambdaRuntimeNode: lambda.Runtime;
}

export class DevOpsDashboardStack extends cdk.Stack {
  private _nestedStacks: cdk.Stack[];

  constructor(scope: Construct, id: string, props: DevOpsDashboardStackProps) {
    super(scope, id, props);
    this._nestedStacks = [];

    const devopsDashboardStackMetadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: {
              default: 'Metrics Configuration'
            },
            Parameters: ['DataDuration', 'CodeCommitRepo']
          },
          {
            Label: {
              default: 'S3 Configuration'
            },
            Parameters: ['S3TransitionDays']
          },
          {
            Label: {
              default: 'QuickSight Configuration'
            },
            Parameters: ['QuickSightPrincipalArn']
          },
          {
            Label: {
              default: 'GitHub Configuration'
            },
            Parameters: ['UseGitHub', 'WebhookSecretToken', 'AllowedIPs']
          },
          {
            Label: {
              default: 'Multi-Account Configuration'
            },
            Parameters: ['PrincipalType', 'PrincipalList']
          },
          {
            Label: {
              default: 'Tag Configuration'
            },
            Parameters: ['TagsConfigCodeCommit', 'TagsConfigCodeBuild', 'TagsConfigCodePipeline']
          }
        ],
        ParameterLabels: {
          PrincipalType: {
            default: 'Principal Type'
          },
          PrincipalList: {
            default: 'List of AWS Accounts or AWS Organization Ids'
          },
          DataDuration: {
            default: 'Athena Query Data Duration (Days)'
          },
          CodeCommitRepo: {
            default: 'AWS CodeCommit Repository List'
          },
          QuickSightPrincipalArn: {
            default: 'Amazon Quicksight Principal ARN'
          },
          S3TransitionDays: {
            default: 'S3 Transition Days'
          },
          UseGitHub: {
            default: 'Use GitHub Repository'
          },
          WebhookSecretToken: {
            default: 'Webhook Secret Token'
          },
          AllowedIPs: {
            default: 'Allowed IP Addresses'
          },
          TagsConfigCodeCommit: {
            default: 'Tag Configuration for filtering on CodeCommit Repositories'
          },
          TagsConfigCodeBuild: {
            default: 'Tag Configuration for filtering on CodeBuild Projects'
          },
          TagsConfigCodePipeline: {
            default: 'Tag Configuration for filtering on CodePipeline Pipelines'
          }
        }
      }
    };

    this.templateOptions.metadata = devopsDashboardStackMetadata;

    //=========================================================================
    // PARAMETERS
    //=========================================================================
    const paramCodeCommitRepo = new cdk.CfnParameter(this, 'CodeCommitRepo', {
      description:
        "List of the names of AWS CodeCommit Repositories that will be monitored. Must be single-quoted and comma separated. For example, 'MyRepository1','MyRepository2'. To monitor all the repositories, leave default 'ALL' value.",
      type: 'String',
      default: "'ALL'"
    });

    const paramQuickSightPrincipalArn = new cdk.CfnParameter(this, 'QuickSightPrincipalArn', {
      type: 'String',
      description:
        'Provide a QuickSight ADMIN user ARN (arn:aws:quicksight:AWSRegion:AWSAccountId:user/default/QuickSightUserName) to automatically create QuickSight dashboards. QuickSight Enterprise edition must be enabled for the account. To disable QuickSight dashboards creation, leave it blank.',
      allowedPattern: '^$|^arn:\\S+:quicksight:\\S+:\\d{12}:user/\\S+$',
      constraintDescription:
        'Provide an arn matching an Amazon Quicksight User ARN. The input did not match the validation pattern.',
      default: ''
    });

    const paramDataDuration = new cdk.CfnParameter(this, 'DataDuration', {
      description:
        'Enter a duration (days) that Athena query uses to retrieve data. By default Athena query retrieves data within the last 90 days. We recommend you to limit the duration for performance optimization and cost reduction.',
      type: 'Number',
      default: '90'
    });

    const paramS3TransitionDays = new cdk.CfnParameter(this, 'S3TransitionDays', {
      description:
        'Enter the number of days after which you would like to transition Amazon S3 objects to Amazon S3 Glacier storage class. By default objects are transitioned to Glacier 365 days (one year) after creation.',
      type: 'Number',
      default: '365'
    });

    const paramUseGitHub = new cdk.CfnParameter(this, 'UseGitHub', {
      description: 'Select Yes if GitHub is used as code repository, otherwise leave it to No.',
      type: 'String',
      default: 'No',
      allowedValues: ['Yes', 'No']
    });

    const paramWebhookSecretToken = new cdk.CfnParameter(this, 'WebhookSecretToken', {
      description:
        'Enter a random string with high entropy to authenticate access to webhooks in GitHub. If a webhook payload header contains a matching secret, IP address authentication is bypassed. The string cannot contain commas (,), backward slashes (\\), or quotes ("). It is highly recommended to use secret to secure your GitHub webhook. To turn off secret authentication, leave it blank. Ignore this field if GitHub is not used.',
      type: 'String',
      default: '',
      noEcho: true
    });

    const paramAllowedIPs = new cdk.CfnParameter(this, 'AllowedIPs', {
      description:
        'Enter a comma-separated list of allowed IPV4 CIDR blocks. By default GitHub IP ranges are used. Note that GitHub changes their IP addresses from time to time so we strongly encourage regular monitoring of their API. If API secret is used, IP address authentication is bypassed. Ignore this field if GitHub is not used.',
      type: 'String',
      default: '192.30.252.0/22,185.199.108.0/22,140.82.112.0/20,143.55.64.0/20',
      allowedPattern:
        '^(?:((?!0\\d)(1?\\d?\\d|25[0-5]|2[0-4]\\d))\\.){3}((?!0\\d)(1?\\d?\\d|25[0-5]|2[0-4]\\d))(?:\\/([1-9]|[12]\\d|3[0-2]))?(?: *, *(?:((?!0\\d)(1?\\d?\\d|25[0-5]|2[0-4]\\d)){1,3}\\.){3}((?!0\\d)(1?\\d?\\d|25[0-5]|2[0-4]\\d))(?:\\/([1-9]|[12]\\d|3[0-2]))?)*$'
    });

    const paramPrincipalType = new cdk.CfnParameter(this, 'PrincipalType', {
      description:
        'The solution can collect metrics from multiple AWS accounts. To turn on the multi-account feature, select either AWS Account Number or AWS Organization Id which your AWS accounts belong to. Leave it to None to turn off this feature. ',
      type: 'String',
      default: 'None',
      allowedValues: ['None', 'AWS Account Number', 'AWS Organization Id']
    });

    const paramPrincipalList = new cdk.CfnParameter(this, 'PrincipalList', {
      description:
        "If you selected List of AWS Account Numbers above, enter a comma separated AWS account numbers, e.g., 111111111111,222222222222. If you selected List of AWS Organization Ids, enter a comma separated AWS Organization Ids, e.g., o-xxxxxxxxxx,o-yyyyyyyyyy. Leave it blank if you don't use the multi-account feature.",
      type: 'CommaDelimitedList',
      default: ''
    });

    const tagConfigDescription =
      'Enter a semicolon-separated list of tags, using a comma as a separator between the tag key and value (e.g. "env,prod;anotherKey,anotherValue"). Omitting a tag value will result in a filter that captures all values for that tag key. Only resources matching the combination of all the tags will be captured. Leave it blank if you do not use the tag feature.';

    const paramUseCodeCommitTags = new cdk.CfnParameter(this, 'TagsConfigCodeCommit', {
      description: tagConfigDescription,
      type: 'String'
    });

    const paramUseCodeBuildTags = new cdk.CfnParameter(this, 'TagsConfigCodeBuild', {
      description: tagConfigDescription,
      type: 'String'
    });

    const paramUseCodePipelineTags = new cdk.CfnParameter(this, 'TagsConfigCodePipeline', {
      description: tagConfigDescription,
      type: 'String'
    });

    //=========================================================================
    // MAPPINGS
    //=========================================================================
    const metricsMapping = new cdk.CfnMapping(this, 'AnonymousData', {
      mapping: {
        SendAnonymousUsageData: {
          Data: 'Yes',
          MetricsURL: 'https://metrics.awssolutionsbuilder.com/generic'
        }
      }
    });

    const userAgentExtraString = new cdk.CfnMapping(this, 'UserAgentExtra');
    userAgentExtraString.setValue('UserAgentExtra', 'Key', `AwsSolution/${props.solutionId}/${props.solutionVersion}`);

    //=========================================================================
    // CONDITIONS
    //=========================================================================
    const metricsCondition = new cdk.CfnCondition(this, 'AnonymousDataToAWS', {
      expression: cdk.Fn.conditionEquals(metricsMapping.findInMap('SendAnonymousUsageData', 'Data'), 'Yes')
    });

    const quickSightCondition = new cdk.CfnCondition(this, 'QuickSightCondition', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(paramQuickSightPrincipalArn, ''))
    });

    const gitHubCondition = new cdk.CfnCondition(this, 'GitHubCondition', {
      expression: cdk.Fn.conditionEquals(paramUseGitHub, 'Yes')
    });

    const webhookSecretTokenCond = new cdk.CfnCondition(this, 'WebhookSecretTokenCondition', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(paramWebhookSecretToken, ''))
    });

    const multiAccountCond = new cdk.CfnCondition(this, 'MultiAccountCondition', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(paramPrincipalType, 'None'))
    });

    const organizationCond = new cdk.CfnCondition(this, 'OrganizationCondition', {
      expression: cdk.Fn.conditionEquals(paramPrincipalType, 'AWS Organization Id')
    });

    const solutionHelper = new SolutionHelper(this, 'SolutionHelper', {
      solutionId: props.solutionId,
      version: props.solutionVersion,
      quickSightPrincipalARN: paramQuickSightPrincipalArn.valueAsString,
      athenaQueryDataDuration: paramDataDuration.valueAsString,
      codeCommitRepo: paramCodeCommitRepo.valueAsString
    });

    const uuid = solutionHelper.UUIDCustomResource.getAttString('UUID');

    //=========================================================================
    // RESOURCES
    //========================================================================
    /**
     * Create AWS CODECOMMIT CloudWatch Events Rule, Kinesis Firehose, S3 Bucket
     *
     * Use aws-eventbridge-kinesisfirehose-s3 construct pattern to
     * create resources for sending cw events data for CODECOMMIT to
     * kinesis firehose to s3
     */

    const codeCommitEventRuleToKinesisFirehoseProps: EventbridgeToKinesisFirehoseToS3Props = {
      eventRuleProps: {
        description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for AWS CodeCommit',
        eventPattern: {
          detailType: ['AWS API Call via CloudTrail'],
          source: ['aws.codecommit'],
          detail: {
            eventName: ['PutFile', 'DeleteFile', 'UpdateFile', 'GitPush']
          }
        },
        enabled: true
      }
    };

    const codecommitERToFHToS3Construct = new EventbridgeToKinesisFirehoseToS3(
      this,
      'CodeCommit',
      codeCommitEventRuleToKinesisFirehoseProps
    );
    const firehoseObj = codecommitERToFHToS3Construct.kinesisFirehose;
    const firehoseRole = codecommitERToFHToS3Construct.kinesisFirehoseRole;
    const refMetricsBucket = codecommitERToFHToS3Construct.s3Bucket?.node.defaultChild as s3.CfnBucket;
    const refLoggingBucket = codecommitERToFHToS3Construct.s3LoggingBucket?.node.defaultChild as s3.CfnBucket;

    const lifecycleRule = [
      {
        NoncurrentVersionTransitions: [
          {
            StorageClass: 'GLACIER',
            TransitionInDays: paramS3TransitionDays.valueAsString
          }
        ],
        Status: 'Enabled'
      }
    ];

    refMetricsBucket.addPropertyOverride('LifecycleConfiguration.Rules', lifecycleRule);
    refMetricsBucket.addPropertyOverride('BucketName', 'aws-devops-metrics-' + uuid);
    refMetricsBucket.addPropertyOverride('OwnershipControls.Rules', [{ ObjectOwnership: 'BucketOwnerEnforced' }]);
    refLoggingBucket.addPropertyOverride('BucketName', 'aws-devops-metrics-logging-' + uuid);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refLoggingBucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'This S3 bucket is used as the access logging bucket for another bucket.'
      }
    ]);

    /**
     * Create CloudWatch Events Rule for Canary events
     */
    new CanaryEvents(this, 'CanaryEvents', {
      targetArn: firehoseObj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole
    });

    /**
     * Create CloudWatch Events Rule for CodePipeline Alarm events
     */
    new CodePipelineAlarmEvents(this, 'CodePipelineAlarmEvents', {
      targetArn: firehoseObj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole,
      solutionId: props.solutionId
    });

    /**
     * Create CloudWatch Events Rule for AWS CodeDeploy
     */
    new CodeDeployEvents(this, 'CodeDeployEvents', {
      targetArn: firehoseObj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole
    });

    /**
     * Create CloudWatch Events Rule for AWS CodePipeline
     */
    new CodePipelineEvents(this, 'CodePipelineEvents', {
      targetArn: firehoseObj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole
    });

    /**
     * Create AWS Glue and Athena database resources including database, table and workgroup
     */
    const db = new GlueDatabase(this, 'GlueAthenaDatabase', {
      solutionId: props.solutionId,
      uuid: uuid,
      metricsBucket: codecommitERToFHToS3Construct.s3Bucket,
      metricsBucketName: codecommitERToFHToS3Construct.s3Bucket?.bucketName
    });

    /**
     * Create AWS resources needed to process CloudWatch Metrics for AWS CodeBuild, including:
     * CloudWatch Metric stream, Kinesis Data Firehose with lambda transformation
     */
    new CodeBuildEvents(this, 'CodeBuildEvents', {
      metricsBucket: codecommitERToFHToS3Construct.s3Bucket,
      lambdaRunTime: props.lambdaRuntimeNode,
      uuid: uuid,
      metricsGlueDBName: db.metricsGlueDBName,
      codeBuildMetricsGlueTableName: db.codeBuildMetricsGlueTableName,
      callingStack: this,
      userAgentExtra: userAgentExtraString.findInMap('UserAgentExtra', 'Key')
    });

    /**
     * Create Event Parser Lambda: Transform cloudwatch event data within Kinesis Firehose
     */
    const cwLogsPS = new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({
          service: 'logs',
          resource: 'log-group',
          arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
          resourceName: '/aws/lambda/*'
        })
      ],
      sid: 'CreateCWLogs'
    });

    const eventParserLambdaPolicyName = 'EventParserLambdaPolicy-' + uuid;

    const eventParserLambdaRole = new iam.Role(this, 'EventParserLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [eventParserLambdaPolicyName]: new iam.PolicyDocument({
          statements: [cwLogsPS]
        })
      }
    });

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(eventParserLambdaRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to region, account and lambda resource.'
      }
    ]);

    const eventParserLambdaFunction = new lambda.Function(this, 'EventParser', {
      description:
        'DevOps Monitoring Dashboard on AWS solution - This function performs lambda transformation within kinesis firehose. It parses raw cloudwatch events, sends relevant data to S3 for downstream operation',
      environment: {
        LOG_LEVEL: 'INFO'
      },
      runtime: props.lambdaRuntimeNode,
      code: lambda.Code.fromAsset(`${__dirname}/../lambda/event_parser`),
      handler: 'index.handler',
      role: eventParserLambdaRole,
      timeout: cdk.Duration.seconds(900),
      logRetention: logs.RetentionDays.THREE_MONTHS
    });

    const refEventParserLambda = eventParserLambdaFunction.node.findChild('Resource') as lambda.CfnFunction;
    const lambdaCfnNag = [
      {
        id: 'W89',
        reason: 'There is no need to run this lambda in a VPC'
      },
      {
        id: 'W92',
        reason: 'There is no need for Reserved Concurrency'
      }
    ];
    addCfnSuppressRules(refEventParserLambda, lambdaCfnNag);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refEventParserLambda, [
      {
        id: 'AwsSolutions-L1',
        reason:
          'The latest Node.js 16 lambda runtime version is not yet supported by AWS solutions construct and CodeBuild docker images.'
      }
    ]);

    /* Add more configurations to property ExtendedS3DestinationConfiguration */
    firehoseObj.addPropertyOverride('ExtendedS3DestinationConfiguration', {
      CompressionFormat: 'UNCOMPRESSED',
      Prefix: 'DevopsEvents/created_at=!{timestamp:yyyy-MM-dd}/',
      ErrorOutputPrefix:
        'DevopsEventsProcessingErrorlogs/result=!{firehose:error-output-type}/created_at=!{timestamp:yyyy-MM-dd}/',
      ProcessingConfiguration: {
        Enabled: true,
        Processors: [
          {
            Type: 'Lambda',
            Parameters: [
              {
                ParameterName: 'LambdaArn',
                ParameterValue: eventParserLambdaFunction.functionArn
              }
            ]
          }
        ]
      },
      BufferingHints: {
        IntervalInSeconds: 300,
        SizeInMBs: 128
      },
      DataFormatConversionConfiguration: {
        Enabled: true,
        InputFormatConfiguration: {
          Deserializer: {
            OpenXJsonSerDe: {
              CaseInsensitive: true
            }
          }
        },
        OutputFormatConfiguration: {
          Serializer: {
            ParquetSerDe: {
              Compression: 'SNAPPY'
            }
          }
        },
        SchemaConfiguration: {
          DatabaseName: db.metricsGlueDBName,
          TableName: db.metricsGlueTableName,
          RoleARN: firehoseRole.roleArn,
          VersionId: 'LATEST'
        }
      }
    });

    /* Add more configurations to property DeliveryStreamEncryptionConfigurationInput */
    firehoseObj.addPropertyOverride('DeliveryStreamEncryptionConfigurationInput', {
      KeyType: 'AWS_OWNED_CMK'
    });

    const invokeLambdaPS = new iam.PolicyStatement();
    invokeLambdaPS.sid = 'InvokeLambda';
    invokeLambdaPS.effect = iam.Effect.ALLOW;
    invokeLambdaPS.addActions('lambda:InvokeFunction', 'lambda:GetFunctionConfiguration');
    invokeLambdaPS.addResources(
      eventParserLambdaFunction.functionArn,
      eventParserLambdaFunction.functionArn + ':$LATEST'
    );

    const glueAccessPSForFirehose = new iam.PolicyStatement({
      actions: ['glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions'],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({ service: 'glue', resource: 'catalog', arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME }),
        this.formatArn({
          service: 'glue',
          resource: 'database',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: db.metricsGlueDBName
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/*`
        })
      ],
      sid: 'glueAccessPSForFirehose'
    });

    const firehoseRolePolicy = codecommitERToFHToS3Construct.node
      .findChild('KinesisFirehoseToS3')
      .node.findChild('KinesisFirehosePolicy') as iam.Policy;

    if (firehoseRolePolicy !== undefined) {
      firehoseRolePolicy.addStatements(invokeLambdaPS);
      firehoseRolePolicy.addStatements(glueAccessPSForFirehose);
      // Add cdk-nag suppression
      NagSuppressions.addResourceSuppressions(firehoseRolePolicy, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'The policy is restricted to region, account and glue resource'
        }
      ]);
    }
    firehoseObj.node.addDependency(firehoseRolePolicy);

    const refGlueTable = db.node.findChild('AWSDevopsMetricsGlueTable') as glue.Table;
    firehoseObj.node.addDependency(refGlueTable);

    /**
     * Create Query Runner Lambda: execute athena queries against devops metrics data
     */

    const metricsBucketName = codecommitERToFHToS3Construct.s3Bucket?.bucketName || '';

    const s3AccessPS = new iam.PolicyStatement({
      actions: [
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:ListMultipartUploadParts',
        's3:AbortMultipartUpload',
        's3:CreateBucket',
        's3:PutObject'
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'athena_results/*'
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: '*'
        })
      ],
      sid: 'S3AccessPS'
    });

    const s3AccessPSwAthena = new iam.PolicyStatement({
      actions: [
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:ListMultipartUploadParts',
        's3:AbortMultipartUpload',
        's3:CreateBucket',
        's3:PutObject'
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'athena_results/*'
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: metricsBucketName,
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: '*'
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: 'aws-athena-query-results-*',
          arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: 'query-results-custom-bucket',
          arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME
        }),
        this.formatArn({
          account: '',
          region: '',
          service: 's3',
          resource: 'query-results-custom-bucket',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: '*'
        })
      ],
      sid: 's3AccessPSwAthena'
    });

    const athenaQueryExecutionPS = new iam.PolicyStatement({
      actions: ['athena:StartQueryExecution'],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({
          service: 'athena',
          resource: 'workgroup',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'AWSDevOpsDashboard*'
        }),
        this.formatArn({
          service: 'athena',
          resource: 'workgroup',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: 'primary'
        })
      ],
      sid: 'AthenaQueryExecutionPS'
    });

    const glueAccessPS = new iam.PolicyStatement({
      actions: [
        'glue:GetTable',
        'glue:GetPartitions',
        'glue:GetDatabase',
        'glue:CreateTable',
        'glue:UpdateTable',
        'glue:BatchCreatePartition',
        'glue:DeleteTable',
        'glue:DeletePartition'
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({ service: 'glue', resource: 'catalog', arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME }),
        this.formatArn({
          service: 'glue',
          resource: 'database',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: db.metricsGlueDBName
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/*`
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/${db.codeBuildMetricsGlueTableName}`
        })
      ],
      sid: 'glueAccessPS'
    });

    const cloudwatchAccessPS = new iam.PolicyStatement({
      actions: ['cloudwatch:GetMetricStatistics'],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      sid: 'cloudwatchAccessPS'
    });

    const queryRunnerLambdaPolicyName = 'queryRunnerLambdaPolicy-' + uuid;

    const queryRunnerLambdaRole = new iam.Role(this, 'queryRunnerLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [queryRunnerLambdaPolicyName]: new iam.PolicyDocument({
          statements: [cwLogsPS, s3AccessPSwAthena, athenaQueryExecutionPS, glueAccessPS]
        })
      }
    });

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(queryRunnerLambdaRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to S3 bucket or region, account and glue resource'
      }
    ]);
    NagSuppressions.addResourceSuppressions(firehoseRolePolicy, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to S3 bucket or region, account and glue resource'
      }
    ]);

    const queryRunnerLambdaFunction = new lambda.Function(this, 'QueryRunner', {
      description:
        'DevOps Monitoring Dashboard on AWS solution - This function runs Amazon Athena queries and creates views.',
      environment: {
        LOG_LEVEL: 'INFO'
      },
      runtime: props.lambdaRuntimeNode,
      code: lambda.Code.fromAsset(`${__dirname}/../lambda/query_runner`),
      handler: 'index.handler',
      role: queryRunnerLambdaRole,
      timeout: cdk.Duration.seconds(300),
      logRetention: logs.RetentionDays.THREE_MONTHS
    });

    const refQueryRunnerLambda = queryRunnerLambdaFunction.node.findChild('Resource') as lambda.CfnFunction;
    addCfnSuppressRules(refQueryRunnerLambda, lambdaCfnNag);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refQueryRunnerLambda, [
      {
        id: 'AwsSolutions-L1',
        reason:
          'The latest Node.js 16 lambda runtime version is not yet supported by AWS solutions construct and CodeBuild docker images.'
      }
    ]);

    /*
     * Create Custom Resource Query Builder Lambda - build and run athena queries
     */
    new cdk.CustomResource(this, 'CustomResourceQueryRunner', {
      resourceType: 'Custom::QueryRunner',
      serviceToken: queryRunnerLambdaFunction.functionArn,
      properties: {
        MetricsDBName: db.metricsGlueDBName,
        MetricsTableName: db.metricsGlueTableName,
        CodeBuildMetricsTableName: db.codeBuildMetricsGlueTableName,
        GitHubMetricsTableName: db.gitHubMetricsGlueTableName,
        CodeCommitTagsGlueTableName: db.codeCommitTagsGlueTableName,
        CodeBuildTagsGlueTableName: db.codeBuildTagsGlueTableName,
        CodePipelineTagsGlueTableName: db.codePipelineTagsGlueTableName,
        AthenaWorkGroup: db.metricsAthenaWGName,
        RepositoryList: paramCodeCommitRepo.valueAsString,
        DataDuration: paramDataDuration.valueAsString,
        Version: props.solutionVersion
      }
    });

    /*
     * Create Custom Resource Anonymous Data Lambda - send anonymous solution metrics when configured
     */
    const sendDataFunction = new cdk.CustomResource(this, 'SendAnonymousUsageData', {
      resourceType: 'Custom::SendAnonymousUsageData',
      serviceToken: queryRunnerLambdaFunction.functionArn,
      properties: {
        SendAnonymousUsageData: metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
        SolutionId: props.solutionId,
        UUID: uuid,
        Version: props.solutionVersion,
        Region: cdk.Aws.REGION,
        MetricsURL: metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL'),
        QuickSightPrincipalArn: paramQuickSightPrincipalArn.valueAsString,
        AthenaQueryDataDuration: paramDataDuration.valueAsString,
        RepositoryList: paramCodeCommitRepo.valueAsString,
        S3TransitionDays: paramS3TransitionDays.valueAsString,
        UseGitHubRepository: paramUseGitHub.valueAsString,
        UseWebhookSecret: cdk.Fn.conditionIf(webhookSecretTokenCond.logicalId, 'yes', 'no').toString(),
        UseMultiAccount: cdk.Fn.conditionIf(multiAccountCond.logicalId, 'yes', 'no').toString(),
        PrincipalType: cdk.Fn.conditionIf(organizationCond.logicalId, 'Organization', 'Account').toString(),
        PrincipalCount: paramPrincipalList.valueAsList.length
      }
    });

    (sendDataFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = metricsCondition;

    /*
     * Create Athena Partition Lambda - add a new partition to Athena table
     */
    const glueAccessPSForAddAthenaPartition = new iam.PolicyStatement({
      actions: [
        'glue:GetTable',
        'glue:GetPartitions',
        'glue:GetDatabase',
        'glue:CreateTable',
        'glue:UpdateTable',
        'glue:BatchCreatePartition'
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        this.formatArn({ service: 'glue', resource: 'catalog', arnFormat: cdk.ArnFormat.NO_RESOURCE_NAME }),
        this.formatArn({
          service: 'glue',
          resource: 'database',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: db.metricsGlueDBName
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`
        }),
        this.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${db.metricsGlueDBName}/*`
        })
      ],
      sid: 'glueAccessPS'
    });

    const AthenaParLambdaPolicyName = 'AddAthenaPartitionPolicy-' + uuid;

    const AthenaParLambdaRole = new iam.Role(this, 'AddAthenaPartitionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [AthenaParLambdaPolicyName]: new iam.PolicyDocument({
          statements: [
            cwLogsPS,
            s3AccessPS,
            athenaQueryExecutionPS,
            glueAccessPSForAddAthenaPartition,
            cloudwatchAccessPS
          ]
        })
      }
    });

    const refAthenaParLambdaRole = AthenaParLambdaRole.node.defaultChild as iam.CfnRole;
    addCfnSuppressRules(refAthenaParLambdaRole, [
      {
        id: 'W11',
        reason:
          'Resource * is required for cloudwatch:GetMetricStatistics as it does not support resource-level permissions.'
      }
    ]);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refAthenaParLambdaRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Resource * is either required by API or the policy has necessary restrictions like partition, region, account, S3, glue resource, etc.'
      }
    ]);

    const athenaParRuleToLambdaProps: EventbridgeToLambdaProps = {
      lambdaFunctionProps: {
        description:
          'DevOps Monitoring Dashboard on AWS solution - This function runs on a daily schedule and adds a new partition to Amazon Athena table',
        environment: {
          LOG_LEVEL: 'INFO',
          MetricsDBName: db.metricsGlueDBName,
          MetricsTableName: db.metricsGlueTableName,
          CodeBuildMetricsTableName: db.codeBuildMetricsGlueTableName,
          GitHubMetricsTableName: db.gitHubMetricsGlueTableName,
          AthenaWorkGroup: db.metricsAthenaWGName,
          SolutionId: props.solutionId,
          UUID: uuid,
          Region: cdk.Aws.REGION,
          Version: props.solutionVersion,
          SendAnonymousUsageData: metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
          MetricsURL: metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL'),
          UserAgentExtra: userAgentExtraString.findInMap('UserAgentExtra', 'Key')
        },
        runtime: props.lambdaRuntimeNode,
        code: lambda.Code.fromAsset(`${__dirname}/../lambda/query_runner`),
        handler: 'add_athena_partition.handler',
        role: AthenaParLambdaRole,
        timeout: cdk.Duration.seconds(300)
      },
      eventRuleProps: {
        description: 'DevOps Monitoring Dashboard on AWS solution - Event rule for adding Athena partitions',
        schedule: events.Schedule.expression('cron(0 0 * * ? *)'),
        enabled: true
      }
    };

    const ebToAthenaParLambda = new EventbridgeToLambda(this, 'AddAthenaPartition', athenaParRuleToLambdaProps);

    const refAthenaParLambdaServiceRole = ebToAthenaParLambda.node.findChild('LambdaFunctionServiceRole').node
      .defaultChild as iam.CfnRole;
    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refAthenaParLambdaServiceRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to region, account and lambda resource.'
      }
    ]);

    const refAthenaParDefaultPolicy = ebToAthenaParLambda.lambdaFunction.role?.node.tryFindChild('DefaultPolicy')?.node
      .defaultChild as iam.CfnPolicy;
    NagSuppressions.addResourceSuppressions(refAthenaParDefaultPolicy, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Lambda needs resource * to send trace data to X-Ray'
      }
    ]);

    const refAthenaParLambda = ebToAthenaParLambda.lambdaFunction.node.defaultChild as lambda.CfnFunction;
    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(refAthenaParLambda, [
      {
        id: 'AwsSolutions-L1',
        reason:
          'The latest Node.js 16 lambda runtime version is not yet supported by AWS solutions construct and CodeBuild docker images.'
      }
    ]);

    /**
     * Create nested template to provision Amazon QuickSight resources as needed
     */
    const qsNestedTemplate = new QuickSightStack(this, 'QSDashboard', {
      parameters: {
        QuickSightSourceTemplateArn: this.node.tryGetContext('quicksight_source_template_arn'),
        QuickSightPrincipalArn: paramQuickSightPrincipalArn.valueAsString,
        SolutionID: props.solutionId,
        SolutionName: props.solutionName,
        SolutionVersion: props.solutionVersion,
        ParentStackName: cdk.Aws.STACK_NAME,
        AthenaWorkGroupName: db.metricsAthenaWGName
      }
    });

    qsNestedTemplate.nestedStackResource?.addMetadata(
      'nestedStackFileName',
      qsNestedTemplate.templateFile.slice(0, -5)
    );
    qsNestedTemplate.nestedStackResource?.addOverride('Condition', 'QuickSightCondition');
    qsNestedTemplate.nestedStackResource?.addOverride(
      'Description',
      `(${props.solutionId})${props.solutionName} - Create QuickSight Template. Version: ${props.solutionVersion}`
    );

    this._nestedStacks.push(qsNestedTemplate as cdk.Stack);

    /**
     * Create nested stack to provision AWS resources for GitHub events as needed
     */
    const gitHubNestedStack = new GitHubStack(this, 'GitHubStack', {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionName: props.solutionName,
      solutionDistBucket: props.solutionDistBucket,
      solutionDistName: props.solutionDistName,
      lambdaRuntimeNode: props.lambdaRuntimeNode,
      webhookSecretToken: paramWebhookSecretToken.valueAsString,
      allowedIPs: paramAllowedIPs.valueAsString,
      metricsBucket: codecommitERToFHToS3Construct.s3Bucket,
      uuid: uuid,
      metricsGlueDBName: db.metricsGlueDBName,
      gitHubMetricsGlueTableName: db.gitHubMetricsGlueTableName
    });

    gitHubNestedStack.nestedStackResource?.addMetadata(
      'nestedStackFileName',
      gitHubNestedStack.templateFile.slice(0, -5)
    );
    gitHubNestedStack.nestedStackResource?.addOverride('Condition', 'GitHubCondition');
    gitHubNestedStack.nestedStackResource?.addOverride(
      'Description',
      `(${props.solutionId})${props.solutionName} - Create AWS Resources needed to process GitHub events. Version: ${props.solutionVersion}`
    );

    this._nestedStacks.push(gitHubNestedStack as cdk.Stack);

    ApplyCfnSuppressRulesToLogRetentionResource(this, 'LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a');

    /**
     * Create resources for multi-account metrics ingestion and analysis
     */
    const monitorAcctPermission = new MonitoringAcctPermission(this, 'monitoringAcctPermission', {
      principalType: cdk.Fn.conditionIf(organizationCond.logicalId, 'Organization', 'Account').toString(),
      principalList: paramPrincipalList.valueAsList,
      lambdaRunTime: props.lambdaRuntimeNode,
      uuid: uuid,
      userAgentExtra: userAgentExtraString.findInMap('UserAgentExtra', 'Key'),
      multiAccountCond: multiAccountCond,
      callingStack: this,
      metricsBucketName: codecommitERToFHToS3Construct.s3Bucket?.bucketName,
      eventsRuleTargetArn: firehoseObj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole,
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion
    });

    new TagQuery(this, 'TagQuery', {
      codeCommitTagConfig: paramUseCodeCommitTags.valueAsString,
      codeBuildTagConfig: paramUseCodeBuildTags.valueAsString,
      codePipelineTagConfig: paramUseCodePipelineTags.valueAsString,
      reportBucket:
        codecommitERToFHToS3Construct.s3Bucket ??
        (() => {
          throw new Error('No bucket');
        })(),
      lambdaRuntimeNode: props.lambdaRuntimeNode,
      userAgentExtraString: userAgentExtraString.findInMap('UserAgentExtra', 'Key'),
      uuid: uuid,
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      sendAnonymousUsageMetrics: metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
      metricsUrl: metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL'),
      stackType: 'monitoring'
    });

    //=========================================================================
    // OUTPUTS
    //=========================================================================
    new cdk.CfnOutput(this, 'QSAnalysisURL', {
      value: qsNestedTemplate.analysisURLOutput,
      description: 'Amazon QuickSight Analysis URL for DevOps Monitoring Dashboard on AWS Solution',
      condition: quickSightCondition
    });

    new cdk.CfnOutput(this, 'QSDashboardURL', {
      value: qsNestedTemplate.dashboardURLOutput,
      description: 'Amazon QuickSight Dashboard URL for DevOps Monitoring Dashboard on AWS Solution',
      condition: quickSightCondition
    });

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: gitHubNestedStack.apiEndpointOutput,
      description: 'Amazon API Endpoint to receive GitHub events for DevOps Monitoring Dashboard on AWS Solution',
      condition: gitHubCondition
    });

    new cdk.CfnOutput(this, 'DevOpsMetricsS3Bucket', {
      value: codecommitERToFHToS3Construct.s3Bucket?.bucketArn
        ? codecommitERToFHToS3Construct.s3Bucket.bucketArn
        : 'Do not exist',
      description: 'DevOps Metrics S3 Bucket for DevOps Monitoring Dashboard on AWS solution',
      exportName: 'DevOpsMetricsS3Bucket'
    });

    new cdk.CfnOutput(this, 'SolutionVersion', {
      value: props.solutionVersion,
      description: 'Version for DevOps Monitoring Dashboard on AWS solution'
    });

    new cdk.CfnOutput(this, 'CustomEventBusArn', {
      value: monitorAcctPermission.customEventBusArn,
      description: 'ARN of custom event bus for DevOps Monitoring Dashboard on AWS Solution',
      exportName: 'CustomEventBusArn',
      condition: multiAccountCond
    });

    new cdk.CfnOutput(this, 'DevOpsMetricsGlueDBName', {
      value: db.metricsGlueDBName,
      description: 'Name of the DevOps metrics Glue database for DevOps Monitoring Dashboard on AWS Solution',
      exportName: 'DevOpsMetricsGlueDBName'
    });

    new cdk.CfnOutput(this, 'CodeBuildMetricsGlueTableName', {
      value: db.codeBuildMetricsGlueTableName,
      description: 'Name of CodeBuild metrics Glue table for DevOps Monitoring Dashboard on AWS Solution',
      exportName: 'CodeBuildMetricsGlueTableName'
    });

    new cdk.CfnOutput(this, 'SolutionUUID', {
      value: uuid,
      description: 'UUID generated by the DevOps Monitoring Dashboard on AWS Solution',
      exportName: 'SolutionUUID'
    });
  }

  public getNestedStacks(): cdk.Stack[] {
    return this._nestedStacks;
  }
}
