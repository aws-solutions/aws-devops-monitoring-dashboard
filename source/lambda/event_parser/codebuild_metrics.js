/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance     *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/


'use strict';


const LOGGER = new (require('./lib/logger'))();


/**
* Transform AWS CloudWatch metrics for CodeBuild
*/
let TransformCodeBuildCWMetrics = (data, recordNumber) => {
    try {
        // Split JSON objects in source data by newline and store them in an array
        const arrayOfObjectsFromData = data.split("\n");

        // Filter out duplicated JSON objects that have no projects in dimensions
        const ObjectsWithDimensionsValue = arrayOfObjectsFromData.filter(obj => {
            try {
                const jsonData = JSON.parse(obj)
                return jsonData["dimensions"]["ProjectName"] != undefined
            } catch (err) {
                return false;
            }
        })

        LOGGER.log('INFO', 'JSON objects after filtering empty dimensions for source event ' + recordNumber.toString() + ': ' + ObjectsWithDimensionsValue);

        // Put JSON objects back to a string, separated by a newline
        return ObjectsWithDimensionsValue.join("\n")
    }
    catch (error) {
        LOGGER.log('ERROR', "Error transforming codebuild metrics failed. Error: " + error.message);
    }
};

module.exports = {
    transformCodeBuildCWMetrics: TransformCodeBuildCWMetrics
};