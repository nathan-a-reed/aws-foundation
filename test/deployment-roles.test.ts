import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.ts';
import { addFoundation } from '../lib/foundation-app.ts';
import {
  createTestApp,
  exampleAccounts,
  exampleVariables,
  managementTemplate,
} from './fixtures.ts';

const repositories = [
  'nathan-a-reed/aws-foundation',
  'nathan-a-reed/portfolio-site',
  'nathan-a-reed/outage-atlas',
  'nathan-a-reed/nasa-rag',
];

const environments = ['test', 'prod'] as const;
type Environment = (typeof environments)[number];

interface RoleResource {
  Properties: {
    Description: string;
    AssumeRolePolicyDocument: { Statement: unknown[] };
    ManagedPolicyArns?: unknown;
    Policies?: unknown;
  };
}

interface PolicyResource {
  Properties: {
    PolicyDocument: { Statement: unknown[] };
    Roles: { Ref: string }[];
  };
}

function baselineTemplate(environment: Environment): Template {
  const foundation = addFoundation(createTestApp(), loadConfig(exampleVariables));
  const stage = foundation[environment];
  if (!stage) {
    throw new Error(`No ${environment} stage`);
  }
  return Template.fromStack(stage.baseline);
}

function deploymentRole(
  template: Template,
  repository: string,
  environment: Environment,
): [string, RoleResource] {
  const roles = Object.entries(template.findResources('AWS::IAM::Role')) as [
    string,
    RoleResource,
  ][];
  const matches = roles.filter(([, role]) =>
    role.Properties.Description.includes(`deployments of ${repository} from the ${environment}`),
  );
  expect(matches).toHaveLength(1);
  const [match] = matches;
  if (!match) {
    throw new Error(`No deployment role for ${repository}`);
  }
  return match;
}

function providerLogicalId(template: Template): string {
  const [logicalId] = Object.keys(template.findResources('AWS::IAM::OIDCProvider'));
  if (!logicalId) {
    throw new Error('No OIDC provider');
  }
  return logicalId;
}

describe.each(environments)('%s deployment roles', (environment) => {
  const template = baselineTemplate(environment);
  const account = exampleAccounts[environment];

  it('trusts GitHub tokens issued for AWS STS', () => {
    template.resourceCountIs('AWS::IAM::OIDCProvider', 1);
    template.hasResourceProperties('AWS::IAM::OIDCProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIdList: ['sts.amazonaws.com'],
    });
  });

  it('creates one role per repository and no other roles', () => {
    template.resourceCountIs('AWS::IAM::Role', repositories.length);
  });

  it.each(repositories)(
    `lets only %s jobs in the ${environment} environment assume its role`,
    (repository) => {
      const [, role] = deploymentRole(template, repository, environment);

      expect(role.Properties.AssumeRolePolicyDocument.Statement).toEqual([
        {
          Effect: 'Allow',
          Action: 'sts:AssumeRoleWithWebIdentity',
          Principal: { Federated: { Ref: providerLogicalId(template) } },
          Condition: {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              'token.actions.githubusercontent.com:sub': `repo:${repository}:environment:${environment}`,
            },
          },
        },
      ]);
    },
  );

  it.each(repositories)('lets the %s role assume only the CDK bootstrap roles', (repository) => {
    const [roleId, role] = deploymentRole(template, repository, environment);
    const policies = Object.values(
      template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: Match.arrayWith([{ Ref: roleId }]) },
      }),
    ) as PolicyResource[];

    expect(role.Properties.ManagedPolicyArns).toBeUndefined();
    expect(role.Properties.Policies).toBeUndefined();
    expect(policies.map((policy) => policy.Properties.PolicyDocument.Statement)).toEqual([
      [
        {
          Sid: 'AssumeCdkBootstrapRoles',
          Effect: 'Allow',
          Action: 'sts:AssumeRole',
          Resource: ['deploy', 'file-publishing', 'image-publishing'].map(
            (purpose) =>
              `arn:aws:iam::${account}:role/cdk-hnb659fds-${purpose}-role-${account}-us-east-1`,
          ),
        },
      ],
    ]);
  });

  it.each(repositories)('outputs the %s role ARN', (repository) => {
    const [roleId] = deploymentRole(template, repository, environment);

    template.hasOutput('*', {
      Description: `AWS_DEPLOY_ROLE_ARN for the ${environment} environment of ${repository}`,
      Value: { 'Fn::GetAtt': [roleId, 'Arn'] },
      Export: Match.absent(),
    });
  });
});

describe('management account', () => {
  it('has no GitHub OIDC provider or deployment roles', () => {
    const template = managementTemplate();

    template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
    expect(JSON.stringify(template.toJSON())).not.toContain('token.actions.githubusercontent.com');
  });
});
