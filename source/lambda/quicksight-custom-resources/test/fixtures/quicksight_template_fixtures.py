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

# import other fixutres
from test.fixtures.quicksight_test_fixture import get_quicksight_api_stubber
from test.fixtures.quicksight_test_fixture import TestHelper

logger = logging.getLogger(__name__)

# globals
stubber_quicksight = None
FAKE_ACCOUNT_ID = 'FAKE_ACCOUNT'
FAKE_ACCOUNT_ID_SRC = 'FAKE_ACCOUNT_SRC'
MOCK_VALUE = "GENERIC_MOCK_VALUE"  # 18 characters, replaced in mock steps
SOLUTION_NAME = "MySolution"

@pytest.fixture(params=[SOLUTION_NAME])
def template_arn(request):
    template_name = request.param
    return f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:template/{template_name}"

@pytest.fixture(params=[f"solutions-reference_{SOLUTION_NAME}_v1_0_0"])
def source_template_arn(request):
    FAKE_ACCOUNT_ID_SRC = 'FAKE_ACCOUNT_SRC'
    template_name = request.param
    return f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID_SRC}:template/{template_name}"

@pytest.fixture(params=TestHelper.get_supported_data_set_sub_types())
def data_set_type(request):
    param = request.param
    yield param

@pytest.fixture
def quicksight_create_and_delete_template_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    TemplateStubber.add_create_response(stubber_quicksight, sub_type)
    TemplateStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_create_template_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    TemplateStubber.add_create_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_delete_template_stubber():
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    TemplateStubber.add_delete_response(stubber_quicksight, sub_type)
    stubber_quicksight.activate()

@pytest.fixture
def quicksight_create_template_from_analysis_stubber():
    sub_type = 'main'
    TemplateStubber.stub_create_template_call(sub_type)

@pytest.fixture
def quicksight_create_template_from_dashboard_stubber():
    sub_type = 'main'
    TemplateStubber.stub_create_template_call(sub_type)

@pytest.fixture
def quicksight_create_template_from_template_stubber(source_template_arn):
    stubber_quicksight = get_quicksight_api_stubber()
    sub_type = 'main'
    TemplateStubber.add_create_template_from_template_response(stubber_quicksight, sub_type, source_template_arn)
    stubber_quicksight.activate()

class TemplateStubber():

    @staticmethod
    def stub_create_template_call(sub_type):
        stubber = get_quicksight_api_stubber()
        TemplateStubber.add_create_response(stubber, sub_type)
        stubber.activate()
        return stubber

    @staticmethod
    def stub_delete_template_call(sub_type):
        stubber = get_quicksight_api_stubber()
        TemplateStubber.add_delete_response(stubber, sub_type)
        stubber.activate()
        return stubber

    @staticmethod
    def stub_update_template_permissions_call(sub_type):
        stubber = get_quicksight_api_stubber()
        TemplateStubber.add_update_template_permissions_response(stubber, sub_type)
        stubber.activate()
        return stubber

    @staticmethod
    def add_create_response(stubber, sub_type):
        operation = 'create_template'
        resource_type = 'template'
        name = SOLUTION_NAME
        response_meta_data = TemplateStubber.get_response_template('ResponseMetadata')
        response_meta_data.update({"Status": 202})
        minimal_mock_reponse = {
            "ResponseMetadata": response_meta_data,
            "Status": 202,
            "Arn": f"{MOCK_VALUE}",
            "VersionArn": f"{MOCK_VALUE}",
            "TemplateId": f"{MOCK_VALUE}",
            "CreationStatus": "CREATION_IN_PROGRESS",
            "RequestId": "c723a6b6-64dc-49ad-a7f5-39e2723305e1"
        }
        minimal_mock_reponse.update({"Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        minimal_mock_reponse.update({"TemplateId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'TemplateId': ANY,
            'Name': ANY,
            'Permissions': ANY,
            'SourceEntity': ANY,
            'VersionDescription': ANY
        }
        stubber.add_response(operation, minimal_mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_create_template_from_template_response(stubber, sub_type, source_template_arn):
        TemplateStubber.add_create_response(stubber, sub_type)

    @staticmethod
    def add_delete_response(stubber, sub_type):
        operation = 'delete_template'
        resource_type = 'template'
        name = SOLUTION_NAME
        mock_reponse = {
            "ResponseMetadata": TemplateStubber.get_response_template('ResponseMetadata'),
            "Status": 200,
            "Arn": f"{MOCK_VALUE}",
            "TemplateId": f"{MOCK_VALUE}",
            "RequestId": "05021dd3-cb91-4390-b6d4-a72200417c9c"
        }

        mock_reponse.update({"Arn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        mock_reponse.update({"TemplateId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'TemplateId': ANY
        }
        stubber.add_response(operation, mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def add_update_template_permissions_response(stubber, sub_type):
        operation = 'update_template_permissions'
        resource_type = 'template'
        name = SOLUTION_NAME
        mock_reponse = {
            "ResponseMetadata": TemplateStubber.get_response_template('ResponseMetadata'),
            "Status": 200,
            "TemplateArn": f"{MOCK_VALUE}",
            "TemplateId": f"{MOCK_VALUE}",
            "RequestId": "05021dd3-cb91-4390-b6d4-a72200417c9c"
        }

        mock_reponse.update({"TemplateArn": f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID}:{resource_type}/{name}"})
        mock_reponse.update({"TemplateId": f"{name}"})

        api_params = {
            'AwsAccountId': ANY,
            'TemplateId': ANY,
            'GrantPermissions': ANY
        }
        stubber.add_response(operation, mock_reponse, api_params)
        logger.debug(f"Stubber: added response for {operation} for name:{name}")

    @staticmethod
    def get_response_template(key):
        response_template = {
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
            }
        }
        return response_template.get(key)
