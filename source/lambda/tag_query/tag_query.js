#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { ResourceGroupsTaggingAPIClient, GetResourcesCommand } = require('@aws-sdk/client-resource-groups-tagging-api');
const { generateTagFilters, generateQueriesForIntersection } = require('./lib/query_generator');
const { createResourceInfo, getType } = require('./lib/resource_info');
const { Throttler } = require('./lib/throttler');
const LOGGER = new (require('./lib/logger'))();

class TagQueryEngine {
  constructor(tagConfigs) {
    this._tagStrings = {}; // When creating a resource info object, we need to know the original filter string
    tagConfigs.forEach(({ resourceType, tagConfig }) => Object.assign(this._tagStrings, { [resourceType]: tagConfig }));
    this._queries = generateQueriesForIntersection(tagConfigs);
    this._tagFilters = generateTagFilters(tagConfigs);
    this._tagApi = new ResourceGroupsTaggingAPIClient({ customUserAgent: process.env.USER_AGENT_EXTRA });
    this._throttler = new Throttler(1000);
    this._savedError = undefined;
  }

  async getResources() {
    const results = [];
    const uniqueArns = new Set();
    for (const params of this._queries) {
      LOGGER.log('INFO', `Querying: ${JSON.stringify(params)}`);
      try {
        const resources = await this._getResourcesPaginated(params);
        LOGGER.log('INFO', `Response: ${JSON.stringify(resources)}`);
        for (const resource of resources) {
          // A resource may be returned by multiple queries, only process it once
          const arn = resource.ResourceARN;
          if (uniqueArns.has(arn)) {
            continue;
          }

          // Get the original tag filter string
          const tagString = this._tagStrings[getType(arn)];

          // Only store data on the tag keys that we are interested in
          const tags = this._filterTags(arn, resource.Tags);
          results.push(createResourceInfo(arn, tags, tagString));
          uniqueArns.add(arn);
        }
      } catch (err) {
        LOGGER.log('ERROR', `Error querying tagging API with ${JSON.stringify(params)}: ${err}`);
        // Return information on as many resources as possible
        if (this._savedError === undefined) {
          // But persist an error if we encounter it so the caller can check for it
          this._savedError = err;
        }
      }
    }
    return results;
  }

  _filterTags(arn, tags) {
    const resourceType = getType(arn);
    const tagFilter = this._tagFilters[resourceType];
    return tags.filter(({ Key }) => tagFilter.has(Key));
  }

  async _getResourcesPaginated(params) {
    const resources = [];
    let response = await this._getResourcesThrottled(params);
    resources.push(...response.ResourceTagMappingList);
    while ('PaginationToken' in response && response.PaginationToken !== '') {
      params.PaginationToken = response.PaginationToken;
      response = await this._getResourcesThrottled(params);
      resources.push(...response.ResourceTagMappingList);
    }
    return resources;
  }

  async _getResourcesThrottled(params) {
    await this._throttler.ready();
    const command = new GetResourcesCommand(params);
    const response = await this._tagApi.send(command);
    return response;
  }

  getSavedError() {
    return this._savedError;
  }
}

exports.TagQueryEngine = TagQueryEngine;
