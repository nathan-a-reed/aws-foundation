export type EnvironmentName = 'management' | 'test' | 'prod';

/** Monthly cost limits in US dollars. */
export interface MonthlyBudgets {
  readonly organization: number;
  readonly management: number;
  readonly test: number;
  readonly prod: number;
}

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
  readonly budgets: MonthlyBudgets;
  /** Total impact in US dollars at which a cost anomaly is emailed. */
  readonly anomalyAlertThresholdUsd: number;
  /** Address for budget and anomaly alerts. Set whenever the management account is. */
  readonly costAlertEmail?: string;
}

export const accountIdVariables: Readonly<Record<EnvironmentName, string>> = {
  management: 'MANAGEMENT_ACCOUNT_ID',
  test: 'TEST_ACCOUNT_ID',
  prod: 'PROD_ACCOUNT_ID',
};

const environmentNames = Object.keys(accountIdVariables) as EnvironmentName[];
const accountIdPattern = /^\d{12}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reads account IDs and the cost alert address from environment variables.
 * Both are kept out of source; CI provides them from GitHub environment
 * variables and workstation deploys from the shell.
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

  const emailValue = variables.COST_ALERT_EMAIL?.trim();
  const costAlertEmail = emailValue === '' ? undefined : emailValue;

  if (accounts.management) {
    // The management stack budgets each member account, so it needs their IDs.
    if (!accounts.test || !accounts.prod) {
      throw new Error('MANAGEMENT_ACCOUNT_ID also requires TEST_ACCOUNT_ID and PROD_ACCOUNT_ID.');
    }
    if (!costAlertEmail) {
      throw new Error('MANAGEMENT_ACCOUNT_ID also requires COST_ALERT_EMAIL.');
    }
  }
  if (costAlertEmail && !emailPattern.test(costAlertEmail)) {
    throw new Error('COST_ALERT_EMAIL must be an email address.');
  }

  return {
    project: 'aws-foundation',
    repository: 'nathan-a-reed/aws-foundation',
    region: 'us-east-1',
    accounts,
    budgets: { organization: 60, management: 5, test: 15, prod: 40 },
    anomalyAlertThresholdUsd: 5,
    costAlertEmail,
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
