#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

import tenacity
import pytest
from moto import mock_sts
from util.quicksight_application import QuicksightApplication
from util.dataset import DataSet
from util.analysis import Analysis

from test.fixtures.quicksight_analysis_fixtures import AnalysisStubber
from test.fixtures.quicksight_dataset_fixtures import (
    data_set_type,
    minimal_data_sets_stub,
    quicksight_data_set_stubber,
    quicksight_create_data_set_stubber,
    quicksight_delete_data_set_stubber
)
from test.fixtures.quicksight_template_fixtures import template_arn
from test.fixtures.quicksight_datasource_fixtures import minimal_data_source_stub
from test.fixtures.quicksight_test_fixture import quicksight_application_stub


from test.logger_test_helper import dump_state

logger = logging.getLogger(__name__)

@ mock_sts
def test_analysis_init(quicksight_application_stub, minimal_data_sets_stub):
    stub = minimal_data_sets_stub
    template_arn_param = template_arn

    obj = Analysis(
        quicksight_application=quicksight_application_stub,
        data_sets=stub.data_sets_stub,
        quicksight_template_arn=template_arn_param,
        props=None
    )
    dump_state(obj, 'Dump analysis')

@ mock_sts
def test_analysis_update_source_entity(quicksight_application_stub, minimal_data_sets_stub, template_arn):
    obj = Analysis(
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
def test_analysis_create(
    quicksight_application_stub,
    minimal_data_source_stub,
    minimal_data_sets_stub,
    template_arn,
):
    obj = Analysis(
        quicksight_application=quicksight_application_stub,
        data_source=minimal_data_source_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None,
    )

    sub_type = 'main'

    dump_state(obj, 'Before create')
    AnalysisStubber.stub_create_analysis(sub_type)
    obj.create()
    dump_state(obj, 'After create')

@ mock_sts
def test_analysis_delete(quicksight_application_stub, minimal_data_sets_stub, template_arn):
    obj = Analysis(
        quicksight_application=quicksight_application_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None
    )

    sub_type = 'main'

    dump_state(obj, 'Before create')
    AnalysisStubber.stub_delete_analysis(sub_type)
    obj.delete()
    dump_state(obj, 'After create')


@ mock_sts
def test_analysis_create_exist(
    quicksight_application_stub,
    minimal_data_source_stub,
    minimal_data_sets_stub,
    template_arn,
):
    obj = Analysis(
        quicksight_application=quicksight_application_stub,
        data_source=minimal_data_source_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None,
    )

    sub_type = "main"
    AnalysisStubber.stub_create_data_source_error_call(sub_type)
    AnalysisStubber.stub_describe_data_source_call(sub_type)

    # Function under test
    response = obj.create()

    # This response is the response to describe_data_source as the code is remaps the response
    assert response
    assert response["Status"] in ["CREATION_SUCCESSFUL"]
    assert obj.arn


@ mock_sts
def test_analysis_create_invalid_parameter(
    quicksight_application_stub,
    minimal_data_source_stub,
    minimal_data_sets_stub,
    template_arn,
):
    obj = Analysis(
        quicksight_application=quicksight_application_stub,
        data_source=minimal_data_source_stub,
        data_sets=minimal_data_sets_stub.data_sets_stub,
        quicksight_template_arn=template_arn,
        props=None,
    )

    sub_type = "main"
    [AnalysisStubber.stub_create_data_source_error_invalid_parameter_call(sub_type) for _ in range(3)]

    response = None
    with pytest.raises(tenacity.RetryError):
        # Function under test
        response = obj.create()

    assert not response
