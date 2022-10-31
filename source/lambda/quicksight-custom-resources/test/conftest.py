#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import pytest

@ pytest.fixture(autouse=True)
def aws_environment_variables():
    """Mocked AWS environment variables such as AWS credentials and region"""
    os.environ['AWS_ACCESS_KEY_ID'] = 'mocked-aws-access-key-id'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'mocked-aws-secret-access-key'
    os.environ['AWS_SESSION_TOKEN'] = 'mocked-aws-session-token'
    os.environ['AWS_REGION'] = 'us-east-1'  # must be a valid region

collect_ignore_glob = ["tests/*.py"]  # crhelper library
collect_ignore = []
