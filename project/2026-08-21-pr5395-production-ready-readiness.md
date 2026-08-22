# Production readiness — PR #5469

## Scope

- Target: `rs/pr5395-production-ready`, dependent on PR #5395.
- Parent head: `66f91ad4950421f411bf666d0f35b2ff09e000ea`.
- Reviewed child code head: `7adee1787ad39c96f9e8e615a6d152305dbe1792`.
- Evidence-only report commit on the pushed branch: `16faf59cf9651970a707f90d2e6a31e5148041f9`.
- Immutable review range: `66f91ad4950421f411bf666d0f35b2ff09e000ea..7adee1787ad39c96f9e8e615a6d152305dbe1792`.

## Verdict

**not-ready**. The branch passes the repository checks run for the latest commit, and the completed-retry, assessment-access, workflow-output, and concurrent-retry response-path defects are fixed. Production exposure still requires a safe Redis contribution/reconciliation contract, database-target parity, an ordered rollout and rollback gate, autonomous replay, bounded workflow waiting, and runtime/capacity evidence that cannot be established from this checkout.

## Prior gates

| Gate | Artifact or evidence | Status |
| --- | --- | --- |
| Production-readiness brief | `project/_local/reviews/2026-08-21-pr5395-production-ready-readiness-brief.md` | current-head brief updated |
| Eight-dimension readiness wave | Config, data, deployment, resilience, observability, docs, performance, and UX reviews | completed; findings dispositioned below |
| Simplifier | Configured simplifier could not read its encrypted task; native fallback review recorded in the execution evidence | fallback completed; safe reductions applied, broader refactor deferred |
| Integrated final review | Native Sol final-reviewer review of `66f..7adee1787` | completed; not-ready findings remain |
| Security checks | Gitleaks, CodeQL, SonarCloud, and repository CI on the pushed branch | terminal for current head `01ff09c15`: 45 checks green, one flaky Playwright shard failed (see findings) |

## Resolved before this head

| Issue | Resolution | Evidence |
| --- | --- | --- |
| Hatchet output was read as a flat status object | Unwrap the `process-assessment-response` task result before mapping HTTP status. | `apps/response-api/src/index.ts:498-510`; pinned SDK 1.9.4 returns a task-keyed map. |
| Acceptance was backdated to HTTP receipt | Set `acceptedAt` inside the worker persistence transaction and keep `submittedAt` as receipt time. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:211-300`. |
| Terminal validation errors looked like outages | Clear the pending marker and return stable `422 invalid_response`; reserve `503` for retryable processing failures. | `apps/hatchet-worker-response-processor/src/index.ts:54-68`; `apps/response-api/src/index.ts:505-523`. |
| Deleted correction evidence remained referenced | Archive plan now records removal of the transient log and screenshots after durable conclusions were retained. | `project/plans_archive/PLAN-assessment-element-quiz-participants.md:242-292,378-382`. |
| Correction transaction loaded unnecessary response JSON | Select only the response id and point fields used by the correction upsert. | `packages/graphql/src/services/courses.ts:1039-1055`. |
| Redis aggregation type was checked twice for the vote marker | Let `addSet` own the hash-type check. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:909-915`. |
| Workflow `208` could acknowledge an old worker's correction-only marker | Re-read the response identity under the worker lock and return `208` only for a genuine same-correlation response with no pending effect; otherwise return retryable `503`. | `apps/response-api/src/index.ts:314-405`. |
| Concurrent same-correlation retry could return `200` after the first worker completed | Return `208` when persistence finds the genuine response but its effect has already been deleted. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:1041-1047`. |

## Findings

| Severity | Dimension | Finding | Evidence | Required action | Verification |
| --- | --- | --- | --- | --- | --- |
| blocker | Migration and schema | The response API only checks PostgreSQL connectivity, while the request and worker require new acceptance columns and `AssessmentResponseEffect`. The migration path was rewritten after earlier committed forms. | `apps/response-api/src/index.ts:755-779`; `packages/prisma/src/prisma/schema/migrations/20260821120000_live_quiz_response_acceptance/migration.sql`; prior migration history | Inventory every distinct assessment database, run `prisma migrate status`, verify the final schema and migration checksum, and add a forward migration if any target applied an earlier form. Make the release gate fail closed on schema mismatch. | unverified; no target database was accessed |
| blocker | Rollout and rollback | An old worker can treat a pending marker as a duplicate, and an unordered rollback can leave accepted rows or effects unapplied. | `apps/response-api/src/index.ts:420-501`; `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:848-856,1018-1026`; `docs/async-and-workers.md` | Deploy the new worker before the API, drain old work, gate new intake during rollback, retain the new worker until pending markers and effects are zero, then roll back the worker while retaining the additive schema. Add a forward replay procedure when drain is impossible. | unverified; no mixed-version or rollback run |
| blocker | Redis data integrity | The completion marker is written in the same `MULTI/EXEC` as the increments. Redis can execute earlier commands before reporting a later command error, so the marker can coexist with a partial aggregate; deleting it would make the next retry double-count the successful increments. The current hash counters have no per-response ledger or reconciliation path. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:1276-1317`; Sol final review of `66f..622f`; worker follow-up review | Replace the marker-only protocol with an idempotent per-response contribution ledger or a proven reconciliation/compensation design, then fault-inject a mid-transaction error and prove the effect remains recoverable without double increments. | confirmed statically; no safe bounded patch in the current representation |
| major | Recovery | `AssessmentResponseEffect` rows are deleted after Redis completion but have no worker-owned drainer after the finite Hatchet retry budget. Recovery depends on a later client retry or operator intervention not defined in the branch. | `apps/hatchet-worker-response-processor/src/index.ts:52-69`; `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:1049-1057`; `docs/async-and-workers.md:60-72` | Add an idempotent bounded drainer, or publish a values-safe replay command with backlog and age alerts, ownership, and completion evidence. | unverified; no crash-after-commit replay run |
| major | Timeouts and backpressure | The API waits synchronously for Hatchet, PostgreSQL, and Redis without an application-level deadline or queue-capacity gate. | `apps/response-api/src/index.ts:368-371`; `apps/hatchet-worker-response-processor/src/index.ts:52-55` | Set aligned API, ingress, and workflow deadlines; return the retryable response before the serving boundary while preserving the durable correlation marker. Verify stalled-worker behavior. | unverified; no ingress or Hatchet runtime |
| major | Capacity | The worker persistence path and response-API acceptance path each acquire a quiz-wide PostgreSQL advisory lock, while whole-quiz corrections perform sequential per-instance/per-participant updates in one transaction. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:176-195`; `apps/response-api/src/index.ts:535-555`; `packages/graphql/src/services/courses.ts:1890-2045` | Exercise expected-peak same-instance submissions plus concurrent correction against real PostgreSQL/Redis. Record p95/p99 latency, lock waits, Redis conflicts, queue depth, and bounded correction duration before broad enablement. | unverified; no production-sized load run |
| major | Observability | No current-head runtime evidence proves alerts for workflow failure, pending-marker age, effect backlog, replay latency, Redis conflicts, or correction-audience anomalies. | `apps/response-api/src/index.ts:675-697`; worker logging and effect paths | Add or verify values-free metrics and alerts for the listed queues, ages, failures, and response latency. Validate the alert path during a controlled dependency failure. | unverified; no runtime or monitoring target |
| major | Operability | The wiki explains the acceptance contract but does not provide a runnable release procedure with target inventory, worker registration/drain signals, rollback abort criteria, replay steps, and owners. | `docs/async-and-workers.md`; `docs/domain-model.md`; `project/2026-08-21-pr5395-production-hardening-plan.md` | Add or link the executable deployment and recovery runbook before release approval. | unverified; documentation action remains open |
| medium | Configuration | Static inspection found no new secret or production environment variable, but API/worker database, Redis, Hatchet, tenant, and `ASSESSMENT_MODE` parity were not proven in a deployed environment. | `apps/response-api/src/index.ts:755-779`; `apps/hatchet-worker-response-processor/src/index.ts:101-112` | Run a values-free preflight that compares target identities and required-key presence, proves workflow registration, and performs one synthetic handshake after migration. | unverified; no environment was started |
| minor | CI | Exact-head Playwright shard 1 failed once in the public-evaluation-link flow (`O-live-quiz.spec.ts`, 10-second attachment timeout), and the dependent status check failed with it. The branch changes no Playwright files, and the identical suite passed all eight shards on `v3` (`d9e9b46a`) about thirty minutes later. | [failed job](https://github.com/uzh-bf/klicker-uzh/actions/runs/32598170617/job/97095186906); [green v3 run](https://github.com/uzh-bf/klicker-uzh/actions/runs/32599386679) | Treat as environment flake based on the recorded cross-run comparison; rerun the affected workflow before release only if the release owner requires a fully green exact-head record. | confirmed via cross-run comparison |

## Evidence established

- The parent branch was refreshed from `origin/v3`; both parent and child conflict resolutions are pushed.
- `pnpm run check:all` passed in the commit hooks for the two fix commits, and the repository build passed in the pre-push hooks.
- Response API and response-processor type checks passed; response-state tests passed 6/6.
- The pushed branch head is `16faf59cf9651970a707f90d2e6a31e5148041f9` for backend review coverage of code head `7adee1787ad39c96f9e8e615a6d152305dbe1792`; exact-head CI later became terminal on documentation head `01ff09c151d92d612aeb36ab0a2e6457af38f376` with 45 green checks and the flaky-shard failure recorded above.
- The simplifier pass used the native fallback because the configured simplifier task was unreadable. It found and the branch applied the reducer initialization, local decomposition, status mapping, and correction-helper simplifications; it deferred only a larger typed-closure refactor for repeated correction arguments because it would widen stable transaction plumbing.
- Native Sol reviewed `66f91ad..7adee1787` and verified the workflow-`208`, concurrent-retry, correction locking, and deleted docs/log fixes. The Redis contribution/reconciliation, autonomous replay, timeout, migration, rollback, contention, and runtime gates remain open. Sol rejected the separate marker-TTL concern because existing live-quiz cleanup expires the quiz keyspace, and found no added-test bloat.
- The correction logic and response workflow were reviewed across the eight readiness dimensions. No secrets, raw data, runtime credentials, staging, or production systems were accessed.

## Not checked

- No live or production-like PostgreSQL, Redis, Hatchet, ingress, staging, or production coordinates were available.
- No migration target, backup/restore, mixed-version rollout, rollback, worker crash, Redis interruption, or autonomous replay was executed.
- No load, latency, queue-drain, or capacity run was executed.
- No browser run was needed for changed frontend code; the inherited assessment client still needs a current-head response-contract check.
- Exact-head GitHub CI for current child head `01ff09c15` is terminal: 45 checks green and two failures caused by one flaky Playwright shard plus its dependent status check; the native Sol review of code head `7adee1787` remains complete and returns not-ready on the open operational blockers above.

## Handoffs

- Migration parity, deployment ordering, schema readiness, backup/restore, live health, and rollback remain release-owner gates.
- Recovery backlog and replay ownership remain open until an automatic drainer or runnable operator procedure exists.
- The configured simplifier provider could not read its encrypted task, so the native fallback result is recorded here. No cluster, runtime, migration target, or secret-bearing environment was accessed.
