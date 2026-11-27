# 0003: Budgets and cost anomaly detection

## Status

Accepted

## Context

`docs/standards/aws.md` sets monthly limits for the organization ($60), prod ($40), test ($15), and management ($5), with alerts at 50%, 80%, and 100% of actual spend and at 100% of forecast spend, and cost anomaly detection across all accounts. AWS Budgets and Cost Explorer have only L1 constructs in CDK. The alert address is personal data and stays out of source.

## Decision

- The management stack defines the four budgets and the anomaly detection, since the management account sees billing for the whole organization.
- `MonthlyCostBudget` and `CostAnomalyAlerts` wrap the L1 resources. Account budgets filter on the linked account; the organization budget has no filter.
- Budgets exclude credits and refunds, so alerts track gross spend.
- Anomaly detection uses one customer managed monitor over the three account IDs, with a daily email summary of anomalies whose total impact is $5 or more.
- Alerts go by email directly from AWS Budgets and Cost Anomaly Detection, to the address in `COST_ALERT_EMAIL`, set at deploy time.

## Alternatives

- **AWS managed services monitor:** covers new accounts automatically, but an account can have only one, and AWS may already have created a default one, which would make the deploy fail.
- **Immediate anomaly alerts through SNS:** faster, but adds a topic and policy for spend that changes slowly at this scale.
- **Budgets that include credits:** credits would hide real usage until they run out.
- **Alert address in source or `cdk.json`:** simpler to deploy, but puts personal data in a public repository.

## Consequences

- A new account needs its own budget and must be added to the anomaly monitor.
- Every management deploy needs `TEST_ACCOUNT_ID`, `PROD_ACCOUNT_ID`, and `COST_ALERT_EMAIL` as well as `MANAGEMENT_ACCOUNT_ID`.
- Budgets without actions and Cost Anomaly Detection have no charge.
- Cost allocation tags are activated once from the CLI after AWS has seen them; CloudFormation has no resource for this.
