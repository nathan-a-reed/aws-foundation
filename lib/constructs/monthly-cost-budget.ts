import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface MonthlyCostBudgetProps {
  /** Name shown in the console and in alert emails. */
  readonly budgetName: string;
  readonly limitUsd: number;
  /** Limits the budget to one account. Omit to cover the whole organization. */
  readonly accountId?: string;
  readonly alertEmail: string;
}

const actualSpendThresholds = [50, 80, 100];
const forecastSpendThreshold = 100;

/**
 * Monthly cost budget that emails at 50%, 80%, and 100% of actual spend and
 * at 100% of forecast spend. Wraps the L1 resource because AWS Budgets has no
 * L2 construct.
 */
export class MonthlyCostBudget extends Construct {
  public readonly budget: CfnBudget;

  constructor(scope: Construct, id: string, props: MonthlyCostBudgetProps) {
    super(scope, id);

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];
    const notification = (notificationType: 'ACTUAL' | 'FORECASTED', threshold: number) => ({
      notification: {
        notificationType,
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers,
    });

    this.budget = new CfnBudget(this, 'Resource', {
      budget: {
        budgetName: props.budgetName,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.limitUsd, unit: 'USD' },
        ...(props.accountId ? { costFilters: { LinkedAccount: [props.accountId] } } : {}),
        // Credits and refunds would hide spend, so alerts track gross cost.
        costTypes: { includeCredit: false, includeRefund: false },
      },
      notificationsWithSubscribers: [
        ...actualSpendThresholds.map((threshold) => notification('ACTUAL', threshold)),
        notification('FORECASTED', forecastSpendThreshold),
      ],
    });
  }
}
