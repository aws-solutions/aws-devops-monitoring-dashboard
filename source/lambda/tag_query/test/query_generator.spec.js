// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const {
  generateQueriesForIntersection,
  generateQueriesForUnion,
  generateTagFilters
} = require('../lib/query_generator');
const { TagConfig, ResourceTypes } = require('../lib/resource_info');

describe('Test query generation for union', () => {
  test('No tag configs', () => {
    const result = generateQueriesForUnion([]);
    expect(result).toStrictEqual([]);
  });

  test('Empty tag config', async () => {
    const result = generateQueriesForUnion([new TagConfig(ResourceTypes.CodeCommitRepository, '')]);
    expect(result).toStrictEqual([]);
  });

  test('Single tag config', () => {
    const result = generateQueriesForUnion([
      new TagConfig(ResourceTypes.CodeBuildProject, 'key1,value1;key2,value2;key3,value3')
    ]);
    expect(result).toStrictEqual([
      {
        TagFilters: [{ Key: 'key1', Values: ['value1'] }],
        ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
      },
      {
        TagFilters: [{ Key: 'key2', Values: ['value2'] }],
        ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
      },
      {
        TagFilters: [{ Key: 'key3', Values: ['value3'] }],
        ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
      }
    ]);
  });
});

describe('Test query generation for intersection', () => {
  test('No tag configs', () => {
    const result = generateQueriesForIntersection([]);
    expect(result).toStrictEqual([]);
  });

  test('Empty tag config', async () => {
    const result = generateQueriesForIntersection([new TagConfig(ResourceTypes.CodeCommitRepository, '')]);
    expect(result).toStrictEqual([]);
  });

  test('Single tag config', () => {
    const result = generateQueriesForIntersection([
      new TagConfig(ResourceTypes.CodeBuildProject, 'key1,value1;key2,value2;key3,value3')
    ]);
    expect(result).toStrictEqual([
      {
        TagFilters: [
          { Key: 'key1', Values: ['value1'] },
          { Key: 'key2', Values: ['value2'] },
          { Key: 'key3', Values: ['value3'] }
        ],
        ResourceTypeFilters: [ResourceTypes.CodeBuildProject]
      }
    ]);
  });
});

describe('Test generating tag filters', () => {
  test('No tag configs', () => {
    const result = generateTagFilters([]);
    expect(result).toStrictEqual({});
  });

  test('Single resource type', () => {
    const result = generateTagFilters([
      new TagConfig(ResourceTypes.CodeCommitRepository, 'firstKey,firstValue;secondKey,secondValue')
    ]);
    expect(result).toStrictEqual({ [ResourceTypes.CodeCommitRepository]: new Set(['firstKey', 'secondKey']) });
  });

  test('All resource types, overlapping keys', () => {
    const result = generateTagFilters([
      new TagConfig(ResourceTypes.CodeCommitRepository, 'k1,v1;k2,v2;k3,v3'),
      new TagConfig(ResourceTypes.CodeBuildProject, 'k4,v4;k2,v2'),
      new TagConfig(ResourceTypes.CodePipelinePipeline, 'k1,v1')
    ]);
    expect(result).toStrictEqual({
      [ResourceTypes.CodeCommitRepository]: new Set(['k1', 'k2', 'k3']),
      [ResourceTypes.CodeBuildProject]: new Set(['k4', 'k2']),
      [ResourceTypes.CodePipelinePipeline]: new Set(['k1'])
    });
  });
});
