import { CfnOutput, DefaultStackSynthesizer, Stack } from 'aws-cdk-lib';
import {
  Effect,
  OidcProviderNative,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export const gitHubTokenIssuer = 'token.actions.githubusercontent.com';

/** Audience `aws-actions/configure-aws-credentials` requests by default. */
export const gitHubTokenAudience = 'sts.amazonaws.com';

export interface GitHubDeploymentRolesProps {
  /** Repositories, as `owner/name`, that each get a deployment role. */
  readonly repositories: readonly string[];
  /** GitHub environment a workflow job must run in to assume a role. */
  readonly gitHubEnvironment: string;
}

/** `nathan-a-reed/portfolio-site` becomes `PortfolioSite`. */
function constructIdFor(repository: string): string {
  const name = repository.split('/').pop() ?? repository;
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * The GitHub OIDC provider and one deployment role per repository. A role can
 * be assumed only by workflow jobs in its repository's GitHub environment, and
 * can only assume the CDK bootstrap roles that publish assets and deploy
 * through CloudFormation.
 */
export class GitHubDeploymentRoles extends Construct {
  public readonly provider: OidcProviderNative;
  /** Deployment roles keyed by repository (`owner/name`). */
  public readonly roles: ReadonlyMap<string, Role>;

  constructor(scope: Construct, id: string, props: GitHubDeploymentRolesProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // No thumbprints: IAM validates GitHub's certificate against its trusted CAs.
    this.provider = new OidcProviderNative(this, 'Provider', {
      url: `https://${gitHubTokenIssuer}`,
      clientIds: [gitHubTokenAudience],
    });

    // The bootstrap roles keep their default names because each account is
    // bootstrapped with the default template and qualifier (see the README).
    const qualifier = DefaultStackSynthesizer.DEFAULT_QUALIFIER;
    const bootstrapRoleArns = ['deploy', 'file-publishing', 'image-publishing'].map((purpose) =>
      stack.formatArn({
        service: 'iam',
        region: '',
        resource: 'role',
        resourceName: `cdk-${qualifier}-${purpose}-role-${stack.account}-${stack.region}`,
      }),
    );

    const roles = new Map<string, Role>();
    for (const repository of props.repositories) {
      const roleId = `${constructIdFor(repository)}DeployRole`;
      const role = new Role(this, roleId, {
        description: `GitHub Actions deployments of ${repository} from the ${props.gitHubEnvironment} environment`,
        assumedBy: new WebIdentityPrincipal(this.provider.oidcProviderArn, {
          StringEquals: {
            [`${gitHubTokenIssuer}:aud`]: gitHubTokenAudience,
            [`${gitHubTokenIssuer}:sub`]: `repo:${repository}:environment:${props.gitHubEnvironment}`,
          },
        }),
      });
      role.addToPrincipalPolicy(
        new PolicyStatement({
          sid: 'AssumeCdkBootstrapRoles',
          effect: Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: bootstrapRoleArns,
        }),
      );
      new CfnOutput(this, `${roleId}Arn`, {
        description: `AWS_DEPLOY_ROLE_ARN for the ${props.gitHubEnvironment} environment of ${repository}`,
        value: role.roleArn,
      });
      roles.set(repository, role);
    }
    this.roles = roles;
  }
}
