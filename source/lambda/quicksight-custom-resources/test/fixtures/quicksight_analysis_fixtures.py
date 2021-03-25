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
MOCK_DATE = "Wed, 30 Sep 2020 02:28:21 GMT"

@pytest.fixture(params=TestHelper.get_supported_data_set_sub_types())
def data_set_type(request):
    param = request.param
    yield param

@pytest.fixture
def quicksight_create_and_delete_analysis_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    AnalysisStubber.add_create_response(stubber_quicksight, sub_type)
    AnalysisStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_create_analysis_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    AnalysisStubber.add_create_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_delete_analysis_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    AnalysisStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

class AnalysisStubber():

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_analysis(stubber, sub_type):
        AnalysisStubber.add_create_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_delete_analysis(stubber, sub_type):
        AnalysisStubber.add_delete_response(stubber, sub_type)

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_source_error_call(stubber, sub_type):
        AnalysisStubber.add_create_client_error(stubber, sub_type, service_error_code="ResourceExistsException")

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_create_data_source_error_invalid_parameter_call(stubber, sub_type):
        AnalysisStubber.add_create_client_error(stubber, sub_type, service_error_code="InvalidParameterValueException")

    @staticmethod
    @TestHelper.stubber_wrapper
    def stub_describe_data_source_call(stubber, sub_type):
        AnalysisStubber.add_describe_response(stubber, sub_type)

    @staticmethod
    def add_create_response(stubber, name):
        operation = 'create_analysis'
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
            "AnalysisId": f"{MOCK_VALUE}",
            "CreationStatus": "CREATION_IN_PROGRESS",
            "RequestId": "c723a6b6-64dc-49ad-a7f5-39e2723305e1"
        }
        minimal_mock_reponse.update({"Arn": "arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_reponse.update({"AnalysisId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'AnalysisId': ANY,
            'Name': ANY,
            'Permissions': ANY,
            'SourceEntity': ANY
        }
        stubber.add_response(operation, minimal_mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_delete_response(stubber, name):
        operation = 'delete_analysis'
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
            "AnalysisId": f"{MOCK_VALUE}",
            "DeletionTime": "Wed, 30 Sep 2020 02:42:45 GMT",
            "RequestId": "05021dd3-cb91-4390-b6d4-a72200417c9c"
        }

        mock_reponse.update({"Arn": "arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        mock_reponse.update({"AnalysisId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'AnalysisId': ANY
        }
        stubber.add_response(operation, mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_create_client_error(stubber, name, service_error_code):
        """service_error_code should be either ResourceExistsException or InvalidParameterValueException"""
        operation = "create_analysis"
        operation_name = "CreateAnalysis"
        resource_type = "analysis"

        service_message = {
            "ResourceExistsException": f"An error occurred ({service_error_code}) when calling the {operation_name} operation: Analysis {resource_type}/{name} already exists",
            "InvalidParameterValueException": f"An error occurred ({service_error_code}) when calling the {operation_name} operation: Analysis {resource_type}/{name} validtion error",
        }

        api_params = {
            "AwsAccountId": ANY,
            "AnalysisId": ANY,
            "Name": ANY,
            "Permissions": ANY,
            "SourceEntity": ANY
        }
        stubber.add_client_error(
            operation,
            service_error_code,
            service_message.get(
                service_error_code,
                f"An error occurred ({service_error_code}) when calling the {operation_name} operation: Analysis {resource_type}/{name} general error"
            ),
            404,
            expected_params=api_params,
        )

    @staticmethod
    def add_describe_response(stubber, name):
        operation = 'describe_analysis'
        resource_type = 'analysis'
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
            "Analysis": {
                "Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}",
                "AnalysisId": f"{MOCK_VALUE}",
                "Name": f"{name}",
                "Status": "CREATION_SUCCESSFUL",
                "CreatedTime": f"{MOCK_DATE}",
                "LastUpdatedTime": f"{MOCK_DATE}",
            },
            "RequestId": "44f5bd3b-bca0-4ecf-b4b6-c39d834ecbff"
        }

        api_params = {
            "AwsAccountId": ANY,
            "AnalysisId": ANY
        }
        stubber.add_response(operation, mock_response, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")
