# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import os

from util.helpers import get_aws_account_id, get_aws_partition, get_aws_region, get_quicksight_client
from util.logging import get_logger

logger = get_logger(__name__)


class ResourceSubTypeError(ValueError):
    pass


class QuickSightFailure(Exception):
    def __init__(
        self,
        msg="failed to create QuickSight resources - it is likely that permissions have not yet been granted for QuickSight to access Athena, or for QuickSight to read/ write access to your Athena S3 query results bucket",
        *args,
    ):
        super().__init__(msg, *args)


class QuickSightResource:
    def __init__(self, quicksight_application=None, type=None, sub_type=None, props=None):
        self.quicksight_application = quicksight_application
        self.aws_account_id = get_aws_account_id()
        self.aws_region = get_aws_region()
        self.aws_partition = get_aws_partition()
        self.principal_arn = quicksight_application.quicksight_principal_arn

        self.type = type
        self.sub_type = sub_type
        self.prefix = quicksight_application.prefix

        self.id = None
        self.name = None
        self.arn = None
        self.url = None

        self._initialize_identity()
        self._update_arn()
        self._update_url()

        self.config_data = dict()

    def _initialize_identity(self):
        """
        Initialize the identity attributes of the quicksight resource. These initial
        value may be overwritten after the constructure is called if needed.
        Examples of resource names: my-stack1_datasource, my-stack1_dataset_image-text,
        my-stack1-dataset_sentiment, my-stack1_analysis
        """
        postfix = "-" + self.type
        if self.sub_type and self.sub_type != "main":
            postfix += f"-{self.sub_type}"
        # Automatically generate a default name based on the prefix, resource type and sub-type
        # Truncate prefix to keep overall length to be no longer than 80 characters. A conservative boundary
        # Limit of 150 for arn
        max_length = 80
        name = self.prefix[0 : max_length - len(postfix)] + postfix

        # Use the same value for name and id. The id should be unique since it is
        # includes the stack name (assuming not getting truncated)
        self.id = name
        self.name = name
        self._update_arn()
        self._update_url()

    def _update_arn(self):
        if self.id:
            self.arn = (
                f"arn:{self.aws_partition}:quicksight:{self.aws_region}:{self.aws_account_id}:{self.type}/{self.id}"
            )

    def _update_url(self):
        if not self.id:
            return
        if self.type == "analysis":
            self.url = f"https://{self.aws_region}.quicksight.aws.amazon.com/sn/analyses/{self.id}"
        elif self.type == "dashboard":
            self.url = f"https://{self.aws_region}.quicksight.aws.amazon.com/sn/{self.type}s/{self.id}"
        else:
            # there is no url link for other object types, leaving url as is (not an error case)
            pass

    def _update_using_properties(self, obj_props):
        if not obj_props:
            return
        if self.sub_type:
            # there is sub-type in props, e.g. in data-set case, so we go one level deeper in the
            # dictionary to get the props of the sub-type
            obj_props = obj_props.get(self.sub_type, None)
        # if we found obj properties, use provided properties to override the object properties
        if obj_props:
            self.id = obj_props.get("id", self.id)
            self.name = obj_props.get("name", self.name)
            self.arn = obj_props.get("arn", self.arn)
            if not self.arn:
                self._update_arn()
            self._update_url()

    def use_props(self, props):
        if not props:
            return
        obj_props = props.get(self.type, None)
        self._update_using_properties(obj_props)

    def describe(self):
        call_type = self._get_type_for_boto3_call(self.type)
        id_parameter_name = self._get_id_name_for_boto3_call(self.type)

        operation = f"describe_{call_type}"
        logger.info(f"requesting quicksight {operation} id:{self.id}")
        obj = get_quicksight_client()

        if not (hasattr(obj, operation) and callable(getattr(obj, operation))):
            raise NotImplementedError(
                f"Internal error, 'QuickSight' client object has no callable function '{operation}'"
            )
        func = getattr(obj, operation)
        parameters = {
            "AwsAccountId": self.aws_account_id,
            id_parameter_name: self.id,
        }

        response = func(**parameters)
        logger.info(f"finished quicksight {operation} for id:{self.id} response: {response}")
        return response

    def get_data(self):
        return {
            "id": self.id,
            "name": self.name,
            "arn": self.arn,
        }

    def _load_config(self, resource_type, resource_sub_types, config_data):
        """load resource configuration from config file"""
        in_dir = os.path.join(os.path.dirname(__file__), "config")
        for sub_type in resource_sub_types:
            config_file = os.path.join(in_dir, f"{resource_type}-{sub_type}.config.json")
            with open(config_file, "r") as config_fd:
                config_data_item = json.load(config_fd)
                config_data[sub_type] = config_data_item

    def _get_map(self, sub_type, map_type):
        if sub_type not in self.config_data:
            raise ResourceSubTypeError(f"Unknown sub type {sub_type}, valid types are {self.config_data.keys()}.")
        sub_type_config = self.config_data[sub_type]
        if map_type not in sub_type_config:
            raise ValueError(f"Missing {map_type} in config of data set type {sub_type}.")
        return sub_type_config[map_type]

    def _get_type_for_boto3_call(self, obj_type):
        call_type_map = {
            "datasource": "data_source",
            "dataset": "data_set",
        }
        return call_type_map.get(obj_type, obj_type)

    def _get_id_name_for_boto3_call(self, obj_type):
        call_type_map = {
            "datasource": "DataSource",
            "dataset": "DataSet",
        }
        return call_type_map.get(obj_type, obj_type.capitalize()) + "Id"

    def __repr__(self):
        return str(self.get_data())
