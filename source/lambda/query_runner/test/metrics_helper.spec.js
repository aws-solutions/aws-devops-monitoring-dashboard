/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
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
const expect = require('chai').expect;
const MockAdapter = require('axios-mock-adapter');

let metricsHelper = require('../lib/metrics_helper.js');

const solutionId = 'SO0000'
const uuid = '999-999'
const metricsURL = 'https://metrics.awssolutionsbuilder.com/generic'

const data = {
  version: 'v1',
  data_type: 'lambda',
  region: 'us-east-1'
};

describe('#SEND METRICS', () => {

	it('should return "200" on a send metrics sucess', async () => {

		let mock = new MockAdapter(axios);
		mock.onPost().reply(200, {});

		let response = await metricsHelper.sendMetrics(solutionId, uuid, data, metricsURL)
		expect(response).to.equal(200);
	});

	it('should return "Network Error" on connection timedout', async () => {

		let mock = new MockAdapter(axios);
		mock.onPut().networkError();

		await metricsHelper.sendMetrics(solutionId, uuid, data, metricsURL).catch(err => {
			expect(err.toString()).to.equal("Error: Request failed with status code 404");
		});
	});

});
