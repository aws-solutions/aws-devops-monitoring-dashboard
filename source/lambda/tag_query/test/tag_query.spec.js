// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const AWS = require('aws-sdk');
const { TagConfig, ResourceTypes, CodeCommitResourceInfo } = require('../lib/resource_info');
const { TagQueryEngine } = require('../tag_query');

jest.mock('aws-sdk', () => ({
  __esmodule: true,
  ResourceGroupsTaggingAPI: jest.fn()
}));

describe('Test TagQueryEngine', () => {
  test('handle no tag configurations', async () => {
    const queryEngine = new TagQueryEngine([]);
    expect(await queryEngine.getResources()).toEqual([]);
  });

  test('handle single tag configuration, no resource', async () => {
    AWS.ResourceGroupsTaggingAPI.mockImplementation(() => ({
      getResources: params => {
        expect(params).toEqual({
          TagFilters: [{ Key: 'env', Values: ['prod'] }],
          ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
        });
        return { promise: () => ({ PaginationToken: '', ResourceTagMappingList: [] }) };
      }
    }));
    const queryEngine = new TagQueryEngine([new TagConfig(ResourceTypes.CodeCommitRepository, 'env,prod')]);
    expect(await queryEngine.getResources()).toEqual([]);
  });

  test('handle single tag configuration', async () => {
    const arn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo';
    const tags = [{ Key: 'env', Value: 'prod' }];
    AWS.ResourceGroupsTaggingAPI.mockImplementation(() => ({
      getResources: params => {
        expect(params).toEqual({
          TagFilters: [{ Key: 'env', Values: ['prod'] }],
          ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
        });
        return {
          promise: () => ({
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
        };
      }
    }));
    const filter = 'env,prod';
    const queryEngine = new TagQueryEngine([new TagConfig(ResourceTypes.CodeCommitRepository, filter)]);
    expect(await queryEngine.getResources()).toEqual([new CodeCommitResourceInfo(arn, tags, filter)]);
  });

  test('handle multiple tag configurations', async () => {
    const arn = 'arn:aws:codecommit:us-east-1:111111111111:test-repo';
    const tags = [{ Key: 'env', Value: 'prod' }];
    AWS.ResourceGroupsTaggingAPI.mockImplementation(() => ({
      getResources: params => {
        expect([
          {
            TagFilters: [{ Key: 'env', Values: ['prod'] }],
            ResourceTypeFilters: [ResourceTypes.CodeCommitRepository]
          },
          {
            TagFilters: [{ Key: 'env', Values: ['dev'] }],
            ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
          }
        ]).toContainEqual(params);
        const resourceType = params.ResourceTypeFilters[0];
        return {
          promise: () =>
            ({
              [ResourceTypes.CodeCommitRepository]: {
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
              },
              [ResourceTypes.CodeBuildProject]: { PaginationToken: '', ResourceTagMappingList: [] }
            }[resourceType])
        };
      }
    }));
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
    AWS.ResourceGroupsTaggingAPI.mockImplementation(() => ({
      getResources: params => ({
        promise: () => {
          if (params.PaginationToken === token) {
            return {
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
            };
          } else {
            return {
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
            };
          }
        }
      })
    }));
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
