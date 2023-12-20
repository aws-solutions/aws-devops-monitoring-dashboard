// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const eb = require('../lib/eventbridge.js');

const accountPrincipalType = 'Account';
const accountPrincipal = 'testAccount';
const orgPrincipalType = 'Account';
const orgPrincipal = 'testOrgId';
const eventBusName = 'testEventBusName';

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
      EventBridge: jest.fn(() => mockEventBridgeService)
    };
  },
  { virual: true }
);

describe('When testing event bridge APIs', () => {
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
});
