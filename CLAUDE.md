# CLAUDE.md: Foundation / aws-foundation

## Project

AWS Organization baseline shared by every application: accounts and guardrails, IAM Identity Center, GitHub deployment roles, DNS for `nathanreed.dev`, and budgets. Application repositories consume it through the SSM contract in `docs/standards/aws.md`.

| | |
|---|---|
| Jira project | `FND`: https://nathan-a-reed.atlassian.net/browse/FND |
| Confluence space | To be decided |
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

The CDK app is added in FND-9. Until then there is nothing to build or test.

## Architecture

Planned layout, created in FND-9:

```
bin/app.ts        Entry point: management stack and test/prod stages
lib/config.ts     Typed per-account configuration
lib/stacks/       Management, account baseline, DNS
lib/constructs/   Reusable constructs
test/             Assertion tests
docs/adr/         Architecture decision records
docs/standards/   Synced from engineering-standards
```

Rules:

- The management stack is deployed manually with Identity Center credentials. CI never has access to the management account.
- Values other repositories need are published only as SSM parameters under `/foundation/`. Never use CloudFormation exports across repositories.
- Changing or removing a `/foundation/` parameter is a breaking change for every application.
- Account IDs come from environment configuration, never source.

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

- Required CI checks: `PR hygiene`; build and test checks are added in FND-9
- Merge strategy: squash merge
- Extra checklist items: notable `cdk diff` output for infrastructure changes

## Restrictions and known issues

- Do not edit `docs/standards/` here. Change `engineering-standards`, then sync.
- Organization, account, and Identity Center setup (FND-6 to FND-8) happens in the AWS console, not in code.

## Overrides of standards

None.
