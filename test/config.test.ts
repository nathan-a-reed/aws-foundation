import { describe, expect, it } from 'vitest';
import { loadConfig, stackTags } from '../lib/config.ts';
import { exampleVariables } from './fixtures.ts';

function without(...names: (keyof typeof exampleVariables)[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(exampleVariables).filter(
      ([name]) => !names.includes(name as keyof typeof exampleVariables),
    ),
  );
}

describe('loadConfig', () => {
  it('reads an account ID for each environment variable that is set', () => {
    const config = loadConfig(exampleVariables);

    expect(config.accounts).toEqual({
      management: '111122223333',
      test: '444455556666',
      prod: '777788889999',
    });
  });

  it('reads the management settings when the management account is set', () => {
    const config = loadConfig(exampleVariables);

    expect(config.management).toEqual({
      accountId: '111122223333',
      testAccountId: '444455556666',
      prodAccountId: '777788889999',
      organizationId: 'o-a1b2c3d4e5',
      workloadsOuId: 'ou-a1b2-c3d4e5f6',
      costAlertEmail: 'costs@example.com',
      securityAlertEmail: 'security@example.com',
    });
  });

  it('leaves out environments without an account ID', () => {
    const config = loadConfig({ TEST_ACCOUNT_ID: '444455556666', PROD_ACCOUNT_ID: '' });

    expect(config.accounts).toEqual({ test: '444455556666' });
    expect(config.management).toBeUndefined();
  });

  it('rejects an account ID that is not 12 digits', () => {
    expect(() => loadConfig({ PROD_ACCOUNT_ID: '7777-8888-9999' })).toThrow(
      'PROD_ACCOUNT_ID must be a 12-digit AWS account ID.',
    );
  });

  it('requires the member account IDs with the management account', () => {
    expect(() => loadConfig(without('PROD_ACCOUNT_ID'))).toThrow(
      'MANAGEMENT_ACCOUNT_ID also requires TEST_ACCOUNT_ID and PROD_ACCOUNT_ID.',
    );
  });

  it.each([
    'COST_ALERT_EMAIL',
    'SECURITY_ALERT_EMAIL',
    'ORGANIZATION_ID',
    'WORKLOADS_OU_ID',
  ] as const)('requires %s with the management account', (name) => {
    expect(() => loadConfig(without(name))).toThrow(`MANAGEMENT_ACCOUNT_ID also requires ${name}.`);
  });

  it.each([
    ['COST_ALERT_EMAIL', 'costs.example.com', 'an email address'],
    ['SECURITY_ALERT_EMAIL', 'security', 'an email address'],
    ['ORGANIZATION_ID', 'r-a1b2', 'an organization ID (o-...)'],
    ['WORKLOADS_OU_ID', 'o-a1b2c3d4e5', 'an organizational unit ID (ou-...)'],
  ])('rejects a malformed %s', (name, value, description) => {
    expect(() => loadConfig({ ...exampleVariables, [name]: value })).toThrow(
      `${name} must be ${description}.`,
    );
  });

  it('requires at least one account ID', () => {
    expect(() => loadConfig({})).toThrow(
      'Set at least one of MANAGEMENT_ACCOUNT_ID, TEST_ACCOUNT_ID, PROD_ACCOUNT_ID.',
    );
  });
});

describe('stackTags', () => {
  it('returns the cost allocation tags for an environment', () => {
    const config = loadConfig({ TEST_ACCOUNT_ID: '444455556666' });

    expect(stackTags(config, 'test')).toEqual({
      Project: 'aws-foundation',
      Environment: 'test',
      Repository: 'nathan-a-reed/aws-foundation',
    });
  });
});
