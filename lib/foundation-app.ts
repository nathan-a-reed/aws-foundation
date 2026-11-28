import { Validations, type App } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { stackTags, type FoundationConfig } from './config.ts';
import { ManagementStack } from './stacks/management-stack.ts';
import { WorkloadStage } from './stages/workload-stage.ts';

export interface FoundationApp {
  readonly management?: ManagementStack;
  readonly test?: WorkloadStage;
  readonly prod?: WorkloadStage;
}

/** Adds a stack or stage for each environment that has an account ID. */
export function addFoundation(app: App, config: FoundationConfig): FoundationApp {
  const { accounts, region } = config;

  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  const management = config.management
    ? new ManagementStack(app, 'Management', {
        stackName: 'Foundation-Management-Organization',
        env: { account: config.management.accountId, region },
        tags: stackTags(config, 'management'),
        terminationProtection: true,
        config,
        management: config.management,
      })
    : undefined;

  const test = accounts.test
    ? new WorkloadStage(app, 'Test', {
        env: { account: accounts.test, region },
        stackNamePrefix: 'Foundation-Test',
        tags: stackTags(config, 'test'),
      })
    : undefined;

  const prod = accounts.prod
    ? new WorkloadStage(app, 'Prod', {
        env: { account: accounts.prod, region },
        stackNamePrefix: 'Foundation-Prod',
        tags: stackTags(config, 'prod'),
      })
    : undefined;

  return { management, test, prod };
}
