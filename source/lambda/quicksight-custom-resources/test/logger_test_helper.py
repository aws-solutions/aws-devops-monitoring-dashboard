#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import logging

def set_log_overrides():
    rootLogger = logging.getLogger()
    rootLogger.warning(f'Root logger level: {rootLogger.level}. Overriding log level  for selected modules')
    logging.getLogger().setLevel(logging.WARNING)
    logging.getLogger('hooks').setLevel(logging.WARNING)
    logging.getLogger('botocore.hooks').setLevel(logging.WARNING)
    logging.getLogger('hooks').setLevel(logging.WARNING)


set_log_overrides()


logger = logging.getLogger(__name__)

def dump_state(obj, msg=None):
    if not msg:
        msg = "Dump object "
    if hasattr(obj, 'get_data'):
        obj_data = obj.get_data()
    else:
        obj_data = obj
    obj_data_json = json.dumps(obj_data, indent=2, sort_keys=True)
    logger.debug(f'{msg}, obj data json: {obj_data_json}')
