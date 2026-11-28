import { Stage, type StageProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { HostedZoneConfig } from '../config.ts';
import type { GitHubRepository } from '../constructs/github-deployment-roles.ts';
import { AccountBaselineStack } from '../stacks/account-baseline-stack.ts';

export interface WorkloadStageProps extends StageProps {
  /** Stack name prefix, for example `Foundation-Test`. */
  readonly stackNamePrefix: string;
  /** Tags applied to every stack in the stage. */
  readonly tags: Record<string, string>;
  /** GitHub environment that deploys to this account: `test` or `prod`. */
  readonly gitHubEnvironment: string;
  /** Repositories that deploy to this account. */
  readonly deploymentRepositories: readonly GitHubRepository[];
  /** The account's public hosted zone, if it has one. */
  readonly hostedZone?: HostedZoneConfig;
}

/** Foundation stacks for one workload account, deployed by CI. */
export class WorkloadStage extends Stage {
  public readonly baseline: AccountBaselineStack;

  constructor(scope: Construct, id: string, props: WorkloadStageProps) {
    super(scope, id, props);

    this.baseline = new AccountBaselineStack(this, 'Baseline', {
      stackName: `${props.stackNamePrefix}-Baseline`,
      tags: props.tags,
      terminationProtection: true,
      gitHubEnvironment: props.gitHubEnvironment,
      deploymentRepositories: props.deploymentRepositories,
      hostedZone: props.hostedZone,
    });
  }
}
