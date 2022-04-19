# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os

import pytest
from botocore.exceptions import ParamValidationError
from moto import mock_sts

from util.helpers import (
    get_aws_partition,
    get_aws_region,
    get_aws_account_id,
    get_sts_client,
    get_quicksight_client,
    EnvironmentVariableError,
)

@mock_sts
def test_with_aws_account_id():
    assert get_aws_account_id() == "MOCK_ACCOUNT"

@mock_sts
def test_get_sts_client():
    client = get_sts_client()
    assert "https://sts." in client.meta.endpoint_url

# @mock_sts
def test_get_quicksight_client():
    client = get_quicksight_client()
    assert "https://quicksight." in client.meta.endpoint_url

def test_region_missing():
    region = os.environ.pop("AWS_REGION")
    with pytest.raises(EnvironmentVariableError):
        get_aws_region()
    os.environ["AWS_REGION"] = region

def test_aws_partition():
    region = os.environ.pop("AWS_REGION")
    with pytest.raises(EnvironmentVariableError):
        get_aws_region()
    os.environ["AWS_REGION"] = region

def test_cn_partition(monkeypatch):
    """Set the SECRET env var to assert the behavior."""
    monkeypatch.setenv('AWS_REGION', 'cn-north-1')
    assert get_aws_region() == 'cn-north-1'
    assert get_aws_partition() == 'aws-cn'

def test_us_gov_cloud_partition(monkeypatch):
    """Set the SECRET env var to assert the behavior."""
    monkeypatch.setenv('AWS_REGION', 'us-gov-east-1')
    assert get_aws_region() == 'us-gov-east-1'
    assert get_aws_partition() == 'aws-us-gov'

def test_get_region_us_west_2(monkeypatch):
    """Set the SECRET env var to assert the behavior."""
    monkeypatch.setenv('AWS_REGION', 'us-west-2')
    assert get_aws_region() == 'us-west-2'
    assert get_aws_partition() == 'aws'

def test_get_aws_region(monkeypatch):
    """Set the SECRET env var to assert the behavior."""
    monkeypatch.setenv("SECRET", "top_secret")
    # See mocked aws_environment_variables in conftest.py
    assert get_aws_region() == "us-east-1"
