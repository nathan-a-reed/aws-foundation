import { describe, expect, it } from 'vitest';
import { loadConfig, stackTags } from '../lib/config.ts';

describe('loadConfig', () => {
  it('reads an account ID for each environment variable that is set', () => {
    const config = loadConfig({
      MANAGEMENT_ACCOUNT_ID: '111122223333',
      TEST_ACCOUNT_ID: '444455556666',
      PROD_ACCOUNT_ID: '777788889999',
    });

    expect(config.accounts).toEqual({
      management: '111122223333',
      test: '444455556666',
      prod: '777788889999',
    });
  });

  it('leaves out environments without an account ID', () => {
    const config = loadConfig({ TEST_ACCOUNT_ID: '444455556666', PROD_ACCOUNT_ID: '' });

    expect(config.accounts).toEqual({ test: '444455556666' });
  });

  it('rejects an account ID that is not 12 digits', () => {
    expect(() => loadConfig({ PROD_ACCOUNT_ID: '7777-8888-9999' })).toThrow(
      'PROD_ACCOUNT_ID must be a 12-digit AWS account ID.',
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
