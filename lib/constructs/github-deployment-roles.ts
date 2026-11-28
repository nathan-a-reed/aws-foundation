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

/** A repository with the numeric IDs GitHub puts in immutable OIDC subjects. */
export interface GitHubRepository {
  /** `owner/name`. */
  readonly fullName: string;
  readonly ownerId: number;
  readonly id: number;
}

/**
 * The token subject of a workflow job that runs in `environment`, in GitHub's
 * immutable format: `repo:<owner>@<owner-id>/<name>@<id>:environment:<environment>`.
 * Owner and repository IDs never change, so a deleted repository recreated
 * under the same name cannot match.
 */
export function gitHubSubject(repository: GitHubRepository, environment: string): string {
  const [owner, name, ...rest] = repository.fullName.split('/');
  if (!owner || !name || rest.length > 0) {
    throw new Error(`Repository ${repository.fullName} must be owner/name.`);
  }
  return `repo:${owner}@${String(repository.ownerId)}/${name}@${String(repository.id)}:environment:${environment}`;
}

export interface GitHubDeploymentRolesProps {
  /** Repositories that each get a deployment role. */
  readonly repositories: readonly GitHubRepository[];
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
      const { fullName } = repository;
      const roleId = `${constructIdFor(fullName)}DeployRole`;
      const role = new Role(this, roleId, {
        description: `GitHub Actions deployments of ${fullName} from the ${props.gitHubEnvironment} environment`,
        assumedBy: new WebIdentityPrincipal(this.provider.oidcProviderArn, {
          StringEquals: {
            [`${gitHubTokenIssuer}:aud`]: gitHubTokenAudience,
            [`${gitHubTokenIssuer}:sub`]: gitHubSubject(repository, props.gitHubEnvironment),
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
        description: `AWS_DEPLOY_ROLE_ARN for the ${props.gitHubEnvironment} environment of ${fullName}`,
        value: role.roleArn,
      });
      roles.set(fullName, role);
    }
    this.roles = roles;
  }
}
