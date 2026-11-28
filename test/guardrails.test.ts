import { Match, type Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { exampleAccounts, exampleVariables, managementTemplate } from './fixtures.ts';

interface PolicyResource {
  Properties: {
    Name: string;
    Type: string;
    TargetIds: string[];
    Content: { Statement: Record<string, unknown>[] };
  };
}

let template: Template;

beforeAll(() => {
  template = managementTemplate();
});

function serviceControlPolicy(name: string): PolicyResource['Properties'] {
  const policies = Object.values(
    template.findResources('AWS::Organizations::Policy', { Properties: { Name: name } }),
  ) as PolicyResource[];
  expect(policies).toHaveLength(1);
  const [policy] = policies;
  if (!policy) {
    throw new Error(`No policy named ${name}`);
  }
  return policy.Properties;
}

describe('organization trail', () => {
  it('records management events from every account and Region', () => {
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'organization-trail',
      IsOrganizationTrail: true,
      IsMultiRegionTrail: true,
      IncludeGlobalServiceEvents: true,
      EnableLogFileValidation: true,
      EventSelectors: [{ IncludeManagementEvents: true, ReadWriteType: 'All' }],
    });
  });

  it('lets CloudTrail write organization logs only from the organization trail', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: 's3:PutObject',
            Principal: { Service: 'cloudtrail.amazonaws.com' },
            Resource: {
              'Fn::Join': [
                '',
                [Match.anyValue(), `/AWSLogs/${exampleVariables.ORGANIZATION_ID}/*`],
              ],
            },
            Condition: {
              StringEquals: Match.objectLike({
                'aws:SourceArn': `arn:aws:cloudtrail:us-east-1:${exampleAccounts.management}:trail/organization-trail`,
              }),
            },
          }),
        ]),
      },
    });
  });
});

describe('trail log bucket', () => {
  it('encrypts objects with S3 managed keys', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
  });

  it('blocks all public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('denies requests without TLS', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:*',
            Principal: { AWS: '*' },
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('expires log files after 365 days and keeps the bucket if the stack is deleted', () => {
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        LifecycleConfiguration: {
          Rules: [Match.objectLike({ ExpirationInDays: 365, Status: 'Enabled' })],
        },
      }),
    });
  });
});

describe('workloads baseline SCP', () => {
  it('is attached to the Workloads OU', () => {
    const policy = serviceControlPolicy('workloads-baseline');

    expect(policy.Type).toBe('SERVICE_CONTROL_POLICY');
    expect(policy.TargetIds).toEqual([exampleVariables.WORKLOADS_OU_ID]);
  });

  it('denies leaving the organization, changing the organization trail, and root user actions', () => {
    const policy = serviceControlPolicy('workloads-baseline');

    expect(policy.Content.Statement).toEqual([
      {
        Sid: 'DenyLeavingOrganization',
        Effect: 'Deny',
        Action: 'organizations:LeaveOrganization',
        Resource: '*',
      },
      {
        Sid: 'ProtectOrganizationTrail',
        Effect: 'Deny',
        Action: [
          'cloudtrail:CreateTrail',
          'cloudtrail:DeleteTrail',
          'cloudtrail:PutEventSelectors',
          'cloudtrail:StopLogging',
          'cloudtrail:UpdateTrail',
        ],
        Resource: 'arn:aws:cloudtrail:*:*:trail/organization-trail',
      },
      {
        Sid: 'DenyRootUser',
        Effect: 'Deny',
        Action: '*',
        Resource: '*',
        Condition: {
          ArnLike: { 'aws:PrincipalArn': ['arn:aws:iam::*:root'] },
          Null: { 'aws:AssumedRoot': 'true' },
        },
      },
    ]);
  });
});

describe('workloads Region restriction SCP', () => {
  it('is attached to the Workloads OU', () => {
    const policy = serviceControlPolicy('workloads-region-restriction');

    expect(policy.TargetIds).toEqual([exampleVariables.WORKLOADS_OU_ID]);
  });

  it('denies every action outside us-east-1 except global services', () => {
    const policy = serviceControlPolicy('workloads-region-restriction');
    const [statement, ...others] = policy.Content.Statement;

    expect(others).toHaveLength(0);
    expect(statement).toMatchObject({
      Sid: 'DenyOutsideAllowedRegion',
      Effect: 'Deny',
      Resource: '*',
      Condition: { StringNotEquals: { 'aws:RequestedRegion': ['us-east-1'] } },
    });
    expect(statement?.NotAction).toEqual(
      expect.arrayContaining(['iam:*', 'sts:*', 'organizations:*', 'route53:*', 'cloudfront:*']),
    );
    expect(statement).not.toHaveProperty('Action');
  });
});

describe('root sign-in alert', () => {
  it('matches root console sign-ins', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['aws.signin'],
        'detail-type': ['AWS Console Sign In via CloudTrail'],
        detail: { userIdentity: { type: ['Root'] } },
      },
      State: 'ENABLED',
      Targets: [
        Match.objectLike({ Arn: { Ref: Match.stringLikeRegexp('^RootSignInAlertTopic') } }),
      ],
    });
  });

  it('emails the security alert address', () => {
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: exampleVariables.SECURITY_ALERT_EMAIL,
      TopicArn: { Ref: Match.stringLikeRegexp('^RootSignInAlertTopic') },
    });
  });
});
