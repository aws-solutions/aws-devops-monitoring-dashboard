#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import test.logger_test_helper
from test.fixtures.quicksight_dashboard_fixtures import DashboardStubber
from test.fixtures.quicksight_dataset_fixtures import (
    data_set_type,
    minimal_data_sets_stub,
    quicksight_create_data_set_stubber,
    quicksight_data_set_stubber,
    quicksight_delete_data_set_stubber,
)
from test.fixtures.quicksight_template_fixtures import template_arn
from test.fixtures.quicksight_test_fixture import quicksight_application_stub
from test.logger_test_helper import dump_state

import pytest
from moto import mock_sts
from util.quicksight_application import QuicksightApplication
from util.source_entity import SourceEntity

logger = logging.getLogger(__name__)


def test_source_entity_init_invalid(quicksight_application_stub, minimal_data_sets_stub):
    template_arn_param = template_arn

    obj = None
    with pytest.raises(ValueError):
        # Function under test
        obj = SourceEntity(
            data_sets=minimal_data_sets_stub.data_sets_stub,
            source_obj_arn=template_arn_param,
            config_data=None,
            source_entity_type="InjectErrorInvalidSource",
        )

    assert not obj


def test_source_entity_get_map_invalid_sub_type(quicksight_application_stub, minimal_data_sets_stub):
    template_arn_param = template_arn
    mock_data_set_references = {
        "MainInjectError": {
            "SourceEntity": {
                "SourceTemplate": {
                    "DataSetReferences": [
                        {
                            "DataSetPlaceholder": "sentiment",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/sentiment",
                        },
                        {
                            "DataSetPlaceholder": "topic",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/topic",
                        },
                        {
                            "DataSetPlaceholder": "text",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/text",
                        },
                        {
                            "DataSetPlaceholder": "image-text",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/image-text",
                        },
                        {
                            "DataSetPlaceholder": "image-moderation-label",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/image-moderation-label",
                        },
                    ],
                    "Arn": "{self.source_template_arn}",
                }
            }
        }
    }
    obj = SourceEntity(
        data_sets=minimal_data_sets_stub.data_sets_stub,
        source_obj_arn=template_arn_param,
        config_data=mock_data_set_references,
        source_entity_type="SourceTemplate",
    )

    source_entity = None
    with pytest.raises(ValueError):
        # Function under test
        source_entity = obj.get_source_entity()

    assert not source_entity


def test_source_entity_get_map_missing_source_entity(quicksight_application_stub, minimal_data_sets_stub):
    template_arn_param = template_arn
    mock_data_set_references = {
        "main": {
            "SourceEntityInjectError": {
                "SourceTemplate": {
                    "DataSetReferences": [
                        {
                            "DataSetPlaceholder": "sentiment",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/sentiment",
                        },
                        {
                            "DataSetPlaceholder": "topic",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/topic",
                        },
                        {
                            "DataSetPlaceholder": "text",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/text",
                        },
                        {
                            "DataSetPlaceholder": "image-text",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/image-text",
                        },
                        {
                            "DataSetPlaceholder": "image-moderation-label",
                            "DataSetArn": "arn:{Aws.PARTITION}:quicksight:{Aws.REGION}:{Aws.ACCOUNT_ID}:dataset/image-moderation-label",
                        },
                    ],
                    "Arn": "{self.source_template_arn}",
                }
            }
        }
    }
    obj = SourceEntity(
        data_sets=minimal_data_sets_stub.data_sets_stub,
        source_obj_arn=template_arn_param,
        config_data=mock_data_set_references,
        source_entity_type="SourceTemplate",
    )

    source_entity = None
    with pytest.raises(ValueError):
        # Function under test
        source_entity = obj.get_source_entity()

    assert not source_entity
