# 0005: GitHub OIDC deployment roles

## Status

Accepted. The subject format is superseded by [ADR 0008](0008-immutable-oidc-subjects.md).

## Context

`docs/standards/aws.md` requires GitHub Actions to authenticate to test and prod through OIDC, with one deployment role per repository and account, trusted only for `repo:<owner>/<repo>:environment:<test|prod>`, and allowed only to assume the CDK bootstrap roles. No AWS access keys are stored in GitHub. Application repositories need their role ARNs before their first pipeline run.

## Decision

- `Foundation-Test-Baseline` and `Foundation-Prod-Baseline` each define a GitHub OIDC provider for `https://token.actions.githubusercontent.com` with the `sts.amazonaws.com` audience. It uses the native `AWS::IAM::OIDCProvider` resource, with no thumbprints, since IAM validates GitHub's certificate against its trusted CA library.
- Each repository in `deploymentRepositories` (`lib/config.ts`) gets one role per account. Its trust policy allows `sts:AssumeRoleWithWebIdentity` from that provider with `StringEquals` on the token's `aud` (`sts.amazonaws.com`) and `sub` (`repo:<owner>/<repo>:environment:<test|prod>`). No wildcards are used.
- Each role's only permission is `sts:AssumeRole` on the account's deploy, file publishing, and image publishing bootstrap roles (default qualifier `hnb659fds`). The lookup role is left out, because the standards forbid `fromLookup`.
- Roles have generated names. Each role ARN is a stack output (not an export), to be copied into the repository's `AWS_DEPLOY_ROLE_ARN` GitHub environment variable.
- The management account has no provider and no roles ([ADR 0002](0002-deploy-management-stack-from-workstation.md)).

## Alternatives

- **One shared deployment role per account:** fewer resources, but any repository could deploy as any other, and CloudTrail would not show which repository acted.
- **Trust on branch (`ref:refs/heads/main`) instead of environment:** works without GitHub environments, but bypasses environment protection rules such as required approval for prod.
- **Fixed role names:** predictable ARNs, but the standards forbid hardcoded physical names, and a rename would replace the role.
- **Publishing role ARNs as SSM parameters:** fits the `/foundation/` contract, but a pipeline needs the ARN before it can authenticate to read SSM.

## Consequences

- Adding a repository means adding it to `deploymentRepositories`, deploying the baseline stacks, and setting `AWS_ACCOUNT_ID` and `AWS_DEPLOY_ROLE_ARN` in that repository's `test` and `prod` GitHub environments.
- A repository's GitHub environment protection rules are what separate test from prod deploys. The `prod` environment must require approval and allow only `main`.
- The bootstrap execution role uses `AdministratorAccess` ([ADR 0002](0002-deploy-management-stack-from-workstation.md)), so any deployment role can change any resource in its account through CloudFormation, including other repositories' stacks and these roles. Narrowing the execution policy is a separate decision.
- A repository that customizes its OIDC subject claim template will not match the trust policy.
- Removing a repository from the list deletes its roles and breaks its pipeline.
