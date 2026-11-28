export type EnvironmentName = 'management' | 'test' | 'prod';

/** Monthly cost limits in US dollars. */
export interface MonthlyBudgets {
  readonly organization: number;
  readonly management: number;
  readonly test: number;
  readonly prod: number;
}

/** Settings only the management stack needs. */
export interface ManagementConfig {
  readonly accountId: string;
  /** Member accounts, budgeted and monitored from the management account. */
  readonly testAccountId: string;
  readonly prodAccountId: string;
  readonly organizationId: string;
  /** The `Workloads` organizational unit that holds test and prod. */
  readonly workloadsOuId: string;
  /** Address for budget and anomaly alerts. */
  readonly costAlertEmail: string;
  /** Address for root sign-in alerts. */
  readonly securityAlertEmail: string;
}

export interface FoundationConfig {
  /** Value of the `Project` tag. */
  readonly project: string;
  /** Value of the `Repository` tag. */
  readonly repository: string;
  readonly region: string;
  /**
   * Repositories, as `owner/name`, that get a GitHub OIDC deployment role in
   * the test and prod accounts.
   */
  readonly deploymentRepositories: readonly string[];
  /**
   * Account IDs for the environments to synthesize. An environment without an
   * account ID is left out of the app, so a deployment can never target an
   * account it was not given.
   */
  readonly accounts: Readonly<Partial<Record<EnvironmentName, string>>>;
  /** Present when `MANAGEMENT_ACCOUNT_ID` is set. */
  readonly management?: ManagementConfig;
  readonly budgets: MonthlyBudgets;
  /** Total impact in US dollars at which a cost anomaly is emailed. */
  readonly anomalyAlertThresholdUsd: number;
  /** Name of the organization trail, referenced by the guardrail SCP. */
  readonly organizationTrailName: string;
  /** Days before trail log files are deleted. */
  readonly trailLogRetentionDays: number;
}

export const accountIdVariables: Readonly<Record<EnvironmentName, string>> = {
  management: 'MANAGEMENT_ACCOUNT_ID',
  test: 'TEST_ACCOUNT_ID',
  prod: 'PROD_ACCOUNT_ID',
};

const environmentNames = Object.keys(accountIdVariables) as EnvironmentName[];

const formats = {
  accountId: { pattern: /^\d{12}$/, description: 'a 12-digit AWS account ID' },
  email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, description: 'an email address' },
  organizationId: { pattern: /^o-[a-z0-9]{10,32}$/, description: 'an organization ID (o-...)' },
  ouId: {
    pattern: /^ou-[a-z0-9]{4,32}-[a-z0-9]{8,32}$/,
    description: 'an organizational unit ID (ou-...)',
  },
} as const;

type Variables = Readonly<Record<string, string | undefined>>;
type Format = keyof typeof formats;

function readVariable(variables: Variables, name: string, format: Format): string | undefined {
  const value = variables[name]?.trim();
  if (!value) {
    return undefined;
  }
  const { pattern, description } = formats[format];
  if (!pattern.test(value)) {
    throw new Error(`${name} must be ${description}.`);
  }
  return value;
}

function requireForManagement(variables: Variables, name: string, format: Format): string {
  const value = readVariable(variables, name, format);
  if (!value) {
    throw new Error(`MANAGEMENT_ACCOUNT_ID also requires ${name}.`);
  }
  return value;
}

function loadManagementConfig(
  variables: Variables,
  accounts: Partial<Record<EnvironmentName, string>>,
): ManagementConfig | undefined {
  if (!accounts.management) {
    return undefined;
  }
  if (!accounts.test || !accounts.prod) {
    throw new Error('MANAGEMENT_ACCOUNT_ID also requires TEST_ACCOUNT_ID and PROD_ACCOUNT_ID.');
  }
  return {
    accountId: accounts.management,
    testAccountId: accounts.test,
    prodAccountId: accounts.prod,
    costAlertEmail: requireForManagement(variables, 'COST_ALERT_EMAIL', 'email'),
    securityAlertEmail: requireForManagement(variables, 'SECURITY_ALERT_EMAIL', 'email'),
    organizationId: requireForManagement(variables, 'ORGANIZATION_ID', 'organizationId'),
    workloadsOuId: requireForManagement(variables, 'WORKLOADS_OU_ID', 'ouId'),
  };
}

/**
 * Reads account IDs, organization IDs, and alert addresses from environment
 * variables. They are kept out of source; CI provides them from GitHub
 * environment variables and workstation deploys from the shell.
 */
export function loadConfig(variables: Variables): FoundationConfig {
  const accounts: Partial<Record<EnvironmentName, string>> = {};

  for (const name of environmentNames) {
    const value = readVariable(variables, accountIdVariables[name], 'accountId');
    if (value) {
      accounts[name] = value;
    }
  }

  if (Object.keys(accounts).length === 0) {
    const names = environmentNames.map((name) => accountIdVariables[name]).join(', ');
    throw new Error(`Set at least one of ${names}.`);
  }

  return {
    project: 'aws-foundation',
    repository: 'nathan-a-reed/aws-foundation',
    region: 'us-east-1',
    deploymentRepositories: [
      'nathan-a-reed/aws-foundation',
      'nathan-a-reed/portfolio-site',
      'nathan-a-reed/outage-atlas',
      'nathan-a-reed/nasa-rag',
    ],
    accounts,
    management: loadManagementConfig(variables, accounts),
    budgets: { organization: 60, management: 5, test: 15, prod: 40 },
    anomalyAlertThresholdUsd: 5,
    organizationTrailName: 'organization-trail',
    trailLogRetentionDays: 365,
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
