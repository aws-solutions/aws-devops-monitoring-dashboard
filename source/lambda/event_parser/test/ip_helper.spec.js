// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const ipHelper = require('../lib/ip_helper');

const ip = '192.168.1.1';
const ipRange = '192.168.100.1/16';
const badIPRange = '192.168.100.1/24';
const malformedIpRange = '192x.168.100.1/24';
const malformedIp = 'abc.def.ghi.jkl';

describe('When testing ip_helper', () => {
  it('should match an IP in the given range', () => {
    const isInRange = ipHelper.isIpInRange(ip, ipRange);
    expect(isInRange).toBe(true);
  });

  it('should match a single IP', () => {
    const isInRange = ipHelper.isIpInRange('192.167.200.1', '192.167.200.1');
    expect(isInRange).toBe(true);
  });

  it('should fail if the ip address is out of range', () => {
    const isInRange = ipHelper.isIpInRange(ip, badIPRange);
    expect(isInRange).toBe(false);
  });

  it('should return false if a malformed IP is provided', () => {
    const isInRange = ipHelper.isIpInRange(malformedIp, ipRange);
    expect(isInRange).toBe(false);
  });

  it('should return false if a malformed IP range is provided', () => {
    const isInRange = ipHelper.isIpInRange(ip, malformedIpRange);
    expect(isInRange).toBe(false);
  });
});
