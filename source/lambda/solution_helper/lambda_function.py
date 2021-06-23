######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

import logging
import os
import uuid
import requests
import json
from copy import copy
from datetime import datetime
from crhelper import CfnResource
from util.solution_metrics import send_metrics

logger = logging.getLogger(__name__)
helper = CfnResource(json_logging=True, log_level="INFO")


@helper.create
@helper.update
@helper.delete
def solution_helper(event, _):

    logger.info(f"[solution_helper] event: {event}")

    if event["ResourceType"] == "Custom::CreateUUID" and event["RequestType"] == "Create":
        random_id = str(uuid.uuid4())
        helper.Data.update({"UUID": random_id})
        logger.info(f"[solution_helper] create uuid: {random_id}")


def handler(event, context):
    logger.info(f"[handler] event: {event}")
    try:
        helper(event, context)
    except Exception as error:
        logger.exception("[handler] failed: {error}")
