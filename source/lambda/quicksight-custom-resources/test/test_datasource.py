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

import test.logger_test_helper
import logging
import pytest
from moto import mock_sts

from util.quicksight_application import QuicksightApplication
from util.dataset import DataSet
from util.datasource import DataSource

from test.fixtures.quicksight_datasource_fixtures import DataSourceStubber
from test.fixtures.quicksight_test_fixture import (
    quicksight_application_stub,
    quicksight_state_all
)

from test.logger_test_helper import dump_state


logger = logging.getLogger(__name__)

class DataSourceHelperStub():
    pass


# globals
FAKE_ACCOUNT_ID = 'FAKE_ACCOUNT'
FAKE_ACCOUNT_ID_SRC = 'FAKE_ACCOUNT_SRC'

class Stub():
    pass

@ mock_sts
def test_data_source_init(quicksight_application_stub):
    obj = DataSource(
        quicksight_application=quicksight_application_stub,
        props=None
    )
    dump_state(obj)

@ mock_sts
def test_data_source_create(quicksight_application_stub):
    obj = DataSource(
        quicksight_application=quicksight_application_stub,
        props=None
    )

    assert obj.athena_workgroup
    assert obj.athena_workgroup == "primary"
    dump_state(obj)

    sub_type = 'main'
    dump_state(obj, 'Before create')
    DataSourceStubber.stub_create_data_source_call(sub_type)
    response = obj.create()
    assert response
    assert response["Status"] in [202]
    assert response["CreationStatus"] in ["CREATION_IN_PROGRESS"]
    assert obj.arn
    dump_state(obj, 'After create')

@ mock_sts
def test_data_source_delete(quicksight_application_stub):
    obj = DataSource(
        quicksight_application=quicksight_application_stub,
        props=None
    )

    dump_state(obj)

    sub_type = 'main'
    dump_state(obj, 'Before delete')
    DataSourceStubber.stub_delete_data_source_call(sub_type)
    obj.delete()
    dump_state(obj, 'After delete')

@ mock_sts
def test_data_source_create_exist(quicksight_application_stub):
    obj = DataSource(
        quicksight_application=quicksight_application_stub,
        props=None
    )

    assert obj.athena_workgroup
    assert obj.athena_workgroup == "primary"

    sub_type = "main"
    DataSourceStubber.stub_create_data_source_error_call(sub_type)
    DataSourceStubber.stub_describe_data_source_call(sub_type)

    # Function under test
    response = obj.create()

    # This response is the response to describe_data_source as the code is remaps the response
    assert response
    assert response["Status"] in ["CREATION_SUCCESSFUL"]
    assert obj.arn
