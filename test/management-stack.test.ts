import { Match } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { exampleAccounts as accounts, exampleVariables, managementTemplate } from './fixtures.ts';

const alertEmail = exampleVariables.COST_ALERT_EMAIL;

interface BudgetResource {
  Properties: {
    NotificationsWithSubscribers: {
      Notification: { NotificationType: string; Threshold: number; ThresholdType: string };
      Subscribers: { SubscriptionType: string; Address: string }[];
    }[];
  };
}

describe('ManagementStack budgets', () => {
  it('limits the whole organization to $60 a month with no account filter', () => {
    const template = managementTemplate();

    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetName: 'Organization monthly',
        BudgetLimit: { Amount: 60, Unit: 'USD' },
        CostFilters: Match.absent(),
      }),
    });
  });

  it.each([
    ['management', 5],
    ['test', 15],
    ['prod', 40],
  ] as const)('limits the %s account to $%i a month', (environment, amount) => {
    const template = managementTemplate();

    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetLimit: { Amount: amount, Unit: 'USD' },
        CostFilters: { LinkedAccount: [accounts[environment]] },
      }),
    });
  });

  it('emails at 50%, 80%, and 100% of actual spend and 100% of forecast on every budget', () => {
    const template = managementTemplate();
    const budgets = Object.values(
      template.findResources('AWS::Budgets::Budget'),
    ) as BudgetResource[];

    expect(budgets).toHaveLength(4);
    for (const budget of budgets) {
      const notifications = budget.Properties.NotificationsWithSubscribers.map(
        ({ Notification, Subscribers }) => ({
          type: Notification.NotificationType,
          threshold: Notification.Threshold,
          thresholdType: Notification.ThresholdType,
          subscribers: Subscribers,
        }),
      );

      expect(notifications).toEqual(
        [
          ['ACTUAL', 50],
          ['ACTUAL', 80],
          ['ACTUAL', 100],
          ['FORECASTED', 100],
        ].map(([type, threshold]) => ({
          type,
          threshold,
          thresholdType: 'PERCENTAGE',
          subscribers: [{ SubscriptionType: 'EMAIL', Address: alertEmail }],
        })),
      );
    }
  });

  it('excludes credits and refunds so alerts track gross spend', () => {
    const template = managementTemplate();

    template.allResourcesProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        CostTypes: { IncludeCredit: false, IncludeRefund: false },
      }),
    });
  });
});

describe('ManagementStack cost anomaly detection', () => {
  it('monitors all three accounts', () => {
    const template = managementTemplate();

    template.hasResourceProperties('AWS::CE::AnomalyMonitor', {
      MonitorType: 'CUSTOM',
      MonitorSpecification: JSON.stringify({
        Dimensions: {
          Key: 'LINKED_ACCOUNT',
          Values: [accounts.management, accounts.test, accounts.prod],
        },
      }),
    });
  });

  it('emails a daily summary of anomalies with an impact of $5 or more', () => {
    const template = managementTemplate();
    const [monitorId] = Object.keys(template.findResources('AWS::CE::AnomalyMonitor'));

    template.hasResourceProperties('AWS::CE::AnomalySubscription', {
      Frequency: 'DAILY',
      MonitorArnList: [{ 'Fn::GetAtt': [monitorId, 'MonitorArn'] }],
      Subscribers: [{ Type: 'EMAIL', Address: alertEmail }],
      ThresholdExpression: JSON.stringify({
        Dimensions: {
          Key: 'ANOMALY_TOTAL_IMPACT_ABSOLUTE',
          MatchOptions: ['GREATER_THAN_OR_EQUAL'],
          Values: ['5'],
        },
      }),
    });
  });
});
