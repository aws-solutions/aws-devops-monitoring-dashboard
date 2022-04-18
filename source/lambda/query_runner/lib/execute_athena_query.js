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


'use strict';

const AWS = require('aws-sdk');
const LOGGER = new (require('./logger'))();

let options = {}
let userAgentExtra = process.env.UserAgentExtra;
if (!userAgentExtra) {
    options = { customUserAgent: userAgentExtra }
}
const athena = new AWS.Athena(options);

/**
 * Execute Athena Query
 */
let ExecuteAthenaQuery = async (dbName, workGroup, queryString) => {
    try {
        LOGGER.log('INFO', '[ExecuteAthenaQuery] Start');

        let params = {
            QueryString: queryString.toString(),
            QueryExecutionContext: { Database: dbName },
            WorkGroup: workGroup
        }

        LOGGER.log('INFO', 'Query params: ' + JSON.stringify(params, null, 2));
        LOGGER.log('INFO', 'Query string: \n' + queryString.toString());

        let response = await athena.startQueryExecution(params).promise();
        let queryExecutionId = response.QueryExecutionId

        LOGGER.log('INFO', '[ExecuteAthenaQuery] response: ' + JSON.stringify(response));
        LOGGER.log('INFO', '[ExecuteAthenaQuery] queryExecutionId: ' + queryExecutionId);
        LOGGER.log('INFO', '[ExecuteAthenaQuery] END');

        return queryExecutionId;
    }
    catch (err) {
        LOGGER.log('ERROR', err);
    }
}

module.exports = {
    executeAthenaQuery: ExecuteAthenaQuery
};