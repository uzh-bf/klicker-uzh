---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-26'
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

### Per-element response processing counts

For every started live-quiz element instance, new execution Redis writes use
two numeric counters:
`lq:<quiz-id>:i:<instance-id>:responses:received:count` and
`lq:<quiz-id>:i:<instance-id>:responses:processed:count`. The response API
increments the received counter once for each accepted event. The regular and
assessment processors increment the processed counter only after every result,
leaderboard, and response-hash command in the batch succeeds.

The response API attempts the received-counter increment before enqueueing a
known instance. One Redis script checks the instance-info TTL and updates the
counter and its retention atomically; an inactive instance returns without
creating a tracking key. Tracking is best-effort: the tracking Redis clients
explicitly connect during startup, disable offline queueing and per-request
retries, and apply a 250ms command timeout. Because the handler awaits this
attempt before enqueueing, a slow
tracking call can delay enqueueing and the request by up to 250ms; a tracking
failure or timeout is logged and does not reject the participant response.
The client timeout bounds the response API's wait and pending retry work; it
does not cancel a Lua script that Redis has already started.
The new
`lq:<quiz-id>:i:<instance-id>:responses:processed:claims` sorted set is an
age-trimmed replay claim for the response `messageId` or assessment
`correlationId`; each member keeps its own timestamp within the 24-hour replay
horizon. The claim key remains for that full horizon even when instance-info
expires sooner, so a retry cannot repeat a completed batch after tracking data
has expired. The legacy
`lq:<quiz-id>:i:<instance-id>:responses:processed` set is read only during the
worker rollout and provides the initial processed-counter baseline. A
processing retry after a lost Redis reply therefore cannot apply the same
completed batch twice during that horizon. The script rejects malformed JSON,
wrong command arity, commands outside the current
`lq:<quiz>:i:<instance>:` namespace, invalid target types, and invalid numeric
increment fields before any aggregation mutation.
If validation fails, it returns an explicit aggregation failure without
creating a claim so the worker can retry safely. If an unexpected command
failure occurs after an earlier command has applied, the script changes the
claim to a negative-score reconciliation marker and returns
`reconciliation_required`. The worker throws, and every retry returns the same
status without repeating the non-idempotent updates, so Hatchet retains a
visible failed task for manual reconciliation. A command failure before any
command applies releases the claim and remains retryable.
Processed-counter, baseline, or retention errors after successful aggregation
use the same reconciliation marker instead of silently acknowledging metric
drift.

The legacy received set
`lq:<quiz-id>:i:<instance-id>:responses:received` is read-only compatibility
input while old response-api instances drain. The cockpit adds its cardinality
to the new received counter. If a processed counter is not initialized yet,
the cockpit falls back to the legacy processed-set cardinality as an opaque
pre-cutover baseline. New code never writes the legacy received set.

Connection-level processing script failures still throw so Hatchet can retry.
The authorized `cockpitQuiz` query reads the counters and compatibility values
per started element, and the lecturer cockpit's existing two-second polling
displays them; scheduled elements have no counts
(`packages/util/src/liveQuizResponseTracking.ts`,
`apps/response-api/src/index.ts:handleAddResponse`,
`apps/response-api/src/index.ts:handleAddAssessmentResponse`,
`apps/hatchet-worker-response-processor/src/processors/processor.ts:processResponseMessage`,
`apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:aggregateAssessmentResponses`,
and `packages/graphql/src/services/liveQuizzes.ts:getCockpitQuiz`).

The difference between received and processed is an operational signal, not
exact queue depth. It can include queued work as well as invalid, duplicate,
late, rejected, failed, or untracked responses. Tracking does not change the
response pipeline's validation semantics. Result aggregation uses the replay
claim as a bounded replay guard for completed batches: after a successful
claim-and-aggregation, a retry is a no-op. Preflight command errors release no
claim, are logged as aggregation failures, do not increment the processed
counter, and cause the worker to retry. Unexpected errors after a command has
applied persist a negative-score reconciliation marker, return
`reconciliation_required`, and keep the Hatchet task failed without repeating
already-applied commands; errors before any command applies release the claim
and remain retryable.

Counters stay persistent while their element instance is active, matching the
rest of the live execution cache. Replay claims are retained independently for
the full 24-hour replay horizon. When a block closes, cleanup first starts the
canonical instance-info key's one-day retention and then expires the response
keys. A concurrent tracking write atomically reads that info-key TTL and
mirrors the remaining retention for counters; if the info key is already
missing, the tracking key receives a one-day safety expiry. The keys also
remain under the existing per-instance wildcard
(`packages/graphql/src/services/liveQuizzes.ts:removeCacheEntriesBlock`).
`endLiveQuiz` persists `ENDED` before arming retention. Cleanup-retention
failures are logged and propagated; a repeated call on an ended quiz retries
retention without repeating end-of-quiz side effects.

Deployment ordering matters: deploy GraphQL before new response ingress, drain
old response-processor replicas before initializing processed counters, and then
run only the new processors. The GraphQL persisted-query manifest also retains
the previous `GetCockpitQuiz` hash through the old Manage bundle drain; the
compatibility entry is rebuilt by
`packages/graphql/scripts/merge-persisted-query-compatibility.mjs`. Frontend-
manage remains safe during that window because the fields are additive and
nullable. Old and new processors cannot overlap after counter initialization
because old workers do not increment the new processed counter.

## Worker task catalog

`apps/hatchet-worker-response-processor` (`src/index.ts`):

- `processAnonymousResponseTask` — on `response-received:anonymous`
- `processAuthenticatedResponseTask` — durable
- `processAssessmentResponseWorkflow` — durable, with an on-failure audit-log hook
- `aggregateAssessmentResponsesTask` — keyed by `instanceId`

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `process-course-duplication` — async course duplication worker implemented by `packages/graphql/src/services/courseDuplication.ts`. A task-local constant concurrency bucket allows one running duplication globally and queues additional duplication jobs for up to 60 minutes with group round-robin scheduling; unrelated Hatchet tasks retain their own concurrency. The GraphQL mutation stores job state in Redis and returns a job id; it retries an ambiguous Hatchet event publication with the same job id, and republishes an existing pending job on a later mutation retry, so a lost acknowledgement cannot open a second copy or strand the job. Each attempt allows 30 minutes, above the ten-minute database transaction limit, and waits 60 seconds before the first retry so a crashed worker's lease can expire. The worker uses a renewable, token-checked process lease plus a separate 120-second heartbeat key refreshed on the same cadence; rethrows generic failures for Hatchet retries; and records only access or partial-copy failures as terminal. Stale-job normalization (`COURSE_DUPLICATION_STALE_AFTER_MS`, currently 75 minutes — 15 minutes beyond the queue timeout) only fires when the record is old **and** no fresh heartbeat exists, then reconciles against Postgres before declaring failure: because a running attempt refreshes the record before starting and the copied course carries the job id as its primary key, live or committed work is not misclassified as a stale failure. Terminal records strip the stored mutation payload (including any notification email) and identity fields for the remainder of their TTL. A scheduled sweep (`sweep-stale-course-duplications`, every 5 minutes) normalizes abandoned jobs server-side, so recovery no longer depends on a user polling. The manage frontend polls `courseDuplicationStatuses` until the job completes or fails, then shows a localized action to open the copied course without navigating automatically.
- `sweep-stale-course-duplications` — cron task (every 5 minutes) scanning non-terminal duplication records and applying stale normalization with heartbeat + Postgres reconciliation.
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Course duplication operations

Job state lives in Redis under three key families (all self-expiring): status records `course-duplication:job:<jobId>` and per-user/per-course source locks `course-duplication:source:<userId>:<sourceCourseId>` expire after **24 hours**; process leases `course-duplication:job:<jobId>:processing` and heartbeats `course-duplication:job:<jobId>:heartbeat` expire after 60/120 seconds. Postgres is the source of truth for outcomes: a committed course row whose id equals the job id proves the copy succeeded regardless of Redis state.

To correlate a user report ("my duplication vanished") with only a course name or approximate time: list their keys with `SCAN 0 MATCH "course-duplication:source:<userId>:*"` (keys carry the source course id), read the referenced job record with `GET course-duplication:job:<jobId>` while it exists, and check `prisma.course.findUnique({ where: { id: <jobId> } })` for the outcome. Permission `AuditLogEntry` rows written inside a successful copy transaction outlive the Redis record. Worker logs carry the job id.

**Rolling back this feature:** old code never registers the `process-course-duplication` workflow, so already-enqueued events stay QUEUED in Hatchet and mid-flight job records simply age out at their TTLs; users lose completion signals until the rollback completes, but no partial copies exist at any point (the copy is one database transaction). Recovery-by-resubmit works immediately after rollback because the legacy synchronous path ignores duplication locks. To release held source locks without waiting for TTL expiry: `SCAN 0 MATCH "course-duplication:source:*"` then `DEL` the listed keys.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).

Both development workers compile with Rollup and run the emitted JavaScript under nodemon. Do not replace that runner with `tsx --watch` or `node --watch`: their in-process watch protocols reach Hatchet's heartbeat worker-thread listener, which treats the watch message as a logger method and crashes with `TypeError: this.logger[message.type] is not a function`. When checking worker health, verify that the process stays alive for more than one four-second heartbeat interval; the initial `Connection established using LISTEN_STRATEGY_V2` message alone is insufficient. See [Hatchet heartbeat workers crash under in-process watch mode](./solutions/runtime-error/hatchet-heartbeat-workers-crash-under-in-process-watch-mode.md).
