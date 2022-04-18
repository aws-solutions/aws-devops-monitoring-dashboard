#!/usr/bin/env python
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import os

DEFAULT_LEVEL = "INFO"


def get_level():
    valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    requested_level = os.environ.get("LOG_LEVEL", DEFAULT_LEVEL)
    if requested_level and requested_level in valid_levels:
        return requested_level
    return DEFAULT_LEVEL


def get_logger(name):
    logger = None
    # first case: running as a lambda function or in pytest with conftest
    # second case: running a single test or locally under test
    if len(logging.getLogger().handlers) > 0:
        logger = logging.getLogger()
        logger.setLevel(get_level())
        # overrides
        logging.getLogger("boto3").setLevel(logging.WARNING)
        logging.getLogger("botocore").setLevel(logging.WARNING)
        logging.getLogger("urllib3").setLevel(logging.WARNING)
    else:
        """
        Configuring loggers is security-sensitive. For this logger, no
        sensitive information is logged and hence suppressing the rule
        """
        logging.basicConfig(level=get_level())  # NOSONAR (python:S4792)
        logger = logging.getLogger(name)
    return logger
