# #####################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                 #
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

from util.helpers import get_quicksight_client
from util.logging import get_logger
from util.quicksight_resource import QuickSightResource

logger = get_logger(__name__)


class DataSource(QuickSightResource):
    def __init__(self, quicksight_application=None, props=None):
        super().__init__(quicksight_application, type="datasource", props=props)
        self.use_props(props)
        self.athena_workgroup = "primary"

    def create(self):
        logger.info(f"creating quicksight datasource id:{self.id}")
        quicksight_client = get_quicksight_client()

        data_source_parameters = {"AthenaParameters": {"WorkGroup": self.athena_workgroup}}

        try:
            response = quicksight_client.create_data_source(
                AwsAccountId=self.aws_account_id,
                DataSourceId=self.id,
                Name=self.name,
                Type="ATHENA",
                DataSourceParameters=data_source_parameters,
                Permissions=self._get_permissions(),
                SslProperties={"DisableSsl": False},
            )
            logger.info(f"finished creating quicksight datasource for id:{self.id}" f"response {response}")
        except quicksight_client.exceptions.ResourceExistsException:
            logger.info(f"datasource for id:{self.id} already exists")
            response = quicksight_client.describe_data_source(AwsAccountId=self.aws_account_id, DataSourceId=self.id)
            response = response["DataSource"]

        self.arn = response["Arn"]
        return response

    def update(self):
        quicksight_client = get_quicksight_client()
        quicksight_client.describe_data_source
        data_source_parameters = {"AthenaParameters": {"WorkGroup": self.athena_workgroup}}
        try:
            response = quicksight_client.update_data_source(
                AwsAccountId=self.aws_account_id,
                DataSourceId=self.id,
                Name=self.name,
                DataSourceParameters=data_source_parameters,
                SslProperties={"DisableSsl": False},
            )
        except quicksight_client.exceptions.ConflictException as exc:
            logger.debug(str(exc))
            response = response["DataSource"]
        return response

    def delete(self):
        logger.info(f"deleting quicksight datasource id:{self.id}")
        quicksight_client = get_quicksight_client()

        response = quicksight_client.delete_data_source(AwsAccountId=self.aws_account_id, DataSourceId=self.id)
        logger.info(f"finished deleting quicksight datasource for id:{self.id}, " f"response:{response}")
        self.arn = response["Arn"]
        return response

    def _get_permissions(self):
        # The principal is the owner of the resource and create the resources and is given full actions for the type
        permissions = [
            {
                "Principal": self.principal_arn,
                "Actions": [
                    "quicksight:DescribeDataSource",
                    "quicksight:DescribeDataSourcePermissions",
                    "quicksight:PassDataSource",
                    "quicksight:UpdateDataSource",
                    "quicksight:UpdateDataSourcePermissions",
                    "quicksight:DeleteDataSource",
                ],
            }
        ]
        return permissions
