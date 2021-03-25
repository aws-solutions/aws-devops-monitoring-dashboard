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
const aws = require('aws-sdk');
const cloudwatch = new aws.CloudWatch();
const lambda = new aws.Lambda()


const LOGGER = new (require('./lib/logger'))();
const buildAthenaQuery = require('./build_athena_query');
const exeAthenaQuery = require('./lib/execute_athena_query');
const metricsHelper = require('./lib/metrics_helper');

const athenaDB = process.env.MetricsDBName
const athenaTable = process.env.MetricsTableName
const athenaWorkGroup = process.env.AthenaWorkGroup
const sendAnonymousUsageData = process.env.SendAnonymousUsageData;
const solutionId = process.env.SolutionId;
const solutionVersion = process.env.Version;
const solutionUUID = process.env.UUID;
const solutionRegion = process.env.Region;
const metricsURL = process.env.MetricsURL;


/**
 * Call functions to add athena partitions and send anonymous usage metrics
 */
exports.handler = async (event) => {
    LOGGER.log(`Event received is ${JSON.stringify(event)}`);
    try{
         await AddPartition();
         await SendAnonymousUsageData();
     }
     catch (err) {
        LOGGER.log('ERROR', err);
     }
};

/**
 * Execute Athena query to add partitions
 */
let AddPartition = async () => {
    try{
            LOGGER.log('INFO', 'Start adding athena partition lambda function');

            const queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB,athenaTable);
            const queryExecutionId = await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

            LOGGER.log('INFO', 'End adding athena partition lambda function');

            return queryExecutionId;
    }
    catch (err) {
        LOGGER.log('ERROR', err);
    }
};

/**
 * Send Anonymous Usage Metrics
 */
let SendAnonymousUsageData = async () => {
    try{
        if (sendAnonymousUsageData.toLowerCase() == "yes"){
            LOGGER.log('INFO', '[SendAnonymousUsageData] Start sending anonymous metrics');

            const queryCount = await GetAthenaQueryExecutionsCount();

            const data = {
                    version: solutionVersion,
                    data_type: 'add_athena_partition_lambda',
                    region: solutionRegion,
                    athena_query_executions_count: queryCount.toString()
                };

                LOGGER.log(`[SendAnonymousUsageData] data: ${JSON.stringify(data)}`);

                const response = await metricsHelper.sendMetrics(solutionId, solutionUUID, data, metricsURL);

                LOGGER.log("INFO", `[SendAnonymousUsageData] response: ${JSON.stringify(response, null, 2)}`);
                LOGGER.log('INFO', '[SendAnonymousUsageData] End sending anonymous metrics');

                return response;
        }
    }
    catch (err) {
        LOGGER.log('ERROR', err);
    }
};

/**
 * Get the count of successful Athena query executions in the solution's Athena work group
 * that are triggered by QuickSight dashboard loading within a certain period of time (24 hours)
 */
let GetAthenaQueryExecutionsCount = async () => {
   LOGGER.log('INFO', '[GetAthenaQueryExecutionsCount] Start getting Athena query executions count');

    const end_time = new Date();
    let start_time = new Date();
    // set start time to one day (24 hours) ago
    start_time = new Date(start_time.setHours(start_time.getHours() - 24));
    const params = {
        EndTime: end_time,
        MetricName: 'ProcessedBytes',
        Namespace: 'AWS/Athena',
        Period: 3600 * 24, //set period to past 24 hours
        StartTime: start_time,
        Statistics: ['SampleCount'],
        Dimensions: [{
            Name: "QueryState",
            Value: "SUCCEEDED"
        }, {
            Name: "QueryType",
            Value: "DML"
        },{
            Name: "WorkGroup",
            Value: athenaWorkGroup
        }]
    };

    let query_executions_count = 0;

    try{
         let response = await cloudwatch.getMetricStatistics(params, function(err, data) {
         if (err) {
            LOGGER.log("DEBUG", `[GetAthenaQueryExecutionsCount] Error: ${err}`);
         } else {
                  LOGGER.log("INFO", `[GetAthenaQueryExecutionsCount] data: ${JSON.stringify(data)}`);
                  if (data.Datapoints && data.Datapoints.length > 0) {
                     data.Datapoints.forEach(function(data_point, index) {
                        query_executions_count += data_point.SampleCount;
                     });
                     // subtract 1 query execution used to add daily athena partition instead of loading QuickSight dashboard
                     query_executions_count = (query_executions_count - 1 >= 0)?(query_executions_count - 1): 0;
               }
         }
        }).promise()

        LOGGER.log("INFO", `[GetAthenaQueryExecutionsCount] Response: ${JSON.stringify(response)}`);
        LOGGER.log("INFO", `[GetAthenaQueryExecutionsCount] Query Executions Count: ${query_executions_count.toString()}`);
    }
    catch (error) {
      LOGGER.log('ERROR', error);
   };

    LOGGER.log('INFO', '[GetAthenaQueryExecutionsCount] End getting Athena query executions count');

    return query_executions_count;
};