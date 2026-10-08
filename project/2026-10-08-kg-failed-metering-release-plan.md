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
- Biome checks, Prettier checks, staged Gitleaks and `git diff --check` passed.
  Source commit `24fd146c1a` passed the complete pre-commit hook: all 42 workspace
  check tasks, seven lint tasks, syncpack, formatting and host contract checks.
  The host CI/runner contracts and local-KB contracts also passed separately
  (133 and 94 tests).
- Installed devrouter is 0.1.0; this target requires 0.1.2. The pinned CLI from a
  temporary npm cache successfully started the exact worktree with profile
  `email`. Workspace/provider identity: `rs-kg-failed-metering-release`.
  No application routes or background app processes were selected.
- The first hook attempt selected the older globally installed CLI in a host
  contract test. The documented `KLICKER_DEVROUTER_BIN` override to a temporary
  host launcher for the pinned CLI resolves that failure. Automatic permission
  review timed out before a commit retry; the bounded retry succeeded. No hook
  or runtime lock was bypassed, and no global CLI configuration changed.
- Main performed simplification and final self-review of
  `a36af5e6af09e3fa801b521beca6f14f265aee38..24fd146c1a`. This is self-review,
  not independent review. Validation, quota locking, one-time settlement,
  publication preservation and successful/superseded charging remain intact;
  no findings remain. Package size: 68 changed source/test lines, excluding
  project artifacts and the seven-line ADR clarification.
- The 27-task pre-push build passed and draft [PR #6431](https://github.com/uzh-bf/klicker-uzh/pull/6431)
  is published at source `24fd146c1a` (documentation head `9df10b4553`). All nine
  required hosted checks pass. Both OpenCodeReview attempts ended at
  the maximum tool-request-round limit with zero findings and no verdict;
  automated review remains incomplete. Hosted Playwright passed; final AI review
  remains pending. No further retry was attempted.
- The exact verification worktree resolves to Devsy workspace
  `rs-kg-failed-metering-release`; fresh provider status is Stopped and
  devrouter reports zero routes. The older provider identity label above is
  devrouter's shared registry field. No runtime deletion, paid model call,
  historical refund, production mutation or global CLI change occurred.
