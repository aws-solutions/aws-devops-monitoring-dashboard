#!/usr/bin/env python
######################################################################################################################
#  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                     #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

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
