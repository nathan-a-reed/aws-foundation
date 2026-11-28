import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.ts';
import { addFoundation } from '../lib/foundation-app.ts';
import { createTestApp, exampleVariables } from './fixtures.ts';

function baselineTemplate(environment: 'test' | 'prod'): Template {
  const foundation = addFoundation(createTestApp(), loadConfig(exampleVariables));
  const stage = foundation[environment];
  if (!stage) {
    throw new Error(`No ${environment} stage`);
  }
  return Template.fromStack(stage.baseline);
}

function zoneLogicalId(template: Template): string {
  const ids = Object.keys(template.findResources('AWS::Route53::HostedZone'));
  expect(ids).toHaveLength(1);
  const [id] = ids;
  if (!id) {
    throw new Error('No hosted zone');
  }
  return id;
}

describe('prod hosted zone', () => {
  const template = baselineTemplate('prod');

  it('is the public nathanreed.dev zone', () => {
    template.resourceCountIs('AWS::Route53::HostedZone', 1);
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'nathanreed.dev.',
      VpcConfigurations: Match.absent(),
    });
  });

  it('is kept if the stack is deleted', () => {
    template.hasResource('AWS::Route53::HostedZone', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  it('publishes the zone name and ID for applications', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/foundation/dns/zone-name',
      Type: 'String',
      Value: 'nathanreed.dev',
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/foundation/dns/zone-id',
      Type: 'String',
      Value: { Ref: zoneLogicalId(template) },
    });
  });

  it('outputs the name servers for the delegation', () => {
    template.hasOutput('*', {
      Value: { 'Fn::Join': [',', { 'Fn::GetAtt': [zoneLogicalId(template), 'NameServers'] }] },
    });
  });
});

describe('test account', () => {
  it('has no hosted zone or DNS parameters yet', () => {
    const template = baselineTemplate('test');

    template.resourceCountIs('AWS::Route53::HostedZone', 0);
    template.resourceCountIs('AWS::SSM::Parameter', 0);
  });
});
