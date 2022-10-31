// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const LOGGER = new (require('./lib/logger'))();

/**
 * Transform AWS CloudWatch metrics for CodeBuild
 * @param data
 * @param recordNumber
 */
const TransformCodeBuildCWMetrics = (data, recordNumber) => {
  try {
    // Split JSON objects in source data by newline and store them in an array
    const arrayOfObjectsFromData = data.split('\n');

    // Filter out duplicated JSON objects that have no projects in dimensions
    const ObjectsWithDimensionsValue = arrayOfObjectsFromData.filter(obj => {
      try {
        const jsonData = JSON.parse(obj);
        return jsonData['dimensions']['ProjectName'] != undefined;
      } catch (err) {
        return false;
      }
    });

    LOGGER.log(
      'INFO',
      'JSON objects after filtering empty dimensions for source event ' +
        recordNumber.toString() +
        ': ' +
        ObjectsWithDimensionsValue
    );

    // Put JSON objects back to a string, separated by a newline
    return ObjectsWithDimensionsValue.join('\n');
  } catch (error) {
    LOGGER.log('ERROR', 'Error transforming codebuild metrics failed. Error: ' + error.message);
  }
};

module.exports = {
  transformCodeBuildCWMetrics: TransformCodeBuildCWMetrics
};
