# Production readiness — PR #5469

## Verdict

**not-ready**. The integrated branch is statically healthy and the current-head GitHub analysis checks pass, but production readiness cannot be established without migration-target parity, runtime DB/Redis/Hatchet proof, rollout/rollback evidence, and current-head standing review artifacts. The focused PostgreSQL correction test did not reach assertions because this host cannot access Docker Buildx state, and the exact DevPod runtime cannot be reconciled.

## Prior gates

| Gate | Artifact | Status |
| --- | --- | --- |
| Code/spec review | No current-head artifact in `project/_local/reviews/` | missing |
| Simplifier | Sol review recorded in the execution context; no artifact | stale/non-artifact |
| Data-integrity slice review | No current-head artifact in `project/_local/reviews/` | missing |
| Integrated outcome review | Prior findings addressed in `61dd3061d`; no current-head artifact | stale/non-artifact |
| Security review | No current-head artifact in `project/_local/reviews/` | missing |

## Findings

| Severity | Dimension | Finding | Evidence | Proposed action | Verification |
| --- | --- | --- | --- | --- | --- |
| blocker | Deploy and rollback | Migration safety depends on every target database being at the same pre-migration state. The migration is intentionally rewritten to the simplified first-application form; applying it after an older draft form would fail or require a follow-up migration. | `packages/prisma/src/prisma/schema/migrations/20260821120000_live_quiz_response_acceptance/migration.sql`; PR release gates | Before merge/deploy, inventory migration history and run `prisma migrate status` for every runtime database. If any database applied the older form, publish a forward follow-up migration rather than rewriting history. | unverified |
| blocker | Failure modes and resilience | The response API now waits for the worker and Redis effect, but production-sized timeout, queue-drain, replay, and dependency-failure behavior is not proven. | `apps/response-api/src/index.ts`; local runtime unavailable; no DB/Redis/Hatchet integration run | Run a production-like integration and contention test with fault injection, then set and monitor bounded API/workflow timeouts and retry behavior. | unverified |
| blocker | Data safety | The acceptance marker and response-keyed outbox are additive and statically validated, but backup/restore and crash-boundary behavior for the new rows are not proven against a real PostgreSQL instance. | Prisma validation/build passed; Docker-backed GraphQL test blocked before assertions | Apply the migration in an isolated runtime, exercise worker crash/replay and restore, and retain migration/rollback evidence. | unverified |
| major | Observability | The assessment API now checks PostgreSQL connectivity at startup, but this audit found no current-head runtime evidence for outbox backlog, worker failure, replay latency, or correction-audience anomalies. | `apps/response-api/src/index.ts`; runtime unavailable | Add or verify alerts and dashboards for workflow failures, pending markers, outbox age/backlog, Redis replay failures, and response latency before production exposure. | unverified |
| major | Docs and operability | The domain and async-worker wiki pages explain the pending/validated acceptance contract, but the release-specific migration parity, worker-first rollout, drain, and recovery procedure is not established as a runnable operator runbook. | `docs/async-and-workers.md`, `docs/domain-model.md`; PR release gates | Add or link a deployment runbook covering migration state checks, worker drain, API rollout, outbox replay, rollback boundaries, and owner/escalation paths. | unverified |
| major | Performance and capacity | Synchronous workflow completion changes the response request latency and couples API capacity to worker, PostgreSQL, Redis, and Hatchet contention. No production-like load or p95/p99 evidence is available. | `apps/response-api/src/index.ts`; full build is not a load test | Measure p95/p99 response latency, queue depth, DB/Redis contention, and failure rates at expected peak participation before enabling the path broadly. | unverified |
| minor | Configuration and secrets | No new secret or environment variable was introduced by this branch; static package checks and CI security analysis pass. Runtime configuration parity remains untested because no environment was started. | Current diff; GitGuardian and analysis checks pass | Verify the deployed worker/API image and environment use matching workflow names and migration state during the release preflight. | unverified |
| minor | UX / operator experience | The branch does not change frontend files. User-visible error semantics for pending, late, retryable, and failed responses were not driven in a browser or production-like client. | `apps/response-api/src/index.ts`; no running instance | Run the inherited assessment response flow in the browser against the current head and confirm retry/conflict/error copy and accessibility behavior. | unverified |

## Evidence already established

- `61dd3061d3db8f041472e71f1387016cd6b8aff0` is pushed to `rs/pr5395-production-ready` and remains a draft dependent PR targeting Patrick’s branch.
- `pnpm run check:all` passed all 24 tasks in the commit hook.
- The full repository build passed all 22 tasks.
- Prisma build/validate/schema sync, GraphQL check, response-api check, response-processor check, formatting, diff check, and isolated analytics lint passed.
- Response-processor tests passed 6/6, including correction replay, repeated deltas, overflow rejection, and signed 64-bit range validation.
- Current-head GitHub checks pass for Java/Kotlin analysis, JavaScript/TypeScript analysis, Python analysis, and GitGuardian.
- The focused GraphQL correction test stopped before test assertions because Docker Buildx activity-state access was denied. The DevPod/devrouter runtime was separately blocked by a missing workspace-owner/process-identity lock.
- Sol’s simplification review passed the response-keyed outbox shape. The follow-up correction review agreed with the pending-marker, worker-validation, and lock-order contract. A fresh configured `final-reviewer` route was unavailable under provider rate limiting, so no new formal final-reviewer artifact exists for this exact head.

## Not checked

- No live or production-like URL, PostgreSQL, Redis, or Hatchet coordinates were available.
- No migration was applied to a disposable or target database at this exact head.
- No concurrent response/correction race, worker crash, Redis interruption, replay, restore, or rollback was executed at runtime.
- No load, latency, queue-drain, or capacity run was executed.
- No browser or accessibility run was executed; the changed surface is backend/worker/schema only, but the inherited client flow still needs current-head proof.
- No eight-worker production-readiness wave could be completed because the configured final-reviewer provider route was rate-limited; the findings above are the orchestrator’s evidence-backed disposition, not claimed worker coverage.

## Handoffs

- Code/spec compliance and the integrated code outcome belong to `$code-review` and the final-reviewer gate. No current-head artifacts are present in `project/_local/reviews/`.
- Security-sensitive review remains with `$security-review`; GitGuardian passed, but that is not a substitute for the standing artifact.
- Migration execution, backup/restore, deployment ordering, live health, and rollback belong to the deployment preflight and release owner.
