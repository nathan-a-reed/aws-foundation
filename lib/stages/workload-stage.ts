import { Stage, type StageProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { AccountBaselineStack } from '../stacks/account-baseline-stack.ts';

export interface WorkloadStageProps extends StageProps {
  /** Stack name prefix, for example `Foundation-Test`. */
  readonly stackNamePrefix: string;
  /** Tags applied to every stack in the stage. */
  readonly tags: Record<string, string>;
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
    });
  }
}
