#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import test.logger_test_helper
import logging

from test.fixtures.quicksight_test_fixture import dump_env

logger = logging.getLogger(__name__)

def check_env():
    dump_env()


if __name__ == "__main__":
    check_env()
