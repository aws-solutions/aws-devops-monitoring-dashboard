#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

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
    minimal_data_sets_stub,
    quicksight_create_data_set_stubber,
    quicksight_data_set_stubber,
    quicksight_delete_data_set_stubber
)
from test.fixtures.quicksight_template_fixtures import template_arn
from test.fixtures.quicksight_datasource_fixtures import minimal_data_source_stub
from test.fixtures.quicksight_test_fixture import quicksight_application_stub
from test.logger_test_helper import dump_state

logger = logging.getLogger(__name__)


@ mock_sts
def test_dashboard_init(quicksight_application_stub, minimal_data_sets_stub):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )
    dump_state(obj, 'Dump dashboard')

@ mock_sts
def test_dashboard_update_source_entity(quicksight_application_stub, minimal_data_sets_stub, template_arn):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
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
    minimal_data_source_stub,
    minimal_data_sets_stub,
    template_arn,
):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_source=minimal_data_source_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'

    dump_state(obj, 'Before create')
    DashboardStubber.stub_create_dashboard_call(sub_type)
    obj.create()
    dump_state(obj, 'After create')

@ mock_sts
def test_dashboard_delete(quicksight_application_stub, minimal_data_sets_stub, template_arn):
    obj = Dashboard(
        quicksight_application=quicksight_application_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'

    dump_state(obj, 'Before delete')
    DashboardStubber.stub_delete_dashboard_call(sub_type)
    obj.delete()
    dump_state(obj, 'After delete')
