#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

# import other fixtures
from test.fixtures.quicksight_test_fixture import TestHelper, get_quicksight_api_stubber

import boto3
import pytest
from botocore.stub import ANY, Stubber
from moto import mock_sts
from util.quicksight import QuicksightApi
from util.quicksight_application import QuicksightApplication

logger = logging.getLogger(__name__)

# globals
stubber_quicksight = None
FAKE_ACCOUNT_ID = "FAKE_ACCOUNT"
MOCK_VALUE = "GENERIC_MOCK_VALUE"  # 18 characters, replaced in mock steps
MOCK_DATE = "Wed, 30 Sep 2020 02:28:21 GMT"


@pytest.fixture()
def minimal_data_sets_stub(request):
    class GenericTestStub:
        pass

    # stubs
    quicksight_application_stub = GenericTestStub()
    quicksight_application_stub.prefix = "SOLUTION_UT"
    quicksight_application_stub.quicksight_principal_arn = "arn:MOCK_ARN"

    # stub datasets
    data_sets_stub = dict()
    for data_set_type in TestHelper.get_supported_data_set_sub_types():
        data_set = GenericTestStub()
        data_set.arn = f"Stub_{data_set_type}-arn"
        data_set.name = f"Stub_{data_set_type}-name"
        data_sets_stub[data_set_type] = data_set

    quicksight_application_stub.data_sets = data_sets_stub

    class MinimalDataSetsStub:
        def __init__(self, quicksight_application_stub, data_sets_stub):
            self.quicksight_application_stub = quicksight_application_stub
            self.data_sets_stub = data_sets_stub

    stub = MinimalDataSetsStub(quicksight_application_stub, data_sets_stub)
    return stub


@pytest.fixture(params=TestHelper.get_supported_data_set_sub_types())
def data_set_type(request):
    param = request.param
    yield param


@pytest.fixture
def quicksight_data_set_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    DataSetStubber.add_create_data_sets_responses(stubber_quicksight)
    DataSetStubber.add_delete_data_sets_responses(stubber_quicksight)
    stubber_quicksight.activate()


@pytest.fixture
def quicksight_create_data_set_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    DataSetStubber.add_create_data_sets_responses(stubber_quicksight)
    stubber_quicksight.activate()


@pytest.fixture
def quicksight_delete_data_set_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    DataSetStubber.add_delete_data_sets_responses(stubber_quicksight)
    stubber_quicksight.activate()


class DataSetStubber:
    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_set(stubber, data_set_type):
        DataSetStubber.add_create_data_set_response(stubber, data_set_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_describe_data_set_call(stubber, sub_type):
        DataSetStubber.add_describe_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_delete_data_set(stubber, data_set_type):
        DataSetStubber.add_delete_data_set_response(stubber, data_set_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_set_error_call(stubber, sub_type):
        DataSetStubber.add_create_client_error(stubber, sub_type, service_error_code="ResourceExistsException")

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_source_error_invalid_parameter_call(stubber, sub_type):
        DataSetStubber.add_create_client_error(stubber, sub_type, service_error_code="InvalidParameterValueException")

    @staticmethod
    def add_create_data_set_response(stubber, name):
        operation = "create_data_set"
        resource_type = "dataset"
        minimal_mock_response = {
            "ResponseMetadata": {
                "RequestId": "04ebc665-35ce-4dab-b678-24a0eb782d86",
                "HTTPStatusCode": 201,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 19:32:29 GMT",
                    "content-type": "application/json",
                    "content-length": "223",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "04ebc665-35ce-4dab-b678-24a0eb782d86",
                },
                "RetryAttempts": 0,
            },
            "Status": 201,
            "Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}",
            "DataSetId": f"{name}",
            "RequestId": "04ebc665-35ce-4dab-b678-24a0eb782d86",
        }
        api_params = {
            "AwsAccountId": ANY,
            "DataSetId": ANY,
            "Name": ANY,
            "ImportMode": ANY,
            "LogicalTableMap": ANY,
            "PhysicalTableMap": ANY,
            "Permissions": ANY,
        }
        stubber.add_response(operation, minimal_mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_delete_data_set_response(stubber, name):
        operation = "delete_data_set"
        resource_type = "dataset"

        minimal_mock_response = {
            "ResponseMetadata": {
                "RequestId": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa",
                "HTTPStatusCode": 200,
                "HTTPHeaders": {
                    "date": "Wed, 30 Sep 2020 02:42:45 GMT",
                    "content-type": "application/json",
                    "content-length": "160",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa",
                },
                "RetryAttempts": 0,
            },
            "Status": 200,
            "Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}",
            "DataSetId": f"name",
            "RequestId": "7123a45b-0b1f-40e5-832a-dd3b0157cbfa",
        }
        api_params = {"AwsAccountId": ANY, "DataSetId": ANY}
        stubber.add_response(operation, minimal_mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_describe_response(stubber, name):
        operation = "describe_data_set"
        resource_type = "dataset"
        # The describe_data_set response does not provide a status at the DataSet level, such
        # as "Status": "CREATION_SUCCESSFUL"
        mock_response = {
            "ResponseMetadata": {
                "RequestId": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff",
                "HTTPStatusCode": 200,
                "HTTPHeaders": {
                    "date": MOCK_DATE,
                    "content-type": "application/json",
                    "content-length": "1029",
                    "connection": "keep-alive",
                    "x-amzn-requestid": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff",
                },
                "RetryAttempts": 0,
            },
            "Status": 200,
            "DataSet": {
                "Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}",
                "DataSetId": f"{MOCK_VALUE}",
                "Name": f"{name}",
                "CreatedTime": f"{MOCK_DATE}",
                "LastUpdatedTime": f"{MOCK_DATE}",
            },
            "RequestId": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff",
        }

        api_params = {"AwsAccountId": ANY, "DataSetId": ANY}
        stubber.add_response(operation, mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_create_client_error(stubber, name, service_error_code):
        """service_error_code should be either ResourceExistsException or InvalidParameterValueException"""
        operation = "create_data_set"
        resource_type = "dataset"
        operation_name = "CreateDataSet"

        service_message = {
            "ResourceExistsException": f"An error occurred ({service_error_code}) when calling the {operation_name} operation: DataSet {resource_type}/{name} already exists",
            "InvalidParameterValueException": f"An error occurred ({service_error_code}) when calling the {operation_name} operation: DataSet {resource_type}/{name} validation error",
        }

        api_params = {
            "AwsAccountId": ANY,
            "DataSetId": ANY,
            "Name": ANY,
            "ImportMode": ANY,
            "LogicalTableMap": ANY,
            "PhysicalTableMap": ANY,
            "Permissions": ANY,
        }
        stubber.add_client_error(
            operation,
            service_error_code,
            service_message.get(
                service_error_code,
                f"An error occurred ({service_error_code}) when calling the {operation_name} operation: DataSet {resource_type}/{name} general error",
            ),
            404,
            expected_params=api_params,
        )

    @staticmethod
    def add_create_data_sets_responses(stubber):
        for data_set_type in TestHelper.get_supported_data_set_sub_types():
            DataSetStubber.add_create_data_set_response(stubber, data_set_type)

    @staticmethod
    def add_delete_data_sets_responses(stubber):
        for data_set_type in TestHelper.get_supported_data_set_sub_types():
            DataSetStubber.add_delete_data_set_response(stubber, data_set_type)
