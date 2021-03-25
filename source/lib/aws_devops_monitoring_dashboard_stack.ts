/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as logs from '@aws-cdk/aws-logs';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-events';
import { CfnOutput } from '@aws-cdk/core';
import {EventsRuleToKinesisFirehoseToS3, EventsRuleToKinesisFirehoseToS3Props}  from '@aws-solutions-constructs/aws-events-rule-kinesisfirehose-s3';
import { EventsRuleToLambdaProps, EventsRuleToLambda } from '@aws-solutions-constructs/aws-events-rule-lambda';
import { QuickSightStack } from './quicksight-custom-resources/quicksight-stack';
import { SolutionHelper } from './solution-helper/solution-helper-construct';
import { CanaryEvents } from './events/canary_events_construct';
import { CodeDeployEvents } from './events/code_deploy_events_construct';
import { Database } from './database/database_construct';
export interface DevOpsDashboardStackProps extends cdk.StackProps {
  solutionId: string;
  solutionVersion: string;
  solutionName: string;
  solutionDistBucket?: string;
  solutionDistName?: string;
  lambdaRuntimeNode: lambda.Runtime;
}

export class DevOpsDashboardStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: DevOpsDashboardStackProps) {
    super(scope, id, props);

    const devopsDashboardStackMetadata =
    {
      "AWS::CloudFormation::Interface": {
        "ParameterGroups": [
          {
            "Label": {
              "default": "Metrics Configuration"
            },
            "Parameters": [
              "DataDuration",
              "CodeCommitRepo"
            ]
          },
          {
            "Label": {
              "default": "S3 Configuration"
            },
            "Parameters": [
              "S3TransitionDays"
            ]
          },
          {
            "Label": {
              "default": "QuickSight Configuration"
            },
            "Parameters": [
              "QuickSightPrincipalArn"
            ]
          }
        ],
        "ParameterLabels": {
          "DataDuration": {
            "default": "Athena Query Data Duration (Days)"
          },
          "CodeCommitRepo": {
            "default": "AWS CodeCommit Repository List"
          },
          "QuickSightPrincipalArn": {
            "default": "Amazon Quicksight Principal ARN"
          },
          "S3TransitionDays": {
            "default": "S3 Transition Days"
          }
        }
      }
    }

    this.templateOptions.metadata = devopsDashboardStackMetadata


    //=========================================================================
    // PARAMETERS
    //=========================================================================
    const paramCodeCommitRepo = new cdk.CfnParameter(this, 'CodeCommitRepo', {
      description: "List of the names of AWS CodeCommit Repositories that will be monitored. Must be single-quoted and comma separated. For example, 'MyRepository1','MyRepository2'. To monitor all the repositories, leave default 'ALL' value.",
      type: "String",
      default: "'ALL'"
    });

    const paramQuickSightPrincipalArn = new cdk.CfnParameter(this, 'QuickSightPrincipalArn', {
      type: 'String',
      description: 'Provide a QuickSight ADMIN user ARN (arn:aws:quicksight:AWSRegion:AWSAccountId:user/default/QuickSightUserName) to automatically create QuickSight dashboards. QuickSight Enterprise edition must be enabled for the account. To disable QuickSight dashboards creation, leave it blank.',
      allowedPattern: '^$|^arn:\\S+:quicksight:\\S+:\\d{12}:user/\\S+$',
      constraintDescription: 'Provide an arn matching an Amazon Quicksight User ARN. The input did not match the validation pattern.',
      default: ""
    });

    const paramDataDuration = new cdk.CfnParameter(this, 'DataDuration', {
      description: "Enter a duration (days) that Athena query uses to retrieve data. By default Athena query retrieves data within the last 90 days. We recommend you to limit the duration for performance optimization and cost reduction.",
      type: "Number",
      default: "90"
    });

    const paramS3TransitionDays = new cdk.CfnParameter(this, 'S3TransitionDays', {
      description: "Enter the number of days after which you would like to transition Amazon S3 objects to Amazon S3 Glacier storage class. By default objects are transitioned to Glacier 365 days (one year) after creation.",
      type: "Number",
      default: "365"
    });


    //=========================================================================
    // MAPPINGS
    //=========================================================================
    const metricsMapping = new cdk.CfnMapping(this, 'AnonymousData', {
      mapping: {
          'SendAnonymousUsageData': {
              'Data': 'Yes',
              'MetricsURL': 'https://metrics.awssolutionsbuilder.com/generic'
          }
      }
    });


    //=========================================================================
    // CONDITIONS
    //=========================================================================
    const metricsCondition = new cdk.CfnCondition(this, 'AnonymousDataToAWS', {
      expression: cdk.Fn.conditionEquals(metricsMapping.findInMap('SendAnonymousUsageData', 'Data'), 'Yes')
    });

    const quickSightCondition = new cdk.CfnCondition(this, "QuickSightCondition", {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(paramQuickSightPrincipalArn, ""))
    });

    const solutionHelper = new SolutionHelper(this, 'SolutionHelper', {
      solutionId: props.solutionId, version: props.solutionVersion,
      quickSightPrincipalARN: paramQuickSightPrincipalArn.valueAsString,
      athenaQueryDataDuration: paramDataDuration.valueAsString,
      codeCommitRepo: paramCodeCommitRepo.valueAsString});

    const uuid = solutionHelper.UUIDCustomResource.getAttString('UUID')


    //=========================================================================
    // RESOURCES
    //========================================================================
    /**
     * Create AWS CODECOMMIT CloudWatch Events Rule, Kinesis Firehose, S3 Bucket
     *
     * Use aws_events_rule_kinesisfirehose_s3 construct pattern to
     * create resources for sending cw events data for CODECOMMIT to
     * kinesis firehose to s3
     */
    const codeCommitEventRuleToKinesisFirehoseProps: EventsRuleToKinesisFirehoseToS3Props = {
      eventRuleProps: {
        description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for AWS CodeCommit',
        eventPattern: {
          detailType: [
            "AWS API Call via CloudTrail"
          ],
          source: ["aws.codecommit"],
          detail: {
            "eventName": [
              "PutFile",
              "DeleteFile",
              "UpdateFile",
              "GitPush"
            ]
          }
        },
        enabled: true
      }
    }

    const codecommitERToFHToS3Construct = new EventsRuleToKinesisFirehoseToS3(this, 'CodeCommit', codeCommitEventRuleToKinesisFirehoseProps);
    const firehose_obj = codecommitERToFHToS3Construct.kinesisFirehose
    const firehoserole = codecommitERToFHToS3Construct.kinesisFirehoseRole
    const refMetricsBucket = codecommitERToFHToS3Construct.s3Bucket?.node.defaultChild as s3.CfnBucket;
    const refLoggingBucket = codecommitERToFHToS3Construct.s3LoggingBucket?.node.defaultChild as s3.CfnBucket;
    const refFirehoseLogGroup = codecommitERToFHToS3Construct.kinesisFirehoseLogGroup.node.findChild('Resource') as logs.CfnLogGroup

    const lifecycleRule = [{
      NoncurrentVersionTransitions:[
          {
            StorageClass: 'GLACIER',
            TransitionInDays: paramS3TransitionDays.valueAsString
          },
        ],
        Status: 'Enabled'
    }]

    refMetricsBucket.addPropertyOverride('LifecycleConfiguration.Rules', lifecycleRule);
    refMetricsBucket.addPropertyOverride('BucketName', 'aws-devops-metrics-'+uuid);
    refLoggingBucket.addPropertyOverride('BucketName', 'aws-devops-metrics-logging-'+uuid);

    refFirehoseLogGroup.cfnOptions.metadata ={
      cfn_nag: {
        rules_to_suppress: [{
            id: 'W84',
            reason: 'The CloudWatch log group does not need to be encrypted.'
        },
        {
            id: 'W86',
            reason: 'The log data in CloudWatch log group does not need to be expired.'
        }]
      }
    };

    /**
     * Create CloudWatch Events Rule for Canary events
     */
    new CanaryEvents(this, 'CanaryEvents', {
      firehoseArn: firehose_obj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole
    });

    /**
     * Create CloudWatch Events Rule for AWS CodeDeploy
     */
    new CodeDeployEvents(this, 'CodeDeployEvents', {
      firehoseArn: firehose_obj.attrArn,
      eventsRuleRole: codecommitERToFHToS3Construct.eventsRole
    });

    /**
     * Create AWS Glue and Athena database resources including database, table and workgroup
     */
    const db = new Database(this, 'GlueAthenaDatabase', {
      solutionId: props.solutionId,
      uuid: uuid,
      metricsBucket: codecommitERToFHToS3Construct.s3Bucket,
      metricsBucketName: codecommitERToFHToS3Construct.s3Bucket?.bucketName
    });

    /**
     * Create Event Parser Lambda: Transform cloudwatch event data within Kinesis Firehose
     */
    const cwLogsPS = new iam.PolicyStatement({
      actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({service: 'logs', resource: 'log-group', sep: ':', resourceName: '/aws/lambda/*'})],
      sid: 'CreateCWLogs'
    })

    const eventParserLambdaPolicyName = 'EventParserLambdaPolicy-' + uuid

    const eventParserLambdaRole = new iam.Role(this, 'EventParserLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [eventParserLambdaPolicyName]: new iam.PolicyDocument({
          statements: [
            cwLogsPS
          ]
        })
      }
    });

    const eventParserLambdaFunction = new lambda.Function(this, 'EventParser', {
      description: 'AWS DevOps Monitoring Dashboard Solution - This function performs lambda transformation within kinesis firehose. It parses raw cloudwatch events, sends relevant data to S3 for downstream operation',
      environment: {
        LOG_LEVEL: 'INFO'
      },
      runtime: props.lambdaRuntimeNode,
      code: lambda.Code.fromAsset(`${__dirname}/../lambda/event_parser`),
      handler: 'index.handler',
      role: eventParserLambdaRole,
      timeout: cdk.Duration.seconds(900)
    })

    /* Add more configurations to property ExtendedS3DestinationConfiguration */
    firehose_obj.addPropertyOverride('ExtendedS3DestinationConfiguration',{
      CompressionFormat: 'UNCOMPRESSED',
      Prefix: 'DevopsEvents/created_at=!{timestamp:yyyy-MM-dd}/',
      ErrorOutputPrefix: 'DevopsEventsProcessingErrorlogs/result=!{firehose:error-output-type}/created_at=!{timestamp:yyyy-MM-dd}/',
      ProcessingConfiguration:{
        Enabled: true,
        Processors: [{
          Type: 'Lambda',
          Parameters: [{
            ParameterName: 'LambdaArn',
            ParameterValue: eventParserLambdaFunction.functionArn
          }]
        }]
      },
      BufferingHints: {
        IntervalInSeconds: 300,
        SizeInMBs: 64
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
            RoleARN: firehoserole.roleArn
        }
      }
    })

    /* Add more configurations to property DeliveryStreamEncryptionConfigurationInput */
    firehose_obj.addPropertyOverride('DeliveryStreamEncryptionConfigurationInput', {
        KeyType: 'AWS_OWNED_CMK'})

    const invokeLambdaPS = new iam.PolicyStatement()
    invokeLambdaPS.sid = 'InvokeLambda'
    invokeLambdaPS.effect = iam.Effect.ALLOW
    invokeLambdaPS.addActions("lambda:InvokeFunction", "lambda:GetFunctionConfiguration")
    invokeLambdaPS.addResources(eventParserLambdaFunction.functionArn)

    const glueAccessPSForFirehose = new iam.PolicyStatement({
      actions: [ 'glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions' ],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({service: 'glue', resource: 'catalog', sep: '', resourceName: ''}),
                  this.formatArn({service: 'glue', resource: 'database', sep: '/', resourceName: db.metricsGlueDBName}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/*`})],
      sid: 'glueAccessPSForFirehose'
    })

    let firehoseRolePolicy = codecommitERToFHToS3Construct.node.findChild('KinesisFirehoseToS3').node.findChild('KinesisFirehosePolicy') as iam.Policy;
    if (firehoseRolePolicy !== undefined) {
        firehoseRolePolicy.addStatements(invokeLambdaPS)
        firehoseRolePolicy.addStatements(glueAccessPSForFirehose)
    }

    firehose_obj.node.addDependency(firehoseRolePolicy)

    /**
     * Create Query Runner Lambda: execute athena queries against devops metrics data
     */
    const s3AccessPS = new iam.PolicyStatement({
      actions: ["s3:GetBucketLocation","s3:GetObject","s3:ListBucket","s3:ListBucketMultipartUploads",
                "s3:ListMultipartUploadParts","s3:AbortMultipartUpload","s3:CreateBucket","s3:PutObject"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '/', resourceName: 'athena_results/*'}),
                  this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '', resourceName: ''}),
                  this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '/', resourceName: '*'})],
      sid: 'S3AccessPS'
    })

    const s3AccessPSwAthena = new iam.PolicyStatement({
      actions: ["s3:GetBucketLocation","s3:GetObject","s3:ListBucket","s3:ListBucketMultipartUploads",
                "s3:ListMultipartUploadParts","s3:AbortMultipartUpload","s3:CreateBucket","s3:PutObject"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '/', resourceName: 'athena_results/*'}),
                  this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '', resourceName: ''}),
                  this.formatArn({account: '', region: '', service: 's3', resource: codecommitERToFHToS3Construct.s3Bucket?.bucketName?codecommitERToFHToS3Construct.s3Bucket?.bucketName:'', sep: '/', resourceName: '*'}),
                  this.formatArn({account: '', region: '', service: 's3', resource: 'aws-athena-query-results-*', sep: '', resourceName: ''}),
                  this.formatArn({account: '', region: '', service: 's3', resource: 'query-results-custom-bucket', sep: '', resourceName: ''}),
                  this.formatArn({account: '', region: '', service: 's3', resource: 'query-results-custom-bucket', sep: '/', resourceName: '*'})],
      sid: 's3AccessPSwAthena'
    })

    const athenaQueryExecutionPS = new iam.PolicyStatement({
      actions: ["athena:StartQueryExecution"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({service: 'athena', resource: 'workgroup', sep: '/', resourceName: 'AWSDevOpsDashboard*'}),
                  this.formatArn({service: 'athena', resource: 'workgroup', sep: '/', resourceName: 'primary'})],
      sid: 'AthenaQueryExecutionPS'
    })

    const glueAccessPS = new iam.PolicyStatement({
      actions: ["glue:GetTable","glue:GetPartitions","glue:GetDatabase","glue:CreateTable","glue:UpdateTable","glue:BatchCreatePartition","glue:DeleteTable","glue:DeletePartition"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({service: 'glue', resource: 'catalog', sep: '', resourceName: ''}),
                  this.formatArn({service: 'glue', resource: 'database', sep: '/', resourceName: db.metricsGlueDBName}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/*`})],
      sid: 'glueAccessPS'
    })

    const cloudwatchAccessPS = new iam.PolicyStatement({
      actions: ["cloudwatch:GetMetricStatistics"],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      sid: 'cloudwatchAccessPS'
    })

    const queryRunnerLambdaPolicyName = 'queryRunnerLambdaPolicy-' + uuid

    const queryRunnerLambdaRole = new iam.Role(this, 'queryRunnerLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [queryRunnerLambdaPolicyName]: new iam.PolicyDocument({
          statements: [
            cwLogsPS,
            s3AccessPSwAthena,
            athenaQueryExecutionPS,
            glueAccessPS
          ]
        })
      }
    });

    const queryRunnerLambdaFunction = new lambda.Function(this, 'QueryRunner', {
      description: 'AWS DevOps Monitoring Dashboard Solution - This function runs Amazon Athena queries and creates views.',
      environment: {
        LOG_LEVEL: 'INFO'
      },
      runtime: props.lambdaRuntimeNode,
      code: lambda.Code.fromAsset(`${__dirname}/../lambda/query_runner`),
      handler: 'index.handler',
      role: queryRunnerLambdaRole,
      timeout: cdk.Duration.seconds(300)
    })

   /*
   * Create Custom Resource Query Builder Lambda - build and run athena queries
   */
   new cdk.CustomResource(this, 'CustomResourceQueryRunner', {
      resourceType: 'Custom::QueryRunner',
      serviceToken: queryRunnerLambdaFunction.functionArn,
      properties: {
        'MetricsDBName': db.metricsGlueDBName,
        'MetricsTableName': db.metricsGlueTableName,
        'AthenaWorkGroup': db.metricsAthenaWGName,
        'RepositoryList': paramCodeCommitRepo.valueAsString,
        'DataDuration': paramDataDuration.valueAsString
      },
    })

    /*
    * Create Custom Resource Anonymous Data Lambda - send anonymous solution metrics when configured
    */
    const sendDataFunction = new cdk.CustomResource(this, 'SendAnonymousUsageData', {
      resourceType: 'Custom::SendAnonymousUsageData',
      serviceToken: queryRunnerLambdaFunction.functionArn,
      properties: {
          'SendAnonymousUsageData': metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
          'SolutionId': props.solutionId,
          'UUID': uuid,
          'Version': props.solutionVersion,
          'Region': cdk.Aws.REGION,
          'MetricsURL': metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL'),
          'QuickSightPrincipalArn': paramQuickSightPrincipalArn.valueAsString,
          'AthenaQueryDataDuration': paramDataDuration.valueAsString,
          'RepositoryList': paramCodeCommitRepo.valueAsString,
          "S3TransitionDays": paramS3TransitionDays.valueAsString
      },
    });

    (sendDataFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = metricsCondition;

    /*
    * Create Athena Partition Lambda - add a new partition to Athena table
    */
    const glueAccessPSForAddAthenaPartition = new iam.PolicyStatement({
      actions: ["glue:GetTable","glue:GetPartitions","glue:GetDatabase","glue:CreateTable","glue:UpdateTable","glue:BatchCreatePartition"],
      effect: iam.Effect.ALLOW,
      resources: [this.formatArn({service: 'glue', resource: 'catalog', sep: '', resourceName: ''}),
                  this.formatArn({service: 'glue', resource: 'database', sep: '/', resourceName: db.metricsGlueDBName}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/${db.metricsGlueTableName}`}),
                  this.formatArn({service: 'glue', resource: 'table', sep: '/', resourceName: `${db.metricsGlueDBName}/*`})],
      sid: 'glueAccessPS'
    })

    const AthenaParLambdaPolicyName = 'AddAthenaPartitionPolicy-' + uuid

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
    refAthenaParLambdaRole.cfnOptions.metadata = {
      cfn_nag: {
         rules_to_suppress: [{
             id: 'W11',
             reason: 'Resource * is required for cloudwatch:GetMetricStatistics as it does not support resource-level permissions.'
          }]
        }
    };

    const athenaParRuleToLambdaProps: EventsRuleToLambdaProps = {
      lambdaFunctionProps: {
        description: 'AWS DevOps Monitoring Dashboard Solution - This function runs on a daily schedule and adds a new partition to Amazon Athena table',
        environment: {
          LOG_LEVEL: 'INFO',
          MetricsDBName: db.metricsGlueDBName,
          MetricsTableName: db.metricsGlueTableName,
          AthenaWorkGroup: db.metricsAthenaWGName,
          SolutionId: props.solutionId,
          UUID: uuid,
          Region: cdk.Aws.REGION,
          Version: props.solutionVersion,
          SendAnonymousUsageData: metricsMapping.findInMap('SendAnonymousUsageData', 'Data'),
          MetricsURL: metricsMapping.findInMap('SendAnonymousUsageData', 'MetricsURL')
        },
        runtime: props.lambdaRuntimeNode,
        code: lambda.Code.fromAsset(`${__dirname}/../lambda/query_runner`),
        handler: 'add_athena_partition.handler',
        role: AthenaParLambdaRole,
        timeout: cdk.Duration.seconds(300)
      },
      eventRuleProps: {
        description: 'AWS DevOps Monitoring Dashboard Solution - Event rule for adding Athena partitions',
        schedule: events.Schedule.expression('cron(0 0 * * ? *)'),
        enabled: true
      }
    };

    new EventsRuleToLambda(this, 'AddAthenaPartition', athenaParRuleToLambdaProps);

    /**
     * Create nested template to provision Amazon QuickSight resources as needed
     */
    const qsNestedTemplate = new QuickSightStack(this, 'QSDashboard', {
        parameters: {
            "QuickSightSourceTemplateArn": this.node.tryGetContext('quicksight_source_template_arn'),
            "QuickSightPrincipalArn": paramQuickSightPrincipalArn.valueAsString,
            "SolutionID": props.solutionId,
            "SolutionName": props.solutionName,
            "SolutionVersion": props.solutionVersion,
            "ParentStackName": cdk.Aws.STACK_NAME,
            "AthenaWorkGroupName": db.metricsAthenaWGName
        }
    });

    qsNestedTemplate.nestedStackResource?.addMetadata('nestedStackFileName', qsNestedTemplate.templateFile.slice(0, -5));
    qsNestedTemplate.nestedStackResource?.addOverride('Condition', 'QuickSightCondition');
    qsNestedTemplate.nestedStackResource?.addOverride('Description', `(${props.solutionId})${props.solutionName} - Create QuickSight Template. Version: ${props.solutionVersion}`);


    //=========================================================================
    // OUTPUTS
    //=========================================================================
    new CfnOutput(this, 'QSAnalysisURL', {
      value: qsNestedTemplate.analysisURLOutput,
      description: 'Amazon QuickSight Analysis URL for AWS DevOps Monitoring Dashboard Solution',
      condition: quickSightCondition
    });

    new CfnOutput(this, 'QSDashboardURL', {
        value: qsNestedTemplate.dashboardURLOutput,
        description: 'Amazon QuickSight Dashboard URL for AWS DevOps Monitoring Dashboard Solution',
        condition: quickSightCondition
    });

    new CfnOutput(this, 'KinesisFirehoseDeliveryStream', {
      value: firehose_obj.attrArn,
      description: 'Kinesis Firehose Delivery Stream for AWS DevOps Monitoring Dashboard Solution'
    })

    new CfnOutput(this, 'EventParserLambdaFunction', {
      value: eventParserLambdaFunction.functionArn,
      description: 'Event Parser Lambda Function for AWS DevOps Monitoring Dashboard Solution'
    })

    new CfnOutput(this, 'QueryRunnerLambdaFunction', {
      value: queryRunnerLambdaFunction.functionArn,
      description: 'Query Runner Lambda Function for AWS DevOps Monitoring Dashboard Solution'
    })

    new CfnOutput(this, 'DevOpsMetricsS3Bucket', {
      value: (codecommitERToFHToS3Construct.s3Bucket?.bucketArn? codecommitERToFHToS3Construct.s3Bucket.bucketArn:'Do not exist'),
      description: 'DevOps Metrics S3 Bucket for AWS DevOps Monitoring Dashboard Solution'
    })

    new CfnOutput(this, 'SolutionVersion', {
      value: props.solutionVersion,
      description: 'Version for AWS DevOps Monitoring Dashboard Solution'
    })
  }
}