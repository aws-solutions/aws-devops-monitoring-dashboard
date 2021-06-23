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

import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as glue from '@aws-cdk/aws-glue';
import * as athena from '@aws-cdk/aws-athena';

export interface DatabaseProps {
  readonly solutionId: string;
  readonly uuid: string;
  readonly metricsBucket: s3.Bucket | undefined;
  readonly metricsBucketName: string | undefined;
}

export class Database extends cdk.Construct {
  public readonly metricsGlueDBName: string;
  public readonly metricsGlueTableName: string;
  public readonly metricsAthenaWGName: string;
  public readonly codeBuildMetricsGlueTableName: string;

  constructor(scope: cdk.Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    /**
     * Create AWS Glue database
     */
    const devopsMetricsGlueDB = new glue.Database(this, 'AWSDevopsMetricsGlueDatabase', {
      databaseName: 'aws_devops_metrics_db_' + props.solutionId.toLowerCase()
    });

    this.metricsGlueDBName = devopsMetricsGlueDB.databaseName;

    /**
     * Create AWS Glue table for CloudWatch Events
     */
    const devopsMetricsGlueTable =  new glue.Table(this, 'AWSDevopsMetricsGlueTable', {
      description: 'AWS DevOps Monitoring Dashboard Solution - AWS DevOps Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_devops_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'DevopsEvents/',
      storedAsSubDirectories: true,
      dataFormat: glue.DataFormat.PARQUET,
      columns: [{
        name: 'version',
        type: glue.Schema.STRING
      },
      {
        name: 'id',
        type: glue.Schema.STRING
      },
      {
        name: 'detail_type',
        type: glue.Schema.STRING
      },
      {
        name: 'source',
        type: glue.Schema.STRING
      },
      {
        name: 'account',
        type: glue.Schema.STRING
      },
      {
        name: 'time',
        type: glue.Schema.TIMESTAMP
      },
      {
        name: 'region',
        type: glue.Schema.STRING
      },
      {
        name: 'resources',
        type: glue.Schema.array(glue.Schema.STRING),
        comment: 'array<string>'
      },
      {
        name: 'detail',
        type: glue.Schema.struct([
        {
          name: 'eventName',
          type: glue.Schema.STRING
        },
        {
          name: 'repositoryName',
          type: glue.Schema.STRING
        },
        {
          name: 'branchName',
          type: glue.Schema.STRING
        },
        {
          name: 'authorName',
          type: glue.Schema.STRING
        },
        {
          name: 'commitId',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmName',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmAppName',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmRepoName',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmCurrState',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmPrevState',
          type: glue.Schema.STRING
        },
        {
          name: 'canaryAlarmCurrStateTimeStamp',
          type: glue.Schema.TIMESTAMP
        },
        {
          name: 'canaryAlarmPrevStateTimeStamp',
          type: glue.Schema.TIMESTAMP
        },
        {
          name: 'recoveryDurationMinutes',
          type: glue.Schema.INTEGER
        },
        {
          name: 'deploymentState',
          type: glue.Schema.STRING
        },
        {
          name: 'deploymentId',
          type: glue.Schema.STRING
        },
        {
          name: 'deploymentApplication',
          type: glue.Schema.STRING
        },
        {
          name: 'pipelineName',
          type: glue.Schema.STRING
        },
        {
          name: 'executionId',
          type: glue.Schema.STRING
        },
        {
          name: 'stage',
          type: glue.Schema.STRING
        },
        {
          name: 'action',
          type: glue.Schema.STRING
        },
        {
          name: 'state',
          type: glue.Schema.STRING
        },
        {
          name: 'externalExecutionId',
          type: glue.Schema.STRING
        },
        {
          name: 'actionCategory',
          type: glue.Schema.STRING
        },
        {
          name: 'actionOwner',
          type: glue.Schema.STRING
        },
        {
          name: 'actionProvider',
          type: glue.Schema.STRING
        }]
        ),
        comment: "struct<nested_column:datatype>"
      }],
      partitionKeys: [{
        name: 'created_at',
        type: glue.Schema.TIMESTAMP
      }],
    });

    this.metricsGlueTableName = devopsMetricsGlueTable.tableName;

    let glue_cfn_table_ref = devopsMetricsGlueTable.node.findChild('Table') as glue.CfnTable;

    glue_cfn_table_ref.addPropertyOverride("TableInput", {
    Parameters: {
      "EXTERNAL": "TRUE"
    }
    })

    /**
     * Create AWS Glue table for CloudWatch Metrics for CodeBuild
     */
    const codeBuildMetricsGlueTable =  new glue.Table(this, 'CodeBuildMetricsGlueTable', {
      description: 'AWS DevOps Monitoring Dashboard Solution - AWS CodeBuild Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_codebuild_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'CodeBuildEvents/',
      storedAsSubDirectories: true,
      dataFormat: glue.DataFormat.PARQUET,
      columns: [{
        name: 'metric_stream_name',
        type: glue.Schema.STRING
      },
      {
        name: 'account_id',
        type: glue.Schema.STRING
      },
      {
        name: 'region',
        type: glue.Schema.STRING
      },
      {
        name: 'namespace',
        type: glue.Schema.STRING
      },
      {
        name: 'metric_name',
        type: glue.Schema.STRING
      },
      {
        name: 'dimensions',
        type: glue.Schema.struct([
          {
            name: 'ProjectName',
            type: glue.Schema.STRING
          },
          {
            name: 'BuildId',
            type: glue.Schema.STRING
          },
          {
            name: 'BuildNumber',
            type: glue.Schema.INTEGER
          }
        ])
      },
      {
        name: 'timestamp',
        type: glue.Schema.BIG_INT
      },
      {
        name: 'value',
        type: glue.Schema.struct([
          {
            name: 'count',
            type: glue.Schema.DOUBLE
          },
          {
            name: 'sum',
            type: glue.Schema.DOUBLE
          },
          {
            name: 'max',
            type: glue.Schema.DOUBLE
          },
          {
            name: 'min',
            type: glue.Schema.DOUBLE
          }
        ]),
        comment: "struct<nested_column:datatype>"
      },
      {
        name: 'unit',
        type: glue.Schema.STRING
      }],
      partitionKeys: [{
        name: 'created_at',
        type: glue.Schema.TIMESTAMP
      }],
    });

   this.codeBuildMetricsGlueTableName = codeBuildMetricsGlueTable.tableName;

   let glue_cfn_codebuild_table_ref = codeBuildMetricsGlueTable.node.findChild('Table') as glue.CfnTable;

   glue_cfn_codebuild_table_ref.addPropertyOverride("TableInput", {
    Parameters: {
      "EXTERNAL": "TRUE"
    }
   })


   /**
    * Create Athena work group
    */
    const workgroupName = 'AWSDevOpsDashboardWG-' + props.uuid
    const devopsMetricsAthenaWorkGroup = new athena.CfnWorkGroup(this, "AWSDevOpsDashboardAthenaWorkGroup", {
      name: workgroupName,
      description: 'AWS DevOps Monitoring Dashboard Solution Athena Work Group',
      state: 'ENABLED',
      recursiveDeleteOption: true,
      workGroupConfiguration:{
        publishCloudWatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: 's3://' + props.metricsBucketName + '/athena_query_output/',
          encryptionConfiguration: {
            encryptionOption: 'SSE_S3'
          }
        },
        engineVersion : {
          selectedEngineVersion: "Athena engine version 2"
        }
      }
    })

    this.metricsAthenaWGName = devopsMetricsAthenaWorkGroup.name;

  }
}