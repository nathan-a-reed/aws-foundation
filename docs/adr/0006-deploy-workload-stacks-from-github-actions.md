# 0006: Deploy the workload stacks from GitHub Actions

## Status

Accepted

## Context

`CONTRIBUTING.md` requires a merge to `main` to deploy to test, with promotion to prod after approval. `docs/standards/security.md` requires prod deploys to run only from `main` through a protected GitHub environment, actions pinned to commit SHAs, and explicit least-privilege workflow permissions. The management stack must never be deployed by CI ([ADR 0002](0002-deploy-management-stack-from-workstation.md)). Each workload account has an `aws-foundation` deployment role that trusts only that repository's matching GitHub environment ([ADR 0005](0005-github-oidc-deployment-roles.md)).

## Decision

- The `Deploy` workflow runs on every push to `main`. Its `Deploy test` job runs in the `test` environment and deploys `Test/*`. Its `Deploy prod` job needs the test job, runs in the `prod` environment, and deploys `Prod/*`.
- The `prod` environment requires a reviewer and allows deployments only from `main`, so prod changes wait for approval after test succeeds.
- Each job sets only its own account ID (`TEST_ACCOUNT_ID` or `PROD_ACCOUNT_ID`) from the environment's `AWS_ACCOUNT_ID`. The app leaves out environments without an account ID, so the app a job synthesizes contains no management stack. The deployment roles cannot reach the management account in any case.
- `aws-actions/configure-aws-credentials` assumes `AWS_DEPLOY_ROLE_ARN` through OIDC, with `allowed-account-ids` set to the environment's account so credentials for any other account fail the job.
- The workflow grants `contents: read` by default. Only the deploy jobs add `id-token: write`.
- Each environment has its own concurrency group without cancellation, so deploys to an account run one at a time and in order. A prod deploy waiting for approval does not block the next test deploy.
- Each job synthesizes the app from the same commit with the committed lockfile. `cdk deploy` runs cdk-nag, so a finding fails the deploy.

## Alternatives

- **CDK Pipelines (CodePipeline):** a self-mutating pipeline in AWS, but it needs a pipeline account or cross-account trust, a CodeConnections connection, and pipeline charges, for two small stacks.
- **Synthesize once and promote the cloud assembly to prod:** guarantees prod deploys the exact templates test received, but the synth job would need both account IDs outside a protected environment, and the stacks have no assets that could differ between builds.
- **Manual `workflow_dispatch` for prod:** explicit, but separates the prod deploy from the commit that passed in test, and environment approval already gives a manual gate.

## Consequences

- Workstation deploys of test and prod remain possible with an Identity Center session, for example when the pipeline is unavailable. Changes made that way should come from `main`.
- A failed test deploy stops the run before prod.
- Unapproved prod deploys accumulate as waiting runs. Approving an older one deploys that commit; later runs then deploy newer commits in order.
- Removing the `prod` environment's protection rules removes the approval gate. The workflow cannot enforce them.
