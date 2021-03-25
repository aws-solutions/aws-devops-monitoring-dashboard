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

/**
 * Build an athena query to alter table add partition as needed
 */
let BuildAddAthenaPartitionQuery = (athenaDB, athenaTable) => {
    LOGGER.log('INFO', '[BuildAddAthenaPartitionQuery] Start');

    // Get today's date and time
    const currentTimeStamp = new Date()
    const year = currentTimeStamp.getFullYear()
    const month = currentTimeStamp.getMonth() + 1
    const day = currentTimeStamp.getDate()

    let queryString =
        'ALTER TABLE ' + athenaDB + '.' + athenaTable  + '\n' +
        'ADD IF NOT EXISTS'  + '\n' +
        "PARTITION (\n"  +
            "\tcreated_at = '" + year.toString() + "-"  +
            (month.toString() < 10 ? '0' : '') + month.toString() + "-"  +
            (day.toString() < 10 ? '0' : '') + day.toString() + "');"

    LOGGER.log('INFO', 'Query string: \n'+ queryString);
    LOGGER.log('INFO', '[BuildAddAthenaPartitionQuery] END');

    return queryString;
};

/**
 * Build an athena query to create a view for code change activities
 */
let BuildCodeChangeActivityQuery = (athenaDB, athenaTable, includedRepositoryList, dataDuration) => {
    LOGGER.log('INFO', '[BuildCodeChangeActivityQuery] Start');

    let queryString =
        'CREATE OR REPLACE VIEW ' + athenaDB + '.code_change_activity_view AS ' + '\n' +
        'SELECT account, time, region, ' + '\n' +
        'detail.eventName as event_name, ' + '\n' +
        'detail.repositoryName as repository_name, ' + '\n' +
        'detail.branchName as branch_name, ' + '\n' +
        'detail.authorName as author_name, ' + '\n' +
        'detail.commitId as commit_id, ' + '\n' +
        'created_at' + '\n' +
        'FROM' + '\n' +
        athenaDB + '.' + athenaTable + '\n' +
        "WHERE source = 'aws.codecommit'"

    const dataDurationQueryString = BuildDataDurationQuery(dataDuration);
    queryString = queryString + '\nAND ' + dataDurationQueryString

    // add filter by customer selected repos if configured
    if (includedRepositoryList.length > 0 && includedRepositoryList !== "'ALL'")
        queryString = queryString + '\nAND detail.repositoryName in (' + includedRepositoryList + ');'
    else queryString = queryString + ';';

    LOGGER.log('INFO', 'Query string: \n'+ queryString);
    LOGGER.log('INFO', '[BuildCodeChangeActivityQuery] END');

    return queryString;
};

/**
 * Build an athena query to create a view for recovery time
 */
let BuildRecoveryTimeQuery = (athenaDB, athenaTable, dataDuration) => {
        LOGGER.log('INFO', '[BuildRecoveryTimeQuery] Start');

        let queryString =
            'CREATE OR REPLACE VIEW ' + athenaDB + '.recovery_time_detail_view AS ' + '\n' +
            'SELECT account, time, region, ' + '\n' +
            'detail.canaryAlarmName as alarm_name, ' + '\n' +
            'detail.canaryAlarmAppName as application_name, ' + '\n' +
            'detail.canaryAlarmRepoName as repository_name, ' + '\n' +
            'detail.canaryAlarmCurrState as current_state, ' + '\n' +
            'detail.canaryAlarmPrevState as previous_state, ' + '\n' +
            'detail.canaryAlarmCurrStateTimeStamp as current_state_timestamp, ' + '\n' +
            'detail.canaryAlarmPrevStateTimeStamp as previous_state_timestamp, ' + '\n' +
            'detail.recoveryDurationMinutes as duration_minutes,' + '\n' +
            'created_at' + '\n' +
            'FROM' + '\n' +
            athenaDB + '.' + athenaTable + '\n' +
            "WHERE source = 'aws.cloudwatch'"

        const dataDurationQueryString = BuildDataDurationQuery(dataDuration);
        queryString = queryString + '\nAND ' + dataDurationQueryString + ';';

        LOGGER.log('INFO', 'Query string: \n'+ queryString);
        LOGGER.log('INFO', '[BuildRecoveryTimeQuery] END');

        return queryString;
};

/**
 * Build an athena query to create a view for application deployments
 */
let BuildDeploymentQuery = (athenaDB, athenaTable, dataDuration) => {
    LOGGER.log('INFO', '[BuildDeploymentQuery] Start');

    let queryString =
        'CREATE OR REPLACE VIEW ' + athenaDB + '.code_deployment_detail_view AS ' + '\n' +
        'SELECT account, time, region, ' + '\n' +
        'detail.deploymentId as deployment_id, ' + '\n' +
        'detail.deploymentApplication as application, ' + '\n' +
        'detail.deploymentState as state,' + '\n' +
        'created_at' + '\n' +
        'FROM' + '\n' +
        athenaDB + '.' + athenaTable + '\n' +
        "WHERE source = 'aws.codedeploy'"

    const dataDurationQueryString = BuildDataDurationQuery(dataDuration);
    queryString = queryString + '\nAND ' + dataDurationQueryString + ';';

    LOGGER.log('INFO', 'Query string: \n'+ queryString);
    LOGGER.log('INFO', '[BuildDeploymentQuery] END');

    return queryString;
};

/**
 * Build a query string for data duration
 */
let BuildDataDurationQuery = (dataDuration) => {
    LOGGER.log('INFO', '[BuildDataDurationString] Start');

    let queryString =
        "created_at between date_add('day', -" + dataDuration + ", current_date) and current_date"

    LOGGER.log('INFO', 'Query string: \n'+ queryString);
    LOGGER.log('INFO', '[BuildDataDurationString] END');

    return queryString;
};

/**
 * Build athena query to drop a view
 */
let BuildDropViewQuery = (athenaDB, athenaView) => {
    LOGGER.log('INFO', '[BuildDropViewQuery] Start');

    let queryString =
        'DROP VIEW IF EXISTS '+ athenaDB + '.' + athenaView + ';'

    LOGGER.log('INFO', 'Query string: \n'+ queryString);
    LOGGER.log('INFO', '[BuildDropViewQuery] END');

    return queryString;
};

module.exports = {
    buildAddAthenaPartitionQuery: BuildAddAthenaPartitionQuery,
    buildCodeChangeActivityQuery: BuildCodeChangeActivityQuery,
    buildRecoveryTimeQuery: BuildRecoveryTimeQuery,
    buildDeploymentQuery: BuildDeploymentQuery,
    buildDropViewQuery: BuildDropViewQuery,
    buildDataDurationQuery: BuildDataDurationQuery
};