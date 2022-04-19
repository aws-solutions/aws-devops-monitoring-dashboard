// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const index = require('../index');

jest.mock('../lib/metrics_helper', () => {
    return {
        __esmodule: true,
        sendMetrics: jest.fn().mockImplementation((solutionId, solutionUUID, data, metricsURL) => {
            expect(solutionId).toBe("SO0103");
            expect(solutionUUID).toBe("2820b493-864c-4ca1-99d3-7174fef7f374");
            expect(metricsURL).toBe("https://metrics-url.com")
        })
    }

}, { virtual: true })

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

jest.mock("../build_athena_query", () => {
    return {
        __esmodule: true,
        buildAddAthenaPartitionQuery: jest.fn().mockImplementation((athenaDB, athenaTable) => {
            expect(athenaDB).toBe("metrics_db")
            expect(athenaTable).toBe("metrics_table")
            //athenaCodeBuildTable "aws_codebuild_metrics_table"
            return "queryString";
        })
    }
}, { virtual: true });

jest.mock("../lib/cfn", () => {
    return {
        __esmodule: true,
        send: jest.fn().mockReturnValue({

        })
    }
}, { virual: true })

jest.mock("aws-sdk", () => {
    return {
        __esmodule: true,
        Glue: jest.fn().mockImplementation((options) => {
            expect(options.customUserAgent).toBe("/AwsSolutions/SO0103/v1.2.0")
            return {
                deletePartition: jest.fn().mockImplementation((data) => {
                    expect(data.DatabaseName).toBe("metrics_db")
                    expect(data.TableName).toBe("metrics_table")
                    const date = new Date()
                    const expectedDate = date.toISOString().substring(0, 10)
                    expect(data.PartitionValues[0]).toBe(expectedDate)
                    return {
                        promise: jest.fn().mockImplementation(() => {
                            return Promise.resolve({})
                        })
                    }
                })
            }
        })
    }
}, { virual: true })

describe("Test index", () => {
    test('handle Create', async () => {
        await index.handler({
            ResourceType: 'Custom::QueryRunner',
            RequestType: 'Create'
        }, {});
    })
    test('handle Update', async () => {
        await index.handler({
            ResourceType: 'Custom::QueryRunner',
            RequestType: 'Update',
            ResourceProperties: {
                MetricsDBName: "metrics_db",
                MetricsTableName: "metrics_table"
            }
        }, {});
    })
})