// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const index = require('../index');
const { TagQueryEngine } = require('../tag_query');
const { Reporter } = require('../reporter');
const cfn = require('../lib/cfn');
const {
  ResourceTypes,
  CodeCommitResourceInfo,
  CodeBuildResourceInfo,
  CodePipelineResourceInfo
} = require('../lib/resource_info');

jest.mock(
  '../lib/cfn',
  () => ({
    __esmodule: true,
    send: jest.fn()
  }),
  { virtual: true }
);

jest.mock('../tag_query');

jest.mock('../reporter');

function getEventFromCfn(operation) {
  return {
    RequestType: operation,
    ResponseURL: 'http://pre-signed-S3-url-for-response',
    StackId: 'arn:aws:cloudformation:us-west-2:111111111111:stack/stack-name/guid',
    RequestId: 'unique id for this create request',
    ResourceType: 'Custom::InvokeTagQuery',
    LogicalResourceId: 'MyTestResource',
    ResourceProperties: {
      ReportBucket: 'report bucket',
      CodeCommitTagConfig: 'codecommit tag config',
      CodeBuildTagConfig: 'codebuild tag config',
      CodePipelineTagConfig: 'codepipeline tag config'
    }
  };
}

function getEvent() {
  return {
    ReportBucket: 'report bucket',
    CodeCommitTagConfig: 'codecommit tag config',
    CodeBuildTagConfig: 'codebuild tag config',
    CodePipelineTagConfig: 'codepipeline tag config'
  };
}

function getExpectedTagConfigs(event) {
  let props = event;
  if ('ResponseURL' in event) {
    // CFN event
    props = event.ResourceProperties;
  }
  return [
    expect.objectContaining({
      resourceType: ResourceTypes.CodeCommitRepository,
      tagConfig: props.CodeCommitTagConfig
    }),
    expect.objectContaining({
      resourceType: ResourceTypes.CodeBuildProject,
      tagConfig: props.CodeBuildTagConfig
    }),
    expect.objectContaining({
      resourceType: ResourceTypes.CodePipelinePipeline,
      tagConfig: props.CodePipelineTagConfig
    })
  ];
}

beforeEach(() => {
  cfn.send.mockClear();

  TagQueryEngine.mockClear();
  TagQueryEngine.mockImplementation(() => {});
  jest.spyOn(TagQueryEngine.prototype, 'getResources').mockClear();
  jest.spyOn(TagQueryEngine.prototype, 'getResources').mockImplementation(() => []);

  Reporter.mockClear();
  jest.spyOn(Reporter.prototype, 'addResource').mockClear();
  jest.spyOn(Reporter.prototype, 'addResource').mockImplementation(() => {});
  jest.spyOn(Reporter.prototype, 'uploadReports').mockClear();
  jest.spyOn(Reporter.prototype, 'uploadReports').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('Test index', () => {
  test('handle Create', async () => {
    const event = getEventFromCfn('Create');
    const context = { logStreamName: 'log stream name' };
    await index.handler(event, context);
    expect(TagQueryEngine).toHaveBeenCalledTimes(1);
    expect(TagQueryEngine.mock.calls[0][0]).toEqual(expect.arrayContaining(getExpectedTagConfigs(event)));
    expect(jest.spyOn(TagQueryEngine.prototype, 'getResources')).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledWith(event, context.logStreamName, { status: 'SUCCESS' });
  });

  test('handle error validating tag configuration', async () => {
    const event = getEventFromCfn('Create');
    const context = { logStreamName: 'log stream name' };
    TagQueryEngine.mockImplementation(() => {
      throw new Error();
    });
    await index.handler(event, context);
    expect(cfn.send).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledWith(event, context.logStreamName, {
      status: 'FAILED',
      data: expect.anything()
    });
  });

  test('handle Update', async () => {
    const event = getEventFromCfn('Update');
    const context = { logStreamName: 'log stream name' };
    await index.handler(event, context);
    expect(TagQueryEngine).toHaveBeenCalledTimes(1);
    expect(TagQueryEngine.mock.calls[0][0]).toEqual(expect.arrayContaining(getExpectedTagConfigs(event)));
    expect(jest.spyOn(TagQueryEngine.prototype, 'getResources')).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledWith(event, context.logStreamName, { status: 'SUCCESS' });
  });

  test('handle Delete', async () => {
    const event = getEventFromCfn('Delete');
    const context = { logStreamName: 'log stream name' };
    await index.handler(event, context);
    expect(jest.spyOn(TagQueryEngine.prototype, 'getResources')).not.toHaveBeenCalled();
    expect(cfn.send).toHaveBeenCalledTimes(1);
    expect(cfn.send).toHaveBeenCalledWith(event, context.logStreamName, { status: 'SUCCESS' });
  });

  test('handle standard invocation', async () => {
    const event = getEvent();
    await index.handler(event, { logStreamName: 'log stream name' });
    expect(TagQueryEngine).toHaveBeenCalledTimes(1);
    expect(TagQueryEngine.mock.calls[0][0]).toEqual(expect.arrayContaining(getExpectedTagConfigs(event)));
    expect(jest.spyOn(TagQueryEngine.prototype, 'getResources')).toHaveBeenCalledTimes(1);
    expect(cfn.send).not.toHaveBeenCalled();
  });

  test('handle standard invocation with resources', async () => {
    const resources = [
      new CodeCommitResourceInfo('arn:aws:codecommit:us-east-1:111111111111:test-repo', {}),
      new CodeBuildResourceInfo('arn:aws:codebuild:us-east-1:111111111111:project/test-project', {}),
      new CodePipelineResourceInfo('arn:aws:codepipeline:us-east-1:111111111111:test-pipeline', {})
    ];
    jest.spyOn(TagQueryEngine.prototype, 'getResources').mockImplementation(() => resources);
    await index.handler({}, { logStreamName: 'log stream name' });
    expect(Reporter).toHaveBeenCalledTimes(1);
    expect(Reporter).toHaveBeenCalledWith(process.env.REPORT_BUCKET, expect.anything());
    expect(jest.spyOn(Reporter.prototype, 'addResource')).toHaveBeenCalledTimes(resources.length);
    for (const resource of resources) {
      expect(jest.spyOn(Reporter.prototype, 'addResource')).toHaveBeenCalledWith(resource);
    }
    expect(jest.spyOn(Reporter.prototype, 'uploadReports')).toHaveBeenCalledTimes(1);
  });

  test('handle error uploading report', async () => {
    const resources = [
      new CodeCommitResourceInfo('arn:aws:codecommit:us-east-1:111111111111:test-repo', {}),
      new CodeBuildResourceInfo('arn:aws:codebuild:us-east-1:111111111111:project/test-project', {}),
      new CodePipelineResourceInfo('arn:aws:codepipeline:us-east-1:111111111111:test-pipeline', {})
    ];
    jest.spyOn(TagQueryEngine.prototype, 'getResources').mockImplementation(() => resources);
    await index.handler({}, { logStreamName: 'log stream name' });
    jest.spyOn(Reporter.prototype, 'addResource').mockImplementation(resource => {
      if (resource.name === 'test-project') {
        throw new Error();
      }
    });
    expect(jest.spyOn(Reporter.prototype, 'addResource')).toHaveBeenCalledTimes(resources.length);
    for (const resource of resources) {
      expect(jest.spyOn(Reporter.prototype, 'addResource')).toHaveBeenCalledWith(resource);
    }
    expect(jest.spyOn(Reporter.prototype, 'uploadReports')).toHaveBeenCalledTimes(1);
  });
});
