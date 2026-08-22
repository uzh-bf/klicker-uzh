# Production readiness — PR #5469

## Scope

- Target: `rs/pr5395-production-ready`, dependent on PR #5395.
- Parent head: `66f91ad4950421f411bf666d0f35b2ff09e000ea`.
- Reviewed child head: `b6409723d5a2fb77e5d0a0fb1f897532b0d8c92f`.
- Immutable review range: `feat/assessment-element-quiz-participants..b6409723d5a2fb77e5d0a0fb1f897532b0d8c92f`.

## Verdict

**not-ready**. The current branch passes repository checks and the two statically confirmed response-path defects found in the audit are fixed. Production exposure still requires database-target parity, an ordered rollout and rollback gate, runtime failure/replay proof, and capacity evidence that cannot be established from this checkout.

## Prior gates

| Gate | Artifact or evidence | Status |
| --- | --- | --- |
| Production-readiness brief | `project/_local/reviews/2026-08-21-pr5395-production-ready-readiness-brief.md` | current-head brief updated |
| Eight-dimension readiness wave | Config, data, deployment, resilience, observability, docs, performance, and UX reviews | completed; findings dispositioned below |
| Simplifier | Configured simplifier provider could not read the encrypted task; native fallback requested | pending |
| Integrated final review | Configured Sol final-reviewer gate | pending |
| Security checks | Gitleaks, CodeQL, and CI security analysis on the pushed branch | CI rerun pending at this head |

## Resolved before this head

| Issue | Resolution | Evidence |
| --- | --- | --- |
| Hatchet output was read as a flat status object | Unwrap the `process-assessment-response` task result before mapping HTTP status. | `apps/response-api/src/index.ts:498-510`; pinned SDK 1.9.4 returns a task-keyed map. |
| Acceptance was backdated to HTTP receipt | Set `acceptedAt` inside the worker persistence transaction and keep `submittedAt` as receipt time. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:211-300`. |
| Terminal validation errors looked like outages | Clear the pending marker and return stable `422 invalid_response`; reserve `503` for retryable processing failures. | `apps/hatchet-worker-response-processor/src/index.ts:54-68`; `apps/response-api/src/index.ts:505-523`. |
| Deleted correction evidence remained referenced | Archive plan now records removal of the transient log and screenshots after durable conclusions were retained. | `project/plans_archive/PLAN-assessment-element-quiz-participants.md:242-292,378-382`. |

## Findings

| Severity | Dimension | Finding | Evidence | Required action | Verification |
| --- | --- | --- | --- | --- | --- |
| blocker | Migration and schema | The response API only checks PostgreSQL connectivity, while the request and worker require new acceptance columns and `AssessmentResponseEffect`. The migration path was rewritten after earlier committed forms. | `apps/response-api/src/index.ts:594`; `packages/prisma/src/prisma/schema/migrations/20260821120000_live_quiz_response_acceptance/migration.sql`; prior migration history | Inventory every distinct assessment database, run `prisma migrate status`, verify the final schema and migration checksum, and add a forward migration if any target applied an earlier form. Make the release gate fail closed on schema mismatch. | unverified; no target database was accessed |
| blocker | Rollout and rollback | An old worker can treat a pending marker as a duplicate, and an unordered rollback can leave accepted rows or effects unapplied. | `apps/response-api/src/index.ts:420-501`; `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:848-856,1018-1026`; `docs/async-and-workers.md` | Deploy the new worker before the API, drain old work, gate new intake during rollback, retain the new worker until pending markers and effects are zero, then roll back the worker while retaining the additive schema. Add a forward replay procedure when drain is impossible. | unverified; no mixed-version or rollback run |
| major | Recovery | `AssessmentResponseEffect` rows are deleted after Redis completion but have no worker-owned drainer after the finite Hatchet retry budget. Recovery depends on a later client retry or operator intervention not defined in the branch. | `apps/hatchet-worker-response-processor/src/index.ts:52-69`; `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:1018-1026`; `docs/async-and-workers.md:60-72` | Add an idempotent bounded drainer, or publish a values-safe replay command with backlog and age alerts, ownership, and completion evidence. | unverified; no crash-after-commit replay run |
| major | Timeouts and backpressure | The API waits synchronously for Hatchet, PostgreSQL, and Redis without an application-level deadline or queue-capacity gate. | `apps/response-api/src/index.ts:496-501`; `apps/hatchet-worker-response-processor/src/index.ts:52-55` | Set aligned API, ingress, and workflow deadlines; return the retryable response before the serving boundary while preserving the durable correlation marker. Verify stalled-worker behavior. | unverified; no ingress or Hatchet runtime |
| major | Capacity | The direct worker path has a three-attempt Redis `WATCH` loop, normal responses acquire a quiz-wide PostgreSQL advisory lock twice, and whole-quiz corrections do sequential per-cell work in one transaction. | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:1043-1105`; `apps/response-api/src/index.ts:366-388`; `packages/graphql/src/services/courses.ts:1890-2045` | Exercise expected-peak same-instance submissions plus concurrent correction against real PostgreSQL/Redis. Record p95/p99 latency, lock waits, Redis conflicts, queue depth, and bounded correction duration before broad enablement. | unverified; no production-sized load run |
| major | Observability | No current-head runtime evidence proves alerts for workflow failure, pending-marker age, effect backlog, replay latency, Redis conflicts, or correction-audience anomalies. | `apps/response-api/src/index.ts:594-611`; worker logging and effect paths | Add or verify values-free metrics and alerts for the listed queues, ages, failures, and response latency. Validate the alert path during a controlled dependency failure. | unverified; no runtime or monitoring target |
| major | Operability | The wiki explains the acceptance contract but does not provide a runnable release procedure with target inventory, worker registration/drain signals, rollback abort criteria, replay steps, and owners. | `docs/async-and-workers.md`; `docs/domain-model.md`; `project/2026-08-21-pr5395-production-hardening-plan.md` | Add or link the executable deployment and recovery runbook before release approval. | unverified; documentation action remains open |
| medium | Configuration | Static inspection found no new secret or production environment variable, but API/worker database, Redis, Hatchet, tenant, and `ASSESSMENT_MODE` parity were not proven in a deployed environment. | `apps/response-api/src/index.ts:574-611`; `apps/hatchet-worker-response-processor/src/index.ts:101-112` | Run a values-free preflight that compares target identities and required-key presence, proves workflow registration, and performs one synthetic handshake after migration. | unverified; no environment was started |

## Evidence established

- The parent branch was refreshed from `origin/v3`; both parent and child conflict resolutions are pushed.
- `pnpm run check:all` passed in the commit hooks for the two fix commits, and the repository build passed in the pre-push hooks.
- Response API and response-processor type checks passed; response-state tests passed 6/6.
- The pushed head is `b6409723d5a2fb77e5d0a0fb1f897532b0d8c92f`; GitHub CI has been requested for this exact head.
- The correction logic and response workflow were reviewed across the eight readiness dimensions. No secrets, raw data, runtime credentials, staging, or production systems were accessed.

## Not checked

- No live or production-like PostgreSQL, Redis, Hatchet, ingress, staging, or production coordinates were available.
- No migration target, backup/restore, mixed-version rollout, rollback, worker crash, Redis interruption, or autonomous replay was executed.
- No load, latency, queue-drain, or capacity run was executed.
- No browser run was needed for changed frontend code; the inherited assessment client still needs a current-head response-contract check.
- CI, the fallback simplifier, and the configured Sol final-reviewer were not terminal at the time this report was written.

## Handoffs

- Migration parity, deployment ordering, schema readiness, backup/restore, live health, and rollback remain release-owner gates.
- Recovery backlog and replay ownership remain open until an automatic drainer or runnable operator procedure exists.
- The final Sol review must cover the immutable range above after CI reaches a terminal state; the configured simplifier provider needs a native fallback because its encrypted task could not be read.
