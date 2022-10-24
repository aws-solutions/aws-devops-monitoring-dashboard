# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from util.logging import get_logger

logger = get_logger(__name__)


class SourceEntity:
    supported_source_entity_types = ["SourceTemplate", "SourceAnalysis"]

    def __init__(self, data_sets, source_obj_arn, config_data, source_entity_type):
        self.data_sets = data_sets
        self.source_obj_arn = source_obj_arn
        self.config_data = config_data
        if source_entity_type not in self.supported_source_entity_types:
            raise ValueError(
                f"Invalid source_entity_type {source_entity_type}, "
                f"valid values are {self.supported_source_entity_types}"
            )
        self.source_entity_type = source_entity_type

    def get_source_entity(self):
        sub_type = "main"
        source_entity = self._get_map(sub_type, "SourceEntity")
        self._update_source_entity(source_entity)
        return source_entity

    def _update_source_entity(self, obj):
        """Update DataSetArn values in SourceEntity"""
        source_object = obj.get(self.source_entity_type, None)
        assert source_object
        logger.debug(f"Initial value of sourceEntity.sourceTemplate.arn: {source_object['Arn']}")
        source_object["Arn"] = self.source_obj_arn
        logger.debug(f"Updated value of sourceEntity.sourceTemplate.arn: {source_object['Arn']}")
        data_set_references = source_object.get("DataSetReferences", None)
        assert source_object

        for ds_ref in data_set_references:
            dsr_placeholder = ds_ref.get("DataSetPlaceholder", None)
            dsr_arn = ds_ref.get("DataSetArn", None)
            logger.debug(
                f"Initial value of DataSetReferences, DataSetPlaceholder: {dsr_placeholder}, DataSetArn: {dsr_arn}"
            )
            data_set = self.data_sets.get(dsr_placeholder, None)
            assert data_set
            ds_ref["DataSetArn"] = data_set.arn
            logger.debug(
                f"Updated value of DataSetReferences, DataSetPlaceholder: {ds_ref['DataSetPlaceholder']}, DataSetArn: {ds_ref['DataSetArn']}"
            )

    def _get_map(self, sub_type, map_type):
        if sub_type not in self.config_data:
            raise ValueError(f"Unknown sub type {sub_type}.")
        sub_type_config = self.config_data[sub_type]
        if map_type not in sub_type_config:
            raise ValueError(f"Missing {map_type} in config of data set type {sub_type}.")
        return sub_type_config[map_type]
