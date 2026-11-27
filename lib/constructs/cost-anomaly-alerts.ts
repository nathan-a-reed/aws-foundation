import { CfnAnomalyMonitor, CfnAnomalySubscription } from 'aws-cdk-lib/aws-ce';
import { Construct } from 'constructs';

export interface CostAnomalyAlertsProps {
  /** Accounts monitored together. New accounts must be added here. */
  readonly accountIds: readonly string[];
  readonly alertEmail: string;
  /** Total impact in US dollars at which an anomaly is emailed. */
  readonly thresholdUsd: number;
}

/**
 * Cost anomaly detection for a set of accounts with a daily email summary.
 * A customer managed monitor is used because an account can have only one
 * AWS managed services monitor, and the default one may already exist.
 */
export class CostAnomalyAlerts extends Construct {
  public readonly monitor: CfnAnomalyMonitor;
  public readonly subscription: CfnAnomalySubscription;

  constructor(scope: Construct, id: string, props: CostAnomalyAlertsProps) {
    super(scope, id);

    this.monitor = new CfnAnomalyMonitor(this, 'Monitor', {
      monitorName: 'Foundation accounts',
      monitorType: 'CUSTOM',
      monitorSpecification: JSON.stringify({
        Dimensions: { Key: 'LINKED_ACCOUNT', Values: props.accountIds },
      }),
    });

    this.subscription = new CfnAnomalySubscription(this, 'Subscription', {
      subscriptionName: 'Foundation accounts daily',
      frequency: 'DAILY',
      monitorArnList: [this.monitor.attrMonitorArn],
      subscribers: [{ type: 'EMAIL', address: props.alertEmail }],
      thresholdExpression: JSON.stringify({
        Dimensions: {
          Key: 'ANOMALY_TOTAL_IMPACT_ABSOLUTE',
          MatchOptions: ['GREATER_THAN_OR_EQUAL'],
          Values: [String(props.thresholdUsd)],
        },
      }),
    });
  }
}
