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

import logging
import test.logger_test_helper
from test.fixtures.quicksight_dataset_fixtures import (
    DataSetStubber,
    data_set_type,
    quicksight_create_data_set_stubber,
    quicksight_data_set_stubber,
    quicksight_delete_data_set_stubber,
)
from test.fixtures.quicksight_datasource_fixtures import mininmal_data_source_stub
from test.fixtures.quicksight_test_fixture import quicksight_application_stub
from test.logger_test_helper import dump_state

import pytest
import tenacity
from moto import mock_sts
from util.dataset import DataSet
from util.datasource import DataSource
from util.quicksight_resource import ResourceSubTypeError

logger = logging.getLogger(__name__)


@mock_sts
def test_data_set_init_all_data_set_types(data_set_type, quicksight_application_stub):
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)
    data_set = DataSet(
        data_source=data_source,
        data_set_sub_type=data_set_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )
    dump_state(data_set, "After initialization")


@mock_sts
def test_data_set_create_all_data_set_types(data_set_type, quicksight_application_stub):
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)

    # stub
    data_source.arn = "STUBBED_DATA_SOURCE_ARN"
    quicksight_application_stub.data_source = data_source

    data_set = DataSet(
        data_source=data_source,
        data_set_sub_type=data_set_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )

    dump_state(data_set, "Before create")
    DataSetStubber.stub_create_data_set(data_set_type)
    data_set.create()
    dump_state(data_set, "After create")


@mock_sts
def test_data_set_delete_all_data_set_types(data_set_type, quicksight_application_stub):
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)

    # stub
    data_source.arn = "STUBBED_DATA_SOURCE_ARN"
    quicksight_application_stub.data_source = data_source

    logger.info(f"Initializing dataset object for type: {data_set_type}")
    data_set = DataSet(
        data_source=data_source,
        data_set_sub_type=data_set_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )
    logger.debug(f"After initializing dataset object for type: {data_set_type}")

    dump_state(data_set, "Before delete")
    DataSetStubber.stub_delete_data_set(data_set_type)
    data_set.delete()
    dump_state(data_set, "After delete")


@mock_sts
def test_data_set_missing_data_source(quicksight_application_stub):
    missing_data_source = None
    data_set = DataSet(
        data_source=missing_data_source,
        data_set_sub_type=data_set_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )
    with pytest.raises(ValueError):
        data_set.create()


@mock_sts
def test_data_set_invalid_sub_type(quicksight_application_stub):
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)
    invalid_sub_type = "TEST_INVALID_SUB_TYPE"
    data_set = DataSet(
        data_source=data_source,
        data_set_sub_type=invalid_sub_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )
    with pytest.raises(Exception):
        data_set.create()


@mock_sts
def test_data_set_get_data(quicksight_application_stub, data_set_type):
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)
    data_set = DataSet(
        data_source=data_source,
        data_set_sub_type=data_set_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )
    expected_name = f"ADMD_Unit_Test-dataset-{data_set_type}"
    assert data_set.get_data() == {
        "id": f"{expected_name}",
        "name": expected_name,
        "arn": f"arn:aws:quicksight:us-east-1:MOCK_ACCOUNT:dataset/{expected_name}",
    }


@mock_sts
def test_data_set_create_exist(data_set_type, quicksight_application_stub):
    # stub
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)
    data_source.arn = "STUBBED_DATA_SOURCE_ARN"
    quicksight_application_stub.data_source = data_source
    sub_type = data_set_type

    obj = DataSet(
        data_source=data_source,
        data_set_sub_type=sub_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )

    DataSetStubber.stub_create_data_set_error_call(sub_type)
    DataSetStubber.stub_describe_data_set_call(sub_type)

    # Function under test
    response = obj.create()

    # This response is the response to describe_data_source as the code is remaps the response
    assert response
    # The describe_data_set reponse does not provide a status at the DataSet level, such
    # as "Status": "CREATION_SUCCESSFUL"
    # Therefore, we verify CreatedTime not being None
    assert response["CreatedTime"]
    assert obj.arn


@mock_sts
def test_data_set_create_invalid_parameter(data_set_type, quicksight_application_stub):
    # stub
    data_source = DataSource(quicksight_application=quicksight_application_stub, props=None)
    data_source.arn = "STUBBED_DATA_SOURCE_ARN"
    quicksight_application_stub.data_source = data_source
    sub_type = data_set_type

    obj = DataSet(
        data_source=data_source,
        data_set_sub_type=sub_type,
        props=None,
        quicksight_application=quicksight_application_stub,
    )

    [DataSetStubber.stub_create_data_source_error_invalid_parameter_call(sub_type) for _ in range(3)]

    response = None
    with pytest.raises(tenacity.RetryError):
        # Function under test
        response = obj.create()

    assert not response
