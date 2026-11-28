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

  it('holds every record of the current zone except NS and SOA', () => {
    const zone = { Ref: zoneLogicalId(template) };
    const records = Object.values(template.findResources('AWS::Route53::RecordSet')).map(
      (resource) => (resource as { Properties: unknown }).Properties,
    );

    // Values as Route 53 lists them for the current zone.
    expect(records).toHaveLength(4);
    expect(records).toEqual(
      expect.arrayContaining([
        {
          HostedZoneId: zone,
          Name: 'nathanreed.dev.',
          Type: 'MX',
          TTL: '300',
          ResourceRecords: ['1 smtp.google.com.'],
        },
        {
          HostedZoneId: zone,
          Name: 'nathanreed.dev.',
          Type: 'TXT',
          TTL: '300',
          ResourceRecords: [
            '"google-site-verification=wd_7_jGZ1Iykqj-mcaxFGumrE5l42kGhFCctRXZFzMc"',
          ],
        },
        {
          HostedZoneId: zone,
          Name: '_55498b75d58d5e0f1b76d605099fc1cc.nathanreed.dev.',
          Type: 'CNAME',
          TTL: '500',
          ResourceRecords: ['_251e74c9a7be8ac0a2f9bf9e33dd6855.xlfgrmvvlj.acm-validations.aws.'],
        },
        {
          HostedZoneId: zone,
          Name: 'server.nathanreed.dev.',
          Type: 'A',
          TTL: '300',
          ResourceRecords: [exampleVariables.SERVER_IP_ADDRESS],
        },
      ]),
    );
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
