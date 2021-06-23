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

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as logs from '@aws-cdk/aws-logs';
import * as lambda from '@aws-cdk/aws-lambda';
import { CfnMetricStream } from '@aws-cdk/aws-cloudwatch';
import { KinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisfirehose-s3';

export interface CodeBuildEventsProps {
  metricsBucket: s3.Bucket | undefined;
  lambdaRunTime: lambda.Runtime;
  uuid: string;
  metricsGlueDBName: string;
  codeBuildMetricsGlueTableName: string;
  callingStack: cdk.Stack;
  userAgentExtra: string;
}

export class CodeBuildEvents extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CodeBuildEventsProps) {
    super(scope, id);

    const parentStack = props.callingStack

    /**
     * Create CodeBuild Event Parser Lambda: Transform Cloudwatch metrics for CodeBuild within Kinesis Firehose
     */
    const cwLogsPS = new iam.PolicyStatement({
      actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      effect: iam.Effect.ALLOW,
      resources: [parentStack.formatArn({service: 'logs', resource: 'log-group', sep: ':', resourceName: '/aws/lambda/*'})],
      sid: 'CreateCWLogs'
    })

    const codeBuildEventParserLambdaPolicyName = 'CodeBuildEventParserLambdaPolicy-' + props.uuid

    const codeBuildEventParserLambdaRole = new iam.Role(this, 'CodeBuildEventParserLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [codeBuildEventParserLambdaPolicyName]: new iam.PolicyDocument({
          statements: [
            cwLogsPS
          ]
        })
      }
    });

    const codeBuildEventParserLambda = new lambda.Function(this, 'CodeBuildEventParser', {
      description: 'AWS DevOps Monitoring Dashboard Solution - This function performs lambda transformation within kinesis firehose. It parses CloudWatch metrics for CodeBuild, sends relevant data to S3 for downstream operation',
      environment: {
        LOG_LEVEL: 'INFO',
        UserAgentExtra: props.userAgentExtra
      },
      runtime: props.lambdaRunTime,
      code: lambda.Code.fromAsset(`${__dirname}/../../lambda/event_parser`),
      handler: 'codebuild_index.handler',
      role: codeBuildEventParserLambdaRole,
      timeout: cdk.Duration.seconds(900)
    })

    const refCodeBuildEventParserLambda =  codeBuildEventParserLambda.node.findChild('Resource') as lambda.CfnFunction;
    const lambdaCfnNag = {
      cfn_nag: {
          rules_to_suppress: [
              {
                  id: 'W89',
                  reason: 'There is no need to run this lambda in a VPC'
              },
              {
                  id: 'W92',
                  reason: 'There is no need for Reserved Concurrency'
              }
          ]
      }
    };
    refCodeBuildEventParserLambda.cfnOptions.metadata = lambdaCfnNag;

    /**
     * Create Kinesis Data Firehose using KinesisFirehoseToS3 construct
     */
    const firehoseToS3Construct = new KinesisFirehoseToS3(this, 'CodeBuild', {
      existingBucketObj: props.metricsBucket
    });

    const refFirehoseLogGroup = firehoseToS3Construct.kinesisFirehoseLogGroup.node.findChild('Resource') as logs.CfnLogGroup
    refFirehoseLogGroup.cfnOptions.metadata = {
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

    /* Add more configurations to property ExtendedS3DestinationConfiguration */
    const firehoseObj = firehoseToS3Construct.kinesisFirehose
    const firehoseRole = firehoseToS3Construct.kinesisFirehoseRole
    firehoseObj.addPropertyOverride('ExtendedS3DestinationConfiguration', {
      CompressionFormat: 'UNCOMPRESSED',
      Prefix: 'CodeBuildEvents/created_at=!{timestamp:yyyy-MM-dd}/',
      ErrorOutputPrefix: 'CodeBuildEventsProcessingErrorlogs/result=!{firehose:error-output-type}/created_at=!{timestamp:yyyy-MM-dd}/',
      ProcessingConfiguration: {
        Enabled: true,
        Processors: [{
          Type: 'Lambda',
          Parameters: [{
            ParameterName: 'LambdaArn',
            ParameterValue: codeBuildEventParserLambda.functionArn
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
          DatabaseName: props.metricsGlueDBName,
          TableName: props.codeBuildMetricsGlueTableName,
          RoleARN: firehoseRole.roleArn
        }
      }
    })

    /* Add more configurations to property DeliveryStreamEncryptionConfigurationInput */
    firehoseObj.addPropertyOverride('DeliveryStreamEncryptionConfigurationInput', {
      KeyType: 'AWS_OWNED_CMK'
    })

    /* Add necessary permissions to firehose role */
    const invokeLambdaPS = new iam.PolicyStatement()
    invokeLambdaPS.sid = 'InvokeLambda'
    invokeLambdaPS.effect = iam.Effect.ALLOW
    invokeLambdaPS.addActions("lambda:InvokeFunction", "lambda:GetFunctionConfiguration")
    invokeLambdaPS.addResources(codeBuildEventParserLambda.functionArn, codeBuildEventParserLambda.functionArn + ':$LATEST')

    const glueAccessPSForFirehose = new iam.PolicyStatement({
      actions: ['glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions'],
      effect: iam.Effect.ALLOW,
      resources: [parentStack.formatArn({ service: 'glue', resource: 'catalog', sep: '', resourceName: '' }),
      parentStack.formatArn({ service: 'glue', resource: 'database', sep: '/', resourceName: props.metricsGlueDBName }),
      parentStack.formatArn({ service: 'glue', resource: 'table', sep: '/', resourceName: `${props.metricsGlueDBName}/${props.codeBuildMetricsGlueTableName}` }),
      parentStack.formatArn({ service: 'glue', resource: 'table', sep: '/', resourceName: `${props.metricsGlueDBName}/*` })],
      sid: 'glueAccessPSForCodeBuildEventsFirehose'
    })

    let firehoseRolePolicy = firehoseToS3Construct.node.findChild('KinesisFirehosePolicy') as iam.Policy;
    if (firehoseRolePolicy !== undefined) {
      firehoseRolePolicy.addStatements(invokeLambdaPS)
      firehoseRolePolicy.addStatements(glueAccessPSForFirehose)
    }

    firehoseObj.node.addDependency(firehoseRolePolicy)

    /**
     * Create CloudWatch Metric Stream
     */
    const firehosePutRecordPS = new iam.PolicyStatement()
    firehosePutRecordPS.sid = 'FirehosePutRecordPS'
    firehosePutRecordPS.effect = iam.Effect.ALLOW
    firehosePutRecordPS.addActions("firehose:PutRecord", "firehose:PutRecordBatch")
    firehosePutRecordPS.addResources(firehoseObj.attrArn)

    const firehosePutRecordPolicyName = 'FirehosePutRecord-' + props.uuid

    const cloudWatchMetricStreamRole = new iam.Role(this, 'CloudWatchMetricStreamRole', {
      assumedBy: new iam.ServicePrincipal('streams.metrics.cloudwatch.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [firehosePutRecordPolicyName]: new iam.PolicyDocument({
          statements: [
            firehosePutRecordPS
          ]
        })
      }
    });

    new CfnMetricStream(this, "CloudWatchMetricStream", {
      firehoseArn: firehoseObj.attrArn,
      roleArn: cloudWatchMetricStreamRole.roleArn,
      includeFilters: [
        { namespace: 'AWS/CodeBuild' }
      ],
      outputFormat: 'json'
    });


  }
}