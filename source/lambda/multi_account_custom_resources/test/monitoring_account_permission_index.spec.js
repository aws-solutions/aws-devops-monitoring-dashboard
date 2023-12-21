// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const monitorAcctPerm = require('../monitoring_account_permission_index');
const eb = require('../lib/eventbridge');

const principalType = 'Account';
const principal = 'testAccount';
const eventBusName = 'testEventBusName';
const resourceProperties = {
  ResourceProperties: {
    PrincipalType: principalType,
    PrincipalList: principal,
    EventBusName: eventBusName
  }
};
const resourcePropertiesNoType = {
  ResourceProperties: {
    PrincipalList: principal,
    EventBusName: eventBusName
  }
};
const setA = new Set(['testAccount2', 'testAccount3', 'testAccount4', 'testAccount5']);
const setB = new Set(['testAccount1', 'testAccount2', 'testAccount3']);
const setDifference = new Set(['testAccount4', 'testAccount5']);
const createEvent = {
  RequestType: 'Create',
  ServiceToken: 'testServiceToken',
  ResponseURL: 'https://testurl.com',
  StackId: 'testStackId',
  RequestId: '69cfc555-8c89-41b0-992e-0d08a1de737e',
  LogicalResourceId: 'monitoringAcctPermissionCustomResourceMonitoringAcctPermission235F99B0',
  ResourceType: 'Custom::MonitoringAcctPermission',
  ResourceProperties: {
    ServiceToken: 'testServiceToken',
    EventBusName: 'DevOpsCustomEventBus-590fab46-aa16-4994-a584-ef2e30a82aee',
    PrincipalType: 'Account',
    PrincipalList: ['111111111111', '222222222222'],
    MetricsBucketName: 'testBucketName',
    UUID: 'testUUID'
  }
};
const updateEvent = {
  RequestType: 'Create',
  ServiceToken: 'testServiceToken',
  ResponseURL: 'https://testurl.com',
  StackId: 'testStackId',
  RequestId: '69cfc555-8c89-41b0-992e-0d08a1de737e',
  LogicalResourceId: 'monitoringAcctPermissionCustomResourceMonitoringAcctPermission235F99B0',
  ResourceType: 'Custom::MonitoringAcctPermission',
  OldResourceProperties: {
    ServiceToken: 'testServiceToken',
    EventBusName: 'DevOpsCustomEventBus-590fab46-aa16-4994-a584-ef2e30a82aee',
    PrincipalType: 'Account',
    PrincipalList: ['testAccount1', 'testAccount2'],
    MetricsBucketName: 'testBucketName',
    UUID: 'testUUID'
  },
  ResourceProperties: {
    ServiceToken: 'testServiceToken',
    EventBusName: 'DevOpsCustomEventBus-590fab46-aa16-4994-a584-ef2e30a82aee',
    PrincipalType: 'Account',
    PrincipalList: ['testAccount2', 'testAccount3'],
    MetricsBucketName: 'testBucketName',
    UUID: 'testUUID'
  }
};

const responseByDescribeEventBus = {
  Name: 'DevOpsCustomEventBus-3089cafd-60ee-4b65-b368-1cb38060f3b1',
  Arn: 'arn:aws:events:us-east-1:hubAccount:event-bus/DevOpsCustomEventBus-3089cafd-60ee-4b65-b368-1cb38060f3b1',
  Policy:
    '{"Version":"2012-10-17","Statement":[{"Sid":"testAccount1","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::testAccount1:root"},"Action":"events:PutEvents","Resource":"arn:aws:events:us-east-1:hubAccount:event-bus/DevOpsCustomEventBus-3089cafd-60ee-4b65-b368-1cb38060f3b1"},{"Sid":"testAccount2","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::testAccount2:root"},"Action":"events:PutEvents","Resource":"arn:aws:events:us-east-1:hubAccount:event-bus/DevOpsCustomEventBus-3089cafd-60ee-4b65-b368-1cb38060f3b1"}]}'
};

jest.mock(
  '@aws-sdk/client-s3',
  () => {
    const mockS3Service = {
      putBucketPolicy: jest.fn(),
      getBucketPolicy: jest.fn(),
      deleteBucketPolicy: jest.fn(),
    };
    return {
      __esmodule: true,
      S3: jest.fn(() => mockS3Service),
    };
  },
  { virual: true }
);

jest.mock(
  '@aws-sdk/client-eventbridge',
  () => {
    const mockEventBridgeService = {
      putPermission: jest.fn(),
      removePermission: jest.fn(),
      describeEventBus: jest.fn(),
    };
    return {
      __esmodule: true,
      EventBridge: jest.fn(() => mockEventBridgeService),
    };
  },
  { virual: true }
);

jest.mock(
  '../lib/cfn',
  () => ({
    __esmodule: true,
    send: jest.fn().mockReturnValue({})
  }),
  { virual: true }
);

jest.mock('../lib/eventbridge');
eb.describeEventBus.mockReturnValue(responseByDescribeEventBus);

describe('Test different request types for monitoring account permissions', () => {
  test('handle Create', async () => {
    await monitorAcctPerm.handler(
      {
        ResourceType: 'Custom::MonitoringAcctPermission',
        RequestType: 'Create',
        resourceProperties
      },
      {}
    );
  });
  test('handle Update', async () => {
    await monitorAcctPerm.handler(
      {
        ResourceType: 'Custom::MonitoringAcctPermission',
        RequestType: 'Update',
        resourceProperties
      },
      {}
    );
  });
  test('handle Delete', async () => {
    await monitorAcctPerm.handler(
      {
        ResourceType: 'Custom::MonitoringAcctPermission',
        RequestType: 'Delete',
        resourcePropertiesNoType
      },
      {}
    );
  });
  it('should successfully add permission when creating stack', async () => {
    const response = await monitorAcctPerm.managePermission(
      'Create',
      resourceProperties['ResourceProperties'],
      createEvent
    );
    expect(response).not.toBeNull();
  });
  it('should successfully delete permission when deleting stack', async () => {
    const response = await monitorAcctPerm.managePermission(
      'Delete',
      resourceProperties['ResourceProperties'],
      createEvent
    );
    expect(response).not.toBeNull();
  });
  it('should successfully update permission when updating stack', async () => {
    const response = await monitorAcctPerm.managePermission(
      'Update',
      resourceProperties['ResourceProperties'],
      updateEvent
    );
    expect(response).not.toBeNull();
  });
  it('should successfully get difference of two sets', async () => {
    const response = monitorAcctPerm.getSetDifference(setA, setB);
    expect(response).toStrictEqual(setDifference);
  });
});
