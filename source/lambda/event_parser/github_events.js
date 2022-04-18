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
* Transform GitHub Events
*/
let TransformGitHubEvents = (data, recordNumber) => {
    try {

        LOGGER.log('INFO', 'Start transforming GitHub event ' + recordNumber.toString());

        let transformedRecord = {};
        let commitIDs = [];

        // If it is not push event, stop further processing but return empty json object to drop it
        if (!(data.hasOwnProperty("ref") && data.hasOwnProperty("pusher"))) {
            LOGGER.log('INFO', 'Event ' + recordNumber.toString() + ' is NOT a push event. STOP processing.');
            return {}
        }

        transformedRecord['repository_name'] = data["repository"]["name"];
        transformedRecord['branch_name'] = data["ref"].split("/").pop();
        transformedRecord['author_name'] = data["head_commit"]["author"]["name"];
        transformedRecord['time'] = new Date(data["head_commit"]["timestamp"]).toISOString().replace('T', ' ').replace('Z', ' ');
        transformedRecord['event_name'] = data["additional-data"]["input-parameters"]["header"]["X-GitHub-Event"];

        for (const commit in data["commits"]) {
            commitIDs.push(data["commits"][commit]["id"]);
            LOGGER.log('DEBUG', 'commit id ' + commit.toString() + ': ' + data["commits"][commit]["id"]);
        }

        transformedRecord["commit_id"] = commitIDs;

        LOGGER.log('DEBUG', 'Transformed record: ' + JSON.stringify(transformedRecord, null, 2));
        LOGGER.log('INFO', 'End transforming GitHub event ' + recordNumber.toString());

        return transformedRecord;

    }
    catch (error) {
        LOGGER.log('ERROR', "Transforming GitHub event failed. Error: " + error.message);
        return {}
    }
};

module.exports = {
    transformGitHubEvents: TransformGitHubEvents
};