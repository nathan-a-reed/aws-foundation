import { readFileSync } from 'node:fs';
import { App, type AppProps } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadConfig } from '../lib/config.ts';
import { addFoundation } from '../lib/foundation-app.ts';

export const exampleAccounts = {
  management: '111122223333',
  test: '444455556666',
  prod: '777788889999',
};

/** Every variable the app reads, with example values. */
export const exampleVariables = {
  MANAGEMENT_ACCOUNT_ID: exampleAccounts.management,
  TEST_ACCOUNT_ID: exampleAccounts.test,
  PROD_ACCOUNT_ID: exampleAccounts.prod,
  COST_ALERT_EMAIL: 'costs@example.com',
  SECURITY_ALERT_EMAIL: 'security@example.com',
  ORGANIZATION_ID: 'o-a1b2c3d4e5',
  WORKLOADS_OU_ID: 'ou-a1b2-c3d4e5f6',
};

const cdkJson = JSON.parse(readFileSync(new URL('../cdk.json', import.meta.url), 'utf8')) as {
  context: Record<string, unknown>;
};

/**
 * App configured like `cdk synth`: the feature flags from `cdk.json`, and the
 * `CDKMetadata` resource the CLI adds, so tests see the deployed templates.
 */
export function createTestApp(props: AppProps = {}): App {
  return new App({
    analyticsReporting: true,
    ...props,
    context: { ...cdkJson.context, ...props.context },
  });
}

export function managementTemplate(): Template {
  const { management } = addFoundation(createTestApp(), loadConfig(exampleVariables));
  if (!management) {
    throw new Error('No management stack');
  }
  return Template.fromStack(management);
}
