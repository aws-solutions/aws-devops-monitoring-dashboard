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
from util.template import Template, TemplatePermissionType

from test.fixtures.quicksight_dataset_fixtures import mininmal_data_sets_stub
from test.fixtures.quicksight_template_fixtures import (TemplateStubber, template_arn)
from test.fixtures.quicksight_test_fixture import quicksight_application_stub
from test.logger_test_helper import dump_state

logger = logging.getLogger(__name__)


@pytest.fixture()
def source_template_arn(request):
    FAKE_ACCOUNT_ID_SRC = 'FAKE_ACCOUNT_SRC'
    return f"arn:aws:quicksight:us-east-1:{FAKE_ACCOUNT_ID_SRC}:template/SO0122-Discovering-Hot-Topics-v1_1_0"

@ mock_sts
def test_template_init(quicksight_application_stub):
    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=None,
        props=None
    )

    dump_state(obj)

@ mock_sts
def test_template_init_minimal_data_sets(quicksight_application_stub, mininmal_data_sets_stub):
    stub = mininmal_data_sets_stub

    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=stub.data_sets_stub,
        props=None
    )

    dump_state(obj)

@ mock_sts
def test_template_create_from_analysis(quicksight_application_stub, mininmal_data_sets_stub):
    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        props=None
    )

    sub_type = 'main'
    TemplateStubber.stub_create_template_call(sub_type)

    class AnalysisStub:
        def __init__(self):
            self.arn = "MOCK_ANALYSIS"

    analysis = AnalysisStub()

    dump_state(obj)
    obj.create_from_analysis(analysis)
    dump_state(obj, 'After template create_from_analysis obj')

@ mock_sts
def test_template_create_from_template(quicksight_application_stub, template_arn):
    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=None,
        props=None
    )

    sub_type = 'main'
    TemplateStubber.stub_create_template_call(sub_type)

    dump_state(obj)
    obj.create_from_template(template_arn)
    dump_state(obj, 'After template create_from_template obj')

@ mock_sts
def test_template_delete(quicksight_application_stub, mininmal_data_sets_stub):
    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        props=None
    )

    sub_type = 'main'
    TemplateStubber.stub_delete_template_call(sub_type)

    dump_state(obj)
    obj.delete()
    dump_state(obj, 'After template delete obj')

@ mock_sts
def test_template_update_template_permissions(quicksight_application_stub, mininmal_data_sets_stub):
    obj = Template(
        quicksight_application=quicksight_application_stub,
        data_sets=mininmal_data_sets_stub.data_sets_stub,
        props=None
    )

    sub_type = 'main'
    TemplateStubber.stub_update_template_permissions_call(sub_type)
    permission_type = TemplatePermissionType.PUBLIC
    logger.info(f"Testing with permission type {permission_type}")
    dump_state(obj)
    obj.update_template_permissions(
        permission=TemplatePermissionType.PUBLIC,
        principal=None
    )
    dump_state(obj, 'After template delete obj')
