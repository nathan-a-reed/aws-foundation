# CLAUDE.md: Foundation / aws-foundation

## Project

AWS Organization baseline shared by every application: accounts and guardrails, IAM Identity Center, GitHub deployment roles, DNS for `nathanreed.dev`, and budgets. Application repositories consume it through the SSM contract in `docs/standards/aws.md`.

| | |
|---|---|
| Jira project | `FND`: https://nathan-a-reed.atlassian.net/browse/FND |
| Confluence space | `ENG` (Engineering): https://nathan-a-reed.atlassian.net/wiki/spaces/ENG |
| Default branch | `main` |
| Related repos | `engineering-standards` (source of `docs/standards/`), `portfolio-site` (planned), `outage-atlas`, `nasa-rag` |

## Standards

@CONTRIBUTING.md
@docs/standards/agent-workflow.md
@docs/standards/engineering.md
@docs/standards/security.md
@docs/standards/aws.md

## Jira workflow

| Status | Transition to reach it |
|---|---|
| To Do | To Do |
| In Progress | In Progress |
| In Review | In Review |
| Done | Done |

Issue types: Epic, Story, Task, Bug, Feature, Subtask

## Tech stack

- Infrastructure: AWS CDK in TypeScript, strict mode
- Testing: CDK assertion tests
- CI/CD: GitHub Actions with OIDC for test and prod; the management stack is deployed from a workstation

## Commands

Node.js 24 runs the TypeScript directly through type stripping; there is no build step.

| Command | Purpose |
|---|---|
| `npm ci` | Install dependencies |
| `npm run format:check` / `npm run format` | Check or apply Prettier formatting |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` type check (no emit) |
| `npm test` | Vitest assertion tests |
| `npm run synth` | `cdk synth` with cdk-nag; needs account IDs, for example `MANAGEMENT_ACCOUNT_ID=111122223333 TEST_ACCOUNT_ID=444455556666 PROD_ACCOUNT_ID=777788889999 COST_ALERT_EMAIL=costs@example.com SECURITY_ALERT_EMAIL=security@example.com ORGANIZATION_ID=o-a1b2c3d4e5 WORKLOADS_OU_ID=ou-a1b2-c3d4e5f6` (see `test/fixtures.ts`) |

## Architecture

```
bin/app.ts             Entry point: management stack and test/prod stages
lib/config.ts          Typed configuration; account IDs from environment variables
lib/foundation-app.ts  Adds a stack or stage per environment that has an account ID
lib/stacks/            Management and account baseline stacks
lib/stages/            Stage for each workload account
lib/constructs/        Budgets, anomaly alerts, organization trail, SCPs, root sign-in alert
test/                  Assertion tests
docs/adr/              Architecture decision records
docs/standards/        Synced from engineering-standards
```

Stacks: `Foundation-Management-Organization` (construct path `Management`), `Foundation-Test-Baseline` (`Test/Baseline`), `Foundation-Prod-Baseline` (`Prod/Baseline`).

Rules:

- The management stack is deployed manually with Identity Center credentials. CI never has access to the management account.
- Values other repositories need are published only as SSM parameters under `/foundation/`. Never use CloudFormation exports across repositories.
- Changing or removing a `/foundation/` parameter is a breaking change for every application.
- Account IDs come from environment configuration, never source: `MANAGEMENT_ACCOUNT_ID`, `TEST_ACCOUNT_ID`, `PROD_ACCOUNT_ID`. An environment without one is left out of the app. The management stack also needs the test and prod IDs, `COST_ALERT_EMAIL`, `SECURITY_ALERT_EMAIL`, `ORGANIZATION_ID`, and `WORKLOADS_OU_ID`; organization and OU IDs stay out of source like account IDs.
- Use erasable TypeScript only (no enums, namespaces, or parameter properties); relative imports end in `.ts`.
- cdk-nag v3 runs as a policy validation plugin on the app. Acknowledge findings on the specific resource with `Validations.of(resource).acknowledge({ id: 'AwsSolutions::AwsSolutions-<rule>', reason })`.
- Tests build apps with `createTestApp()` from `test/fixtures.ts`, which loads the `cdk.json` feature flags so tests match `cdk synth`.
- SCP statements follow `aws-samples/service-control-policy-examples`; the organization trail name is fixed because the baseline SCP protects it by name.
- Stack tags are passed as the `tags` stack prop (`stackTags()` in `lib/config.ts`); `@aws-cdk/core:explicitStackTags` is on.

## Conventions

- Commit scopes: `org` (Organization, SCPs, Identity Center), `billing`, `dns`, `iam` (deployment roles), `ci`, `docs`
- Avoid: `fromLookup` methods, hardcoded physical names, alpha CDK modules

## Testing

- Requirements: assertion tests for security-critical properties: SCP statements, trust policy conditions, encryption, and public access.
- External services: none; tests run against synthesized templates.
- Known flaky tests: None.

## Configuration and secrets

No secrets are needed. Deployment targets are GitHub environment variables:

| Variable | Environments | Purpose |
|---|---|---|
| `AWS_ACCOUNT_ID` | `test`, `prod` | Target account |
| `AWS_DEPLOY_ROLE_ARN` | `test`, `prod` | Role assumed through OIDC |

## Pull requests

- Required CI checks: `PR hygiene / PR hygiene`, `Quality`, `Tests`, `Synth`
- Merge strategy: squash merge

## Confluence page map

When asked for a Confluence update, these are the pages to change:

| Change | Page |
|---|---|
| Organization, accounts, or Identity Center setup | AWS account setup runbook: https://nathan-a-reed.atlassian.net/wiki/spaces/ENG/pages/1835028 |
| DNS | DNS migration runbook: https://nathan-a-reed.atlassian.net/wiki/spaces/ENG/pages/1867777 |
| Budgets or cost | Cost and budgets: https://nathan-a-reed.atlassian.net/wiki/spaces/ENG/pages/1671189 |
| Release | Release notes: https://nathan-a-reed.atlassian.net/wiki/spaces/ENG/pages/1376290 |

## Restrictions and known issues

- Do not edit `docs/standards/` here. Change `engineering-standards`, then sync.
- Organization, account, and Identity Center setup (FND-6 to FND-8) happens in the AWS console, not in code.

## Overrides of standards

None.
