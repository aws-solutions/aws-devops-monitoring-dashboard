// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

"use strict";

const expect = require("chai").expect;
const { buildDataDurationQuery } = require("../build_athena_query");
const queryRunner = require("../build_athena_query");

const athenaDB = "testAthenaDB";
const athenaTable = "testAthenaTable";
const athenaView = "testView";
const dataDuration = 90;

function generateQueryString(currentTimeStamp) {
    const year = currentTimeStamp.getFullYear();
    const month = currentTimeStamp.getMonth() + 1;
    const day = currentTimeStamp.getDate();

    const queryString = `ALTER TABLE ${athenaDB}.${athenaTable}
        ADD IF NOT EXISTS
        PARTITION(
            created_at = '${year.toString()}-${month.toString() < 10 ? "0" : ""}${month.toString()}-${day.toString() < 10 ? "0" : ""}${day.toString()}'
        )`;

    return queryString;
}

describe("When testing query builder", () => {
    let queryString, expectedQueryString;

    beforeAll(() => {
        jest.useFakeTimers("modern");
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("should expect matching query for adding athena partitions (pad month/day)", () => {
        jest.setSystemTime(new Date(2020, 1, 1));

        expectedQueryString = generateQueryString(new Date());

        queryString = queryRunner.buildAddAthenaPartitionQuery(athenaDB, athenaTable);

        console.log("Generated query string: " + queryString);
        console.log("Expected query string: " + expectedQueryString);

        expect(queryString).to.equal(expectedQueryString);
    });

    it("should expect matching query for adding athena partitions (don't pad month/day)", () => {
        jest.setSystemTime(new Date(2020, 10, 10));

        expectedQueryString = generateQueryString(new Date());
        queryString = queryRunner.buildAddAthenaPartitionQuery(athenaDB, athenaTable);

        console.log("Generated query string: " + queryString);
        console.log("Expected query string: " + expectedQueryString);

        expect(queryString).to.equal(expectedQueryString);
    });

    const codePipelineQueryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_pipeline_detail_view AS
        SELECT account, time, region,
        detail.pipelineName as pipeline_name,
        detail.executionId as execution_id,
        detail.stage as stage,
        detail.action as action, 
        detail.state as state,
        detail.externalExecutionId as external_execution_id,
        detail.actionCategory as action_category,
        detail.actionOwner as action_owner,
        detail.actionProvider as action_provider,
        created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.codepipeline' 
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date;`;

    it("should build the code pipeline query", () => {
        const response = queryRunner.buildCodePipelineQuery(athenaDB, athenaTable, dataDuration);
        expect(response).to.equal(codePipelineQueryString);
    });

    const codeBuildQueryString = `CREATE OR REPLACE VIEW ${athenaDB}.code_build_detail_view AS
        SELECT account_id as account, region, namespace, metric_name, timestamp,
        dimensions.ProjectName as project_name, dimensions.BuildId as build_id,
        dimensions.BuildNumber as build_number, value.count as count, value.sum as sum, 
        value.max as max, value.min as min, unit, created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE namespace = 'AWS/CodeBuild' 
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date;`;

    it("should build the code build query", () => {
        const response = queryRunner.buildCodeBuildQuery(athenaDB, athenaTable, dataDuration);
        expect(response).to.equal(codeBuildQueryString);
    });

    const codeChangeActivity = `CREATE OR REPLACE VIEW ${athenaDB}.code_change_activity_view AS
        SELECT account, time, region,
        detail.eventName as event_name,
        detail.repositoryName as repository_name,
        detail.branchName as branch_name, 
        detail.authorName as author_name,
        detail.commitId as commit_id,
        created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.codecommit'
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date
            ;`;

    const includedRepositoryList = "IncludedRepositoryList";
    const codeChangeActivityIncluded = `CREATE OR REPLACE VIEW ${athenaDB}.code_change_activity_view AS
        SELECT account, time, region,
        detail.eventName as event_name,
        detail.repositoryName as repository_name,
        detail.branchName as branch_name, 
        detail.authorName as author_name,
        detail.commitId as commit_id,
        created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.codecommit'
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date
            AND detail.repositoryName in (${includedRepositoryList});`;

    it("should build the code change activity query", () => {
        const response = queryRunner.buildCodeChangeActivityQuery(athenaDB, athenaTable, "", dataDuration);
        expect(response).to.equal(codeChangeActivity);
    });

    it("should build the code change activity query with includedRepositoryList = 'ALL'", () => {
        const response = queryRunner.buildCodeChangeActivityQuery(athenaDB, athenaTable, "'ALL'", dataDuration);
        expect(response).to.equal(codeChangeActivity);
    });

    it("should build the code change activity query with includedRepositoryList = IncludedRepoList", () => {
        const response = queryRunner.buildCodeChangeActivityQuery(athenaDB, athenaTable, includedRepositoryList, dataDuration);
        expect(response).to.equal(codeChangeActivityIncluded);
    });

    const buildRecoveryTimeQuery = `CREATE OR REPLACE VIEW ${athenaDB}.recovery_time_detail_view AS
        SELECT account, time, region,
        detail.canaryAlarmName as alarm_name,
        detail.alarmType as alarm_type,
        detail.canaryAlarmAppName as application_name,
        detail.canaryAlarmRepoName as repository_name,
        detail.canaryAlarmCurrState as current_state,
        detail.canaryAlarmPrevState as previous_state,
        detail.canaryAlarmCurrStateTimeStamp as current_state_timestamp,
        detail.canaryAlarmPrevStateTimeStamp as previous_state_timestamp,
        detail.recoveryDurationMinutes as duration_minutes, created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.cloudwatch' 
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date;`;

    it("should build the recover time query", () => {
        const response = queryRunner.buildRecoveryTimeQuery(athenaDB, athenaTable, dataDuration);
        expect(response).to.equal(buildRecoveryTimeQuery);
    });

    const expectedDeploymentQuery = `CREATE OR REPLACE VIEW ${athenaDB}.code_deployment_detail_view AS
        SELECT account, time, region,
        detail.deploymentId as deployment_id,
        detail.deploymentApplication as application,
        detail.deploymentState as state,
        created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE source = 'aws.codedeploy' 
            AND created_at between date_add('day', -${dataDuration}, current_date) and current_date;`;

    it("should build the deployment query", () => {
        const response = queryRunner.buildDeploymentQuery(athenaDB, athenaTable, dataDuration);
        expect(response).to.equal(expectedDeploymentQuery);
    });

    const expectedDropViewQuery = `DROP VIEW IF EXISTS ${athenaDB}.${athenaView};`;

    it("should build the drop view query", () => {
        const response = queryRunner.buildDropViewQuery(athenaDB, athenaView);
        expect(response).to.equal(expectedDropViewQuery);
    });

    const expectedGitHubQuery = `CREATE OR REPLACE VIEW ${athenaDB}.github_change_activity_view AS
        SELECT repository_name, branch_name, author_name, event_name, cast(cardinality(commit_id) as int) as commit_count, time, created_at
        FROM ${athenaDB}.${athenaTable}
        WHERE created_at between date_add('day', -${dataDuration}, current_date) and current_date;`;

    it("should build the github query", () => {
        const response = queryRunner.buildGitHubQuery(athenaDB, athenaTable, dataDuration);
        expect(response).to.equal(expectedGitHubQuery);
    });
});
