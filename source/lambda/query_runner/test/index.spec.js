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
const queryRunner = require('../build_athena_query');

const athenaDB = 'testAthenaDB'
const athenaTable = 'testAthenaTable'
const currentTimeStamp = new Date()
const year = currentTimeStamp.getFullYear()
const month = currentTimeStamp.getMonth() + 1
const day = currentTimeStamp.getDate()
const hour = currentTimeStamp.getHours()

let expectedQueryString =
    'ALTER TABLE ' + athenaDB + '.' + athenaTable  + '\n' +
    'ADD IF NOT EXISTS'  + '\n' +
    "PARTITION (\n"  +
    "\tcreated_at = '" + year.toString() + "-"  +
        (month.toString() < 10 ? '0' : '') + month.toString() + "-"  +
        (day.toString() < 10 ? '0' : '') + day.toString() + "');"

describe('When testing query builder', () => {

    let queryString;

    it('expect matching query for adding athena partitions', async () => {
      queryString = await queryRunner.buildAddAthenaPartitionQuery(athenaDB, athenaTable);

      console.log("Generated query string: " + queryString);
      console.log("Expected query string: " + expectedQueryString);

      expect(queryString).to.equal(expectedQueryString);

   });

});