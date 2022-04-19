// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const axios = require('axios');

let sendResponse = async (event, context, responseStatus, responseData) => {
    let data;

    const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
        PhysicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    const params = {
        url: event.ResponseURL,
        port: 443,
        method: 'put',
        headers: {
            'content-type': '',
            'content-length': responseBody.length
        },
        data: responseBody
    };

    data = await axios(params);
    return data.status;
};

module.exports = {
    send: sendResponse
};