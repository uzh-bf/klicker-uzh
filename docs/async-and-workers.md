---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-09-02'
tags:
  - backend
  - hatchet
---

# Async & Workers

**What silently breaks without workers: publication, scheduling, and live responses.** Publishing or scheduling an activity enqueues Hatchet work; if the Hatchet engine or the general worker isn't running, mutations can fail with `workflow not found` — or scheduled activities simply never go live. Live-quiz answers accepted by the UI are never processed into cockpit/evaluation state without the response processor. When a feature "does nothing" locally, check the workers before debugging the feature.

## Topology

```
student answer → apps/response-api (HTTP) → Hatchet event
                                              ↓
        apps/hatchet-worker-response-processor (consume + re-emit)
                                              ↓
        apps/hatchet-worker-general (aggregation + scheduled jobs)
```

Task definitions are centralized in `packages/hatchet/src/index.ts:prepareHatchetTasks`; the actual handlers are service functions exported from `@klicker-uzh/graphql` as the `HatchetHandlers` map — workers and the GraphQL backend share one business-logic codebase. The backend itself also constructs the tasks at startup and exposes them on the GraphQL context as `ctx.tasks`.

Hatchet clients use two distinct endpoints (`packages/hatchet/src/client.ts:setupClient`): `HATCHET_CLIENT_HOST_PORT` for gRPC worker and event traffic, and `HATCHET_API_URL` for HTTP API operations such as programmatic scheduled runs. Both must target the same Hatchet installation. A healthy worker proves only the gRPC path; publication and delayed aggregation can still fail if the HTTP URL points to a retired service.

## Response ingest (`apps/response-api`)

Bare `http.createServer`, two routes: `GET /healthz` and `POST /AddResponse`. Non-assessment responses (`handleAddResponse`) emit `response-received:authenticated|anonymous`. The assessment path (`handleAddAssessmentResponse`) verifies a JWT correlation key, dedupes via `hget` on the assessment Redis, then emits `response-received:assessment`; audit-log events (`create-audit-log-entry`) are emitted throughout. Live-quiz vs assessment behavior switches on the `ASSESSMENT_MODE` env var.

## Worker task catalog

`apps/hatchet-worker-response-processor` (`src/index.ts`):

- `processAnonymousResponseTask` — on `response-received:anonymous`
- `processAuthenticatedResponseTask` — durable
- `processAssessmentResponseWorkflow` — durable, with an on-failure audit-log hook
- `aggregateAssessmentResponsesTask` — keyed by `instanceId`

**Live-quiz response idempotency invariant:** standard live-quiz response aggregation must keep the response marker and all result increments in one atomic Redis write path (Lua script in `src/processors/responseScript.ts`); the preflight `hexists` check is only an optimization, never the dedupe mechanism. The script validates every touched key's type and every counter's integer magnitude **before its first write** (Redis does not roll back partial scripts) and answers with coded results: `1` applied, `0` duplicate, `-1` invalid counter state, `-2` wrong key type — anything else fails the task. The script is registered once via `defineCommand`, so responses invoke it through EVALSHA with automatic EVAL fallback.

Every response carries a dedupe identity, resolved in this order: the authenticated/temporary participant (`sub`, `temporary-` prefixed), the PWA's bounded opaque `submissionId` (hashed to `anonymous-<sha256>`; generated per browser profile, quiz execution and instance in `apps/frontend-pwa/src/lib/clientSubmissionId.ts`), or — for legacy anonymous events without a valid submission id — the event's `messageId` (`redelivery-<sha256>`). Client submission identity protects repeated submissions; message identity only protects repeated _delivery_ of one queued submission. Direct `/AddResponse` callers submitting twice without a submission id still count twice.

Anonymous identity is a browser profile, not a person: two tabs share it, two people sharing a browser profile during one quiz execution share one identity, and it is duplicate-submission protection, not anti-abuse protection. When localStorage is unavailable, a page-lifetime in-memory identity is used; dedupe then holds within the page session only.

**First-response timing semantics:** `firstResponseReceivedAt` is committed by `HSETNX` inside the atomic write; "first" means first _processed_, not first received. Points are still computed against the pre-write snapshot, so two workers can both calculate a full timing bonus; the loser's over-credit is corrected immediately after the commit in a separate best-effort pipeline whose per-command results are inspected and any failure is logged as an error. **Accepted disposition:** scoring effects are _not_ claimed exactly-once for the timing-bonus portion — a crash or correction failure between commit and correction leaves a bounded residual over-credit on the leaderboard, and a retry cannot re-apply the correction because the duplicate guard short-circuits first. XP never depends on timing.

**Known follow-ups tracked outside this invariant** (inherited pipeline weaknesses, not solved by the atomic write): responses are bound to quiz+instance but not validated against a block execution counter (a delayed event from a cancelled execution can land in the re-initialized one); the response API acknowledges queueing, not recording (no receipt/status reconciliation exists); final result persistence relies on a five-minute post-closure aggregation delay rather than an admitted-vs-completed watermark; and processing outcomes are logs-only (no applied/duplicate/rejected/failed metrics).

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `process-course-duplication` — async course duplication worker implemented by `packages/graphql/src/services/courseDuplication.ts`. A task-local constant concurrency bucket allows one running duplication globally and queues additional duplication jobs for up to 60 minutes with group round-robin scheduling; unrelated Hatchet tasks retain their own concurrency. The GraphQL mutation stores job state in Redis and returns a job id; it retries an ambiguous Hatchet event publication with the same job id, and republishes an existing pending job on a later mutation retry, so a lost acknowledgement cannot open a second copy or strand the job. Each attempt allows 30 minutes, above the ten-minute database transaction limit, and waits 60 seconds before the first retry so a crashed worker's lease can expire. The worker uses a renewable, token-checked process lease plus a separate 120-second heartbeat key refreshed on the same cadence; rethrows generic failures for Hatchet retries; and records only access or partial-copy failures as terminal. Stale-job normalization (`COURSE_DUPLICATION_STALE_AFTER_MS`, currently 75 minutes — 15 minutes beyond the queue timeout) only fires when the record is old **and** no fresh heartbeat exists, then reconciles against Postgres before declaring failure: because a running attempt refreshes the record before starting and the copied course carries the job id as its primary key, live or committed work is not misclassified as a stale failure. Terminal records strip the stored mutation payload (including any notification email) and identity fields for the remainder of their TTL. A scheduled sweep (`sweep-stale-course-duplications`, every 5 minutes) normalizes abandoned jobs server-side, so recovery no longer depends on a user polling. The manage frontend polls `courseDuplicationStatuses` until the job completes or fails, then shows a localized action to open the copied course without navigating automatically.
- `sweep-stale-course-duplications` — cron task (every 5 minutes) scanning non-terminal duplication records and applying stale normalization with heartbeat + Postgres reconciliation.
- `process-course-deletion` — event-driven permanent deletion of an accepted course deletion request, implemented by `packages/graphql/src/services/courseDeletion.ts`. `requestCourseDeletion` sets `Course.deletionRequestedAt` (the only persisted state, and the visibility boundary for every read path) and pushes the event carrying the requester id and the draft-live-quiz option; if the push fails, the marker is cleared again and the mutation errors, so a hidden course always has a scheduled job. A task-local concurrency bucket serializes deletion processing. The deletion transaction claims the row by its request timestamp and rechecks the requester's ADMIN/OWNER permission, assessment mode, and the published-live-quiz condition; a failed check clears the marker (the course reappears) instead of deleting. Ordinary failures are retried three times; when the last attempt fails, the handler clears the marker so the lecturer can retry.
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Course duplication operations

Job state lives in Redis under three key families (all self-expiring): status records `course-duplication:job:<jobId>` and per-user/per-course source locks `course-duplication:source:<userId>:<sourceCourseId>` expire after **24 hours**; process leases `course-duplication:job:<jobId>:processing` and heartbeats `course-duplication:job:<jobId>:heartbeat` expire after 60/120 seconds. Postgres is the source of truth for outcomes: a committed course row whose id equals the job id proves the copy succeeded regardless of Redis state.

To correlate a user report ("my duplication vanished") with only a course name or approximate time: list their keys with `SCAN 0 MATCH "course-duplication:source:<userId>:*"` (keys carry the source course id), read the referenced job record with `GET course-duplication:job:<jobId>` while it exists, and check `prisma.course.findUnique({ where: { id: <jobId> } })` for the outcome. Permission `AuditLogEntry` rows written inside a successful copy transaction outlive the Redis record. Worker logs carry the job id.

**Rolling back this feature:** old code never registers the `process-course-duplication` workflow, so already-enqueued events stay QUEUED in Hatchet and mid-flight job records simply age out at their TTLs; users lose completion signals until the rollback completes, but no partial copies exist at any point (the copy is one database transaction). Recovery-by-resubmit works immediately after rollback because the legacy synchronous path ignores duplication locks. To release held source locks without waiting for TTL expiry: `SCAN 0 MATCH "course-duplication:source:*"` then `DEL` the listed keys.

For course deletion, drain pending markers before rolling back. Old code ignores
the marker and exposes the course again, while already-enqueued deletion events
remain unprocessed until a feature-aware worker runs again.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. In the managed devcontainer, `devrouter ensure . --profile live-quiz` starts Response API and both workers, then proves `/healthz` and one live runtime process per worker before reporting ready. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).

Both development workers compile with Rollup and run the emitted JavaScript under nodemon. Do not replace that runner with `tsx --watch` or `node --watch`: their in-process watch protocols reach Hatchet's heartbeat worker-thread listener, which treats the watch message as a logger method and crashes with `TypeError: this.logger[message.type] is not a function`. When checking worker health, verify that the process stays alive for more than one four-second heartbeat interval; the initial `Connection established using LISTEN_STRATEGY_V2` message alone is insufficient. See [Hatchet heartbeat workers crash under in-process watch mode](./solutions/runtime-error/hatchet-heartbeat-workers-crash-under-in-process-watch-mode.md).
