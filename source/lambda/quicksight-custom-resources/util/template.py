# #####################################################################################################################
#  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                            #
#                                                                                                                     #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance     #
#  with the License. A copy of the License is located at                                                              #
#                                                                                                                     #
#  http://www.apache.org/licenses/LICENSE-2.0                                                                         #
#                                                                                                                     #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES  #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions     #
#  and limitations under the License.                                                                                 #
# #####################################################################################################################

from enum import Enum, auto

from util.helpers import get_quicksight_client
from util.logging import get_logger
from util.quicksight_resource import QuickSightResource
from util.source_entity import SourceEntity

logger = get_logger(__name__)


class TemplatePermissionType(Enum):
    """Simplifies permission setting of template"""

    PUBLIC = auto()
    SELECTED = auto()
    PRIVATE = auto()

    def __str__(self):
        return self.name

    def __eq__(self, other):
        return self.name == other


class Template(QuickSightResource):
    def __init__(self, quicksight_application=None, data_sets=None, props=None):
        super().__init__(quicksight_application=quicksight_application, type="template", props=props)
        self.use_props(props)

        self.data_sets = data_sets

        self.config_data = {}
        self._load_config(self.type, ["main"], self.config_data)

    def create_from_analysis(self, analysis):
        logger.info(f"requesting quicksight create_template id {self.id} from analysis")
        quicksight_client = get_quicksight_client()

        analysis_source_entity = SourceEntity(
            self.data_sets, analysis.arn, self.config_data, source_entity_type="SourceAnalysis"
        )

        response = quicksight_client.create_template(
            AwsAccountId=self.aws_account_id,
            TemplateId=self.id,
            Name=self.name,
            Permissions=self._get_permissions(),
            SourceEntity=analysis_source_entity.get_source_entity(),
            VersionDescription="1",
        )
        logger.info(f"finished quicksight create_template id:{self.id} from analysis " f"response: {response}")

        self.arn = response["Arn"]
        return response

    def create_from_dashboard(self, dashboard):
        # TODO: REFACTOR+MERGE with create_from_analysis after testing to be the same
        logger.info(f"requesting quicksight create_template id {self.id} from dashboard")
        quicksight_client = get_quicksight_client()

        analysis_source_entity = SourceEntity(
            self.data_sets, dashboard.arn, self.config_data, source_entity_type="SourceAnalysis"
        )

        response = quicksight_client.create_template(
            AwsAccountId=self.aws_account_id,
            TemplateId=self.id,
            Name=self.name,
            Permissions=self._get_permissions(),
            SourceEntity=analysis_source_entity.get_source_entity(),
            VersionDescription="1",
        )
        logger.info(f"finished quicksight create_template id:{self.id} from analysis " f"response: {response}")

        self.arn = response["Arn"]
        return response

    def create_from_template(self, source_template_arn):
        quicksight_client = get_quicksight_client()

        logger.info(f"requesting quicksight create_template id:{self.id} from template")
        source_entity = self._get_source_entity_using_template(source_template_arn)
        response = quicksight_client.create_template(
            AwsAccountId=self.aws_account_id,
            TemplateId=self.id,
            Name=self.name,
            Permissions=self._get_permissions(),
            SourceEntity=source_entity,
            VersionDescription="1",
        )
        logger.info(f"finished quicksight create_template id:{self.id} from template " f"response: {response}")

        self.arn = response["Arn"]
        return response

    def delete(self):
        quicksight_client = get_quicksight_client()

        logger.info(f"requesting quicksight delete_template id:{self.id}")
        response = quicksight_client.delete_template(AwsAccountId=self.aws_account_id, TemplateId=self.id)
        logger.info(f"finished quicksight delete_template for id:{self.id} " f"response: {response}")
        return response

    def update_template_permissions(
        self, permission: TemplatePermissionType = TemplatePermissionType.PUBLIC, principal=None
    ):
        quicksight_client = get_quicksight_client()

        logger.debug(f"requesting quicksight update_template_permissions, principal: {principal}")
        if permission == TemplatePermissionType.PUBLIC:
            principal = "*"

        logger.info(f"requesting quicksight update_template_permissions: {self.id} from template")
        response = quicksight_client.update_template_permissions(
            AwsAccountId=self.aws_account_id,
            TemplateId=self.id,
            GrantPermissions=[{"Principal": principal, "Actions": ["quicksight:DescribeTemplate"]}],
        )
        logger.info(
            f"finished quicksight update_template_permissions for id:{self.id} from template " f"response: {response}"
        )
        return response

    def _get_permissions(self):
        # The principal is the owner of the resource and create the resources and is given full actions for the type
        permissions = [
            {
                "Principal": self.principal_arn,
                "Actions": [
                    "quicksight:DescribeTemplate",
                    "quicksight:ListTemplateVersions",
                    "quicksight:UpdateTemplatePermissions",
                    "quicksight:UpdateTemplate",
                    "quicksight:DeleteTemplate",
                    "quicksight:DescribeTemplatePermissions",
                ],
            }
        ]
        return permissions

    def _get_source_entity_using_template(self, source_template_arn):
        source_entity = {"SourceTemplate": {"Arn": source_template_arn}}
        return source_entity
