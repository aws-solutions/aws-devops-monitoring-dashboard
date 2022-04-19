#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import pytest

import boto3
from botocore.stub import Stubber, ANY
from moto import mock_sts

from util.quicksight import QuicksightApi
from util.quicksight_application import QuicksightApplication
from util.dataset import DataSet

# import other fixutres
from test.fixtures.quicksight_test_fixture import get_quicksight_api_stubber
from test.fixtures.quicksight_test_fixture import TestHelper

logger = logging.getLogger(__name__)

# globals
stubber_quicksight = None
FAKE_ACCOUNT_ID = 'FAKE_ACCOUNT'
prefix = 'DHTUT'
MOCK_VALUE = "GENERIC_MOCK_VALUE"  # 18 characters, replaced in mock steps

@pytest.fixture(params=TestHelper.get_supported_data_set_sub_types())
def data_set_type(request):
    param = request.param
    yield param

@pytest.fixture
def quicksight_create_and_delete_dashboard_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DashboardStubber.add_create_response(stubber_quicksight, sub_type)
    DashboardStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_create_dashboard_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DashboardStubber.add_create_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_delete_dashboard_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DashboardStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

class DashboardStubber():

    @staticmethod
    def stub_create_dashboard_call(sub_type):
        stubber = get_quicksight_api_stubber()
        DashboardStubber.add_create_response(stubber, sub_type)
        stubber.activate()
        return stubber

    @staticmethod
    def stub_delete_dashboard_call(sub_type):
        logger.info(f"Using stub_delete_data for {sub_type}")
        stubber = get_quicksight_api_stubber()
        DashboardStubber.add_delete_response(stubber, sub_type)
        stubber.activate()
        return stubber

    @staticmethod
    def add_create_response(stubber, name):
        operation = 'create_dashboard'
        minimal_mock_reponse = {
            "ResponseMetadata": {
                "RequestId": "c723a6b6-64dc-49ad-a7f5-39e2723305e1",
                "HTTPStatusCode": 202,
                "HTTPHeaders": {
                    "date": "Sun, 04 Oct 2020 02:29:11 GMT",
                    "content-type": "application/json",
                    "content-length": "228",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "c723a6b6-64dc-49ad-a7f5-39e2723305e1"
                },
                "RetryAttempts": 0
            },
            "Status": 202,
            "Arn": f"{MOCK_VALUE}",
            "DashboardId": f"{MOCK_VALUE}",
            "CreationStatus": "CREATION_IN_PROGRESS",
            "RequestId": "c723a6b6-64dc-49ad-a7f5-39e2723305e1"
        }
        minimal_mock_reponse.update({"Arn": "arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_reponse.update({"DashboardId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'DashboardId': ANY,
            'Name': ANY,
            'Permissions': ANY,
            'SourceEntity': ANY,
            'DashboardPublishOptions': ANY
        }
        stubber.add_response(operation, minimal_mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_delete_response(stubber, name):
        operation = 'delete_dashboard'
        mock_reponse = {
            "ResponseMetadata": {
                "RequestId": "05021dd3-cb91-4390-b6d4-a72200417c9c",
                "HTTPStatusCode": 200,
                "HTTPHeaders": {
                    "date": "Sun, 04 Oct 2020 02:43:51 GMT",
                    "content-type": "application/json",
                    "content-length": "217",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "05021dd3-cb91-4390-b6d4-a72200417c9c"
                },
                "RetryAttempts": 0
            },
            "Status": 200,
            "Arn": f"{MOCK_VALUE}",
            "DashboardId": f"{MOCK_VALUE}",
            "RequestId": "05021dd3-cb91-4390-b6d4-a72200417c9c"
        }

        mock_reponse.update({"Arn": "arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        mock_reponse.update({"DashboardId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'DashboardId': ANY
        }
        stubber.add_response(operation, mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")
