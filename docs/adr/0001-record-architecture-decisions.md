# 0001: Record architecture decisions

## Status

Accepted

## Context

`aws-foundation` makes decisions that every application depends on: account structure, guardrails, deployment access, and the SSM contract. The reasons behind them are lost if they live only in pull requests and tickets.

## Decision

- Significant decisions are recorded as architecture decision records in `docs/adr/NNNN-short-title.md`, numbered in sequence.
- Each record has Status, Context, Decision, Alternatives, and Consequences sections.
- A record is written for the cases listed in `docs/standards/engineering.md`: a new runtime dependency, a new AWS service, a data model, an authentication approach, or a pipeline design. In this repository that also covers guardrails and changes to the `/foundation/` contract.
- A record is added in the same pull request as the change it describes.
- Accepted records are not rewritten. A new record supersedes an old one, and the old record's status becomes `Superseded by NNNN`.

## Alternatives

- **Confluence pages:** easier to browse, but separate from the code and not reviewed with the change.
- **Pull request descriptions only:** no extra files, but hard to find later and not tied to the current state of the code.

## Consequences

- Decisions are reviewed with the code that implements them.
- The README's key decisions section links the relevant records.
