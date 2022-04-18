// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');
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
          //Formatting the time string to the format 'YYYY-MM-DD HH:mm:ss.S'
          TimeStamp: new Date().toISOString().replace('T', ' ').replace('Z', ' ').substring(0, 21),
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