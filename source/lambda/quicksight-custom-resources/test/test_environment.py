#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

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
    from test.fixtures.quicksight_dataset_fixtures import minimal_data_sets_stub

    from test.fixtures.quicksight_analysis_fixtures import AnalysisStubber

    from test.fixtures.quicksight_test_fixture import quicksight_state_all

@mock_sts
def test_dummy():
    dump_env()
