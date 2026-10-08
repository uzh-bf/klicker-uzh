# Release quota for metered failed graph builds

## Approval summary

This source slice implements the user's existing no-charge-for-failures rule
from P6 of the graph-cost accounting plan. A valid failed result currently
settles the reported amount against lecturer quota. A late provider success
rejected as stale also ends as FAILED while consuming quota.

Use the existing transaction and quota lock to release those reservations,
record zero user charge, and retain provider costs and token counters for
diagnostics. Preserve published graphs, duplicate-result idempotency, identity
and currency validation, integer bounds, and human review for ambiguous holds.
Successful and superseded builds retain their existing settlement behavior.
Previously settled failures are not refunded by this source patch.

Approval mode: executable batch, derived from the approved P6 direction and the
explicit user policy that failed builds are not charged. Main owns this package
in solo mode. Ordinary task-branch commits, non-force pushes and draft PR
publication are standing-authorized. Merge, ready status, deployment, live
accounting repairs, paid generation and CLI/global configuration changes retain
their existing separate boundaries.

## Execution details

- Repository: KlickerUZH. Worktree: `trees/rs/kg-failed-metering-release`.
- Branch: `rs/kg-failed-metering-release`; target: `v3-ai` at
  `a36af5e6af09e3fa801b521beca6f14f265aee38`.
- Parent: P6 in the existing local `2026-09-21-kg-graph-cost-metering-plan.md`
  and the KG roadmap. The estimate and fallback choices remain open.
- Package: one cohesive backend defect correction, full path because it changes
  a quota invariant. No schema, dependency, service or stack change.
- Named files: `knowledgeGraphAccounting.ts`, its existing integration suite,
  ADR 0013, and this execution artifact. No new executable module.

Verification uses the existing PostgreSQL integration suite. The two changed
regressions cover provider failure and a stale late success. They require zero
user charge and released reservation; the provider-failure fixture also proves
retained diagnostics, unchanged prior quota charges, preserved publication and
one-time settlement under duplicate delivery. Reuse existing success, currency,
overflow and ambiguous-hold coverage by running the whole accounting suite.
Run required repository checks before source publication. Simplification and
final review are main-session self-reviews; they are not independent evidence.

## Progress

- Source and the two existing failure regressions prepared. Test delta: two
  changed tests, no new suite. The complete accounting integration suite passed
  all 13 tests in the worktree's disposable PostgreSQL runtime on 2026-10-08.
  The later test-title correction does not change its behavior or assertions.
- Biome checks, Prettier checks and `git diff --check` passed. Required Git-hook
  checks and build, committed-scope self-review, and draft delivery remain pending.
- Installed devrouter is 0.1.0; this target requires 0.1.2. The pinned CLI from a
  temporary npm cache successfully started the exact worktree with profile
  `email`. Workspace/provider identity: `rs-kg-failed-metering-release`.
  No application routes or background app processes were selected.
- No model call, production mutation, commit or PR has occurred. Stop the exact
  runtime after the last container check and verify provider state and routes.
