#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const ResourceTypes = {
  CodeCommitRepository: 'codecommit:repository',
  CodeBuildProject: 'codebuild:project',
  CodePipelinePipeline: 'codepipeline:pipeline'
};

function getServiceFromResourceType(resourceType) {
  return {
    [ResourceTypes.CodeCommitRepository]: 'CodeCommit',
    [ResourceTypes.CodeBuildProject]: 'CodeBuild',
    [ResourceTypes.CodePipelinePipeline]: 'CodePipeline'
  }[resourceType];
}

function getTypeFromResourceType(resourceType) {
  return {
    [ResourceTypes.CodeCommitRepository]: 'repository',
    [ResourceTypes.CodeBuildProject]: 'project',
    [ResourceTypes.CodePipelinePipeline]: 'pipeline'
  }[resourceType];
}

function getType(arn) {
  const service = arn.split(':')[2];
  switch (service) {
    case 'codecommit':
      return ResourceTypes.CodeCommitRepository;
    case 'codebuild':
      return ResourceTypes.CodeBuildProject;
    case 'codepipeline':
      return ResourceTypes.CodePipelinePipeline;
    default:
      throw new Error(`Unrecognized resource type: ${service}`);
  }
}

class TagConfig {
  static tagConfigSeparator = ';';
  static tagKeyValueSeparator = ',';

  constructor(resourceType, tagConfig) {
    this.resourceType = resourceType;
    this.tagConfig = tagConfig;
  }
}

class ResourceInfo {
  constructor(arn, tags, tagString) {
    this.service = 'Unknown';
    this.type = 'Unknown';
    this._arn = arn;
    this.account = this._arn.split(':')[4];
    this.tags = tags;
    // Store the tag filter string so that resources acquired using the same filter have the same value
    // This could also be generated with some extra work as long as we guarantee an ordering and know
    //   what tags were specified with optional values
    this.tagString = tagString;
    this.name = 'Unknown';
  }
}

class CodeCommitResourceInfo extends ResourceInfo {
  constructor(arn, tags, tagString) {
    super(arn, tags, tagString);
    this.service = 'CodeCommit';
    this.type = 'repository';
    // codecommit:repository arn: arn:${Partition}:codecommit:${Region}:${Account}:${RepositoryName}
    // RepositoryName regex: [\w\.-]{1,100}
    this.name = this._arn.substring(this._arn.lastIndexOf(':') + 1);
  }
}

class CodeBuildResourceInfo extends ResourceInfo {
  constructor(arn, tags, tagString) {
    super(arn, tags, tagString);
    this.service = 'CodeBuild';
    this.type = 'project';
    // codebuild:project arn: arn:${Partition}:codebuild:${Region}:${Account}:project/${ProjectName}
    // ProjectName regex: [A-Za-z0-9][A-Za-z0-9\-_]{1,254}
    this.name = this._arn.substring(this._arn.lastIndexOf('/') + 1);
  }
}

class CodePipelineResourceInfo extends ResourceInfo {
  constructor(arn, tags, tagString) {
    super(arn, tags, tagString);
    this.service = 'CodePipeline';
    this.type = 'pipeline';
    // codepipeline:pipeline arn: arn:${Partition}:codepipeline:${Region}:${Account}:${PipelineName}
    // PipelineName regex: [A-Za-z0-9.@\-_]{1,100}
    this.name = this._arn.substring(this._arn.lastIndexOf(':') + 1);
  }
}

function createResourceInfo(arn, tags, tagString) {
  const service = arn.split(':')[2];
  switch (service) {
    case 'codecommit':
      return new CodeCommitResourceInfo(arn, tags, tagString);
    case 'codebuild':
      return new CodeBuildResourceInfo(arn, tags, tagString);
    case 'codepipeline':
      return new CodePipelineResourceInfo(arn, tags, tagString);
    default:
      throw new Error(`Unrecognized resource type: ${service}`);
  }
}

exports.ResourceTypes = ResourceTypes;
exports.getServiceFromResourceType = getServiceFromResourceType;
exports.getTypeFromResourceType = getTypeFromResourceType;
exports.getType = getType;
exports.TagConfig = TagConfig;
exports.ResourceInfo = ResourceInfo;
exports.CodeCommitResourceInfo = CodeCommitResourceInfo;
exports.CodeBuildResourceInfo = CodeBuildResourceInfo;
exports.CodePipelineResourceInfo = CodePipelineResourceInfo;
exports.createResourceInfo = createResourceInfo;
