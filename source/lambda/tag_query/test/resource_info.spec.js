// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { ResourceTypes, getType, createResourceInfo } = require('../lib/resource_info');

describe('Test getType', () => {
  test('CodeCommit repository', () => {
    const arn = 'arn:aws-us-gov:codecommit:us-gov-west-1:111111111111:repo-name';
    expect(getType(arn)).toStrictEqual(ResourceTypes.CodeCommitRepository);
  });

  test('CodeBuild project', () => {
    const arn = 'arn:aws-cn:codebuild:cn-northwest-1:111111111111:project/project-name';
    expect(getType(arn)).toStrictEqual(ResourceTypes.CodeBuildProject);
  });

  test('CodePipeline pipeline', () => {
    const arn = 'arn:aws:codepipeline:us-west-2:111111111111:pipeline-name';
    expect(getType(arn)).toStrictEqual(ResourceTypes.CodePipelinePipeline);
  });

  test('Invalid ARN', () => {
    const arn = 'arn:aws:s3:::bucket-name';
    expect(() => {
      getType(arn);
    }).toThrow(Error);
  });
});

describe('Test createResourceInfo', () => {
  test('CodeCommit repository', () => {
    const arn = 'arn:aws:codecommit:us-east-1:111111111111:SomeRepoName';
    const resourceInfo = createResourceInfo(arn, {});
    expect(resourceInfo.service).toStrictEqual('CodeCommit');
    expect(resourceInfo.type).toStrictEqual('repository');
    expect(resourceInfo.account).toStrictEqual('111111111111');
    expect(resourceInfo.name).toStrictEqual('SomeRepoName');
  });

  test('CodeBuild project', () => {
    const arn = 'arn:aws-us-gov:codebuild:us-gov-west-1:111111111111:project/a_project';
    const resourceInfo = createResourceInfo(arn, {});
    expect(resourceInfo.service).toStrictEqual('CodeBuild');
    expect(resourceInfo.type).toStrictEqual('project');
    expect(resourceInfo.account).toStrictEqual('111111111111');
    expect(resourceInfo.name).toStrictEqual('a_project');
  });

  test('CodePipeline pipeline', () => {
    const arn = 'arn:aws-cn:codepipeline:cn-northwest-1:111111111111:pipeline-name';
    const resourceInfo = createResourceInfo(arn, {});
    expect(resourceInfo.service).toStrictEqual('CodePipeline');
    expect(resourceInfo.type).toStrictEqual('pipeline');
    expect(resourceInfo.account).toStrictEqual('111111111111');
    expect(resourceInfo.name).toStrictEqual('pipeline-name');
  });

  test('Invalid ARN', () => {
    const arn = 'arn:aws:iam::111111111111:role/RoleName';
    expect(() => {
      createResourceInfo(arn, {});
    }).toThrow(Error);
  });
});
