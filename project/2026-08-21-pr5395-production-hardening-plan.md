# PR #5395 production-hardening plan

## Goal

Publish a dependent draft PR whose base is Patrick’s exact head for #5395. The
dependent change must make assessment response acceptance, correction audience
selection, response persistence, and Redis aggregation resumable under retries
and concurrent corrections without carrying newer `v3` history.

Merge, deployment, and production data actions remain outside this plan.

## Research and baseline

- Parent PR: `feat/assessment-element-quiz-participants` at
  `9bb527b8d8cdf4e49c8f24e5a108a7163ad53b87`.
- Dependent branch: `rs/pr5395-production-ready`.
- The prior readiness and Sol reviews identified two code gates: queued responses
  omitted from quiz-participant corrections and post-commit Redis work that could
  not resume. Database-level race evidence remains a release verification gate;
  the shared advisory-lock path is covered by the focused correction suite.
- The transient correction change log is removed. This plan is the durable
  execution record; no review report or private runtime output is committed.

## Primitive impact

| Existing primitive | Change | Boundary |
| --- | --- | --- |
| `LiveQuizResponse` lifecycle | Extend it with an acceptance timestamp and correlation identity. Correction-only rows can therefore represent an accepted but not-yet-materialized response without creating a second response identity. | The compound response identity remains `(instanceId, elementBlockExecution, participantId)`. |
| Assessment response processing | Add one `AssessmentResponseEffect` row per persisted response. The row carries the exact aggregation input until Redis confirms the effect. | Legacy genuine rows without an effect remain terminally complete; new rows always create the effect atomically. |
| Quiz-participant correction audience | Compose validated genuine responses and legacy-compatible rows at one cutoff under a quiz-level advisory lock. | Validated `acceptedAt` before the cutoff is included; pending markers are excluded. Pre-migration genuine rows without `acceptedAt` use `submittedAt`. |

## Implementation slices

### S0 — dependent baseline

Transplant only the reviewed correction fixes: placeholder materialization,
per-response advisory locking, legacy cache compatibility, deterministic
ordering, post-commit quiz-audience audit delivery, audit payload normalization,
and removal of the transient docs log.

Acceptance: the parent-relative diff contains no newer `v3` commits and the
primary checkout and earlier readiness worktree remain untouched.

### S1 — durable response completion

Add acceptance fields and the effect migration. The response API writes a
pending marker under the shared quiz lock, runs the named Hatchet workflow with
`runAndWait`, returns success only after persistence and Redis effects complete,
and returns a retryable 503 when workflow execution fails or an incompatible
worker returns a terminal duplicate. It validates course participation, binds
the signed block execution through the workflow, preserves the first acceptance
timestamp, and returns a non-success result for late responses. The worker
creates or materializes the response and effect atomically, recognizes exact
retries, and does not treat a pending effect as a duplicate.

### S2 — idempotent aggregation

Run votes, result counters, response hashes, leaderboards, XP, and a per-response
completion marker in one watched Redis transaction on a dedicated connection.
Validate every target key and counter before the transaction, reject command
level errors, and delete the database effect only after the transaction
succeeds or its marker proves it already succeeded.

### S3 — bounded correction reads and writes

Resolve quiz participants with a database-side distinct query over the current
block execution and accepted cutoff. Apply correction cells in deterministic
sequence so concurrent correction and response transactions acquire shared
identity locks in a stable order.

### S4 — verification and review

Run focused worker, GraphQL, Prisma, response API, and Redis checks, then the
repository checks/build. Add or retain tests for response state retries,
current-execution audience filtering, and acceptance-before-correction ordering.
Run the required simplifier, data-integrity slice review, and final Sol review
on the immutable integrated range.

## Test portfolio

| Behavior | Evidence |
| --- | --- |
| Response state and legacy cache fallback | Worker unit tests. |
| Correction audience boundary | PostgreSQL GraphQL correction tests with a validated marker, a pending marker, and legacy genuine-row fallback. |
| Response/correction identity race | Shared advisory-lock implementation plus focused PostgreSQL correction tests; production-sized concurrent race remains an external gate. |
| Redis replay | Watched transaction and per-response marker in the aggregation path; production Redis replay evidence remains an external gate. |
| Schema compatibility | Prisma generate, migration validation, analytics schema sync, package checks. |

## Release gates not proven by local code

Current-head remote CI and image artifacts, migration-target parity, worker-first
rollout and queue drain, client/ingress latency for synchronous completion,
browser/accessibility proof, and production-sized contention remain explicit
release checks. The PR must not be described as deployed or merged until those
environmental proofs are current.

## Terminal condition

Create and push the dependent draft PR against Patrick’s branch, verify the
stack base and current-head CI, and leave merge and deployment withheld.
