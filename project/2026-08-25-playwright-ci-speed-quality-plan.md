# Playwright CI speed and reliability package

## Goal

Reduce avoidable Playwright CI diagnostic cost while preserving the current
test manifest, test intent, failure evidence, and shared-state execution model.
Use PR #5446 as the failure case, but do not claim that this package fixes its
course-duplication worker failure.

## Problem

- PR #5446's Playwright run repeatedly spends about 57.5 minutes in shard 8
  after course-duplication jobs fail to reach a terminal status within 150
  seconds. The other seven shards complete in roughly 10-15 minutes.
- CI retains video, traces, screenshots, HTML reports, and the service log in
  one artifact upload. A failed shard artifact is about 260 MB.
- CI retries every test once. That multiplies the cost of deterministic
  course-duplication failures and leaves later stateful tests observing the
  resulting residual state.
- The custom file-level sharder uses stale timing data, but a one-off timing
  edit is not a durable timing pipeline and does not explain the worker stall.
- `workers: 1` and `fullyParallel: false` are deliberate safety boundaries for
  specs that share seeded users, database rows, Redis keys, and Hatchet workers.

## Evidence

- PR #5446 run `32796194924` has four consecutive failed shard-8 attempts. The
  fourth attempt reports 113 passing tests in 57.5 minutes and repeated
  `Course duplication job ... did not reach a terminal status within 150000ms`
  errors, followed by strict-mode failures caused by residual duplicate state.
- The CI worker registers `process-course-duplication` before the test starts.
  Registration does not prove event delivery, handler execution, lease or
  heartbeat renewal, database reconciliation, or terminal status persistence.
- The current Playwright manifest contains 881 tests in 31 files. The baseline
  manifest is captured in `/tmp/pw-analysis/current-list.txt` for this local
  verification.
- The current branch is `fix/course-duplication-timeout` at
  `93a84c6296021fd758a5292710b76a6d9ce92dbe`, equal to its upstream and 68
  commits ahead of, 10 commits behind, `origin/v3`. Relevant package paths
  have been compared with current `origin/v3`; the artifact slice changes no
  duplicated or worker-owned paths. The three pre-existing generated GraphQL
  modifications remain excluded.

## Sol validation

- GPT-5.6 Sol planner returned `DONE_WITH_CONCERNS` on 2026-08-25.
- Sol approved only the artifact-policy slice as implementation-ready.
- Sol rejected increasing the browser wait, removing retries globally,
  changing worker count, changing sharding, or adding cleanup without tracing
  the failed job lifecycle. Those changes could hide coverage loss or permit
  duplicate course state.
- Sol deferred timing redesign until several recent successful JUnit histories
  are available and deferred in-shard parallelism until fixture hermeticity is
  established.

## Decision

Execute one narrow CI diagnostics slice now:

- Disable video only in CI. Keep local `retain-on-failure` video behavior.
- Keep JUnit results as an always-uploaded compact artifact.
- Upload HTML reports, traces, screenshots, and `service.log` only when the
  shard job fails.
- Keep test selection, retries, timeouts, workers, shard count, and test
  assertions unchanged.

Defer the following to separate packages or follow-up slices:

- Course-duplication root-cause repair: trace publication acknowledgement,
  Hatchet run state, handler start, Redis lease and heartbeat, transaction,
  retry, and terminal status before changing code.
- Timing maintenance: aggregate several recent successful JUnit reports,
  validate positive finite durations and duplicate basenames, record freshness,
  and prove deterministic exact-once shard assignment before changing the
  workflow.
- In-shard parallelism: inventory shared mutable fixtures and prove repeated
  clean runs with isolated state before raising worker count or enabling
  `fullyParallel`.

## Risk

- Failed tests that pass on retry will retain only the JUnit result in this
  slice's always-uploaded artifact. A later CI-quality slice should preserve
  retry diagnostics without restoring video for every test.
- The artifact policy reduces transfer and storage cost but does not reduce the
  execution time of a stuck course-duplication job.
- The package cannot claim PR #5446 is green until a fresh CI run proves the
  duplication job lifecycle reaches a terminal state.

## Test portfolio

| Behavior | Obligation | Primary check |
| --- | --- | --- |
| CI uses no video but local failure video remains | Extend existing configuration | Config inspection and focused Playwright TypeScript check |
| JUnit is available when a shard passes or fails | No new browser test | Workflow path and artifact-condition inspection |
| Failure diagnostics remain available | No new browser test | Workflow path inspection; later failed-CI artifact proof |
| Test coverage and ordering are unchanged | No new test | Before/after `playwright test --list --project=chromium` manifest comparison |
| Course duplication completes reliably | Deferred | Traced failed job plus repeated clean CI shard-8 run |
| Shards remain balanced | Deferred | Multi-run timing aggregation and live shard wall-time comparison |
| In-shard parallelism is safe | Deferred | Isolation inventory and repeated parallel runs |

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S0 — reviewed plan | main | Sol challenge complete | Plan committed without staging pre-existing dirty files |
| S1 — artifact policy | main | S0 | Manifest parity, formatting, TypeScript/config checks, exact diff scope |
| S2 — duplication root cause | main, proposed follow-up | Failed-job lifecycle evidence | Repeated clean duplication journey and fresh shard-8 CI success |
| S3 — timing pipeline | separate task (proposed) | Recent successful JUnit history | Deterministic exact-once packing and improved live balance |
| S4 — hermetic parallelism | separate task (proposed) | Fixture isolation design | Repeated parallel runs with unchanged coverage and lower wall time |

## Authority

- Authorized: local plan creation, local edits, focused checks, review, and
  local commits on `fix/course-duplication-timeout`.
- Withheld: push, PR update, merge, branch deletion, deployment, cluster
  changes, production access, and live-service changes.
- Preserve and exclude the pre-existing changes in:
  `packages/graphql/src/ops.ts`,
  `packages/graphql/src/public/client.json`, and
  `packages/graphql/src/public/server.json`.

## Terminal

This package reaches its local terminal when the reviewed plan and the artifact
policy slice are committed, focused checks pass, the exact diff is inspected,
and the remaining CI and parallelization gates are reported as deferred. It
does not reach a green-PR or published-delivery terminal without a later
authorized push and fresh CI evidence.

## Boundary owner

`self`

## Pause

Pause before any push, PR update, merge, deployment, live-service access, or
change to the course-duplication worker behavior. Pause if the artifact policy
requires changing test selection, retries, timeouts, or the shared-state
execution model.

## Progress

- 2026-08-25: Freshness gate completed. The matching PR worktree is reused;
  the primary checkout remains untouched.
- 2026-08-25: Sol planner challenge completed with `DONE_WITH_CONCERNS`.
- 2026-08-25: S0 plan written; S1 implementation and verification remain.
