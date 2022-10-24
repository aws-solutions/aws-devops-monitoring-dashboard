// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

const { expect } = require('chai');
const githubEvent = require('../github_events');

const recordNumber = 1;
const data = {
  ref: 'refs/heads/main',
  repository: {
    name: 'aws-integration-test'
  },
  pusher: {
    name: 'fbaggins',
    email: 'emailAddress'
  },
  commits: [
    {
      id: '2bf894de6812831eed090150d2827e8adc15eb40'
    }
  ],
  head_commit: {
    timestamp: '2022-01-01T12:34:56Z',
    author: {
      name: 'Frodo Baggins'
    }
  },
  'additional-data': {
    'input-parameters': {
      header: {
        'X-GitHub-Event': 'push'
      }
    }
  }
};

const dataNoPusher = {
  ref: 'refs/heads/main',
  repository: {
    name: 'aws-integration-test'
  },
  commits: [
    {
      id: '2bf894de6812831eed090150d2827e8adc15eb40'
    }
  ],
  head_commit: {
    timestamp: '2022-01-01T12:34:56Z',
    author: {
      name: 'Frodo Baggins'
    }
  },
  'additional-data': {
    'input-parameters': {
      header: {
        'X-GitHub-Event': 'push'
      }
    }
  }
};

const dataNoAdditionalData = {
  ref: 'refs/heads/main',
  repository: {
    name: 'aws-integration-test'
  },
  pusher: {
    name: 'fbaggins',
    email: 'emailAddress'
  },
  commits: [
    {
      id: '2bf894de6812831eed090150d2827e8adc15eb40'
    }
  ],
  head_commit: {
    timestamp: '2022-01-01T12:34:56Z',
    author: {
      name: 'Frodo Baggins'
    }
  }
};

const expectedTransformedRecord = {
  repository_name: 'aws-integration-test',
  branch_name: 'main',
  author_name: 'Frodo Baggins',
  time: '2022-01-01 12:34:56.000 ',
  event_name: 'push',
  commit_id: ['2bf894de6812831eed090150d2827e8adc15eb40']
};
const emptyTransformedRecord = {};

describe('When testing github_events', () => {
  it('should transform a record', () => {
    const transformedRecord = githubEvent.transformGitHubEvents(data, recordNumber);

    expect(transformedRecord).to.eql(expectedTransformedRecord);
  });

  it('should return an empty object if it is not a push event', () => {
    const transformedRecord = githubEvent.transformGitHubEvents(dataNoPusher, recordNumber);

    expect(transformedRecord).to.eql(emptyTransformedRecord);
  });

  it('should return an empty object if an exception is thrown during the transformation', () => {
    const transformedRecord = githubEvent.transformGitHubEvents(dataNoAdditionalData, recordNumber);

    expect(transformedRecord).to.eql(emptyTransformedRecord);
  });
});
