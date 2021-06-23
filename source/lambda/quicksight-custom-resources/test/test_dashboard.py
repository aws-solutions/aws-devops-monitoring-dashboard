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

from util.quicksight_application import QuicksightApplication
from util.dataset import DataSet
from util.dashboard import Dashboard

from test.fixtures.quicksight_dashboard_fixtures import DashboardStubber
from test.fixtures.quicksight_dataset_fixtures import (
    data_set_type,
    mininmal_data_sets_stub,
    quicksight_create_data_set_stubber,
    quicksight_data_set_stubber,
    quicksight_delete_data_set_stubber
)
from test.fixtures.quicksight_template_fixtures import template_arn
from test.fixtures.quicksight_datasource_fixtures import mininmal_data_source_stub
from test.fixtures.quicksight_test_fixture import quicksight_application_stub
from test.logger_test_helper import dump_state

logger = logging.getLogger(__name__)


@ mock_sts
def test_dashboard_init(quicksight_application_stub, mininmal_data_sets_stub):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )
    dump_state(obj, 'Dump dashboard')

@ mock_sts
def test_dashboard_update_source_entity(quicksight_application_stub, mininmal_data_sets_stub, template_arn):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'
    assert sub_type in obj.config_data
    assert 'SourceEntity' in obj.config_data[sub_type]

    source_entity = obj.source_entity._get_map(sub_type, "SourceEntity")
    dump_state(source_entity, 'Dump SourceEntity before update')

    assert 'SourceTemplate' in source_entity
    source_template = source_entity.get('SourceTemplate', None)
    assert 'DataSetReferences' in source_template
    assert 'Arn' in source_template
    obj.source_entity._update_source_entity(source_entity)

    dump_state(source_entity, 'Dump SourceEntity after update')

    assert template_arn == source_template['Arn']

@ mock_sts
def test_dashboard_create(
    quicksight_application_stub,
    mininmal_data_source_stub,
    mininmal_data_sets_stub,
    template_arn,
):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_source=mininmal_data_source_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'

    dump_state(obj, 'Before create')
    DashboardStubber.stub_create_dashboard_call(sub_type)
    obj.create()
    dump_state(obj, 'After create')

@ mock_sts
def test_dashboard_delete(quicksight_application_stub, mininmal_data_sets_stub, template_arn):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'

    dump_state(obj, 'Before delete')
    DashboardStubber.stub_delete_dashboard_call(sub_type)
    obj.delete()
    dump_state(obj, 'After delete')
