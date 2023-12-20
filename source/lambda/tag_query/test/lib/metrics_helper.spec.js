// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');
const expect = require('chai').expect;
const MockAdapter = require('axios-mock-adapter');

let metricsHelper = require('../../lib/metrics_helper.js');

const solutionId = 'SO0000';
const uuid = '999-999';
const metricsURL = 'https://metrics.awssolutionsbuilder.com/generic';

const data = {
  version: 'v1',
  data_type: 'lambda',
  region: 'us-east-1'
};

describe('#SEND METRICS', () => {
  it('should return "200" on a send metrics success', async () => {
    let mock = new MockAdapter(axios);
    mock.onPost().reply(200, {});

    let response = await metricsHelper.sendMetrics(solutionId, uuid, data, metricsURL);
    expect(response).to.equal(200);
  });

  it('should return "Network Error" on connection timeout', async () => {
    let mock = new MockAdapter(axios);
    mock.onPut().networkError();

    await metricsHelper.sendMetrics(solutionId, uuid, data, metricsURL).catch(err => {
      expect(err.toString()).to.equal('Error: Request failed with status code 404');
    });
  });
});
