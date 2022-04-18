#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from test.logger_test_helper import dump_state
import test.logger_test_helper
import logging
import pytest
from moto import mock_sts

from util.quicksight import QuicksightApi
from util.quicksight_application import QuicksightApplication
from util.template import Template, TemplatePermissionType

from test.fixtures.quicksight_test_fixture import TestHelper, quicksight_application_resource_properties
from test.fixtures.quicksight_template_fixtures import (
    TemplateStubber,
    source_template_arn,
    quicksight_create_template_from_template_stubber,
    quicksight_create_template_from_analysis_stubber,
    quicksight_create_template_from_dashboard_stubber
)


logger = logging.getLogger(__name__)

def assert_success_response(response, expected_status_list=[202]):
    assert response.get('Status') in expected_status_list
    dump_state(response)

@ mock_sts
def test_quicksight_api_init(quicksight_application_resource_properties):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    logger.debug(f'unit-test: Global data {qs_api.global_state}')
    dump_state(qs_api.global_state, 'After initialization QuicksightApi global_state')

@ mock_sts
def test_quicksight_api_init_with_config_file(quicksight_application_resource_properties):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    logger.debug(f'unit-test: Global data {qs_api.global_state}')
    dump_state(qs_api.global_state, 'After initialization QuicksightApi global_state')
    assert set(qs_api.global_state.keys()) == set(['dashboard', 'analysis', 'dataset', 'datasource'])

@ mock_sts
def test_quicksight_api_create_template_from_template(
    quicksight_application_resource_properties,
    source_template_arn,
    quicksight_create_template_from_template_stubber
):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    response = qs_api.create_template_from_template(source_template_arn)
    assert_success_response(response)

@ mock_sts
def test_quicksight_api_create_template_from_analysis(
    quicksight_application_resource_properties,
    quicksight_create_template_from_analysis_stubber
):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    response = qs_api.create_template_from_analysis()
    assert_success_response(response)

@ mock_sts
def test_quicksight_api_create_template_from_dashboard(
    quicksight_application_resource_properties,
    quicksight_create_template_from_dashboard_stubber
):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    response = qs_api.create_template_from_dashboard()
    assert_success_response(response)

@ mock_sts
def test_quicksight_api_delete_template(
    quicksight_application_resource_properties
):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    sub_type = 'main'
    TemplateStubber.stub_delete_template_call(sub_type)

    response = qs_api.delete_template()
    assert_success_response(response, expected_status_list=[200])

@ mock_sts
def test_quicksight_api_update_template_permissions(
    quicksight_application_resource_properties
):
    resource_properties = quicksight_application_resource_properties
    qs_api = QuicksightApi(resource_properties)
    sub_type = 'main'
    TemplateStubber.stub_update_template_permissions_call(sub_type)

    response = qs_api.update_template_permissions(
        permission=TemplatePermissionType.PUBLIC,
        principal=None
    )
    assert_success_response(response, expected_status_list=[200])

@mock_sts
def test_quicksight_api_long_app_name(quicksight_application_resource_properties):
    resource_properties = quicksight_application_resource_properties
    stack_name = "MOCK" + "".join(["A" for _ in range(100)])
    resource_properties.update({"StackName": stack_name})
    QuicksightApplication.clear_global_states()
    qs_api = QuicksightApi(resource_properties)
    assert len(qs_api.quicksight_application.data_source.name) == 80
