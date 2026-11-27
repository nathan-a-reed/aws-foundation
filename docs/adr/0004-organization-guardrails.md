# 0004: Organization guardrails

## Status

Accepted

## Context

`docs/standards/aws.md` requires service control policies on the `Workloads` OU that deny leaving the organization, actions outside `us-east-1` other than global services, root user actions, and changes to the organization trail, plus an organization trail and an alert on root sign-in. Test and prod already have centralized root access, with member root credentials removed. Organizations and CloudTrail policies are account-wide, so mistakes affect every application.

## Decision

- An organization trail in the management account records management events from every account and Region, with log file validation, to an S3 bucket with S3-managed encryption, blocked public access, a TLS-only policy, 365-day expiration, and retention when the stack is deleted.
- Two SCPs are attached to the `Workloads` OU:
  - `workloads-baseline` denies `organizations:LeaveOrganization`, changes to the trail named `organization-trail`, and every action by the root user unless the session comes from centralized root access (`aws:AssumedRoot` present).
  - `workloads-region-restriction` denies actions outside `us-east-1`, exempting the global services listed in the AWS example policy, with no principal exemptions.
- Statements follow the published examples in `aws-samples/service-control-policy-examples`.
- An EventBridge rule in `us-east-1` sends root console sign-ins in the management account to an SNS topic that emails `SECURITY_ALERT_EMAIL`.
- The organization ID and OU ID are deploy-time variables, like account IDs.

## Alternatives

- **One SCP per rule:** clearer names, but an OU allows only five attached SCPs, including `FullAWSAccess`.
- **Root denial without the `aws:AssumedRoot` exemption:** stricter, but blocks privileged tasks such as unlocking a bucket policy until the SCP is detached.
- **Encrypting the alert topic with a customer managed key:** satisfies cdk-nag `AwsSolutions-SNS2`, but costs about $1 a month to protect a message that only says a sign-in happened. The AWS managed SNS key cannot be used because EventBridge cannot publish with it.
- **Alert rules in every Region:** catches sign-ins through regional endpoints, but adds a stack per Region for a rare event the trail already records.

## Consequences

- A new global service used by an application must be added to the Region restriction's exemptions.
- Services that route requests to other Regions, such as Amazon Bedrock cross-Region inference, are denied in test and prod unless the Region restriction is extended. AWS publishes a variant of the example policy for Bedrock.
- The trail name is fixed, because the SCP protects it by name.
- The trail bucket has no access logging (acknowledged `AwsSolutions-S1`), and the alert topic is unencrypted (acknowledged `AwsSolutions-SNS2`).
- SCPs do not apply to the management account. It relies on Identity Center, MFA, and the root sign-in alert.
