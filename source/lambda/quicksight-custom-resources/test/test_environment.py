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

from test.fixtures.quicksight_test_fixture import dump_env

logger = logging.getLogger(__name__)

def test_import_application():
    from util.quicksight import QuicksightApi
    from util.quicksight_application import QuicksightApplication
    from util.datasource import DataSource
    from util.dataset import DataSet
    from util.analysis import Analysis
    from util.dashboard import Dashboard
    from util.template import Template

def test_import_test_environment():
    from test.fixtures.quicksight_dataset_fixtures import quicksight_data_set_stubber
    from test.fixtures.quicksight_dataset_fixtures import data_set_type
    from test.fixtures.quicksight_dataset_fixtures import quicksight_create_data_set_stubber, quicksight_delete_data_set_stubber
    from test.fixtures.quicksight_dataset_fixtures import mininmal_data_sets_stub

    from test.fixtures.quicksight_analysis_fixtures import AnalysisStubber

    from test.fixtures.quicksight_test_fixture import quicksight_state_all

@mock_sts
def test_dummy():
    dump_env()
