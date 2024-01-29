// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const mockEventBridge = {
  putPermission: jest.fn(),
  removePermission: jest.fn(),
  describeEventBus: jest.fn(),
};
const eb = require('../lib/eventbridge.js');
const { ServiceException } = require('@smithy/smithy-client');
const accountPrincipalType = 'Account';
const accountPrincipal = 'testAccount';
const orgPrincipalType = 'Account';
const orgPrincipal = 'testOrgId';
const eventBusName = 'testEventBusName';

jest.mock(
  '@aws-sdk/client-eventbridge',
  () => ({
      __esmodule: true,
      EventBridge: jest.fn(() => mockEventBridge),
    })
);

describe('When testing event bridge APIs', () => {
  beforeEach(() => {
    mockEventBridge.putPermission.mockReset();
    mockEventBridge.removePermission.mockReset();
    mockEventBridge.describeEventBus.mockReset();
  });

  it('should successfully put permission for account', async () => {
    const response = await eb.putPermission(accountPrincipalType, accountPrincipal, eventBusName);
    expect(response).not.toBeNull();
  });

  it('should successfully remove permission from account', async () => {
    const response = await eb.removePermission(accountPrincipal, eventBusName);
    expect(response).not.toBeNull();
  });

  it('should successfully put permission for organization', async () => {
    const response = await eb.putPermission(orgPrincipalType, accountPrincipal, eventBusName);
    expect(response).not.toBeNull();
  });

  it('should successfully remove permission from organization', async () => {
    const response = await eb.removePermission(orgPrincipal, eventBusName);
    expect(response).not.toBeNull();
  });
  it('should successfully describe event bus', async () => {
  const response = await eb.describeEventBus(eventBusName);
    expect(response).not.toBeNull();
  });
  it('should return undefined when resource is not found', async () => {
    const mockError = new ServiceException({name: 'ResourceNotFoundException'});
    mockEventBridge.removePermission.mockImplementation(async () => { throw mockError });
    const response = await eb.removePermission(orgPrincipal, eventBusName);
    expect(response).toEqual(undefined);
  });
    it('should throw when removing permissions throws anything other than ResourceNotFoundException', async () => {
    const mockError = new ServiceException({name: 'OtherException'});
    mockEventBridge.removePermission.mockImplementation(async () => { throw mockError });
    expect(eb.removePermission(orgPrincipal, eventBusName)).rejects.toThrow(mockError);
  });
});
