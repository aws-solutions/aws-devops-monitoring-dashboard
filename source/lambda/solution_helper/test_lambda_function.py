# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import requests
import json
import sys
import unittest


class LambdaTest(unittest.TestCase):

    def test_create_unique_id(self):
        import lambda_function

        event = {
            "RequestType": "Create",
            "ResourceProperties": {
                "Resource": "UUID"
                }}

        lambda_function.solution_helper(event, None)
        self.assertIsNotNone(lambda_function.helper.Data.get("UUID"))
