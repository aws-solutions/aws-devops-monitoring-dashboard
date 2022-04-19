// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Database, Table, DataFormat, Schema} from '@aws-cdk/aws-glue';
import { CfnWorkGroup } from '@aws-cdk/aws-athena';

export interface DatabaseProps {
  readonly solutionId: string;
  readonly uuid: string;
  readonly metricsBucket: Bucket | undefined;
  readonly metricsBucketName: string | undefined;
}

export class GlueDatabase extends Construct {
  public readonly metricsGlueDBName: string;
  public readonly metricsGlueTableName: string;
  public readonly metricsAthenaWGName: string;
  public readonly codeBuildMetricsGlueTableName: string;
  public readonly gitHubMetricsGlueTableName: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);


    /**
     * Create AWS Glue database
     */
    const devopsMetricsGlueDB = new Database(this, 'AWSDevopsMetricsGlueDatabase', {
      databaseName: 'aws_devops_metrics_db_' + props.solutionId.toLowerCase()
    });

    this.metricsGlueDBName = devopsMetricsGlueDB.databaseName;


    /**
     * Create AWS Glue table for CloudWatch Events for AWS CodeCommit, CodeDeploy, CodePipeline, CloudWatch Canary
     */
    const devopsMetricsGlueTable = new Table(this, 'AWSDevopsMetricsGlueTable', {
      description: 'AWS DevOps Monitoring Dashboard Solution - AWS DevOps Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_devops_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'DevopsEvents/',
      storedAsSubDirectories: true,
      dataFormat: DataFormat.PARQUET,
      columns: [{
        name: 'version',
        type: Schema.STRING
      },
      {
        name: 'id',
        type: Schema.STRING
      },
      {
        name: 'detail_type',
        type: Schema.STRING
      },
      {
        name: 'source',
        type: Schema.STRING
      },
      {
        name: 'account',
        type: Schema.STRING
      },
      {
        name: 'time',
        type: Schema.TIMESTAMP
      },
      {
        name: 'region',
        type: Schema.STRING
      },
      {
        name: 'resources',
        type: Schema.array(Schema.STRING),
        comment: 'array<string>'
      },
      {
        name: 'detail',
        type: Schema.struct([
          {
            name: 'eventName',
            type: Schema.STRING
          },
          {
            name: 'repositoryName',
            type: Schema.STRING
          },
          {
            name: 'branchName',
            type: Schema.STRING
          },
          {
            name: 'authorName',
            type: Schema.STRING
          },
          {
            name: 'commitId',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmName',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmAppName',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmRepoName',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmCurrState',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmPrevState',
            type: Schema.STRING
          },
          {
            name: 'canaryAlarmCurrStateTimeStamp',
            type: Schema.TIMESTAMP
          },
          {
            name: 'canaryAlarmPrevStateTimeStamp',
            type: Schema.TIMESTAMP
          },
          {
            name: 'recoveryDurationMinutes',
            type: Schema.INTEGER
          },
          {
            name: 'deploymentState',
            type: Schema.STRING
          },
          {
            name: 'deploymentId',
            type: Schema.STRING
          },
          {
            name: 'deploymentApplication',
            type: Schema.STRING
          },
          {
            name: 'pipelineName',
            type: Schema.STRING
          },
          {
            name: 'executionId',
            type: Schema.STRING
          },
          {
            name: 'stage',
            type: Schema.STRING
          },
          {
            name: 'action',
            type: Schema.STRING
          },
          {
            name: 'state',
            type: Schema.STRING
          },
          {
            name: 'externalExecutionId',
            type: Schema.STRING
          },
          {
            name: 'actionCategory',
            type: Schema.STRING
          },
          {
            name: 'actionOwner',
            type: Schema.STRING
          },
          {
            name: 'actionProvider',
            type: Schema.STRING
          },
          {
            name: 'alarmType',
            type: Schema.STRING
          }]
        ),
        comment: "struct<nested_column:datatype>"
      }],
      partitionKeys: [{
        name: 'created_at',
        type: Schema.TIMESTAMP
      }],
    });

    this.metricsGlueTableName = devopsMetricsGlueTable.tableName;
    

    /**
     * Create AWS Glue table for CloudWatch Metrics for CodeBuild
     */
    const codeBuildMetricsGlueTable = new Table(this, 'CodeBuildMetricsGlueTable', {
      description: 'AWS DevOps Monitoring Dashboard Solution - AWS CodeBuild Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_codebuild_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'CodeBuildEvents/',
      storedAsSubDirectories: true,
      dataFormat: DataFormat.PARQUET,
      columns: [{
        name: 'metric_stream_name',
        type: Schema.STRING
      },
      {
        name: 'account_id',
        type: Schema.STRING
      },
      {
        name: 'region',
        type: Schema.STRING
      },
      {
        name: 'namespace',
        type: Schema.STRING
      },
      {
        name: 'metric_name',
        type: Schema.STRING
      },
      {
        name: 'dimensions',
        type: Schema.struct([
          {
            name: 'ProjectName',
            type: Schema.STRING
          },
          {
            name: 'BuildId',
            type: Schema.STRING
          },
          {
            name: 'BuildNumber',
            type: Schema.INTEGER
          }
        ])
      },
      {
        name: 'timestamp',
        type: Schema.BIG_INT
      },
      {
        name: 'value',
        type: Schema.struct([
          {
            name: 'count',
            type: Schema.DOUBLE
          },
          {
            name: 'sum',
            type: Schema.DOUBLE
          },
          {
            name: 'max',
            type: Schema.DOUBLE
          },
          {
            name: 'min',
            type: Schema.DOUBLE
          }
        ]),
        comment: "struct<nested_column:datatype>"
      },
      {
        name: 'unit',
        type: Schema.STRING
      }],
      partitionKeys: [{
        name: 'created_at',
        type: Schema.TIMESTAMP
      }],
    });

    this.codeBuildMetricsGlueTableName = codeBuildMetricsGlueTable.tableName;


    /**
     * Create AWS Glue table for GitHub Metrics
     */
    const gitHubMetricsGlueTable = new Table(this, 'GitHubMetricsGlueTable', {
      description: 'AWS DevOps Monitoring Dashboard Solution - GitHub Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_github_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'GitHubEvents/',
      storedAsSubDirectories: true,
      dataFormat: DataFormat.PARQUET,
      columns: [{
        name: 'repository_name',
        type: Schema.STRING
      },
      {
        name: 'branch_name',
        type: Schema.STRING
      },
      {
        name: 'author_name',
        type: Schema.STRING
      },
      {
        name: 'event_name',
        type: Schema.STRING
      },
      {
        name: 'commit_id',
        type: Schema.array(Schema.STRING),
        comment: 'array<string>'
      },
      {
        name: 'time',
        type: Schema.TIMESTAMP
      }],
      partitionKeys: [{
        name: 'created_at',
        type: Schema.TIMESTAMP
      }],
    });

    this.gitHubMetricsGlueTableName = gitHubMetricsGlueTable.tableName;


    /**
    * Create Athena work group
    */
    const workgroupName = 'AWSDevOpsDashboardWG-' + props.uuid
    const devopsMetricsAthenaWorkGroup = new CfnWorkGroup(this, "AWSDevOpsDashboardAthenaWorkGroup", {
      name: workgroupName,
      description: 'AWS DevOps Monitoring Dashboard Solution Athena Work Group',
      state: 'ENABLED',
      recursiveDeleteOption: true,
      workGroupConfiguration: {
        publishCloudWatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: 's3://' + props.metricsBucketName + '/athena_query_output/',
          encryptionConfiguration: {
            encryptionOption: 'SSE_S3'
          }
        },
        engineVersion: {
          selectedEngineVersion: "Athena engine version 2"
        }
      }
    })

    this.metricsAthenaWGName = devopsMetricsAthenaWorkGroup.name;

  }
}