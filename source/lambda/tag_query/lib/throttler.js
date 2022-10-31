#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

class Throttler {
  constructor(minIntervalMilliseconds) {
    this._minIntervalMilliseconds = minIntervalMilliseconds;
    this._timeLastReady = undefined;
  }

  async ready() {
    const timeWhenCalled = new Date().getTime();
    if (this._timeLastReady === undefined) {
      // First call, return immediately
      this._timeLastReady = timeWhenCalled;
      return;
    }

    const timeNextReady = this._timeLastReady + this._minIntervalMilliseconds;
    if (timeWhenCalled < timeNextReady) {
      const delayMilliseconds = timeNextReady - timeWhenCalled;
      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, delayMilliseconds);
      });
    }

    // Whether we waited or not, remember the last time we returned a ready status
    this._timeLastReady = new Date().getTime();
  }
}

exports.Throttler = Throttler;
