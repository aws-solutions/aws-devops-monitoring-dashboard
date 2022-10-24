# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

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
        logger.exception(f"[handler] failed: {error}")
