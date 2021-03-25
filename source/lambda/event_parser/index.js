/*********************************************************************************************************************
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                                   *
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
const codeCommitEvents = require('./codecommit_events');
const synCanaryAlarmEvents = require('./synthetic_canary_alarm_events');
const codeDeployEvents = require('./codedeploy_events');

/**
 * Transform AWS CloudWatch event data
 */
exports.handler = async (event, context, callback) => {

    /* Process the list of records and transform them */
    let recordTotalCount = event.records.length;
    let recordCount = 0;
    let droppedCount = 0;
    let transformedRecord = {}

    LOGGER.log('INFO', "Total incoming source events : " + recordTotalCount.toString());

    const output = event.records.map(record => {
        try{
                const sourceData = Buffer.from(record.data, 'base64').toString('utf8');

                recordCount++;

                LOGGER.log('INFO', 'Decoded source event ' + recordCount.toString() + ': ' + sourceData);

                const parsedData = JSON.parse(sourceData);

                // Transform codecommit cloudwatch events data
                if (parsedData['source'] == 'aws.codecommit') {
                    transformedRecord = codeCommitEvents.transformCodeCommitEvents(parsedData, recordCount);
                }
                // Transform synthetic canary alarm cloudwatch events data
                else if (parsedData['source'] == 'aws.cloudwatch') {
                    transformedRecord = synCanaryAlarmEvents.transformSyntheticCanaryAlarmEvents(parsedData, recordCount);
                }
                // Transform codedeploy cloudwatch events data
                else if (parsedData['source'] == 'aws.codedeploy') {
                    transformedRecord = codeDeployEvents.transformCodeDeployEvents(parsedData, recordCount);
                }
                // Drop record and notify as needed
                if (Object.keys(transformedRecord).length === 0){
                    droppedCount++;
                    LOGGER.log('INFO', "Drop event " + recordCount.toString());
                    return {
                        recordId: record.recordId,
                        result: 'Dropped',
                        data: record.data,
                    };
                }

                LOGGER.log('INFO', 'Transformed event ' +  recordCount.toString() + ': ' + JSON.stringify(transformedRecord, null, 2));

                //remove new line break
                let transformedRecordString = JSON.stringify(transformedRecord, null, 2).replace(/\n|\r/g, "")

                //add new line break between records
                if ( recordCount < recordTotalCount )
                    transformedRecordString = transformedRecordString + "\n"

                return {
                    recordId: record.recordId,
                    result: 'Ok',
                    data: new Buffer.from(transformedRecordString).toString('base64')
                };
        }
        catch (err) {
            LOGGER.log('INFO', "Processing record " + recordTotalCount.toString() + " failled. Error: " + err.message);
        }
    });

    LOGGER.log('INFO', "Processed " + recordTotalCount.toString() + ' event(s).');
    LOGGER.log('INFO', "Dropped " + droppedCount.toString() + ' event(s).');
    LOGGER.log('DEBUG', 'Payload for AWS Kinesis Firehose: ' + JSON.stringify(output, null, 2));

    callback(null, {records: output});

};