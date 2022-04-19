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

/**
 * Checks if provide ip is in the provided ipRange
 * @param {string} ip - The IP address being validated
 * @param {string} ipRange - The masked IP address range e.g. 192.168.1.1/20
 * @returns true if provided ip falls in the ipRange
 */
let isIpInRange = (ip, ipRange) => {
    const [range, bits = 32] = ipRange.split("/");
    const mask = ~(2 ** (32 - bits) - 1);

    const ipA = ip4ToInt(ip) & mask;
    const ipB = ip4ToInt(range) & mask;
    return !Number.isNaN(ipA) && !Number.isNaN(ipB) && ipA === ipB;
};

/**
 * Converts an IP4 address string into an integer
 * @param {string} ip - The IP address to convert
 * @returns integer representation of the IP address string
 */
let ip4ToInt = (ip) => {
    const ipRegEx = /^(?!.*\.$)((?!0\d)(1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
    if (!ipRegEx.test(ip)) {
        LOGGER.log("ERROR", `Invalid IP Address: ${ip}`);
        return NaN;
    }

    return ip.split(".").reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
};

module.exports = {
    isIpInRange: isIpInRange,
};
