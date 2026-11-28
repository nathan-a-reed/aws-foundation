# 0008: Immutable GitHub OIDC subjects in deployment role trust

## Status

Accepted. Supersedes the subject format in [ADR 0005](0005-github-oidc-deployment-roles.md).

## Context

ADR 0005 trusts each deployment role for the subject `repo:<owner>/<repo>:environment:<test|prod>`. The repositories use GitHub's immutable subject claims, so their tokens carry `repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:<test|prod>`. AWS compared the two with `StringEquals` and denied `sts:AssumeRoleWithWebIdentity`, so the Deploy workflow could not authenticate (FND-23).

## Decision

- Each deployment role trusts its repository's immutable subject for its environment, for example `repo:nathan-a-reed@149594858/aws-foundation@1470959404:environment:test`. Everything else in ADR 0005 stands.
- `deploymentRepositories` (`lib/config.ts`) holds each repository's owner ID and repository ID. They come from the repository's subject claim prefix (`GET /repos/{owner}/{repo}/actions/oidc/customization/sub`) and are public, so they live in source.
- Role construct IDs, names, and outputs are unchanged, so the role ARNs in the GitHub environment variables stay valid.

## Alternatives

- **Turn immutable subjects off in each repository:** keeps the ADR 0005 format, but a repository deleted and recreated under the same name would match the old trust.
- **Trust both formats:** works during a migration, but there is no other format in use, and it widens the trust for no benefit.

## Consequences

- A new repository needs its owner and repository IDs added with its name, and must use immutable subjects.
- Renaming a repository does not break its role trust, but the role keeps its old construct ID and description.
- The pipeline cannot deploy this change, because its own role trust is what changes. The test and prod baseline stacks are deployed once from a workstation.
- `docs/standards/aws.md` still describes the ADR 0005 format and is updated in `engineering-standards`.
