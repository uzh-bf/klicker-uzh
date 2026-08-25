# 38. Live-quiz response-count migration and reconciliation

- **Status:** Accepted — 2026-08-25
- **Context:** [ADR 0003](./0003-promote-stg-via-release-annotation-write-back.md)

## Context

Live-quiz response counts are moving from legacy Redis sets to numeric
counters and an age-trimmed replay-claim sorted set. Staging currently rolls
all fifteen components together per promotion, so the migration has a real
mixed-version gap. Processing also has a non-idempotent partial-write trade-off
when one aggregation command succeeds before a later command fails.

## Decision

Use numeric received and processed counters for reporting. Keep the legacy
sets read-only for compatibility and baseline initialization. Do not use the
ordinary all-fifteen staging promotion for this cutover unless mixed versions
are proven counter-compatible or an explicit rollout deploys GraphQL before
ingress, drains old response processors, initializes counters, and then runs
only new processors.

Preflight validation and a failure before any aggregation command succeeds
release the replay claim and allow Hatchet to retry. A failure after a
non-idempotent command succeeds retains the claim, returns
`reconciliation_required`, and is acknowledged and logged for reconciliation
instead of being automatically retried.

The persisted-operation manifest retains the previous `GetCockpitQuiz` hash
while older Manage bundles drain. The compatibility entry is rebuilt after
GraphQL code generation by
`packages/graphql/scripts/merge-persisted-query-compatibility.mjs` and is
removed only in a deliberate follow-up after the old bundle is retired.

## Consequences

Counters remain bounded and duplicate retries do not repeat already-applied
commands. Post-write reconciliation is operational work, and the rollout gate
remains until compatibility or the required deployment order is proven.
