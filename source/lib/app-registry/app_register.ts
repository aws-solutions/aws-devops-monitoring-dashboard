#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aspects, Aws, CfnCondition, CfnMapping, CfnParameter, Fn, Stack } from 'aws-cdk-lib';
import * as appreg from '@aws-cdk/aws-servicecatalogappregistry-alpha';
import { CfnApplication } from 'aws-cdk-lib/aws-applicationinsights';
import { applyTag } from './apply_tag';
import { CfnAttributeGroupAssociation, CfnResourceAssociation } from 'aws-cdk-lib/aws-servicecatalogappregistry';
import { CfnResourceShare } from 'aws-cdk-lib/aws-ram';
import { ConditionAspect } from './condition_aspect';

export interface AppRegisterProps {
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
  appRegistryApplicationName: string;
  applicationType: string;
  attributeGroupName: string;
}

export class AppRegister {
  private solutionId: string;
  private solutionName: string;
  private solutionVersion: string;
  private appRegistryApplicationName: string;
  private applicationType: string;
  private attributeGroupName: string;

  constructor(props: AppRegisterProps) {
    this.solutionId = props.solutionId;
    this.appRegistryApplicationName = props.appRegistryApplicationName;
    this.solutionName = props.solutionName;
    this.applicationType = props.applicationType;
    this.solutionVersion = props.solutionVersion;
    this.attributeGroupName = props.attributeGroupName;
  }

  public applyAppRegistryToStacks(hubStack: Stack, spokeStacks: Stack[], nestedStacks: Stack[]) {
    const application = this.createAppRegistry(hubStack);
    if (spokeStacks.length > 0) {
      this.allowHubStackToShareApplication(application, hubStack);
      spokeStacks.forEach(spokeStack => this.applyAppRegistryToSpokeStack(spokeStack));
    }

    let suffix = 1;
    nestedStacks.forEach(nestedStack => {
      const association = new CfnResourceAssociation(application, `ResourceAssociation${suffix++}`, {
        application: application.applicationId,
        resource: nestedStack.stackId,
        resourceType: 'CFN_STACK'
      });

      // If the nested stack is conditional, the resource association must also be so on the same condition
      // But the condition may have been added as an override
      const stackCondition =
        nestedStack.nestedStackResource?.cfnOptions.condition ?? // eslint-disable prettier/prettier
        (nestedStack as any).resource.rawOverrides.Condition; // eslint-disable-line @typescript-eslint/no-explicit-any

      if (stackCondition) {
        association.addOverride('Condition', stackCondition);
      }
    });
  }

  private createAppRegistry(stack: Stack): appreg.Application {
    const map = this.createMap(stack);

    const application = new appreg.Application(stack, 'AppRegistry', {
      applicationName: Fn.join('-', [map.findInMap('Data', 'AppRegistryApplicationName'), Aws.REGION, Aws.ACCOUNT_ID]),
      description: `Service Catalog application to track and manage all your resources for the solution ${this.solutionName}`
    });
    application.associateStack(stack);

    const attributeGroup = new appreg.AttributeGroup(stack, 'DefaultApplicationAttributes', {
      attributeGroupName: map.findInMap('Data', 'AttributeGroupName'),
      description: 'Attribute group for solution information',
      attributes: {
        applicationType: map.findInMap('Data', 'ApplicationType'),
        version: map.findInMap('Data', 'Version'),
        solutionID: map.findInMap('Data', 'ID'),
        solutionName: map.findInMap('Data', 'SolutionName')
      }
    });

    application.associateAttributeGroup(attributeGroup);

    this.applyTagsToApplication(application, map);

    return application;
  }

  private createMap(stack: Stack) {
    const map = new CfnMapping(stack, 'Solution');
    map.setValue('Data', 'ID', this.solutionId);
    map.setValue('Data', 'Version', this.solutionVersion);
    map.setValue('Data', 'AppRegistryApplicationName', this.appRegistryApplicationName);
    map.setValue('Data', 'SolutionName', this.solutionName);
    map.setValue('Data', 'ApplicationType', this.applicationType);
    map.setValue('Data', 'AttributeGroupName', this.attributeGroupName);

    return map;
  }

  private allowHubStackToShareApplication(application: appreg.Application, hubStack: Stack) {
    const orgId = new CfnParameter(hubStack, 'OrganizationID', {
      description: 'Organization ID to support multi account deployment. Leave blank for single account deployments.',
      type: 'String',
      allowedPattern: '^$|^o-[a-z0-9]{10,32}$',
      default: ''
    });

    const managementAccountId = new CfnParameter(hubStack, 'ManagementAccountId', {
      description:
        'Account ID for the management account of the Organization. Leave blank for single account deployments.',
      type: 'String',
      default: ''
    });

    const multiAccountDeployment = new CfnCondition(hubStack, 'MultiAccountDeployment', {
      expression: Fn.conditionOr(
        Fn.conditionNot(Fn.conditionEquals(orgId.valueAsString, '')),
        Fn.conditionNot(Fn.conditionEquals(managementAccountId.valueAsString, ''))
      )
    });

    const resourceShare = new CfnResourceShare(hubStack, 'ApplicationShare', {
      name: Aws.STACK_NAME,
      allowExternalPrincipals: false,
      permissionArns: [
        'arn:aws:ram::aws:permission/AWSRAMPermissionServiceCatalogAppRegistryApplicationAllowAssociation'
      ],
      principals: [
        `arn:${Aws.PARTITION}:organizations::${managementAccountId.valueAsString}:organization/${orgId.valueAsString}`
      ],
      resourceArns: [application.applicationArn]
    });
    Aspects.of(resourceShare).add(new ConditionAspect(multiAccountDeployment));
  }

  private applyAppRegistryToSpokeStack(spokeStack: Stack) {
    let hubAccountId: CfnParameter | undefined = undefined;
    try {
      hubAccountId = spokeStack.node.findChild('MonitorAcctNumber') as CfnParameter;
    } catch (err) {
      hubAccountId = new CfnParameter(spokeStack, 'HubAccountId', {
        description: 'AWS AccountId for the hub account',
        type: 'String',
        default: ''
      });
    }

    const appregEnabled = new CfnParameter(spokeStack, 'AppRegistryEnabled', {
      description: 'Select "Yes" if the hub account was deployed with App Registry support.',
      allowedValues: ['Yes', 'No'],
      default: 'Yes'
    });

    const condAppregEnabled = new CfnCondition(spokeStack, 'AppRegistryEnabledCondition', {
      expression: Fn.conditionEquals(appregEnabled.valueAsString, 'Yes')
    });

    const map = this.createMap(spokeStack);

    const association = new CfnResourceAssociation(spokeStack, 'AppRegistryStackAssociation', {
      application: Fn.join('-', [
        map.findInMap('Data', 'AppRegistryApplicationName'),
        Aws.REGION,
        hubAccountId.valueAsString
      ]),
      resource: Aws.STACK_ID,
      resourceType: 'CFN_STACK'
    });

    association.addOverride('Condition', condAppregEnabled.logicalId);

    const attributeGroup = new appreg.AttributeGroup(spokeStack, 'DefaultApplicationAttributes', {
      attributeGroupName: map.findInMap('Data', 'AttributeGroupName'),
      description: 'Attribute group for solution information',
      attributes: {
        applicationType: map.findInMap('Data', 'ApplicationType'),
        version: map.findInMap('Data', 'Version'),
        solutionID: map.findInMap('Data', 'ID'),
        solutionName: map.findInMap('Data', 'SolutionName')
      }
    });

    const attrGroupAssociation = new CfnAttributeGroupAssociation(
      spokeStack,
      'AppRegistryApplicationAttributeAssociation',
      {
        application: Fn.join('-', [
          map.findInMap('Data', 'AppRegistryApplicationName'),
          Aws.REGION,
          hubAccountId.valueAsString
        ]),
        attributeGroup: attributeGroup.attributeGroupId
      }
    );

    attrGroupAssociation.addOverride('Condition', condAppregEnabled.logicalId);

    const app = new CfnApplication(spokeStack, 'ApplicationInsightsConfiguration', {
      resourceGroupName: Fn.join('-', ['AWS_CloudFormation_Stack', Aws.STACK_NAME]),
      autoConfigurationEnabled: true,
      cweMonitorEnabled: true,
      opsCenterEnabled: true
    });

    app.addOverride('Condition', condAppregEnabled.logicalId);
  }

  private applyTagsToApplication(application: appreg.Application, map: CfnMapping) {
    applyTag(application, 'Solutions:SolutionID', map.findInMap('Data', 'ID'));
    applyTag(application, 'Solutions:SolutionName', map.findInMap('Data', 'SolutionName'));
    applyTag(application, 'Solutions:SolutionVersion', map.findInMap('Data', 'Version'));
    applyTag(application, 'Solutions:ApplicationType', map.findInMap('Data', 'ApplicationType'));
  }
}