// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { Throttler } = require('../../lib/throttler');

describe('Test Throttler', () => {
  test('Throttles execution', async () => {
    const throttler = new Throttler(100);
    const start = new Date().getTime();
    for (let i = 0; i <= 5; i++) {
      await throttler.ready();
    }
    const end = new Date().getTime();
    expect(end - start).toBeGreaterThanOrEqual(500);
  });
});
