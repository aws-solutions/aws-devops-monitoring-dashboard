// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { ResourceGroupsTaggingAPIClient, GetResourcesCommand } = require('@aws-sdk/client-resource-groups-tagging-api');
const { mockClient } = require('aws-sdk-client-mock');
const { TagConfig, ResourceTypes, CodeCommitResourceInfo } = require('../lib/resource_info');
const { TagQueryEngine } = require('../tag_query');

process.env.LOG_LEVEL = 'DEBUG';

// jest.mock('aws-sdk', () => ({
//   __esmodule: true,
//   ResourceGroupsTaggingAPI: jest.fn()
// }));

describe('Test TagQueryEngine', () => {
  const mockResourceGroupsTaggingAPIClient = mockClient(ResourceGroupsTaggingAPIClient);

  beforeEach(() => {
    mockResourceGroupsTaggingAPIClient.reset();
  });

  test('handle no tag configurations', async () => {
    const queryEngine = new TagQueryEngine([]);
    expect(await queryEngine.getResources()).toEqual([]);
  });

  test('handle single tag configuration, no resource', async () => {
    mockResourceGroupsTaggingAPIClient
      .on(GetResourcesCommand, {
        TagFilters: [{ Key: 'env', Values: ['prod'] }],
        ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
      })
      .resolves({
        PaginationToken: '',
        ResourceTagMappingList: []
      });

    const queryEngine = new TagQueryEngine([new TagConfig(ResourceTypes.CodeCommitRepository, 'env,prod')]);
    expect(await queryEngine.getResources()).toEqual([]);
  });

  test('handle single tag configuration', async () => {
    const arn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo';
    const tags = [{ Key: 'env', Value: 'prod' }];

    mockResourceGroupsTaggingAPIClient.on(GetResourcesCommand).resolves({
      PaginationToken: '',
      ResourceTagMappingList: [
        {
          ComplianceDetails: {
            ComplianceStatus: true,
            KeysWithNoncompliantValues: [],
            NoncompliantKeys: []
          },
          ResourceARN: arn,
          Tags: tags
        }
      ]
    });

    const filter = 'env,prod';
    const queryEngine = new TagQueryEngine([new TagConfig(ResourceTypes.CodeCommitRepository, filter)]);
    expect(await queryEngine.getResources()).toEqual([new CodeCommitResourceInfo(arn, tags, filter)]);
  });

  test('handle multiple tag configurations', async () => {
    const arn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo';
    const tags = [{ Key: 'env', Value: 'prod' }];

    const resourceType = {
      TagFilters: [{ Key: 'env', Values: ['prod'] }],
      ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
    };

    mockResourceGroupsTaggingAPIClient
      .on(GetResourcesCommand, {
        TagFilters: [{ Key: 'env', Values: ['prod'] }],
        ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
      })
      .resolvesOnce({
        PaginationToken: '',
        ResourceTagMappingList: [
          {
            ComplianceDetails: {
              ComplianceStatus: true,
              KeysWithNoncompliantValues: [],
              NoncompliantKeys: []
            },
            ResourceARN: arn,
            Tags: tags
          }
        ]
      })
      .on(GetResourcesCommand, {
        TagFilters: [{ Key: 'env', Values: ['prod'] }],
        ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
      })
      .resolves({
        PaginationToken: '',
        ResourceTagMappingList: []
      });

    const filter = 'env,prod';
    const queryEngine = new TagQueryEngine([
      new TagConfig(ResourceTypes.CodeCommitRepository, filter),
      new TagConfig(ResourceTypes.CodeBuildProject, filter)
    ]);
    expect(await queryEngine.getResources()).toEqual([new CodeCommitResourceInfo(arn, tags, filter)]);
  });

  test('handle paginated response', async () => {
    const firstArn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo';
    const secondArn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo2';
    const tags = [{ Key: 'env', Value: 'prod' }];
    const token = 'a_token';

    mockResourceGroupsTaggingAPIClient
      .on(GetResourcesCommand, {
        TagFilters: [{ Key: 'env', Values: ['prod'] }],
        ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
      })
      .resolvesOnce({
        PaginationToken: token,
        ResourceTagMappingList: [
          {
            ComplianceDetails: {
              ComplianceStatus: true,
              KeysWithNoncompliantValues: [],
              NoncompliantKeys: []
            },
            ResourceARN: firstArn,
            Tags: tags
          }
        ]
      })
      .on(GetResourcesCommand, {
        TagFilters: [{ Key: 'env', Values: ['prod'] }],
        ResourceTypeFilters: [ResourceTypes.CodeCommitRepository],
        PaginationToken: token
      })
      .resolves({
        PaginationToken: '',
        ResourceTagMappingList: [
          {
            ComplianceDetails: {
              ComplianceStatus: true,
              KeysWithNoncompliantValues: [],
              NoncompliantKeys: []
            },
            ResourceARN: secondArn,
            Tags: tags
          }
        ]
      });

    const filter = 'env,prod';
    const queryEngine = new TagQueryEngine([new TagConfig(ResourceTypes.CodeCommitRepository, filter)]);
    expect(await queryEngine.getResources()).toEqual(
      expect.arrayContaining([
        new CodeCommitResourceInfo(firstArn, tags, filter),
        new CodeCommitResourceInfo(secondArn, tags, filter)
      ])
    );
  });
});
