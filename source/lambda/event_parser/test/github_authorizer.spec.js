// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const githubAuthorizer = require('../lib/github_authorizer');
const secretsManager = require('../lib/secrets_manager');
const ipHelper = require('../lib/ip_helper');

const secret = 'exampleSecret';

const data = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22',
    'input-parameters': {
      header: {
        'X-Hub-Signature-256': 'sha256=32859f172d4279fb9bd468b3c9a7d064cd50225d5dd57b25ffd2d3e82d619adc'
      }
    }
  }
};

const dataBadAllowedIp = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22x',
    'input-parameters': {
      header: {}
    }
  }
};

const dataMissingSignature = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22',
    'input-parameters': {
      header: {}
    }
  }
};

const dataMissingHeaders = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22',
    'input-parameters': {}
  }
};

const dataMissingSourceIp = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22',
    'input-parameters': {
      header: {}
    }
  }
};

const dataMissingAllowedIps = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'input-parameters': {
      header: {}
    }
  }
};

const dataShortSignature = {
  body: {
    example: 'example'
  },
  'additional-data': {
    'source-ip': '192.168.1.1',
    'allowed-ips': '192.168.100.0/24,192.168.1.0/24,192.255.0.0/22',
    'input-parameters': {
      header: {
        'X-Hub-Signature-256': 'sha256=32859f172d4279fb9bd468b3c9a7d064cd50225d5dd57b25ffd2d3e82d619ad'
      }
    }
  }
};

jest.mock('../lib/secrets_manager');
jest.mock('../lib/ip_helper');
secretsManager.getSecret.mockReturnValue(secret);

describe('When testing the github_authorizer', () => {
  const ipRangeSpy = jest.spyOn(ipHelper, 'isIpInRange');

  afterEach(() => {
    ipRangeSpy.mockClear();
  });

  it('should return true if a valid secret is found, and not attempt to validate the ipRange', async () => {
    process.env = {
      UseSecret: 'yes'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(data);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(true);
  });

  it('should return false if a secret is found and it does not match', async () => {
    process.env = {
      UseSecret: 'yes'
    };

    secretsManager.getSecret.mockReturnValueOnce('wrongSecret');

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(data);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return false if the hash header is present but no secret was provided', async () => {
    process.env = {
      UseSecret: 'no'
    };
    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(data);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return true if no secret is found and it is in a valid ipRange', async () => {
    process.env = {
      UseSecret: 'no'
    };

    ipHelper.isIpInRange.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingSignature);

    // succeeds on the 2nd ipAddress range out of 3
    expect(ipRangeSpy).toHaveBeenCalledTimes(2);

    expect(isAuthorized).toBe(true);
  });

  it('should return false if no secret is found and it is outside of a valid ipRange', async () => {
    process.env = {
      UseSecret: 'no'
    };

    ipHelper.isIpInRange.mockReturnValue(false);

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingSignature);

    // checks all 3 ip address ranges and fails
    expect(ipRangeSpy).toHaveBeenCalledTimes(3);

    expect(isAuthorized).toBe(false);
  });

  it('should return false if no secret is found and an invalid ipRange is provided', async () => {
    process.env = {
      UseSecret: 'no'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataBadAllowedIp);

    expect(isAuthorized).toBe(false);
  });

  it('should return false (and print an error) if missing X-Hub-Signature', async () => {
    process.env = {
      UseSecret: 'yes'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingSignature);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return false (and print an error) if missing headers when testing', async () => {
    process.env = {
      UseSecret: 'yes'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingHeaders);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return false (and print an error) if the hash is too short', async () => {
    process.env = {
      UseSecret: 'yes'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataShortSignature);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return false if missing source-ip', async () => {
    process.env = {
      UseSecret: 'no'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingSourceIp);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });

  it('should return false if missing allowed-ips', async () => {
    process.env = {
      UseSecret: 'no'
    };

    const isAuthorized = await githubAuthorizer.authorizeGitHubRequest(dataMissingAllowedIps);

    expect(ipRangeSpy).not.toHaveBeenCalled();

    expect(isAuthorized).toBe(false);
  });
});
