# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json

import yaml

from util.analysis import Analysis
from util.dashboard import Dashboard
from util.dataset import DataSet
from util.datasource import DataSource
from util.helpers import get_aws_account_id, get_quicksight_client
from util.logging import get_logger
from util.template import Template

logger = get_logger(__name__)

# Global state. Keep in execution context of lambda
_global_state = dict()


def get_global_state():
    """Get the global state"""
    global _global_state
    if not _global_state:
        logger.debug(f"Initializing global state for quicksight api")
        _global_state = dict()
    return _global_state


def read_config(file_name):
    config_path = file_name
    with open(config_path, "r") as f:
        body = f.read()
    config_dict = yaml.safe_load(body)
    logger.info(f"config loaded, config: {config_dict}")
    return config_dict


class QuicksightApplication:
    def __init__(self, resource_properties):

        supported_data_set_types = ["code-change-activity", "code-deployment-detail", "recovery-time-detail", "code-pipeline-detail", "code-build-detail", "github-change-activity"]

        self.resource_properties = resource_properties
        self.global_state = get_global_state()

        # use config data file if provided
        config_file = resource_properties.get("ConfigDataFile", None)
        if config_file:
            data = read_config(config_file)
            self.global_state.update(data)

        self.prefix = resource_properties.get("StackName", "Sample_Sol")

        self.quicksight_template_arn = resource_properties.get(
            "QuickSightSourceTemplateArn", "Uninitialized QuickSightSourceTemplateArn"
        )
        logger.debug(f"Using QuickSightSourceTemplateArn: {self.quicksight_template_arn }")

        self.quicksight_principal_arn = resource_properties.get(
            "QuickSightPrincipalArn", "Uninitialized QuickSightPrincipalArn"
        )
        logger.debug(f"Using QuickSightPrincipalArn: {self.quicksight_principal_arn }")

        self.data_source = DataSource(quicksight_application=self, props=self.global_state)
        self.data_source.athena_workgroup = resource_properties.get("WorkGroupName", "primary")

        self.data_set_sub_types = supported_data_set_types
        self.data_sets = dict()
        for data_set_sub_type in self.data_set_sub_types:
            data_set = DataSet(
                quicksight_application=self,
                data_source=self.data_source,
                data_set_sub_type=data_set_sub_type,
                props=self.global_state,
            )
            self.data_sets[data_set_sub_type] = data_set

        self.analysis = Analysis(
            quicksight_application=self,
            data_sets=self.data_sets,
            quicksight_template_arn=self.quicksight_template_arn,
            data_source=self.data_source,
            props=self.global_state,
        )

        self.dashboard = Dashboard(
            quicksight_application=self,
            data_source=self.data_source,
            data_sets=self.data_sets,
            quicksight_template_arn=self.quicksight_template_arn,
            props=self.global_state,
        )

        self.template = Template(quicksight_application=self, data_sets=self.data_sets, props=self.global_state)

        global_state_json = json.dumps(self.global_state, indent=2, sort_keys=True)
        logger.debug(f"QuicksightApi: after init, global data json: {global_state_json}")

    def get_data_source(self):
        return self.data_source

    def get_data_sets(self):
        return self.data_sets

    def get_analysis(self):
        return self.analysis

    def get_dashboard(self):
        return self.dashboard

    def get_template(self):
        return self.template

    def get_supported_data_set_sub_types(self):
        return self.data_set_sub_types

    def get_global_state(self):
        return self.global_state

    @property
    def edition(self) -> str:
        qs = get_quicksight_client()
        try:
            settings = qs.describe_account_settings(AwsAccountId=get_aws_account_id())
            edition = settings.get("AccountSettings").get("Edition")
        except qs.exceptions.ResourceNotFoundException:
            edition = "DISABLED"

        logger.info("running with QuickSight %s" % edition)
        return edition

    @staticmethod
    def clear_global_states():
        global _global_state
        _global_state = dict()
