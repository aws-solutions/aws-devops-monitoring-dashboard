// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const githubIndex = require('../github_index');
const githubAuthorizer = require('../lib/github_authorizer');
const githubEvents = require('../github_events');
const { expect } = require('chai');

const validRecord = {
  recordId: '123456789',
  approximateArrivalTimestamp: 1646768972399,
  data: 'ewogICAgInJlcG9zaXRvcnlfbmFtZSI6ICJhd3MtaW50ZWdyYXRpb24tdGVzdCIsCiAgICAiYnJhbmNoX25hbWUiOiAibWFpbiIsCiAgICAiYXV0aG9yX25hbWUiOiAiRnJvZG8gQmFnZ2lucyIsCiAgICAidGltZSI6ICIyMDIyLTAxLTAxIDEyOjM0OjU2LjAwMCAiLAogICAgImV2ZW50X25hbWUiOiAicHVzaCIsCiAgICAiY29tbWl0X2lkIjogWyIyYmY4OTRkZTY4MTI4MzFlZWQwOTAxNTBkMjgyN2U4YWRjMTVlYjQwIl0KfQ=='
};

const invalidRecord = {
  recordId: '123456789',
  approximateArrivalTimestamp: 1646768972399,
  data: 'ewogICAgImJhZF9kYXRhIjogImF3cy1pbnRlZ3JhdGlvbi10ZXN0Igp9'
};

const event = {
  records: [validRecord]
};

const emptyEvent = {
  records: [invalidRecord]
};

const multiEvent = {
  records: [validRecord, validRecord, invalidRecord]
};

const nonsenseEvent = {
  records: [undefined]
};

jest.mock('../lib/github_authorizer');
githubAuthorizer.authorizeGitHubRequest.mockResolvedValue(true);

const transformedRecord = {
  repository_name: 'aws-integration-test',
  branch_name: 'main',
  author_name: 'Frodo Baggins',
  time: '2022-01-01 12:34:56.000 ',
  event_name: 'push',
  commit_id: ['2bf894de6812831eed090150d2827e8adc15eb40']
};
const transformedRecordString = JSON.stringify(transformedRecord);

const emptyTransformedRecord = {};

jest.mock('../github_events');
githubEvents.transformGitHubEvents.mockReturnValue(transformedRecord);

const okayRecord = {
  recordId: '123456789',
  result: 'Ok',
  data: new Buffer.from(transformedRecordString).toString('base64')
};
const unauthorizedRecord = { recordId: '123456789', result: 'Dropped', data: validRecord.data };
const droppedRecord = { recordId: '123456789', result: 'Dropped', data: invalidRecord.data };

const expectedRecords = { records: [okayRecord] };
const expectedUnauthorizedRecord = { records: [unauthorizedRecord] };
const expectedNonsenseRecord = { records: [undefined] };
const droppedRecords = { records: [droppedRecord] };
const expectedMultipleRecords = { records: [okayRecord, okayRecord, droppedRecord] };

describe('When testing github_index', () => {
  it('should transform a record using GitHub event transformation', async () => {
    const records = await githubIndex.handler(event, undefined, undefined);
    expect(records).to.eql(expectedRecords);
  });

  it('should skip a record if not authorized from github', async () => {
    githubAuthorizer.authorizeGitHubRequest.mockResolvedValueOnce(false);

    const records = await githubIndex.handler(event, undefined, undefined);
    expect(records).to.eql(expectedUnauthorizedRecord);
  });

  it('should drop an empty record', async () => {
    githubEvents.transformGitHubEvents.mockReturnValueOnce(emptyTransformedRecord);
    const records = await githubIndex.handler(emptyEvent, undefined, undefined);
    expect(records).to.eql(droppedRecords);
  });

  it('should create an undefined object if it throws an exception while parsing', async () => {
    const records = await githubIndex.handler(nonsenseEvent, undefined, undefined);
    expect(records).to.eql(expectedNonsenseRecord);
  });

  it('should transform multiple records using GitHub event transformation', async () => {
    githubEvents.transformGitHubEvents.mockReturnValueOnce(transformedRecord);
    githubEvents.transformGitHubEvents.mockReturnValueOnce(transformedRecord);
    githubEvents.transformGitHubEvents.mockReturnValueOnce(emptyTransformedRecord);
    const records = await githubIndex.handler(multiEvent, undefined, undefined);
    expect(records).to.eql(expectedMultipleRecords);
  });
});
