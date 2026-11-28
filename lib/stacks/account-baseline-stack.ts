import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { HostedZoneConfig } from '../config.ts';
import { AccountDnsZone } from '../constructs/account-dns-zone.ts';
import {
  GitHubDeploymentRoles,
  type GitHubRepository,
} from '../constructs/github-deployment-roles.ts';

export interface AccountBaselineStackProps extends StackProps {
  /** GitHub environment that deploys to this account: `test` or `prod`. */
  readonly gitHubEnvironment: string;
  /** Repositories that deploy to this account. */
  readonly deploymentRepositories: readonly GitHubRepository[];
  /** The account's public hosted zone, if it has one. */
  readonly hostedZone?: HostedZoneConfig;
}

/**
 * Shared resources in a workload account: deployment roles, the hosted zone,
 * and the `/foundation/` parameters that applications read.
 */
export class AccountBaselineStack extends Stack {
  public readonly deploymentRoles: GitHubDeploymentRoles;
  public readonly dnsZone?: AccountDnsZone;

  constructor(scope: Construct, id: string, props: AccountBaselineStackProps) {
    super(scope, id, props);

    this.deploymentRoles = new GitHubDeploymentRoles(this, 'GitHubDeploymentRoles', {
      repositories: props.deploymentRepositories,
      gitHubEnvironment: props.gitHubEnvironment,
    });

    if (props.hostedZone) {
      this.dnsZone = new AccountDnsZone(this, 'DnsZone', props.hostedZone);
    }
  }
}
