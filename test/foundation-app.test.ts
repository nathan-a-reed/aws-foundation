import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App, type Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.ts';
import { addFoundation } from '../lib/foundation-app.ts';

const allAccounts = {
  MANAGEMENT_ACCOUNT_ID: '111122223333',
  TEST_ACCOUNT_ID: '444455556666',
  PROD_ACCOUNT_ID: '777788889999',
  COST_ALERT_EMAIL: 'alerts@example.com',
};

function createApp(variables: Record<string, string> = allAccounts) {
  const app = new App({ outdir: mkdtempSync(join(tmpdir(), 'foundation-')) });
  const foundation = addFoundation(app, loadConfig(variables));
  const stacks: Record<string, Stack | undefined> = {
    management: foundation.management,
    test: foundation.test?.baseline,
    prod: foundation.prod?.baseline,
  };
  return { app, foundation, stacks };
}

describe('addFoundation', () => {
  it('creates the management stack and a stage for each workload account', () => {
    const { stacks } = createApp();

    expect(stacks.management?.stackName).toBe('Foundation-Management-Organization');
    expect(stacks.test?.stackName).toBe('Foundation-Test-Baseline');
    expect(stacks.prod?.stackName).toBe('Foundation-Prod-Baseline');
  });

  it('leaves out environments without an account ID', () => {
    const { foundation } = createApp({ TEST_ACCOUNT_ID: '444455556666' });

    expect(foundation.management).toBeUndefined();
    expect(foundation.prod).toBeUndefined();
    expect(foundation.test).toBeDefined();
  });

  it.each([
    ['management', '111122223333'],
    ['test', '444455556666'],
    ['prod', '777788889999'],
  ])('deploys the %s stack to its account in us-east-1', (environment, account) => {
    const { stacks } = createApp();

    expect(stacks[environment]?.account).toBe(account);
    expect(stacks[environment]?.region).toBe('us-east-1');
  });

  it.each(['management', 'test', 'prod'])(
    'tags the %s stack for cost allocation',
    (environment) => {
      const { app, stacks } = createApp();
      const stack = stacks[environment];
      if (!stack) {
        throw new Error(`No ${environment} stack`);
      }

      const artifact = app.synth().getStackArtifact(stack.artifactId);

      expect(artifact.tags).toEqual({
        Project: 'aws-foundation',
        Environment: environment,
        Repository: 'nathan-a-reed/aws-foundation',
      });
    },
  );

  it.each(['management', 'test', 'prod'])(
    'fails synthesis when a %s resource breaks an AwsSolutions rule',
    (environment) => {
      const { app, stacks } = createApp();
      const stack = stacks[environment];
      if (!stack) {
        throw new Error(`No ${environment} stack`);
      }
      // A bucket with default settings has no TLS-only policy or access logging.
      new Bucket(stack, 'NonCompliantBucket');

      expect(() => app.synth()).toThrow(/AwsSolutions-S10/);
    },
  );
});
