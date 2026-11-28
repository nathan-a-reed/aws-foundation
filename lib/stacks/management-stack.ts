import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { FoundationConfig, ManagementConfig } from '../config.ts';
import { CostAnomalyAlerts } from '../constructs/cost-anomaly-alerts.ts';
import { MonthlyCostBudget } from '../constructs/monthly-cost-budget.ts';
import { OrganizationTrail } from '../constructs/organization-trail.ts';
import { RootSignInAlert } from '../constructs/root-sign-in-alert.ts';
import { WorkloadGuardrails } from '../constructs/workload-guardrails.ts';

export interface ManagementStackProps extends StackProps {
  readonly config: FoundationConfig;
  readonly management: ManagementConfig;
}

/**
 * Organization-wide resources in the management account: guardrails, budgets,
 * and the organization trail. Deployed only from a workstation.
 */
export class ManagementStack extends Stack {
  constructor(scope: Construct, id: string, props: ManagementStackProps) {
    super(scope, id, props);

    const { config, management } = props;
    const { budgets } = config;

    new OrganizationTrail(this, 'OrganizationTrail', {
      organizationId: management.organizationId,
      trailName: config.organizationTrailName,
      logRetentionDays: config.trailLogRetentionDays,
    });

    new WorkloadGuardrails(this, 'WorkloadGuardrails', {
      targetIds: [management.workloadsOuId],
      allowedRegion: config.region,
      organizationTrailName: config.organizationTrailName,
    });

    new RootSignInAlert(this, 'RootSignInAlert', {
      alertEmail: management.securityAlertEmail,
    });

    const alertEmail = management.costAlertEmail;
    new MonthlyCostBudget(this, 'OrganizationBudget', {
      budgetName: 'Organization monthly',
      limitUsd: budgets.organization,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'ManagementBudget', {
      budgetName: 'Management account monthly',
      limitUsd: budgets.management,
      accountId: management.accountId,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'TestBudget', {
      budgetName: 'Test account monthly',
      limitUsd: budgets.test,
      accountId: management.testAccountId,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'ProdBudget', {
      budgetName: 'Prod account monthly',
      limitUsd: budgets.prod,
      accountId: management.prodAccountId,
      alertEmail,
    });

    new CostAnomalyAlerts(this, 'CostAnomalyAlerts', {
      accountIds: [management.accountId, management.testAccountId, management.prodAccountId],
      alertEmail,
      thresholdUsd: config.anomalyAlertThresholdUsd,
    });
  }
}
