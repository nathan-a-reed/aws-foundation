import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { MonthlyBudgets } from '../config.ts';
import { CostAnomalyAlerts } from '../constructs/cost-anomaly-alerts.ts';
import { MonthlyCostBudget } from '../constructs/monthly-cost-budget.ts';

export interface ManagementStackProps extends StackProps {
  readonly accountIds: Readonly<Record<'management' | 'test' | 'prod', string>>;
  readonly budgets: MonthlyBudgets;
  readonly costAlertEmail: string;
  readonly anomalyAlertThresholdUsd: number;
}

/**
 * Organization-wide resources in the management account: guardrails, budgets,
 * and the organization trail. Deployed only from a workstation.
 */
export class ManagementStack extends Stack {
  constructor(scope: Construct, id: string, props: ManagementStackProps) {
    super(scope, id, props);

    const { accountIds, budgets, costAlertEmail: alertEmail } = props;

    new MonthlyCostBudget(this, 'OrganizationBudget', {
      budgetName: 'Organization monthly',
      limitUsd: budgets.organization,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'ManagementBudget', {
      budgetName: 'Management account monthly',
      limitUsd: budgets.management,
      accountId: accountIds.management,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'TestBudget', {
      budgetName: 'Test account monthly',
      limitUsd: budgets.test,
      accountId: accountIds.test,
      alertEmail,
    });
    new MonthlyCostBudget(this, 'ProdBudget', {
      budgetName: 'Prod account monthly',
      limitUsd: budgets.prod,
      accountId: accountIds.prod,
      alertEmail,
    });

    new CostAnomalyAlerts(this, 'CostAnomalyAlerts', {
      accountIds: [accountIds.management, accountIds.test, accountIds.prod],
      alertEmail,
      thresholdUsd: props.anomalyAlertThresholdUsd,
    });
  }
}
