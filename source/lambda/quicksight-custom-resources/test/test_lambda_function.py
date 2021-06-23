#!/usr/bin/env python
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

import test.logger_test_helper
import logging
import pytest
from moto import mock_sts

from test.fixtures.quicksight_analysis_fixtures import (
    quicksight_create_analysis_stubber,
    quicksight_delete_analysis_stubber
)
from test.fixtures.quicksight_dashboard_fixtures import (
    quicksight_create_dashboard_stubber,
    quicksight_delete_dashboard_stubber
)
from test.fixtures.quicksight_dataset_fixtures import (
    DataSetStubber, data_set_type,
    quicksight_create_data_set_stubber,
    quicksight_data_set_stubber,
    quicksight_delete_data_set_stubber
)
from test.fixtures.quicksight_datasource_fixtures import (
    quicksight_create_and_delete_data_source_stubber,
    quicksight_create_data_source_stubber,
    quicksight_delete_data_source_stubber
)
from test.fixtures.quicksight_test_fixture import (
    quicksight_state_all,
    quicksight_lambda_resource_properties,
)


logger = logging.getLogger(__name__)

# globals
FAKE_ACCOUNT_ID = 'FAKE_ACCOUNT'

def generate_event(request_type, resource):
    assert request_type in ['Create', 'Update', 'Delete']
    event = {
        'RequestType': f'{request_type}',
        'ResourceType': 'Custom::QuickSightResources',
        'ResourceProperties': {
            'ServiceToken': f'arn:aws:lambda:us-east-1:{FAKE_ACCOUNT_ID}:function:quicksight-lib-5-QuicksightCustomResource0CF2518D-C3vtxT0YP9uz',
            'ApplicationName': 'DHTUT',
            'StackName': 'DHTUT',
            'Resource': f'{resource}',
            'LogLevel': 'INFO'
        }
    }
    return event

@ mock_sts
def test_data_source_create_and_delete(
    quicksight_lambda_resource_properties,
    quicksight_create_and_delete_data_source_stubber,
):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    # create datasource
    event = generate_event('Create', 'datasource')
    custom_resource_create(event, None)

    # delete datasource
    event = generate_event('Delete', 'datasource')
    custom_resource_delete(event, None)

@ mock_sts
def test_data_set_create_and_delete(quicksight_create_data_set_stubber, quicksight_delete_data_set_stubber):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    # create dataset
    event = generate_event('Create', 'dataset')
    custom_resource_create(event, None)

    # delete dataset
    event = generate_event('Delete', 'dataset')
    custom_resource_delete(event, None)

@ mock_sts
def test_analysis_create_and_delete(
    quicksight_state_all,
    quicksight_create_analysis_stubber,
    quicksight_delete_analysis_stubber
):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    event = generate_event('Create', 'analysis')
    custom_resource_create(event, None)

    event = generate_event('Delete', 'analysis')
    custom_resource_delete(event, None)


@ mock_sts
def test_dashboard_create_and_delete(
    quicksight_state_all,
    quicksight_create_dashboard_stubber,
    quicksight_delete_dashboard_stubber
):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    event = generate_event('Create', 'dashboard')
    custom_resource_create(event, None)

    event = generate_event('Delete', 'dashboard')
    custom_resource_delete(event, None)

@ mock_sts
def test_all_create(
    quicksight_create_data_source_stubber,
    quicksight_create_data_set_stubber,
    quicksight_create_analysis_stubber,
    quicksight_create_dashboard_stubber
):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    event = generate_event('Create', 'all')
    custom_resource_create(event, None)

@ mock_sts
def test_all_delete(quicksight_delete_dashboard_stubber,
                    quicksight_delete_analysis_stubber,
                    quicksight_delete_data_set_stubber,
                    quicksight_delete_data_source_stubber):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    event = generate_event('Delete', 'all')
    custom_resource_delete(event, None)

@ mock_sts
def test_all_create_and_delete(
    quicksight_create_data_source_stubber,  # NOSONAR:S107 this test function is designed to take many fixtures and is a larger test
    quicksight_create_data_set_stubber,
    quicksight_create_analysis_stubber,
    quicksight_create_dashboard_stubber,
    quicksight_delete_dashboard_stubber,
    quicksight_delete_analysis_stubber,
    quicksight_delete_data_set_stubber,
    quicksight_delete_data_source_stubber
):
    # call lambda function under test
    from lambda_function import custom_resource_create, custom_resource_delete

    event = generate_event('Create', 'all')
    custom_resource_create(event, None)

    event = generate_event('Delete', 'all')
    custom_resource_delete(event, None)


class StubLambdaCloudFormationCall():
    def __init__(self, request_type):
        from lambda_function import custom_resource_create, custom_resource_update, custom_resource_delete
        function_mapping = {
            'Create': custom_resource_create,
            'Update': custom_resource_update,
            'Delete': custom_resource_delete
        }
        self.func = function_mapping.get(request_type)
        self.request_type = request_type

@ pytest.fixture(params=[StubLambdaCloudFormationCall('Create'), StubLambdaCloudFormationCall('Update'), StubLambdaCloudFormationCall('Delete')])
def lambda_cloudformation_call(request):
    lambda_call = request.param
    return lambda_call

@ mock_sts
def test_invalid_request(lambda_cloudformation_call):
    request_type = lambda_cloudformation_call.request_type
    lambda_func = lambda_cloudformation_call.func
    event = generate_event(request_type, 'TEST_INVALID_REQUEST')
    with pytest.raises(ValueError):
        lambda_func(event, None)
