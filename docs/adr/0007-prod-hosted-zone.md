# 0007: Prod hosted zone for nathanreed.dev

## Status

Accepted

## Context

`docs/standards/aws.md` puts the `nathanreed.dev` zone in prod, delegates `test.nathanreed.dev` to test, and gives applications the zone through `/foundation/dns/zone-name` and `/foundation/dns/zone-id`. The current zone is in the management account, its records were added by hand, and the domain's registration delegates to its name servers. DNSSEC is off: the zone is not signing and the `.dev` registry has no DS record for the domain. Mail for the domain runs through Google Workspace, so the move must not change any answers. One record, `server.nathanreed.dev`, points to a home lab address, which is personal data and cannot go into this public repository.

## Decision

- `Foundation-Prod-Baseline` defines a public hosted zone `nathanreed.dev` with every record set of the current zone except its NS and SOA records, with the same names, types, TTLs, and values. The records are listed in `lib/dns/prod-zone-records.ts`.
- The zone is retained if the stack is deleted, so the registered name servers never point at a deleted zone.
- The stack publishes `/foundation/dns/zone-name` and `/foundation/dns/zone-id` as SSM parameters and outputs the zone's name servers.
- The `server` A record's address comes from `SERVER_IP_ADDRESS` at deploy time. Synthesizing the prod stage without it fails, so a deploy cannot delete the record. CI reads it from a secret in the `prod` GitHub environment, because the workflow logs of a public repository are public and secrets are masked in them.
- DNSSEC signing and query logging are not enabled, so the cutover needs no DNSSEC changes.
- The cutover and the removal of the old zone follow the DNS migration runbook (FND-16).

## Alternatives

- **Import the current zone into a stack:** keeps the zone ID and name servers, but the zone is in the management account, which CI must not change, and moving a hosted zone between accounts is not supported.
- **Commit the home lab address:** simpler, but it is personal data and would stay in the repository's history.
- **Leave the zone in the management account:** no migration, but application stacks in prod could not manage records in it.

## Consequences

- Workstation deploys of prod, and of the management stack, which includes the prod stage, need `SERVER_IP_ADDRESS` set.
- When the home lab address changes, the variable and the secret are updated and prod is redeployed.
- Records added by hand to the new zone are not tracked and could conflict with later stack changes. All changes go through `lib/dns/prod-zone-records.ts`.
- Mail authentication records (SPF, DKIM, DMARC) do not exist in the current zone and are not added here.
