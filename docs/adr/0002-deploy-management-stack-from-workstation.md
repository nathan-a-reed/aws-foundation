# 0002: Deploy the management stack from a workstation

## Status

Accepted

## Context

The management account holds the Organization, service control policies, the organization trail, budgets, and domain registration. Anyone who can change it can weaken the guardrails on every account. Test and prod change often and are deployed by GitHub Actions through OIDC; the management account changes rarely.

CDK's default synthesizer deploys through bootstrap roles in the target account, so every account a stack deploys to must be bootstrapped.

## Decision

- `Foundation-Management-Organization` is deployed only from a workstation, with an Identity Center `AdministratorAccess` session (MFA, one-hour sessions).
- The management account has no GitHub OIDC provider and no deployment role. CI synthesizes the management stack with example account IDs on every pull request but never deploys it.
- Management, test, and prod are bootstrapped in `us-east-1` with the default `cdk bootstrap` template, termination protection, and no `--trust` option. Each account's bootstrap roles trust only that account.
- In test and prod, the GitHub deployment roles live in the same account and may assume only that account's bootstrap roles.

## Alternatives

- **Deploy management from CI through OIDC:** consistent and automated, but a compromised workflow or repository could change the guardrails for the whole organization, and `docs/standards/aws.md` forbids CI access to management.
- **Leave management unbootstrapped and use a bootstrapless synthesizer:** avoids CDK resources in the account, but cannot publish assets and departs from the default CDK deployment path.
- **A separate deployment account with cross-account trust:** isolates deployment credentials, but adds an account and trust relationships that a single maintainer does not need.

## Consequences

- Management changes need a person with an Identity Center session and are applied after the pull request merges, not by the pipeline. Deploy promptly after merging so the account matches `main`.
- The management account holds the CDK bootstrap resources: an S3 bucket, an ECR repository, and roles that trust only the account itself.
- Bootstrap uses the default CloudFormation execution policy, `AdministratorAccess`. Narrowing it is a separate decision.
- When a CDK release requires a newer bootstrap version, all three accounts are bootstrapped again with the same procedure.
