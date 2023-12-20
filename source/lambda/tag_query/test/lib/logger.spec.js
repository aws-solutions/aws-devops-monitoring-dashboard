// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

let Logger = new (require('../../lib/logger'))();

const consoleSpy = jest.spyOn(console, 'log');

describe('#Logger', () => {
  describe('#logger', () => {
    it('check with LOG_LEVEL=INFO', () => {
      Logger.loglevel = 'INFO';
      Logger.log('INFO', 'INFO_MESSAGE');
      Logger.log('WARN', 'WARN_MESSAGE');
      Logger.log('ERROR', 'ERROR_MESSAGE');
      Logger.log('DEBUG', 'DEBUG_MESSAGE');

      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });

    it('check with LOG_LEVEL=WARN', () => {
      Logger.loglevel = 'WARN';
      Logger.log('INFO', 'INFO_MESSAGE');
      Logger.log('WARN', 'WARN_MESSAGE');
      Logger.log('ERROR', 'ERROR_MESSAGE');
      Logger.log('DEBUG', 'DEBUG_MESSAGE');

      expect(consoleSpy).toHaveBeenCalledTimes(5);
    });

    it('check with LOG_LEVEL=ERROR', () => {
      Logger.loglevel = 'ERROR';
      Logger.log('INFO', 'INFO_MESSAGE');
      Logger.log('WARN', 'WARN_MESSAGE');
      Logger.log('ERROR', 'ERROR_MESSAGE');
      Logger.log('DEBUG', 'DEBUG_MESSAGE');

      expect(consoleSpy).toHaveBeenCalledTimes(6);
    });

    it('check with LOG_LEVEL=DEBUG', () => {
      Logger.loglevel = 'DEBUG';
      Logger.log('INFO', 'INFO_MESSAGE');
      Logger.log('WARN', 'WARN_MESSAGE');
      Logger.log('ERROR', 'ERROR_MESSAGE');
      Logger.log('DEBUG', 'DEBUG_MESSAGE');

      expect(consoleSpy).toHaveBeenCalledTimes(10);
    });
  });
});
