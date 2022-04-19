/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance     *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/


"use strict";

const LOGGER = new (require("./logger"))();
const AWS = require("aws-sdk");

let options = {
    customUserAgent: process.env.userAgentExtra,
};
const secretsManager = new AWS.SecretsManager(options);

const secretMap = new Map();

/**
 * Retrieve the secret with the provided secretId. Returns the secret or undefined if one isn't found.
 * @param {string} secretId - the ID of the secret to retrieve
 * @returns The SecretString if found, otherwise undefined
 */
let getSecret = async (secretId) => {
    if (secretMap.has(secretId)) {
        return secretMap.get(secretId);
    }

    const params = {
        SecretId: secretId,
    };
    let secret;

    try {
        const response = await secretsManager.getSecretValue(params).promise();
        secret = response.SecretString;
        secretMap.set(secretId, secret);
    } catch (error) {
        LOGGER.log("ERROR", `Error when retrieving secret. ${error.message}`);
    }

    return secret;
};

module.exports = {
    getSecret: getSecret,
};
