/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

'use strict';

const expect = require('chai').expect;
const queryRunner = require('../build_athena_query');

const athenaDB = 'testAthenaDB'
const athenaTable = 'testAthenaTable'
const athenaView = 'testView'
const currentTimeStamp = new Date()
const year = currentTimeStamp.getFullYear()
const month = currentTimeStamp.getMonth() + 1
const day = currentTimeStamp.getDate()
const hour = currentTimeStamp.getHours()

let expectedQueryString =
    'ALTER TABLE ' + athenaDB + '.' + athenaTable + '\n' +
    'ADD IF NOT EXISTS' + '\n' +
    "PARTITION (\n" +
    "\tcreated_at = '" + year.toString() + "-" +
    (month.toString() < 10 ? '0' : '') + month.toString() + "-" +
    (day.toString() < 10 ? '0' : '') + day.toString() + "');"

describe('When testing query builder', () => {

    let queryString;

    it('expect matching query for adding athena partitions', async () => {
        queryString = await queryRunner.buildAddAthenaPartitionQuery(athenaDB, athenaTable);

        console.log("Generated query string: " + queryString);
        console.log("Expected query string: " + expectedQueryString);

        expect(queryString).to.equal(expectedQueryString);

    });

    const codePipelineQueryString =
        'CREATE OR REPLACE VIEW ' + athenaDB + '.code_pipeline_detail_view AS ' + '\n' +
        'SELECT account, time, region, ' + '\n' +
        'detail.pipelineName as pipeline_name, \n' +
        'detail.executionId as execution_id, \n' +
        'detail.stage as stage, ' + '\n' +
        'detail.action as action, ' + '\n' +
        'detail.state as state,' + '\n' +
        'detail.externalExecutionId as external_execution_id,' + '\n' +
        'detail.actionCategory as action_category,' + '\n' +
        'detail.actionOwner as action_owner,' + '\n' +
        'detail.actionProvider as action_provider,' + '\n' +
        'created_at' + '\n' +
        'FROM' + '\n' +
        athenaDB + '.' + athenaTable + '\n' +
        "WHERE source = 'aws.codepipeline'" + '\nAND' + " created_at between date_add('day', -90, current_date) and current_date;"

    it('code pipeline query', async () => {

        const response = await queryRunner.buildCodePipelineQuery(athenaDB, athenaTable, 90);
        expect(response).to.equal(codePipelineQueryString)
    });


    const codeBuildQueryString =
        'CREATE OR REPLACE VIEW ' + athenaDB + '.code_build_detail_view AS ' + '\n' +
        'SELECT account_id as account,' + '\n' +
        'region, namespace, metric_name, timestamp,' + '\n' +
        'dimensions.ProjectName as project_name,' + '\n' +
        'dimensions.BuildId as build_id,' + '\n' +
        'dimensions.BuildNumber as build_number,' + '\n' +
        'value.count as count,' + '\n' +
        'value.sum as sum,' + '\n' +
        'value.max as max,' + '\n' +
        'value.min as min,' + '\n' +
        'unit,' + '\n' +
        'created_at' + '\n' +
        'FROM' + '\n' +
        athenaDB + '.' + athenaTable + '\n' +
        "WHERE namespace = 'AWS/CodeBuild'" + '\nAND ' + "created_at between date_add('day', -90, current_date) and current_date;";

    it('code build query', async () => {

        const response = await queryRunner.buildCodeBuildQuery(athenaDB, athenaTable, 90);
        expect(response).to.equal(codeBuildQueryString)
    });


    const codeChangeActivity = 'CREATE OR REPLACE VIEW ' + athenaDB + '.code_change_activity_view AS ' + '\n' +
        'SELECT account, time, region, ' + '\n' +
        'detail.eventName as event_name, ' + '\n' +
        'detail.repositoryName as repository_name, ' + '\n' +
        'detail.branchName as branch_name, ' + '\n' +
        'detail.authorName as author_name, ' + '\n' +
        'detail.commitId as commit_id, ' + '\n' +
        'created_at' + '\n' +
        'FROM' + '\n' +
        athenaDB + '.' + athenaTable + '\n' +
        "WHERE source = 'aws.codecommit'" + "\nAND " + "created_at between date_add('day', -90, current_date) and current_date;"

    it('code change activity query', async () => {

        const response = await queryRunner.buildCodeChangeActivityQuery(athenaDB, athenaTable, "", 90);
        expect(response).to.equal(codeChangeActivity)
    });

    const buildRecoveryTimeQuery =             'CREATE OR REPLACE VIEW ' + athenaDB + '.recovery_time_detail_view AS ' + '\n' +
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
    "WHERE source = 'aws.cloudwatch'" + "\nAND " + "created_at between date_add('day', -90, current_date) and current_date;"

    it('recover time query', async() => {
        const response = await queryRunner.buildRecoveryTimeQuery(athenaDB, athenaTable, 90);
        expect(response).to.equal(buildRecoveryTimeQuery)
    })


    const expectedDeploymentQuery =         'CREATE OR REPLACE VIEW ' + athenaDB + '.code_deployment_detail_view AS ' + '\n' +
    'SELECT account, time, region, ' + '\n' +
    'detail.deploymentId as deployment_id, ' + '\n' +
    'detail.deploymentApplication as application, ' + '\n' +
    'detail.deploymentState as state,' + '\n' +
    'created_at' + '\n' +
    'FROM' + '\n' +
    athenaDB + '.' + athenaTable + '\n' +
    "WHERE source = 'aws.codedeploy'" + "\nAND " + "created_at between date_add('day', -90, current_date) and current_date;"

    it('recover time query', async() => {
        const response = await queryRunner.buildDeploymentQuery(athenaDB, athenaTable, 90);
        expect(response).to.equal(expectedDeploymentQuery)
    })

    const expectedDropViewQuery = 'DROP VIEW IF EXISTS '+ athenaDB + '.' + athenaView + ';'

    it('drop view', async () => {
        const response = await queryRunner.buildDropViewQuery(athenaDB, athenaView);
        expect(response).to.equal(expectedDropViewQuery)
    })


});