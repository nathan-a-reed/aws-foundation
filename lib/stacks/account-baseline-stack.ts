import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { GitHubDeploymentRoles } from '../constructs/github-deployment-roles.ts';

export interface AccountBaselineStackProps extends StackProps {
  /** GitHub environment that deploys to this account: `test` or `prod`. */
  readonly gitHubEnvironment: string;
  /** Repositories, as `owner/name`, that deploy to this account. */
  readonly deploymentRepositories: readonly string[];
}

/**
 * Shared resources in a workload account: deployment roles, the hosted zone,
 * and the `/foundation/` parameters that applications read.
 */
export class AccountBaselineStack extends Stack {
  public readonly deploymentRoles: GitHubDeploymentRoles;

  constructor(scope: Construct, id: string, props: AccountBaselineStackProps) {
    super(scope, id, props);

    this.deploymentRoles = new GitHubDeploymentRoles(this, 'GitHubDeploymentRoles', {
      repositories: props.deploymentRepositories,
      gitHubEnvironment: props.gitHubEnvironment,
    });
  }
}
