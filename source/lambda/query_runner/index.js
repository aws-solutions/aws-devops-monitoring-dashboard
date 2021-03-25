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
const cfn = require('./lib/cfn')
const buildAthenaQuery = require('./build_athena_query');
const exeAthenaQuery = require('./lib/execute_athena_query');
const metricsHelper = require('./lib/metrics_helper');


/**
 * Execute Athena query as configured for different data sources
 */
exports.handler = async (event, context) => {
    LOGGER.log('INFO', `Event received is ${JSON.stringify(event)}`);

    const resourceType = event.ResourceType;
    const requestType = event.RequestType;
    const resourceProperties = event["ResourceProperties"];

    try{
            // run Athena queries
            if (resourceType  === 'Custom::QueryRunner') {
                await QueryRunner(requestType, resourceProperties);
            }
            // send anonymous metrics
            else if (resourceType  === 'Custom::SendAnonymousUsageData'){
                await SendAnonymousUsageData(requestType, resourceProperties);
            }

            // send cfn response
            if (requestType === 'Create' || requestType === 'Update' || requestType == 'Delete') {
                return await cfn.send(event, context, 'SUCCESS');
            }
     }
     catch (err) {
        LOGGER.log('ERROR', err);
        if (requestType === 'Create' || requestType === 'Update' || requestType == 'Delete') {
            await cfn.send(event, context, 'FAILED', err.message + `\nMore information in CloudWatch Log Stream: ${context.logStreamName}`);
        }
     }
};

/**
 * Run Athena queries
 */
let QueryRunner = async (requestType, resourceProperties) => {
    try{
            LOGGER.log('INFO', 'Start query runner lambda function');

            let queryString = ''
            const athenaDB = resourceProperties['MetricsDBName']
            const athenaTable = resourceProperties['MetricsTableName']
            const athenaWorkGroup = resourceProperties['AthenaWorkGroup']
            const dataDuration = resourceProperties['DataDuration']
            const repositoryList = resourceProperties['RepositoryList']
            const athenaViews = ['code_change_activity_view', 'code_deployment_detail', 'recovery_time_detail_view']

            // Create Athena views at stack creation or update
            if (requestType === 'Create' || requestType === 'Update') {
                LOGGER.log('INFO', 'Add Athena Partition and Build Athena Views');

                // First run query to add athena partitions as needed
                queryString = buildAthenaQuery.buildAddAthenaPartitionQuery(athenaDB, athenaTable);
                await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

                // Run query to build view for codecommit events
                queryString = buildAthenaQuery.buildCodeChangeActivityQuery(athenaDB, athenaTable, repositoryList, dataDuration);
                await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

                // Run query to build view for canary alarm events
                queryString = buildAthenaQuery.buildRecoveryTimeQuery(athenaDB,athenaTable, dataDuration);
                await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);

                // Run query to build view for deployment events
                queryString = buildAthenaQuery.buildDeploymentQuery(athenaDB,athenaTable, dataDuration);
                await exeAthenaQuery.executeAthenaQuery(athenaDB, athenaWorkGroup, queryString);
            }
            // Drop Athena views at stack deletion
            else if (requestType === 'Delete'){
                LOGGER.log('INFO', 'Delete Athena Views');
                for(let i in athenaViews){
                    queryString = buildAthenaQuery.buildDropViewQuery(athenaDB, athenaViews[i]);
                    await exeAthenaQuery.executeAthenaQuery(athenaDB, 'primary', queryString);
                }
            }
            LOGGER.log('INFO', 'End query runner lambda function');
    }
    catch (err) {
        LOGGER.log('ERROR', err);
    }
};

/**
 * Send Anonymous Usage Metrics
 */
let SendAnonymousUsageData = async (requestType, resourceProperties) => {
    try{
            if (resourceProperties['SendAnonymousUsageData'].toLowerCase() == "yes"){
                LOGGER.log('INFO', '[SendAnonymousUsageData] Start sending anonymous metrics');

                const data = {
                    "version": resourceProperties['Version'],
                    "data_type": "custom_resource",
                    "region": resourceProperties['Region'],
                    "request_type": requestType,
                    "quicksight_deployed": resourceProperties.hasOwnProperty('QuickSightPrincipalArn') && resourceProperties["QuickSightPrincipalArn"] != null ?'yes':'no',
                    "athena_query_data_duration": resourceProperties['AthenaQueryDataDuration'],
                    "repository": resourceProperties["RepositoryList"] == "'ALL'"? 'all':'customer list',
                    "s3_transition_days": resourceProperties['S3TransitionDays']
                }

                LOGGER.log("INFO", `[SendAnonymousUsageData] data: ${JSON.stringify(data)}`);

                const response = await metricsHelper.sendMetrics(resourceProperties['SolutionId'],
                                                                resourceProperties['UUID'],
                                                                data,
                                                                resourceProperties['MetricsURL']);

                LOGGER.log("INFO", `[SendAnonymousUsageData] response: ${JSON.stringify(response, null, 2)}`);
                LOGGER.log('INFO', '[SendAnonymousUsageData] End sending anonymous metrics');

                return response;
            }
    }
    catch (err) {
        LOGGER.log('ERROR', err);
    }
};