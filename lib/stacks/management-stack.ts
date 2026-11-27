import { Stack } from 'aws-cdk-lib';

/**
 * Organization-wide resources in the management account: guardrails, budgets,
 * and the organization trail. Deployed only from a workstation.
 */
export class ManagementStack extends Stack {}
