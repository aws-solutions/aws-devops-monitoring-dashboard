# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import requests
from json import dumps
from datetime import datetime


def send_metrics(data,
                 uuid=os.getenv('UUID'),
                 solution_id=os.getenv('SOLUTION_ID'),
                 url=os.getenv('METRICS_URL')):
    """Sends anonymous customer metrics to s3 via API gateway owned and
        managed by the Solutions Builder team.

    Args:
        data - anonymous customer metrics to be sent
        uuid - uuid of the solution
        solution_id: unique id of the solution
        url: url for API Gateway via which data is sent

    Return: response returned by https post request
    """
    try:
        metrics_data = {
            "Solution": solution_id,
            "UUID": uuid,
            "TimeStamp": str(datetime.utcnow().isoformat()),
            "Data": data
            }
        json_data = dumps(metrics_data)
        print('metrics data:' + json_data)
        headers = {'content-type': 'application/json'}
        response = requests.post(url, data=json_data, headers=headers)
        return response
    except:
        pass
