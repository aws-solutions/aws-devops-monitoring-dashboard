// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const expect = require('chai').expect;
const codeCommitEventsLambda = require('../codecommit_events');
const codeBuildEventsLambda = require('../codebuild_metrics');
const codeDeployEventsLambda = require('../codedeploy_events');
const codePipelineEventsLambda = require('../codepipeline_events');
const CanaryAlarmEventsLambda = require('../synthetic_canary_alarm_events');

const recordNumber = 1;

const codeCommitSourceEventData = {
  version: '0',
  id: 'someId',
  'detail-type': 'AWS API Call via CloudTrail',
  source: 'aws.codecommit',
  account: 'xxxxxxxxxxxx',
  time: '2020-12-17T23:09:56Z',
  region: 'us-east-1',
  resources: [],
  detail: {
    eventVersion: '1.08',
    userIdentity: {
      type: 'IAMUser',
      principalId: 'someID',
      arn: 'arn:aws:iam::xxxxxxxxxxxx:user/codecommituser-DoNOTDELETE',
      accountId: 'xxxxxxxxxxxx',
      userName: 'codecommituser-DoNOTDELETE'
    },
    eventTime: '2020-12-17T23:09:56Z',
    eventSource: 'codecommit.amazonaws.com',
    eventName: 'GitPush',
    awsRegion: 'us-east-1',
    sourceIPAddress: 'someIP',
    userAgent: 'SSH-2.0-OpenSSH_7.8',
    requestParameters: {
      references: [
        {
          commit: 'someId',
          ref: 'refs/heads/master'
        }
      ]
    },
    responseElements: null,
    additionalEventData: {
      protocol: 'SSH',
      capabilities: ['report-status', 'side-band-64k'],
      dataTransferred: true,
      repositoryName: 'MyDemoRepo',
      repositoryId: 'someId'
    },
    requestID: 'someId',
    eventID: 'someId',
    readOnly: false,
    resources: [
      {
        accountId: 'xxxxxxxxxxxx',
        type: 'AWS::CodeCommit::Repository',
        ARN: 'arn:aws:codecommit:us-east-1:xxxxxxxxxxxx:MyDemoRepo'
      }
    ],
    eventType: 'AwsApiCall',
    managementEvent: true,
    eventCategory: 'Management'
  }
};

const expectedTransformedCodeCommitRecord = {
  version: '0',
  id: 'someId',
  detail_type: 'AWS API Call via CloudTrail',
  source: 'aws.codecommit',
  account: 'xxxxxxxxxxxx',
  time: '2020-12-17T23:09:56Z',
  region: 'us-east-1',
  resources: [],
  detail: {
    eventName: 'GitPush',
    authorName: 'codecommituser-DoNOTDELETE',
    commitId: 'someId',
    branchName: 'master',
    repositoryName: 'MyDemoRepo'
  }
};

const codeDeploySourceEventData = {
  version: '0',
  id: 'someId',
  'detail-type': 'CodeDeploy Deployment State-change Notification',
  source: 'aws.codedeploy',
  account: 'xxxxxxxxxxxx',
  time: '2021-05-17T21:34:33Z',
  region: 'us-east-1',
  resources: [
    'arn:aws:codedeploy:us-east-1:xxxxxxxxxxxx:deploymentgroup:MyDemoApplication/MyDemoDeploymentGroup',
    'arn:aws:codedeploy:us-east-1:xxxxxxxxxxxx:application:MyDemoApplication'
  ],
  detail: {
    region: 'us-east-1',
    deploymentId: 'someId',
    instanceGroupId: 'someId',
    deploymentGroup: 'MyDemoDeploymentGroup',
    state: 'FAILURE',
    application: 'MyDemoApplication'
  }
};

const expectedTransformedCodeDeployRecord = {
  version: '0',
  id: 'someId',
  detail_type: 'CodeDeploy Deployment State-change Notification',
  source: 'aws.codedeploy',
  account: 'xxxxxxxxxxxx',
  time: '2021-05-17T21:34:33Z',
  region: 'us-east-1',
  resources: [
    'arn:aws:codedeploy:us-east-1:xxxxxxxxxxxx:deploymentgroup:MyDemoApplication/MyDemoDeploymentGroup',
    'arn:aws:codedeploy:us-east-1:xxxxxxxxxxxx:application:MyDemoApplication'
  ],
  detail: {
    deploymentState: 'FAILURE',
    deploymentId: 'someId',
    deploymentApplication: 'MyDemoApplication'
  }
};

const codePipelineSourceEventData = {
  version: '0',
  id: 'someId',
  'detail-type': 'CodePipeline Action Execution State Change',
  source: 'aws.codepipeline',
  account: 'xxxxxxxxxxxx',
  time: '2021-05-17T21:34:24Z',
  region: 'us-east-1',
  resources: ['arn:aws:codepipeline:us-east-1:xxxxxxxxxxxx:MyFirstPipeline'],
  detail: {
    pipeline: 'MyFirstPipeline',
    'execution-id': 'someId',
    stage: 'Build1',
    'execution-result': {
      'external-execution-url': 'someURL',
      'external-execution-id': 'someId'
    },
    action: 'Build1',
    state: 'SUCCEEDED',
    region: 'us-east-1',
    type: {
      owner: 'AWS',
      provider: 'CodeBuild',
      category: 'Build',
      version: '1'
    },
    version: 4
  }
};

const expectedTransformedCodePipelineRecord = {
  version: '0',
  id: 'someId',
  detail_type: 'CodePipeline Action Execution State Change',
  source: 'aws.codepipeline',
  account: 'xxxxxxxxxxxx',
  time: '2021-05-17T21:34:24Z',
  region: 'us-east-1',
  resources: ['arn:aws:codepipeline:us-east-1:xxxxxxxxxxxx:MyFirstPipeline'],
  detail: {
    pipelineName: 'MyFirstPipeline',
    executionId: 'someId',
    stage: 'Build1',
    action: 'Build1',
    state: 'SUCCEEDED',
    externalExecutionId: 'someId',
    actionCategory: 'Build',
    actionOwner: 'AWS',
    actionProvider: 'CodeBuild'
  }
};

const canaryAlarmSourceEventData = {
  version: '0',
  id: 'someId',
  'detail-type': 'CloudWatch Alarm State Change',
  source: 'aws.cloudwatch',
  account: 'xxxxxxxxxxxx',
  time: '2020-09-29T06:05:01Z',
  region: 'us-east-1',
  resources: ['arn:aws:cloudwatch:us-east-1:xxxxxxxxxxxx:alarm:SO0143-[MyDemoApplication2]-[MyDemoRepo2]-MTTR'],
  detail: {
    alarmName: 'SO0143-[MyDemoApplication2]-[MyDemoRepo2]-MTTR',
    state: {
      value: 'OK',
      reason:
        'Threshold Crossed: 1 out of the last 1 datapoints [100.0 (29/09/20 06:04:00)] was not less than the threshold (100.0) (minimum 1 datapoint for ALARM -> OK transition).',
      reasonData:
        '{"version":"1.0","queryDate":"2020-09-29T06:05:01.175+0000","startDate":"2020-09-29T06:04:00.000+0000","statistic":"Average","period":60,"recentDatapoints":[100.0],"threshold":100.0}',
      timestamp: '2020-09-29T06:05:01.181+0000'
    },
    previousState: {
      value: 'ALARM',
      reason:
        'Threshold Crossed: 1 out of the last 1 datapoints [0.0 (29/09/20 05:56:00)] was less than the threshold (100.0) (minimum 1 datapoint for OK -> ALARM transition).',
      reasonData:
        '{"version":"1.0","queryDate":"2020-09-29T05:59:01.321+0000","startDate":"2020-09-29T05:56:00.000+0000","statistic":"Average","period":60,"recentDatapoints":[0.0],"threshold":100.0}',
      timestamp: '2020-09-29T05:59:01.323+0000'
    },
    configuration: {
      metrics: [
        {
          id: 'dcba6c38-0741-206b-e73e-62c54f8435f9',
          metricStat: {
            metric: {
              namespace: 'CloudWatchSynthetics',
              name: 'SuccessPercent',
              dimensions: {
                CanaryName: 'mycanary'
              }
            },
            period: 60,
            stat: 'Average'
          },
          returnData: true
        }
      ]
    }
  }
};

const expectedTransformedCanaryAlarmRecord = {
  version: '0',
  id: 'someId',
  detail_type: 'CloudWatch Alarm State Change',
  source: 'aws.cloudwatch',
  account: 'xxxxxxxxxxxx',
  time: '2020-09-29T06:05:01Z',
  region: 'us-east-1',
  resources: ['arn:aws:cloudwatch:us-east-1:xxxxxxxxxxxx:alarm:SO0143-[MyDemoApplication2]-[MyDemoRepo2]-MTTR'],
  detail: {
    canaryAlarmCurrState: 'OK',
    canaryAlarmCurrStateTimeStamp: '2020-09-29T06:05:01Z',
    canaryAlarmPrevState: 'ALARM',
    canaryAlarmPrevStateTimeStamp: '2020-09-29T05:59:01Z',
    canaryAlarmName: 'SO0143-[MyDemoApplication2]-[MyDemoRepo2]-MTTR',
    canaryAlarmAppName: 'MyDemoApplication2',
    canaryAlarmRepoName: 'MyDemoRepo2',
    alarmType: 'Canary',
    recoveryDurationMinutes: 6
  }
};

const codeBuildSourceEventData =
  'eyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiUG9zdEJ1aWxkRHVyYXRpb24iLCJkaW1lbnNpb25zIjp7fSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjAuMDQ0LCJtYXgiOjAuMDQ0LCJtaW4iOjAuMDQ0fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJQcm92aXNpb25pbmdEdXJhdGlvbiIsImRpbWVuc2lvbnMiOnsiUHJvamVjdE5hbWUiOiJ0ZXN0Q29kZUJ1aWxkLUNvZGVDb21taXQifSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjIyLjEwNywibWF4IjoyMi4xMDcsIm1pbiI6MjIuMTA3fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJEb3dubG9hZFNvdXJjZUR1cmF0aW9uIiwiZGltZW5zaW9ucyI6e30sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjowLjI4NCwibWF4IjowLjI4NCwibWluIjowLjI4NH0sInVuaXQiOiJTZWNvbmRzIn0KeyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiQnVpbGREdXJhdGlvbiIsImRpbWVuc2lvbnMiOnsiUHJvamVjdE5hbWUiOiJ0ZXN0Q29kZUJ1aWxkLUNvZGVDb21taXQifSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjAuMDQ2LCJtYXgiOjAuMDQ2LCJtaW4iOjAuMDQ2fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJVcGxvYWRBcnRpZmFjdHNEdXJhdGlvbiIsImRpbWVuc2lvbnMiOnsiUHJvamVjdE5hbWUiOiJ0ZXN0Q29kZUJ1aWxkLUNvZGVDb21taXQifSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjAuMDk3LCJtYXgiOjAuMDk3LCJtaW4iOjAuMDk3fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJCdWlsZER1cmF0aW9uIiwiZGltZW5zaW9ucyI6e30sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjowLjA0NiwibWF4IjowLjA0NiwibWluIjowLjA0Nn0sInVuaXQiOiJTZWNvbmRzIn0KeyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiSW5zdGFsbER1cmF0aW9uIiwiZGltZW5zaW9ucyI6e30sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjowLjA0NiwibWF4IjowLjA0NiwibWluIjowLjA0Nn0sInVuaXQiOiJTZWNvbmRzIn0KeyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiQnVpbGRzIiwiZGltZW5zaW9ucyI6e30sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjoxLjAsIm1heCI6MS4wLCJtaW4iOjEuMH0sInVuaXQiOiJDb3VudCJ9CnsibWV0cmljX3N0cmVhbV9uYW1lIjoiQ29kZUJ1aWxkTWV0cmljcy1FeGlzdGluZ0ZpcmVob3NlLUN1c3RvbVBhcnRpYWwtTnFOUlh0IiwiYWNjb3VudF9pZCI6Inh4eHh4eHh4eHh4eCIsInJlZ2lvbiI6InVzLWVhc3QtMSIsIm5hbWVzcGFjZSI6IkFXUy9Db2RlQnVpbGQiLCJtZXRyaWNfbmFtZSI6IkZpbmFsaXppbmdEdXJhdGlvbiIsImRpbWVuc2lvbnMiOnt9LCJ0aW1lc3RhbXAiOjE2MTkxMzM3MjAwMDAsInZhbHVlIjp7ImNvdW50IjoxLjAsInN1bSI6NC4xMTcsIm1heCI6NC4xMTcsIm1pbiI6NC4xMTd9LCJ1bml0IjoiU2Vjb25kcyJ9CnsibWV0cmljX3N0cmVhbV9uYW1lIjoiQ29kZUJ1aWxkTWV0cmljcy1FeGlzdGluZ0ZpcmVob3NlLUN1c3RvbVBhcnRpYWwtTnFOUlh0IiwiYWNjb3VudF9pZCI6Inh4eHh4eHh4eHh4eCIsInJlZ2lvbiI6InVzLWVhc3QtMSIsIm5hbWVzcGFjZSI6IkFXUy9Db2RlQnVpbGQiLCJtZXRyaWNfbmFtZSI6IkRvd25sb2FkU291cmNlRHVyYXRpb24iLCJkaW1lbnNpb25zIjp7IlByb2plY3ROYW1lIjoidGVzdENvZGVCdWlsZC1Db2RlQ29tbWl0In0sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjowLjI4NCwibWF4IjowLjI4NCwibWluIjowLjI4NH0sInVuaXQiOiJTZWNvbmRzIn0KeyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiUHJvdmlzaW9uaW5nRHVyYXRpb24iLCJkaW1lbnNpb25zIjp7fSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjIyLjEwNywibWF4IjoyMi4xMDcsIm1pbiI6MjIuMTA3fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJQcmVCdWlsZER1cmF0aW9uIiwiZGltZW5zaW9ucyI6eyJQcm9qZWN0TmFtZSI6InRlc3RDb2RlQnVpbGQtQ29kZUNvbW1pdCJ9LCJ0aW1lc3RhbXAiOjE2MTkxMzM3MjAwMDAsInZhbHVlIjp7ImNvdW50IjoxLjAsInN1bSI6MC4wNDYsIm1heCI6MC4wNDYsIm1pbiI6MC4wNDZ9LCJ1bml0IjoiU2Vjb25kcyJ9CnsibWV0cmljX3N0cmVhbV9uYW1lIjoiQ29kZUJ1aWxkTWV0cmljcy1FeGlzdGluZ0ZpcmVob3NlLUN1c3RvbVBhcnRpYWwtTnFOUlh0IiwiYWNjb3VudF9pZCI6Inh4eHh4eHh4eHh4eCIsInJlZ2lvbiI6InVzLWVhc3QtMSIsIm5hbWVzcGFjZSI6IkFXUy9Db2RlQnVpbGQiLCJtZXRyaWNfbmFtZSI6IlF1ZXVlZER1cmF0aW9uIiwiZGltZW5zaW9ucyI6e30sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjoxLjIwMiwibWF4IjoxLjIwMiwibWluIjoxLjIwMn0sInVuaXQiOiJTZWNvbmRzIn0KeyJtZXRyaWNfc3RyZWFtX25hbWUiOiJDb2RlQnVpbGRNZXRyaWNzLUV4aXN0aW5nRmlyZWhvc2UtQ3VzdG9tUGFydGlhbC1OcU5SWHQiLCJhY2NvdW50X2lkIjoieHh4eHh4eHh4eHh4IiwicmVnaW9uIjoidXMtZWFzdC0xIiwibmFtZXNwYWNlIjoiQVdTL0NvZGVCdWlsZCIsIm1ldHJpY19uYW1lIjoiU3VibWl0dGVkRHVyYXRpb24iLCJkaW1lbnNpb25zIjp7fSwidGltZXN0YW1wIjoxNjE5MTMzNzIwMDAwLCJ2YWx1ZSI6eyJjb3VudCI6MS4wLCJzdW0iOjAuMTI2LCJtYXgiOjAuMTI2LCJtaW4iOjAuMTI2fSwidW5pdCI6IlNlY29uZHMifQp7Im1ldHJpY19zdHJlYW1fbmFtZSI6IkNvZGVCdWlsZE1ldHJpY3MtRXhpc3RpbmdGaXJlaG9zZS1DdXN0b21QYXJ0aWFsLU5xTlJYdCIsImFjY291bnRfaWQiOiJ4eHh4eHh4eHh4eHgiLCJyZWdpb24iOiJ1cy1lYXN0LTEiLCJuYW1lc3BhY2UiOiJBV1MvQ29kZUJ1aWxkIiwibWV0cmljX25hbWUiOiJGaW5hbGl6aW5nRHVyYXRpb24iLCJkaW1lbnNpb25zIjp7IlByb2plY3ROYW1lIjoidGVzdENvZGVCdWlsZC1Db2RlQ29tbWl0In0sInRpbWVzdGFtcCI6MTYxOTEzMzcyMDAwMCwidmFsdWUiOnsiY291bnQiOjEuMCwic3VtIjo0LjExNywibWF4Ijo0LjExNywibWluIjo0LjExN30sInVuaXQiOiJTZWNvbmRzIn0K';
const decodedCodeBuildSourceData = Buffer.from(codeBuildSourceEventData, 'base64').toString('utf8');
const expectedTransformedCodeBuildRecord =
  '{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"ProvisioningDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":22.107,"max":22.107,"min":22.107},"unit":"Seconds"}\n{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"BuildDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":0.046,"max":0.046,"min":0.046},"unit":"Seconds"}\n{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"UploadArtifactsDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":0.097,"max":0.097,"min":0.097},"unit":"Seconds"}\n{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"DownloadSourceDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":0.284,"max":0.284,"min":0.284},"unit":"Seconds"}\n{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"PreBuildDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":0.046,"max":0.046,"min":0.046},"unit":"Seconds"}\n{"metric_stream_name":"CodeBuildMetrics-ExistingFirehose-CustomPartial-NqNRXt","account_id":"xxxxxxxxxxxx","region":"us-east-1","namespace":"AWS/CodeBuild","metric_name":"FinalizingDuration","dimensions":{"ProjectName":"testCodeBuild-CodeCommit"},"timestamp":1619133720000,"value":{"count":1.0,"sum":4.117,"max":4.117,"min":4.117},"unit":"Seconds"}';

describe('When testing event parser', () => {
  it('expect record match after CodeCommit event transformation', async () => {
    const transformedRecord = await codeCommitEventsLambda.transformCodeCommitEvents(
      codeCommitSourceEventData,
      recordNumber
    );
    const transformedRecordString = JSON.stringify(transformedRecord, null, 2);
    const expectedTransformedRecordString = JSON.stringify(expectedTransformedCodeCommitRecord, null, 2);

    console.log('Transformed record string for CodeCommit: ' + transformedRecordString);
    console.log('Expected record string for CodeCommit: ' + expectedTransformedRecordString);

    expect(transformedRecordString).to.equal(expectedTransformedRecordString);
  });

  it('expect record match after CodeDeploy event transformation', async () => {
    const transformedRecord = await codeDeployEventsLambda.transformCodeDeployEvents(
      codeDeploySourceEventData,
      recordNumber
    );
    const transformedRecordString = JSON.stringify(transformedRecord, null, 2);
    const expectedTransformedRecordString = JSON.stringify(expectedTransformedCodeDeployRecord, null, 2);

    console.log('Transformed record string for CodeDeploy: ' + transformedRecordString);
    console.log('Expected record string for CodeDeploy: ' + expectedTransformedRecordString);

    expect(transformedRecordString).to.equal(expectedTransformedRecordString);
  });

  it('expect record match after CodePipeline event transformation', async () => {
    const transformedRecord = await codePipelineEventsLambda.transformCodePipelineEvents(
      codePipelineSourceEventData,
      recordNumber
    );
    const transformedRecordString = JSON.stringify(transformedRecord, null, 2);
    const expectedTransformedRecordString = JSON.stringify(expectedTransformedCodePipelineRecord, null, 2);

    console.log('Transformed record string for CodePipeline: ' + transformedRecordString);
    console.log('Expected record string for CodePipeline: ' + expectedTransformedRecordString);

    expect(transformedRecordString).to.equal(expectedTransformedRecordString);
  });

  it('expect record match after Synthetics canary alarm event transformation', async () => {
    const transformedRecord = await CanaryAlarmEventsLambda.transformSyntheticCanaryAlarmEvents(
      canaryAlarmSourceEventData,
      recordNumber
    );
    const transformedRecordString = JSON.stringify(transformedRecord, null, 2);
    const expectedTransformedRecordString = JSON.stringify(expectedTransformedCanaryAlarmRecord, null, 2);

    console.log('Transformed record string for Synthetics canary alarm: ' + transformedRecordString);
    console.log('Expected record string for Synthetics canary alarm: ' + expectedTransformedRecordString);

    expect(transformedRecordString).to.equal(expectedTransformedRecordString);
  });

  it('expect record match after transformation of CodeBuild event with project', async () => {
    const transformedRecord = await codeBuildEventsLambda.transformCodeBuildCWMetrics(
      decodedCodeBuildSourceData,
      recordNumber
    );
    const transformedRecordString = JSON.stringify(transformedRecord, null, 2);
    const expectedTransformedRecordString = JSON.stringify(expectedTransformedCodeBuildRecord, null, 2);

    console.log('Transformed record string for Code Build ' + transformedRecordString);
    console.log('Expected record string for Code Build: ' + expectedTransformedRecordString);

    expect(transformedRecordString).to.equal(expectedTransformedRecordString);
  });
});
