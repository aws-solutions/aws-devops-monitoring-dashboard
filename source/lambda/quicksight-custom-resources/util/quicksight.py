# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from util.logging import get_logger
from util.quicksight_application import QuicksightApplication
from util.template import TemplatePermissionType

logger = get_logger(__name__)


class QuicksightApi:
    def __init__(self, resource_properties):
        self.quicksight_application = QuicksightApplication(resource_properties)
        self.global_state = self.quicksight_application.get_global_state()

    def create_all_resources(self):
        responses = []

        responses.append(self.create_data_source())
        responses.append(self.create_data_sets())
        responses.append(self.create_analysis())
        responses.append(self.create_dashboard())

        return responses

    # TODO:REFACTOR?: Move to object itself, with state in QuicksightApplication: self.get_global_state().update({'datasource': resource.get_data()})
    # TODO:REORG: delegate update of all the state to objects, which may decide to call out to QuicksightApplication
    def create_data_source(self):
        qs_resource = self.quicksight_application.get_data_source()
        response = qs_resource.create()
        self.get_global_state().update({"datasource": qs_resource.get_data()})
        return response

    def create_data_sets(self):
        responses = []

        data_set_sub_types = self.quicksight_application.get_supported_data_set_sub_types()
        data_sets = self.quicksight_application.get_data_sets()
        self.get_global_state().update({"dataset": {}})
        for data_set_type in data_set_sub_types:
            response = data_sets[data_set_type].create()
            responses.append(response)
            self.get_global_state()["dataset"].update({data_set_type: data_sets[data_set_type].get_data()})

        return responses

    def create_analysis(self):
        qs_resource = self.quicksight_application.get_analysis()
        response = qs_resource.create()
        self.get_global_state().update({"analysis": qs_resource.get_data()})
        return response

    def create_dashboard(self):
        qs_resource = self.quicksight_application.get_dashboard()
        response = qs_resource.create()
        self.get_global_state().update({"dashboard": qs_resource.get_data()})
        return response

    def delete_all_resources(self):
        responses = []
        """
        To ensure deletion is done on a best effort basis, each method call is in its own try except block
        Any exception that occurs when deleting is logged as a warning but not raised as an exception to
        continue deleting the other QuickSight resources
        """
        try:
            responses.append(self.delete_dashboard())
        except Exception as error:
            logger.warning(f"Failed to delete dashboard {error}")

        try:
            responses.append(self.delete_analysis())
        except Exception as error:
            logger.warning(f"Failed to delete analysis {error}")

        try:
            responses.append(self.delete_data_sets())
        except Exception as error:
            logger.warning(f"Failed to delete data sets {error}")

        try:
            responses.append(self.delete_data_source())
        except Exception as error:
            logger.warning(f"Failed to delete data source {error}")

        return responses

    def delete_data_source(self):
        qs_resource = self.quicksight_application.get_data_source()
        response = qs_resource.delete()
        return response

    def delete_data_sets(self):
        responses = []

        data_sets = self.quicksight_application.get_data_sets()
        for data_set in data_sets.values():
            response = data_set.delete()
            responses.append(response)
        return responses

    def delete_analysis(self):
        qs_resource = self.quicksight_application.get_analysis()
        response = qs_resource.delete()
        return response

    def delete_dashboard(self):
        qs_resource = self.quicksight_application.get_dashboard()
        response = qs_resource.delete()
        return response

    def create_template_from_template(self, source_template_arn):
        qs_resource = self.quicksight_application.get_template()
        response = qs_resource.create_from_template(source_template_arn)
        self.get_global_state().update({"template": qs_resource.get_data()})
        return response

    def create_template_from_analysis(self):
        template = self.quicksight_application.get_template()
        analysis = self.quicksight_application.get_analysis()
        response = template.create_from_analysis(analysis)
        self.get_global_state().update({"template": template.get_data()})
        return response

    def create_template_from_dashboard(self):
        template = self.quicksight_application.get_template()
        dashboard = self.quicksight_application.get_dashboard()
        response = template.create_from_dashboard(dashboard)
        self.get_global_state().update({"template": template.get_data()})
        return response

    def update_template_permissions(
        self, permission: TemplatePermissionType = TemplatePermissionType.PUBLIC, principal=None
    ):
        qs_resource = self.quicksight_application.get_template()
        response = qs_resource.update_template_permissions(permission, principal)
        return response

    def delete_template(self):
        qs_resource = self.quicksight_application.get_template()
        response = qs_resource.delete()
        return response

    def get_global_state(self):
        return self.global_state

    def describe_data_source(self):
        qs_resource = self.quicksight_application.get_data_source()
        response = qs_resource.describe()
        return response

    def describe_data_sets(self):
        responses = []

        data_sets = self.quicksight_application.get_data_sets()
        for data_set in data_sets.values():
            response = data_set.describe()
            responses.append(response)
        return responses

    def describe_analysis(self):
        qs_resource = self.quicksight_application.get_analysis()
        response = qs_resource.describe()
        return response

    def describe_dashboard(self):
        qs_resource = self.quicksight_application.get_dashboard()
        response = qs_resource.describe()
        return response
