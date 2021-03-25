/*********************************************************************************************************************
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
const axios = require('axios');
const moment = require('moment');
const LOGGER = new (require('./logger'))();

/**
 * Send anonymous usage metrics
 */
const SendMetrics = async (solutionId, uuid, metricsData, metricsURL) => {
  LOGGER.log('INFO', '[metrics_helper] Start sending Anonymous Metric.');

  let data;

  try {
        const metrics = {
          Solution: solutionId,
          UUID: uuid,
          TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
          Data: metricsData
        };
        const params = {
          method: 'post',
          port: 443,
          url: metricsURL,
          headers: {
            'Content-Type': 'application/json'
          },
          data: metrics
        };
        data = await axios(params);
  }
  catch (err) {
    LOGGER.log('ERROR', err);
    throw err;
  }

  LOGGER.log('INFO', '[metrics_helper] End sending Anonymous Metric.');

  return data.status;
};


module.exports = {
  sendMetrics: SendMetrics
};