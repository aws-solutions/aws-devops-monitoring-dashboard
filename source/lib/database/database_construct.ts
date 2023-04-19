// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Database, Table, DataFormat, Schema } from '@aws-cdk/aws-glue-alpha';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { NagSuppressions } from 'cdk-nag';

export interface DatabaseProps {
  readonly solutionId: string;
  readonly uuid?: string;
  readonly metricsBucket: Bucket | undefined;
  readonly metricsBucketName: string | undefined;
  readonly callingStack?: string;
}

export class GlueDatabase extends Construct {
  public readonly metricsGlueDBName: string;
  public readonly metricsGlueTableName: string;
  public readonly metricsAthenaWGName: string;
  public readonly codeBuildMetricsGlueTableName: string;
  public readonly gitHubMetricsGlueTableName: string;
  public readonly codeCommitTagsGlueTableName: string;
  public readonly codeBuildTagsGlueTableName: string;
  public readonly codePipelineTagsGlueTableName: string;

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
     * Create AWS Glue table for CloudWatch Metrics for CodeBuild
     */
    const codeBuildMetricsGlueTable = new Table(this, 'CodeBuildMetricsGlueTable', {
      description: 'DevOps Monitoring Dashboard on AWS solution - AWS CodeBuild Metrics Glue table',
      database: devopsMetricsGlueDB,
      tableName: 'aws_codebuild_metrics_table',
      bucket: props.metricsBucket,
      s3Prefix: 'CodeBuildEvents/',
      storedAsSubDirectories: true,
      dataFormat: DataFormat.PARQUET,
      columns: [
        {
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
          comment: 'struct<nested_column:datatype>'
        },
        {
          name: 'unit',
          type: Schema.STRING
        }
      ],
      partitionKeys: [
        {
          name: 'created_at',
          type: Schema.TIMESTAMP
        }
      ]
    });

    this.codeBuildMetricsGlueTableName = codeBuildMetricsGlueTable.tableName;

    /**
     * Create the following AWS Glue tables only in the central monitoring account
     */
    if (props.callingStack !== 'sharing') {
      /**
       * Create AWS Glue table for CloudWatch Events for AWS CodeCommit, CodeDeploy, CodePipeline, CloudWatch Canary
       */
      const devopsMetricsGlueTable = new Table(this, 'AWSDevopsMetricsGlueTable', {
        description: 'DevOps Monitoring Dashboard on AWS solution - AWS DevOps Metrics Glue table',
        database: devopsMetricsGlueDB,
        tableName: 'aws_devops_metrics_table',
        bucket: props.metricsBucket,
        s3Prefix: 'DevopsEvents/',
        storedAsSubDirectories: true,
        dataFormat: DataFormat.PARQUET,
        columns: [
          {
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
              }
            ]),
            comment: 'struct<nested_column:datatype>'
          }
        ],
        partitionKeys: [
          {
            name: 'created_at',
            type: Schema.TIMESTAMP
          }
        ]
      });

      this.metricsGlueTableName = devopsMetricsGlueTable.tableName;

      /**
       * Create AWS Glue table for tagged CodeCommit repositories
       */
      const codeCommitTagsGlueTable = new Table(this, 'CodeCommitTagsGlueTable', {
        description: 'DevOps Monitoring Dashboard on AWS solution - AWS CodeCommit Tags Glue table',
        database: devopsMetricsGlueDB,
        tableName: 'tagged_codecommit_table',
        bucket: props.metricsBucket,
        s3Prefix: 'TaggedResources/CodeCommit/',
        storedAsSubDirectories: true,
        dataFormat: DataFormat.JSON,
        columns: [
          {
            name: 'account_id',
            type: Schema.STRING
          },
          {
            name: 'region',
            type: Schema.STRING
          },
          {
            name: 'resource_type',
            type: Schema.STRING
          },
          {
            name: 'resource_name',
            type: Schema.STRING
          },
          {
            name: 'tag',
            type: Schema.STRING
          },
          {
            name: 'create_time_stamp',
            type: Schema.TIMESTAMP
          }
        ]
      });

      this.codeCommitTagsGlueTableName = codeCommitTagsGlueTable.tableName;

      /**
       * Create AWS Glue table for tagged CodeBuild projects
       */
      const codeBuildTagsGlueTable = new Table(this, 'CodeBuildTagsGlueTable', {
        description: 'DevOps Monitoring Dashboard on AWS solution - AWS CodeBuild Tags Glue table',
        database: devopsMetricsGlueDB,
        tableName: 'tagged_codebuild_table',
        bucket: props.metricsBucket,
        s3Prefix: 'TaggedResources/CodeBuild/',
        storedAsSubDirectories: true,
        dataFormat: DataFormat.JSON,
        columns: [
          {
            name: 'account_id',
            type: Schema.STRING
          },
          {
            name: 'region',
            type: Schema.STRING
          },
          {
            name: 'resource_type',
            type: Schema.STRING
          },
          {
            name: 'resource_name',
            type: Schema.STRING
          },
          {
            name: 'tag',
            type: Schema.STRING
          },
          {
            name: 'create_time_stamp',
            type: Schema.TIMESTAMP
          }
        ]
      });

      this.codeBuildTagsGlueTableName = codeBuildTagsGlueTable.tableName;

      /**
       * Create AWS Glue table for tagged CodePipelines
       */
      const codePipelineTagsGlueTable = new Table(this, 'CodePipelineTagsGlueTable', {
        description: 'DevOps Monitoring Dashboard on AWS solution - AWS CodePipeline Tags Glue table',
        database: devopsMetricsGlueDB,
        tableName: 'tagged_codepipeline_table',
        bucket: props.metricsBucket,
        s3Prefix: 'TaggedResources/CodePipeline/',
        storedAsSubDirectories: true,
        dataFormat: DataFormat.JSON,
        columns: [
          {
            name: 'account_id',
            type: Schema.STRING
          },
          {
            name: 'region',
            type: Schema.STRING
          },
          {
            name: 'resource_type',
            type: Schema.STRING
          },
          {
            name: 'resource_name',
            type: Schema.STRING
          },
          {
            name: 'tag',
            type: Schema.STRING
          },
          {
            name: 'create_time_stamp',
            type: Schema.TIMESTAMP
          }
        ]
      });

      this.codePipelineTagsGlueTableName = codePipelineTagsGlueTable.tableName;

      /**
       * Create AWS Glue table for GitHub Metrics
       */
      const gitHubMetricsGlueTable = new Table(this, 'GitHubMetricsGlueTable', {
        description: 'DevOps Monitoring Dashboard on AWS solution - GitHub Metrics Glue table',
        database: devopsMetricsGlueDB,
        tableName: 'aws_github_metrics_table',
        bucket: props.metricsBucket,
        s3Prefix: 'GitHubEvents/',
        storedAsSubDirectories: true,
        dataFormat: DataFormat.PARQUET,
        columns: [
          {
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
          }
        ],
        partitionKeys: [
          {
            name: 'created_at',
            type: Schema.TIMESTAMP
          }
        ]
      });

      this.gitHubMetricsGlueTableName = gitHubMetricsGlueTable.tableName;

      /**
       * Create Athena work group
       */
      const workgroupName = 'AWSDevOpsDashboardWG-' + props.uuid;
      const devopsMetricsAthenaWorkGroup = new CfnWorkGroup(this, 'AWSDevOpsDashboardAthenaWorkGroup', {
        name: workgroupName,
        description: 'DevOps Monitoring Dashboard on AWS solution Athena Work Group',
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
            selectedEngineVersion: 'Athena engine version 3'
          }
        }
      });

      this.metricsAthenaWGName = devopsMetricsAthenaWorkGroup.name;

      // Add cdk-nag suppression
      NagSuppressions.addResourceSuppressions(devopsMetricsAthenaWorkGroup, [
        {
          id: 'AwsSolutions-ATH1',
          reason: 'The Athena query result is encrypted using SSE_S3.'
        }
      ]);
    }
  }
}
