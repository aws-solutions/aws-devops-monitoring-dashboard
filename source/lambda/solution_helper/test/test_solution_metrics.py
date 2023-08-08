# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from unittest import TestCase
from unittest.mock import patch
from util.solution_metrics import send_metrics

class LambdaTest(TestCase):

    @patch('util.solution_metrics.requests.post')     
    def test_send_metrics(self, mock_post):
        data = {"data": "some data"}
        uuid = "2820b493-864c-4ca1-99d3-7174fef7f374"
        solution_id = "SO0000"
        url = "https://example.com"

        mock_post.return_value.status_code = 200
        response = send_metrics(data, uuid, solution_id, url)
        self.assertIsNotNone(response)
