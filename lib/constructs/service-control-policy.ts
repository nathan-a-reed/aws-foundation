import { PolicyDocument, type PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnPolicy } from 'aws-cdk-lib/aws-organizations';
import { Construct } from 'constructs';

export interface ServiceControlPolicyProps {
  readonly policyName: string;
  readonly description: string;
  readonly statements: readonly PolicyStatement[];
  /** Organizational units, accounts, or the root the policy is attached to. */
  readonly targetIds: readonly string[];
}

/**
 * Service control policy built from IAM policy statements. Wraps the L1
 * resource because AWS Organizations has no L2 construct.
 */
export class ServiceControlPolicy extends Construct {
  public readonly policy: CfnPolicy;

  constructor(scope: Construct, id: string, props: ServiceControlPolicyProps) {
    super(scope, id);

    this.policy = new CfnPolicy(this, 'Resource', {
      name: props.policyName,
      description: props.description,
      type: 'SERVICE_CONTROL_POLICY',
      content: new PolicyDocument({ statements: [...props.statements] }).toJSON() as unknown,
      targetIds: [...props.targetIds],
    });
  }
}
