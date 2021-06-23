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

const add_athena_partition = require('../add_athena_partition');

jest.mock("aws-sdk", () => {
    return {
        __esmodule: true,
        CloudWatch: jest.fn().mockReturnValue({
            getMetricStatistics: jest.fn().mockImplementation((data) => {
                console.log("inside the cloudwatch getMetricsStatistics method")
                expect(data["Namespace"]).toBe("AWS/Athena")
                expect(data["Dimensions"][0]["Name"]).toBe("QueryState")
                expect(data["Dimensions"][0]["Value"]).toBe("SUCCEEDED")
                expect(data["Dimensions"][1]["Name"]).toBe("QueryType")
                expect(data["Dimensions"][1]["Value"]).toBe("DML")
                expect(data["Dimensions"][2]["Name"]).toBe("WorkGroup")
                expect(data["Dimensions"][2]["Value"]).toBe('AWSDevOpsDashboardWG-2820b493-864c-4ca1-99d3-7174fef7f374')
            })
        }),

        Athena: jest.fn().mockImplementation((options) => {

        })
    }
}, { virtual: true });

jest.mock("../build_athena_query", () => {
    return {
        __esmodule: true,
        buildAddAthenaPartitionQuery: jest.fn().mockImplementation((athenaDB, athenaTable) => {
            expect(athenaDB).toBe("metrics_db")
            expect(athenaTable).toBe("metrics_table")
            return "queryString";
        })
    }
}, { virtual: true });

jest.mock("../lib/execute_athena_query", () => {
    return {
        __esmodule: true,
        executeAthenaQuery: jest.fn().mockImplementation((athenaDB, athenaWorkGroup, queryString) => {
            expect(queryString).toBe("queryString");
            expect(athenaDB).toBe("metrics_db")
            expect(athenaWorkGroup).toBe("AWSDevOpsDashboardWG-2820b493-864c-4ca1-99d3-7174fef7f374");
        })
    }
}, { virtual: true });

jest.mock('../lib/metrics_helper', () => {
    return {
        __esmodule: true,
        sendMetrics: jest.fn().mockImplementation((solutionId, solutionUUID, data, metricsURL) => {
            expect(solutionId).toBe("SO0103");
            expect(solutionUUID).toBe("2820b493-864c-4ca1-99d3-7174fef7f374");
            expect(metricsURL).toBe("https://metrics-url.com")
        })
    }

}, { virtual: true} )

describe('Test suite for add athena partition.', () => {

    test('add partition', async () => {
        await add_athena_partition.handler();
    })
})