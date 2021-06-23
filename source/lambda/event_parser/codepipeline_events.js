/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance     *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

 'use strict';

 const LOGGER = new (require('./lib/logger'))();
 
 /**
  * Transform AWS CloudWatch events from AWS CodePipeline.
  */
 
 let TransformCodePipelineEvents = (data, recordNumber) => {
 
     LOGGER.log('INFO', 'Start transforming CodePipeline CW Event ' + recordNumber.toString());
 
     let detailData = {};
     let transformedRecord = {};
     let transformedDetail ={};
 
     //Process event data
     for(var key in data){
         //Keep all key values that are not under detail tag and are common in all cloudwatch events
         if (key != 'detail') {
             if (key != 'detail-type')
                 transformedRecord[key] = !transformedRecord.hasOwnProperty(key)? data[key]: null;
             //rename key detail-type to detail_type to support athena query
             else transformedRecord['detail_type'] = !transformedRecord.hasOwnProperty(key)? data[key]: null;
         }
         //process key values under detail tag that are specific only for this event
         else {
                 detailData = data["detail"];
                 transformedDetail['pipelineName'] = detailData.hasOwnProperty("pipeline")?detailData['pipeline']:'';
                 transformedDetail['executionId'] = detailData.hasOwnProperty("execution-id")?detailData['execution-id']:'';
                 transformedDetail['stage'] = detailData.hasOwnProperty("stage")?detailData['stage']:'';
                 transformedDetail['action'] = detailData.hasOwnProperty("action")?detailData['action']:'';
                 transformedDetail['state'] = detailData.hasOwnProperty("state")?detailData['state']:'';


                 if (detailData.hasOwnProperty("execution-result") && detailData["execution-result"] != null){
                    let executionResult = detailData["execution-result"];
                    if (executionResult.hasOwnProperty("external-execution-id"))
                         transformedDetail["externalExecutionId"]=executionResult["external-execution-id"];      
                 }

                 if (detailData.hasOwnProperty("type") && detailData["type"] != null) {
                     let actionType = detailData["type"]
                     if (actionType.hasOwnProperty("category"))
                        transformedDetail["actionCategory"]=actionType["category"];
                     if (actionType.hasOwnProperty("owner"))
                        transformedDetail["actionOwner"]=actionType["owner"];
                     if (actionType.hasOwnProperty("provider"))
                        transformedDetail["actionProvider"]=actionType["provider"];
                 }

         }//end else
 
     }//end for loop
 
     transformedRecord['detail'] = transformedDetail
 
     LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
     LOGGER.log('INFO', 'End transforming CodeDeploy CW Event ' + recordNumber.toString());
 
     return transformedRecord;
 
 };
 
  module.exports = {
      transformCodePipelineEvents: TransformCodePipelineEvents
  };