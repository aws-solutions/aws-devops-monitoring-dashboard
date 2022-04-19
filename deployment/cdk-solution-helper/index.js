// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Imports
const fs = require('fs');

// Paths
const global_s3_assets = '../global-s3-assets';

// For each template in global_s3_assets ...
fs.readdirSync(global_s3_assets).forEach(file => {
    // Import and parse template file
    const raw_template = fs.readFileSync(`${global_s3_assets}/${file}`);
    let template = JSON.parse(raw_template);

    // Clean-up Lambda function code dependencies
    const resources = (template.Resources) ? template.Resources : {};
    const lambdaFunctions = Object.keys(resources).filter(function (key) {
        return resources[key].Type === 'AWS::Lambda::Function';
    });

    lambdaFunctions.forEach(function (f) {
        const fn = template.Resources[f];
        if (fn.Properties.Code.hasOwnProperty('S3Bucket')) {
            // Set the S3 key reference
            let artifactHash = Object.assign(fn.Properties.Code.S3Bucket.Ref);
            // console.debug(`Old artificatHash is ${artifactHash}`);
            artifactHash = artifactHash.replace(/[\w]*AssetParameters/g, '');
            artifactHash = artifactHash.substring(0, artifactHash.indexOf('S3Bucket'));
            // console.debug(`New artificatHash is ${artifactHash}`);
            const assetPath = `asset${artifactHash}`;
            fn.Properties.Code.S3Key = `%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}.zip`;

            // Set the S3 bucket reference
            fn.Properties.Code.S3Bucket = {
                'Fn::Sub': '%%BUCKET_NAME%%-${AWS::Region}'
            };
        } else {
            // console.debug(`Here is the fn dump ${JSON.stringify(fn)}`);
        }
    });

    // Clean-up nested template stack dependencies
    const nestedStacks = Object.keys(resources).filter(function(key) {
        return resources[key].Type === 'AWS::CloudFormation::Stack'
    });

    nestedStacks.forEach(function(f) {
        const fn = template.Resources[f];
        fn.Properties.TemplateURL = {
            'Fn::Join': [
                '',
                [
                    `https://%%TEMPLATE_BUCKET_NAME%%.s3.`,
                    {
                        'Ref' : 'AWS::URLSuffix'
                    },
                    '/',
                    `%%SOLUTION_NAME%%/%%VERSION%%/${fn.Metadata.nestedStackFileName}`
                ]
            ]
        };
        // fn.Properties.TemplateURL = {
        //     'Fn::Join': [
        //         '',
        //         [
        //             'https://s3.',
        //             {
        //                 'Ref' : 'AWS::URLSuffix'
        //             },
        //             '/',
        //             `%%TEMPLATE_BUCKET_NAME%%/%%SOLUTION_NAME%%/%%VERSION%%/${fn.Metadata.nestedStackFileName}`
        //         ]
        //     ]
        // };

        const params = fn.Properties.Parameters ? fn.Properties.Parameters : {};
        const nestedStackParameters = Object.keys(params).filter(function(key) {
            if (key.search(/[\w]*AssetParameters/g) > -1) {
                return true;
            }
            return false;
        });

        nestedStackParameters.forEach(function(stkParam) {
            fn.Properties.Parameters[stkParam] = undefined;
        });
    });

    // Clean-up parameters section
    const parameters = (template.Parameters) ? template.Parameters : {};
    const assetParameters = Object.keys(parameters).filter(function (key) {
        // console.debug(`key to analyze ${key}`);
        if (key.search(/[\w]*AssetParameters/g) > -1) {
            // console.debug('Pattern match');
            return true;
        }
        // console.debug('Pattern did not match');
        return false;
    });
    assetParameters.forEach(function (a) {
        template.Parameters[a] = undefined;
    });

    // Output modified template file
    const output_template = JSON.stringify(template, null, 2);
    fs.writeFileSync(`${global_s3_assets}/${file}`, output_template);
});