// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

require('aws-sdk');
const secretsManager = require('../lib/secrets_manager');

const goodSecretId = 'goodSecretId';
const badSecretId = 'badSecretId';

const successfulSecretResponse = {
  SecretString: 'mySecretString'
};

const mockGetSecretValue = jest.fn(SecretId => {
  if (SecretId === goodSecretId) {
    return {
      SecretString: successfulSecretResponse.SecretString
    };
  } else {
    throw Error('secret not found');
  }
});

jest.mock('aws-sdk', () => ({
  config: {
    logger: String,
    update() {
      return {};
    }
  },
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn(({ SecretId }) => ({
      promise: () => mockGetSecretValue(SecretId)
    }))
  }))
}));

describe('When testing secrets manager', () => {
  afterEach(() => {
    mockGetSecretValue.mockClear();
  });

  it('should successfully retrieve a secret', async () => {
    const secret = await secretsManager.getSecret(goodSecretId);
    expect(secret).toBe(successfulSecretResponse.SecretString);
  });

  it('should return a cached secret', async () => {
    let secret = await secretsManager.getSecret(goodSecretId);
    expect(secret).toBe(successfulSecretResponse.SecretString);

    expect(mockGetSecretValue).not.toHaveBeenCalled();

    secret = await secretsManager.getSecret(goodSecretId);
    expect(secret).toBe(successfulSecretResponse.SecretString);
  });

  it('should return undefined if there is an error when retrieving the secret', async () => {
    const secret = await secretsManager.getSecret(badSecretId);
    expect(secret).toBe(undefined);
  });
});
