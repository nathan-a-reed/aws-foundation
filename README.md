# aws-foundation

AWS Organization baseline for the `nathanreed.dev` projects: accounts and guardrails, sign-in through IAM Identity Center, GitHub deployment roles, DNS, and budgets. Application repositories build on it through a small contract of SSM parameters.

**Status:** repository setup. Infrastructure code is added in upcoming changes.

## Accounts

| Account | Purpose | Changed by |
|---|---|---|
| Management | Organization, Identity Center, billing, budgets, organization trail, domain registration | Manual deploys from a workstation |
| Test | Test stage of every application, `test.nathanreed.dev` zone | GitHub Actions on merge to `main` |
| Prod | Production stage of every application, `nathanreed.dev` zone | GitHub Actions after approval |

## What this repository manages

- Service control policies and an organization CloudTrail trail
- Budgets and cost anomaly detection
- GitHub OIDC deployment roles for each application repository
- Hosted zones for `nathanreed.dev` and `test.nathanreed.dev`
- SSM parameters under `/foundation/` that applications read at deploy time

## Contract for applications

Applications read these parameters in their own account and never reference foundation resources directly.

| Parameter | Value |
|---|---|
| `/foundation/dns/zone-name` | The account's hosted zone name |
| `/foundation/dns/zone-id` | The account's hosted zone ID |

Changing or removing a parameter is a breaking change: the replacement is added first, consumers migrate, and the original is removed last.

## Development

Prerequisites, commands, and the bootstrapping procedure are added with the CDK app.

## Standards

Work in this repository follows [CONTRIBUTING.md](CONTRIBUTING.md) and the shared standards in [`docs/standards/`](docs/standards), synced from [engineering-standards](https://github.com/nathan-a-reed/engineering-standards).

## License

[MIT](LICENSE)
