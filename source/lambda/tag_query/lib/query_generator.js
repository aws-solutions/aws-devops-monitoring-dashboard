#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { TagConfig } = require('./resource_info');

function generateQueriesForUnion(tagConfigs) {
  const queries = [];
  for (const tagConfig of tagConfigs) {
    const tags = tagConfig.tagConfig.length > 0 ? tagConfig.tagConfig.split(TagConfig.tagConfigSeparator) : [];
    for (const tag of tags) {
      const tagSplit = tag.split(TagConfig.tagKeyValueSeparator);
      const key = tagSplit[0];
      const value = tagSplit[1];

      const resourceTypeFilters = [tagConfig.resourceType];
      const tagFilters = [];
      tagFilters.push({ Key: key, Values: [value] });

      const params = {
        TagFilters: tagFilters,
        ResourceTypeFilters: resourceTypeFilters
      };
      queries.push(params);
    }
  }
  return queries;
}

function generateQueriesForIntersection(tagConfigs) {
  const queries = [];
  for (const tagConfig of tagConfigs) {
    const tags = tagConfig.tagConfig.length > 0 ? tagConfig.tagConfig.split(TagConfig.tagConfigSeparator) : [];
    const tagFilters = [];
    for (const tag of tags) {
      const tagSplit = tag.split(TagConfig.tagKeyValueSeparator);
      const key = tagSplit[0];
      const value = tagSplit[1];

      tagFilters.push({ Key: key, Values: [value] });
    }

    if (tagFilters.length === 0) {
      continue;
    }

    const resourceTypeFilters = [tagConfig.resourceType];
    const params = {
      TagFilters: tagFilters,
      ResourceTypeFilters: resourceTypeFilters
    };
    queries.push(params);
  }
  return queries;
}

// Generate the set of keys requested for each resource type, so that we can filter the tags that go into the report
function generateTagFilters(tagConfigs) {
  const filters = {};
  for (const tagConfig of tagConfigs) {
    const tags = tagConfig.tagConfig.length > 0 ? tagConfig.tagConfig.split(TagConfig.tagConfigSeparator) : [];
    for (const tag of tags) {
      const tagSplit = tag.split(TagConfig.tagKeyValueSeparator);
      const key = tagSplit[0];

      if (!(tagConfig.resourceType in filters)) {
        filters[tagConfig.resourceType] = new Set();
      }

      filters[tagConfig.resourceType].add(key);
    }
  }
  return filters;
}

exports.generateQueriesForUnion = generateQueriesForUnion;
exports.generateQueriesForIntersection = generateQueriesForIntersection;
exports.generateTagFilters = generateTagFilters;
