export type EnvironmentName = 'management' | 'test' | 'prod';

export interface FoundationConfig {
  /** Value of the `Project` tag. */
  readonly project: string;
  /** Value of the `Repository` tag. */
  readonly repository: string;
  readonly region: string;
  /**
   * Account IDs for the environments to synthesize. An environment without an
   * account ID is left out of the app, so a deployment can never target an
   * account it was not given.
   */
  readonly accounts: Readonly<Partial<Record<EnvironmentName, string>>>;
}

export const accountIdVariables: Readonly<Record<EnvironmentName, string>> = {
  management: 'MANAGEMENT_ACCOUNT_ID',
  test: 'TEST_ACCOUNT_ID',
  prod: 'PROD_ACCOUNT_ID',
};

const environmentNames = Object.keys(accountIdVariables) as EnvironmentName[];
const accountIdPattern = /^\d{12}$/;

/**
 * Reads account IDs from environment variables. Account IDs are kept out of
 * source; CI provides them from GitHub environment variables and workstation
 * deploys from the shell.
 */
export function loadConfig(
  variables: Readonly<Record<string, string | undefined>>,
): FoundationConfig {
  const accounts: Partial<Record<EnvironmentName, string>> = {};

  for (const name of environmentNames) {
    const variable = accountIdVariables[name];
    const value = variables[variable]?.trim();
    if (!value) {
      continue;
    }
    if (!accountIdPattern.test(value)) {
      throw new Error(`${variable} must be a 12-digit AWS account ID.`);
    }
    accounts[name] = value;
  }

  if (Object.keys(accounts).length === 0) {
    const names = environmentNames.map((name) => accountIdVariables[name]).join(', ');
    throw new Error(`Set at least one of ${names}.`);
  }

  return {
    project: 'aws-foundation',
    repository: 'nathan-a-reed/aws-foundation',
    region: 'us-east-1',
    accounts,
  };
}

/**
 * Tags for every foundation stack. CloudFormation propagates stack tags to the
 * stack's resources, which makes them usable as cost allocation tags.
 */
export function stackTags(
  config: FoundationConfig,
  environment: EnvironmentName,
): Record<string, string> {
  return {
    Project: config.project,
    Environment: environment,
    Repository: config.repository,
  };
}
