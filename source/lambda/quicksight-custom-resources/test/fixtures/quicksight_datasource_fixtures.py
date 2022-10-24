#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import pytest

import boto3
from botocore.stub import Stubber, ANY
from moto import mock_sts

from util.quicksight_application import QuicksightApplication
from util.datasource import DataSource

# import other fixtures
from test.fixtures.quicksight_test_fixture import get_quicksight_api_stubber, TestHelper

logger = logging.getLogger(__name__)

# globals
stubber_quicksight = None
FAKE_ACCOUNT_ID = 'FAKE_ACCOUNT'
prefix = 'DHTUT'
MOCK_VALUE = "GENERIC_MOCK_VALUE"  # 18 characters, replaced in mock steps
MOCK_DATE = "Wed, 30 Sep 2020 02:28:21 GMT"


@pytest.fixture()
@mock_sts
def minimal_data_source_stub(request):
    class GenericTestStub:
        pass

    # stubs
    quicksight_application_stub = GenericTestStub()
    quicksight_application_stub.prefix = "SOLUTION_UT"
    quicksight_application_stub.quicksight_principal_arn = "arn:MOCK_ARN"

    # We use the real object here but with a stubbed quicksight_application
    data_source_stub = DataSource(quicksight_application=quicksight_application_stub, props=None)

    quicksight_application_stub.data_source = data_source_stub

    return data_source_stub


@pytest.fixture
def quicksight_create_and_delete_data_source_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DataSourceStubber.add_create_response(stubber_quicksight, sub_type)
    DataSourceStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_create_data_source_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DataSourceStubber.add_create_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_delete_data_source_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    DataSourceStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

class DataSourceStubber():

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_source_call(stubber, sub_type):
        DataSourceStubber.add_create_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_update_data_source_call(stubber, sub_type):
        DataSourceStubber.update_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_delete_data_source_call(stubber, sub_type):
        DataSourceStubber.add_delete_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_source_error_call(stubber, sub_type):
        DataSourceStubber.add_create_client_error(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_describe_data_source_call(stubber, sub_type):
        DataSourceStubber.add_describe_response(stubber, sub_type)

    @staticmethod
    def add_create_response(stubber, name):
        operation = 'create_data_source'
        resource_type = 'datasource'
        minimal_mock_response = {
            "ResponseMetadata": {
                "RequestId": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5",
                "HTTPStatusCode": 202,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 02:28:21 GMT",
                    "content-type": "application/json",
                    "content-length": "200",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5"
                },
                "RetryAttempts": 0
            },
            "Status": 202,
            "Arn": f"{MOCK_VALUE}",
            "DataSourceId": f"{MOCK_VALUE}",
            "CreationStatus": "CREATION_IN_PROGRESS",
            "RequestId": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5"
        }
        minimal_mock_response.update({"Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_response.update({"DataSourceId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'DataSourceId': ANY,
            'Name': ANY,
            'Type': 'ATHENA',
            'DataSourceParameters': ANY,
            'Permissions': ANY,
            'SslProperties': ANY
        }
        stubber.add_response(operation, minimal_mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_delete_response(stubber, name):
        operation = 'delete_data_source'
        resource_type = 'datasource'
        minimal_mock_response = {
            "ResponseMetadata": {
                "RequestId": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa",
                "HTTPStatusCode": 200,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 02:42:45 GMT",
                    "content-type": "application/json",
                    "content-length": "160",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa"
                },
                "RetryAttempts": 0
            },
            "Status": 200,
            "Arn": f"{MOCK_VALUE}",
            "DataSourceId": f"{MOCK_VALUE}",
            "RequestId": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa"
        }
        minimal_mock_response.update({"Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_response.update({"DataSourceId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'DataSourceId': ANY
        }
        stubber.add_response(operation, minimal_mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_create_client_error(stubber, name):
        operation = "create_data_source"
        operation_name = "CreateDataSource"
        resource_type = "datasource"

        api_params = {
            'AwsAccountId': ANY,
            'DataSourceId': ANY,
            'Name': ANY,
            'Type': 'ATHENA',
            'DataSourceParameters': ANY,
            'Permissions': ANY,
            'SslProperties': ANY
        }
        stubber.add_client_error(
            operation,
            "ResourceExistsException",
            f"An error occurred (ResourceExistsException) when calling the {operation_name} operation: DataSource {resource_type}/{name} already exists",
            404,
            expected_params=api_params,
        )

    @staticmethod
    def add_describe_response(stubber, name):
        operation = 'describe_data_source'
        resource_type = 'datasource'
        mock_response = {
            "ResponseMetadata": {
                "RequestId": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff",
                "HTTPStatusCode": 200,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 02:28:21 GMT",
                    "content-type": "application/json",
                    "content-length": "1029",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff"
                },
                "RetryAttempts": 0
            },
            "Status": 200,
            "DataSource": {
                "Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}",
                "DataSourceId": f"{MOCK_VALUE}",
                "Name": f"{name}",
                "Type": "ATHENA",
                "Status": "CREATION_SUCCESSFUL",
                "CreatedTime": f"{MOCK_DATE}",
                "LastUpdatedTime": f"{MOCK_DATE}",
                "DataSourceParameters": {
                    "AthenaParameters": {
                        "WorkGroup": "primary"
                    }
                },
                "SslProperties": {
                    "DisableSsl": False
                }
            },
            "RequestId": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff"
        }

        api_params = {
            "AwsAccountId": ANY,
            "DataSourceId": ANY
        }
        stubber.add_response(operation, mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def update_response(stubber, name):
        operation = "update_data_source"
        resource_type = "datasource"
        minimal_mock_response = {
            "ResponseMetadata": {
                "RequestId": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5",
                "HTTPStatusCode": 202,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 02:28:21 GMT",
                    "content-type": "application/json",
                    "content-length": "200",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5",
                },
                "RetryAttempts": 0,
            },
            "Status": 202,
            "Arn": f"{MOCK_VALUE}",
            "DataSourceId": f"{MOCK_VALUE}",
            "UpdateStatus": "UPDATE_IN_PROGRESS",
            "RequestId": "6c97c6d8-bdac-43b5-bf0a-a1bee3dbacb5",
        }
        minimal_mock_response.update({"Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_response.update({"DataSourceId": f"{name}"})

        # We are not using these parameters in the update
        #    "Type": "ATHENA",
        #    "Permissions": ANY,

        api_params = {
            "AwsAccountId": ANY,
            "DataSourceId": ANY,
            "Name": ANY,
            "DataSourceParameters": ANY,
            "SslProperties": ANY,
        }
        stubber.add_response(operation, minimal_mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")
