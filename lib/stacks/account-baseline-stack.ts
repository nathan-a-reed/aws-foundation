import { Stack } from 'aws-cdk-lib';

/**
 * Shared resources in a workload account: deployment roles, the hosted zone,
 * and the `/foundation/` parameters that applications read.
 */
export class AccountBaselineStack extends Stack {}
