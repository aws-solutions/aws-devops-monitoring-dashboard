// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import { CfnCondition, CfnResource, Stack, Duration, ArnFormat, RemovalPolicy, Fn, SecretValue } from 'aws-cdk-lib';
import {
  ServicePrincipal,
  Role,
  PolicyDocument,
  PolicyStatement,
  Effect,
  Policy,
  CfnPolicy,
  CfnRole
} from 'aws-cdk-lib/aws-iam';
import { Runtime, Function as LambdaFunction, Code, CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnLogGroup, LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  AccessLogFormat,
  AwsIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MethodOptions,
  PassthroughBehavior,
  RequestValidator,
  RestApi
} from 'aws-cdk-lib/aws-apigateway';
import { KinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisfirehose-s3';
import { addCfnSuppressRules } from '@aws-solutions-constructs/core';
import { NagSuppressions } from 'cdk-nag';

export interface GitHubEventsProps {
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly solutionName: string;
  readonly solutionDistBucket: string;
  readonly solutionDistName: string;
  readonly lambdaRuntimeNode: Runtime;
  readonly webhookSecretToken: string;
  readonly allowedIPs: string;
  readonly metricsBucket: Bucket | undefined;
  readonly uuid: string;
  readonly metricsGlueDBName: string;
  readonly gitHubMetricsGlueTableName: string;
  readonly userAgentExtra: string;
  readonly callingStack: Stack;
}

export class GitHubEvents extends Construct {
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: GitHubEventsProps) {
    super(scope, id);

    const parentStack = props.callingStack;

    //=========================================================================
    // RESOURCES
    //=========================================================================

    /**
     * Create webhook secret token using AWS Secret Manager
     */
    const webhookSecretTokenCond = new CfnCondition(this, 'WebhookSecretTokenCondition', {
      expression: Fn.conditionNot(Fn.conditionEquals(props.webhookSecretToken, ''))
    });

    const secretValue = SecretValue.unsafePlainText(props.webhookSecretToken);
    const webhookSecretToken = new Secret(this, 'WebhookSecretToken', {
      secretName: `${props.solutionId}/GitHubWebhookSecretToken`,
      secretStringValue: secretValue
    });

    const webhookSecretTokenCfnRef = webhookSecretToken.node.defaultChild as CfnResource;
    webhookSecretTokenCfnRef.addOverride('Condition', webhookSecretTokenCond.logicalId);
    addCfnSuppressRules(webhookSecretTokenCfnRef, [
      {
        id: 'W77',
        reason: 'By default the key aws/secretsmanager is used to encrypt the secret value.'
      }
    ]);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(webhookSecretTokenCfnRef, [
      {
        id: 'AwsSolutions-SMG4',
        reason:
          'Automatic rotation does not apply to this use case because the secret is created by user to secure GitHub webhook connection and it is fully controlled by the user.'
      }
    ]);

    /**
     * Create GitHub Event Parser Lambda: Transform GitHub events within Kinesis Firehose
     */
    const cwLogsPS = new PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      effect: Effect.ALLOW,
      resources: [
        parentStack.formatArn({
          service: 'logs',
          resource: 'log-group',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          resourceName: '/aws/lambda/*'
        })
      ],
      sid: 'CreateCWLogs'
    });

    const secretsManagerPS = new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      effect: Effect.ALLOW,
      resources: [webhookSecretToken.secretArn],
      sid: 'GetSecretFromSecretsManager'
    });

    const secretsManagerPolicy = new Policy(this, 'SecretsManagerPolicy', {
      statements: [secretsManagerPS]
    });

    (secretsManagerPolicy.node.defaultChild as CfnPolicy).cfnOptions.condition = webhookSecretTokenCond;

    const eventParserLambdaPolicyNameGitHub = 'eventParserLambdaCWLogPolicy-' + props.uuid;

    const eventParserLambdaRoleGitHub = new Role(this, 'LambdaParserRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [eventParserLambdaPolicyNameGitHub]: new PolicyDocument({
          statements: [cwLogsPS]
        })
      }
    });

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(eventParserLambdaRoleGitHub, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The policy is restricted to region, account and lambda resource.'
      }
    ]);

    secretsManagerPolicy.attachToRole(eventParserLambdaRoleGitHub);

    const eventParserLambdaGitHub = new LambdaFunction(this, 'LambdaParser', {
      description:
        'DevOps Monitoring Dashboard on AWS solution - This function performs lambda transformation on GitHub events within kinesis firehose. It parses GitHub events and sends relevant data to S3 via firehose for downstream operation',
      environment: {
        LOG_LEVEL: 'INFO',
        UserAgentExtra: props.userAgentExtra,
        SolutionID: props.solutionId,
        UseSecret: Fn.conditionIf(webhookSecretTokenCond.logicalId, 'yes', 'no').toString()
      },
      runtime: props.lambdaRuntimeNode,
      code: Code.fromAsset(`${__dirname}/../../lambda/event_parser`),
      handler: 'github_index.handler',
      role: eventParserLambdaRoleGitHub,
      timeout: Duration.seconds(900),
      logRetention: RetentionDays.THREE_MONTHS
    });

    const eventParserLambdaGitHubCfnRef = eventParserLambdaGitHub.node.findChild('Resource') as CfnFunction;
    addCfnSuppressRules(eventParserLambdaGitHubCfnRef, [
      {
        id: 'W89',
        reason: 'There is no need to run this lambda in a VPC'
      },
      {
        id: 'W92',
        reason: 'There is no need for Reserved Concurrency'
      }
    ]);

    /**
     * Create Kinesis Data Firehose using KinesisFirehoseToS3 construct to deliver GitHub events
     */
    const firehoseToS3ConstructGitHub = new KinesisFirehoseToS3(this, 'GitHub', {
      existingBucketObj: props.metricsBucket
    });

    const firehoseLogGroupGitHubCfnRef = firehoseToS3ConstructGitHub.kinesisFirehoseLogGroup.node.findChild(
      'Resource'
    ) as CfnLogGroup;
    addCfnSuppressRules(firehoseLogGroupGitHubCfnRef, [
      {
        id: 'W84',
        reason: 'CloudWatch Log groups are encrypted by default.'
      },
      {
        id: 'W86',
        reason: 'The log data in CloudWatch log group does not need to be expired.'
      }
    ]);

    /* Add more configurations to property ExtendedS3DestinationConfiguration */
    const firehoseObjGitHub = firehoseToS3ConstructGitHub.kinesisFirehose;
    const firehoseRoleGitHub = firehoseToS3ConstructGitHub.kinesisFirehoseRole;
    firehoseObjGitHub.addPropertyOverride('ExtendedS3DestinationConfiguration', {
      CompressionFormat: 'UNCOMPRESSED',
      Prefix: 'GitHubEvents/created_at=!{timestamp:yyyy-MM-dd}/',
      ErrorOutputPrefix:
        'GitHubEventsProcessingErrorlogs/result=!{firehose:error-output-type}/created_at=!{timestamp:yyyy-MM-dd}/',
      ProcessingConfiguration: {
        Enabled: true,
        Processors: [
          {
            Type: 'Lambda',
            Parameters: [
              {
                ParameterName: 'LambdaArn',
                ParameterValue: eventParserLambdaGitHub.functionArn
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
          DatabaseName: props.metricsGlueDBName,
          TableName: props.gitHubMetricsGlueTableName,
          RoleARN: firehoseRoleGitHub.roleArn
        }
      }
    });

    /* Add more configurations to property DeliveryStreamEncryptionConfigurationInput */
    firehoseObjGitHub.addPropertyOverride('DeliveryStreamEncryptionConfigurationInput', {
      KeyType: 'AWS_OWNED_CMK'
    });

    /* Add necessary permissions to firehose role */
    const invokeLambdaPS = new PolicyStatement({
      actions: ['lambda:InvokeFunction', 'lambda:GetFunctionConfiguration'],
      effect: Effect.ALLOW,
      resources: [eventParserLambdaGitHub.functionArn, eventParserLambdaGitHub.functionArn + ':$LATEST'],
      sid: 'InvokeLambda'
    });

    const glueAccessPSForFirehose = new PolicyStatement({
      actions: ['glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions'],
      effect: Effect.ALLOW,
      resources: [
        parentStack.formatArn({ service: 'glue', resource: 'catalog', arnFormat: ArnFormat.NO_RESOURCE_NAME }),
        parentStack.formatArn({
          service: 'glue',
          resource: 'database',
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: props.metricsGlueDBName
        }),
        parentStack.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${props.metricsGlueDBName}/${props.gitHubMetricsGlueTableName}`
        }),
        parentStack.formatArn({
          service: 'glue',
          resource: 'table',
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          resourceName: `${props.metricsGlueDBName}/*`
        })
      ],
      sid: 'glueAccessPSForGitHubEventsFirehose'
    });

    const firehoseRolePolicyGitHub = firehoseToS3ConstructGitHub.node.findChild('KinesisFirehosePolicy') as Policy;
    if (firehoseRolePolicyGitHub !== undefined) {
      firehoseRolePolicyGitHub.addStatements(invokeLambdaPS);
      firehoseRolePolicyGitHub.addStatements(glueAccessPSForFirehose);
      // Add cdk-nag suppression
      NagSuppressions.addResourceSuppressions(firehoseRolePolicyGitHub, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'The policy is restricted to S3 bucket or region, account and glue resource'
        }
      ]);
    }

    firehoseObjGitHub.node.addDependency(firehoseRolePolicyGitHub);

    /**
     * Create API to receive GitHub events using API Gateway
     */
    const apiLogGroup = new LogGroup(this, 'APILogGroup', {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.THREE_MONTHS
    });

    const apiLogGroupCfnRef = apiLogGroup.node.findChild('Resource') as CfnLogGroup;
    addCfnSuppressRules(apiLogGroupCfnRef, [
      {
        id: 'W84',
        reason: 'CloudWatch Log groups are encrypted by default.'
      }
    ]);

    const api = new RestApi(this, 'DevOpsDashboardAPI', {
      description: 'DevOps Monitoring Dashboard on AWS solution - API for receiving GitHub events',
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.ERROR,
        stageName: 'prod',
        tracingEnabled: true,
        variables: { ['allowedips']: props.allowedIPs }
      }
    });

    this.apiEndpoint = `${api.url}git`;

    const gitResource = api.root.addResource('git');

    const requestValidator = new RequestValidator(this, 'APIRequestValidator', {
      restApi: api,
      validateRequestBody: true,
      validateRequestParameters: true
    });

    const deploymentCfnRef = api.node.findChild('Deployment').node.defaultChild as CfnResource;
    addCfnSuppressRules(deploymentCfnRef, [
      {
        id: 'W68',
        reason: 'The API does not require the usage plan.'
      }
    ]);

    const prodStageCfnRef = api.node.findChild('DeploymentStage.prod').node.defaultChild as CfnResource;
    addCfnSuppressRules(prodStageCfnRef, [
      {
        id: 'W64',
        reason: 'The API does not require the usage plan.'
      }
    ]);
    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(prodStageCfnRef, [
      {
        id: 'AwsSolutions-APIG3',
        reason: 'The API does not require enabling WAF.'
      }
    ]);

    const cloudWatchRoleRef = api.node.findChild('CloudWatchRole').node.defaultChild as CfnRole;
    NagSuppressions.addResourceSuppressions(cloudWatchRoleRef, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'The managed policy is automatically generated by CDK itself to allow APIGateway to push CloudWatch logs.'
      }
    ]);

    const firehosePutRecordPS = new PolicyStatement({
      actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
      effect: Effect.ALLOW,
      resources: [firehoseObjGitHub.attrArn],
      sid: 'FirehosePutRecordPS'
    });

    const apiPolicyName = 'DevOpsDashboardAPIPolicy-' + props.uuid;

    const apiRole = new Role(this, 'APIExecutionRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        [apiPolicyName]: new PolicyDocument({
          statements: [firehosePutRecordPS]
        })
      }
    });

    const mappingTemplate = [
      "#set($inputRoot = $input.path('$'))",
      '#set($inputParams = $input.params())',
      '#set($data = "{',
      '#foreach($key in $inputRoot.keySet())',
      '""$key"": $input.json($key),',
      '#end',
      '""additional-data"":',
      '{',
      '""api-id"": ""$context.apiId"",',
      '""stage"": ""$context.stage"",',
      '""http-method"": ""$context.httpMethod"",',
      '""request-id"": ""$context.requestId"",',
      '""resource-id"": ""$context.resourceId"",',
      '""resource-path"": ""$context.resourcePath"",',
      '""source-ip"": ""$context.identity.sourceIp"",',
      '""allowed-ips"": ""$util.escapeJavaScript($stageVariables.get(\'allowedips\'))"",',
      '""input-parameters"": {',
      '#foreach($type in $inputParams.keySet())',
      '#set($params = $inputParams.get($type))',
      '""$type"": {',
      '#foreach($paramName in $params.keySet())',
      '""$paramName"": ""$util.escapeJavaScript($params.get($paramName))""',
      '#if($foreach.hasNext),#end',
      '#end',
      '}',
      '#if($foreach.hasNext),#end',
      '#end',
      '}',
      '}',
      '}")',
      '{',
      '"DeliveryStreamName": "' + firehoseObjGitHub.deliveryStreamName + '",',
      '"Record": {',
      '"Data": "$util.base64Encode($data)"',
      '}',
      '}'
    ];

    const awsIntegration = new AwsIntegration({
      service: 'firehose',
      action: 'PutRecord',
      options: {
        credentialsRole: apiRole,
        integrationResponses: [{ statusCode: '200' }],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        requestTemplates: { 'application/json': mappingTemplate.join('\n') }
      }
    });

    const methodOptions: MethodOptions = {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': { modelId: 'Empty' }
          }
        }
      ],
      requestParameters: { 'method.request.header.X-GitHub-Event': true },
      requestValidator: requestValidator
    };

    gitResource.addMethod('POST', awsIntegration, methodOptions);

    const postMethodCfnRef = gitResource.node.findChild('POST').node.defaultChild as CfnResource;
    addCfnSuppressRules(postMethodCfnRef, [
      {
        id: 'W59',
        reason: 'Authorization is done by github webhook secret token or allowed ips.'
      }
    ]);

    // Add cdk-nag suppression
    NagSuppressions.addResourceSuppressions(postMethodCfnRef, [
      {
        id: 'AwsSolutions-APIG4',
        reason: 'Authorization is done by github webhook secret token or allowed ips.'
      },
      {
        id: 'AwsSolutions-COG4',
        reason: 'Authorization is done by github webhook secret token or allowed ips.'
      }
    ]);
  }
}
