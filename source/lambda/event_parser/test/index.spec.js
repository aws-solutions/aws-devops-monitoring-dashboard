/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

'use strict';

const expect = require('chai').expect;
const codeCommitEventsLambda = require('../codecommit_events');

const recordNumber = 1
const codeCommitSourceEventData = {
  "version": "0",
  "id": "aa4985bd-7090-e49f-600d-9674e2fc3517",
  "detail-type": "AWS API Call via CloudTrail",
  "source": "aws.codecommit",
  "account": "xxxxxxxxxxxx",
  "time": "2020-12-17T23:09:56Z",
  "region": "us-east-1",
  "resources": [],
  "detail": {
      "eventVersion": "1.08",
      "userIdentity": {
          "type": "IAMUser",
          "principalId": "AIDA2Y4WAKMDPSR4YEND6",
          "arn": "arn:aws:iam::xxxxxxxxxxxx:user/codecommituser-DoNOTDELETE",
          "accountId": "xxxxxxxxxxxx",
          "userName": "codecommituser-DoNOTDELETE"
      },
      "eventTime": "2020-12-17T23:09:56Z",
      "eventSource": "codecommit.amazonaws.com",
      "eventName": "GitPush",
      "awsRegion": "us-east-1",
      "sourceIPAddress": "72.21.196.64",
      "userAgent": "SSH-2.0-OpenSSH_7.8",
      "requestParameters": {
          "references": [
              {
                  "commit": "2167ac048f337fd2b24edd379e0ea6fd22749ca9",
                  "ref": "refs/heads/master"
              }
          ]
      },
      "responseElements": null,
      "additionalEventData": {
          "protocol": "SSH",
          "capabilities": [
              "report-status",
              "side-band-64k"
          ],
          "dataTransferred": true,
          "repositoryName": "MyDemoRepo",
          "repositoryId": "777bd545-ca04-49c3-88ee-a289b2301011"
      },
      "requestID": "1ceb8047-623e-48fb-8c25-30eeeac66ec2",
      "eventID": "7aa1c4ba-f79c-4bc2-b38b-359ff3dda6c3",
      "readOnly": false,
      "resources": [
          {
              "accountId": "xxxxxxxxxxxx",
              "type": "AWS::CodeCommit::Repository",
              "ARN": "arn:aws:codecommit:us-east-1:xxxxxxxxxxxx:MyDemoRepo"
          }
      ],
      "eventType": "AwsApiCall",
      "managementEvent": true,
      "eventCategory": "Management"
  }
}

const  expectedTransformedCodeCommitRecord = {
  "version": "0",
  "id": "aa4985bd-7090-e49f-600d-9674e2fc3517",
  "detail_type": "AWS API Call via CloudTrail",
  "source": "aws.codecommit",
  "account": "xxxxxxxxxxxx",
  "time": "2020-12-17T23:09:56Z",
  "region": "us-east-1",
  "resources": [],
  "detail": {
      "eventName": "GitPush",
      "authorName": "codecommituser-DoNOTDELETE",
      "commitId": "2167ac048f337fd2b24edd379e0ea6fd22749ca9",
      "branchName": "master",
      "repositoryName": "MyDemoRepo"
  }
}

describe('When testing event parser', () => {

    let transformedRecord;
    let transformedRecordString;
    let expectedTransformedCodeCommitRecordString = JSON.stringify(expectedTransformedCodeCommitRecord,null,2);

    it('expect record match after event transformation', async () => {
      transformedRecord = await codeCommitEventsLambda.transformCodeCommitEvents(codeCommitSourceEventData,recordNumber);
      transformedRecordString = JSON.stringify(transformedRecord,null,2);

      console.log("transformedRecordString: " + transformedRecordString);
      console.log("expectedTransformedCodeCommitRecordString: " + expectedTransformedCodeCommitRecordString);

      expect(transformedRecordString).to.equal(expectedTransformedCodeCommitRecordString);

   });

});