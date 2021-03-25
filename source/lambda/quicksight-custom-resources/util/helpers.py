# #####################################################################################################################
#  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                            #
#                                                                                                                     #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance     #
#  with the License. A copy of the License is located at                                                              #
#                                                                                                                     #
#  http://www.apache.org/licenses/LICENSE-2.0                                                                         #
#                                                                                                                     #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES  #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions     #
#  and limitations under the License.                                                                                 #
# #####################################################################################################################

import json
from os import environ

import boto3
import botocore.config

from util.logging import get_logger

logger = get_logger(__name__)

# Glogbal boto3 clients to help with initializa_hion and performance
_helpers_service_clients = dict()


class EnvironmentVariableError(Exception):
    pass


def get_service_client(service_name, arguments):
    """Get the global service boto3 client"""
    global _helpers_service_clients
    if service_name not in _helpers_service_clients:
        config = botocore.config.Config(retries=dict(max_attempts=3))
        logger.debug(f"Initializing global boto3 client for {service_name}")
        _helpers_service_clients[service_name] = boto3.client(service_name, config=config, region_name=get_aws_region())
    return _helpers_service_clients[service_name]


def get_quicksight_client(**kwargs):
    """Get the global quicksight boto3 client"""
    return get_service_client("quicksight", kwargs)


def get_sts_client(**kwargs):
    """Get the global sts boto3 client"""
    return get_service_client("sts", kwargs)


def get_aws_partition():
    """
    Get the caller's AWS partion by driving it from AWS region
    :return: partition name for the current AWS region (e.g. aws)
    """
    region_name = environ.get("AWS_REGION")
    china_region_name_prefix = "cn"
    us_gov_cloud_region_name_prefix = "us-gov"
    aws_regions_partition = "aws"
    aws_china_regions_partition = "aws-cn"
    aws_us_gov_cloud_regions_partition = "aws-us-gov"

    # China regions
    if region_name.startswith(china_region_name_prefix):
        return aws_china_regions_partition
    # AWS GovCloud(US) Regions
    elif region_name.startswith(us_gov_cloud_region_name_prefix):
        return aws_us_gov_cloud_regions_partition
    else:
        return aws_regions_partition


def get_aws_region():
    """
    Get the caller's AWS region from the environment variable AWS_REGION
    :return: the AWS region name (e.g. us-east-1)
    """
    region = environ.get("AWS_REGION")
    if not region:
        raise EnvironmentVariableError("Missing AWS_REGION environment variable.")

    return region


def get_aws_account_id():
    """
    Get the caller's AWS account ID
    :return: The AWS account ID
    """
    sts_client = get_sts_client()
    identity = sts_client.get_caller_identity()
    return identity.get("Account")
