---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-20'
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

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `process-course-duplication` — async course duplication worker implemented by `packages/graphql/src/services/courseDuplication.ts`. The GraphQL mutation stores job state in Redis and returns a job id; it retries an ambiguous Hatchet event publication with the same job id, and republishes an existing pending job on a later mutation retry, so a lost acknowledgement cannot open a second copy or strand the job. The task allows 15 minutes for a copy, above the ten-minute database transaction limit, and waits 60 seconds before the first retry so a crashed worker's lease can expire. The worker uses a renewable, token-checked process lease plus a separate 120-second heartbeat key refreshed on the same cadence; rethrows generic failures for Hatchet retries; and records only access or partial-copy failures as terminal. Stale-job normalization (`COURSE_DUPLICATION_STALE_AFTER_MS`, currently 75 minutes — above the worst legitimate 15-minute-attempt × 4-retry chain) only fires when the record is old **and** no fresh heartbeat exists, then reconciles against Postgres before declaring failure: because the copied course carries the job id as its primary key, a committed row upgrades the job to COMPLETED instead of a false FAILED. Terminal records strip the stored mutation payload (including any notification email) and identity fields for the remainder of their TTL. A scheduled sweep (`sweep-stale-course-duplications`, every 5 minutes) normalizes abandoned jobs server-side, so recovery no longer depends on a user polling. The manage frontend polls `courseDuplicationStatuses` until the job completes or fails, then shows a localized action to open the copied course without navigating automatically.
- `sweep-stale-course-duplications` — cron task (every 5 minutes) scanning non-terminal duplication records and applying stale normalization with heartbeat + Postgres reconciliation.
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Course duplication operations

Job state lives in Redis under three key families (all self-expiring): status records `course-duplication:job:<jobId>` and per-user/per-course source locks `course-duplication:source:<userId>:<sourceCourseId>` expire after **24 hours**; process leases `course-duplication:job:<jobId>:processing` and heartbeats `course-duplication:job:<jobId>:heartbeat` expire after 60/120 seconds. Postgres is the source of truth for outcomes: a committed course row whose id equals the job id proves the copy succeeded regardless of Redis state.

To correlate a user report ("my duplication vanished") with only a course name or approximate time: list their keys with `SCAN 0 MATCH "course-duplication:source:<userId>:*"` (keys carry the source course id), read the referenced job record with `GET course-duplication:job:<jobId>` while it exists, and check `prisma.course.findUnique({ where: { id: <jobId> } })` for the outcome. Permission `AuditLogEntry` rows written inside a successful copy transaction outlive the Redis record. Worker logs carry the job id.

**Rolling back this feature:** old code never registers the `process-course-duplication` workflow, so already-enqueued events stay QUEUED in Hatchet and mid-flight job records simply age out at their TTLs; users lose completion signals until the rollback completes, but no partial copies exist at any point (the copy is one database transaction). Recovery-by-resubmit works immediately after rollback because the legacy synchronous path ignores duplication locks. To release held source locks without waiting for TTL expiry: `SCAN 0 MATCH "course-duplication:source:*"` then `DEL` the listed keys.

## Learning analytics contract boundary

`packages/analytics-engine-contract/src/constants.ts:COURSE_WORKFLOW_NAME` and
`PLATFORM_WORKFLOW_NAME` reserve `learning-analytics-course-v1` and
`learning-analytics-platform-v1`. The public package validates dispatch input and
successful identity echoes through
`packages/analytics-engine-contract/src/stubs.ts:createAnalyticsEngineStubs`; failures
and cancellations remain rejected workflow calls rather than successful status
objects. `packages/analytics-engine-contract/src/conformance.ts:runBlackBoxConformance`
checks that boundary without importing a Hatchet SDK.

This contract is inert. No public task registration, worker, schedule, coordinator, or
deployment exists for these names yet. The Catalyst runtime owns the eventual Hatchet
workflow implementation; KlickerUZH will add its dispatch and product-state updates in
later public layers.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).

Both development workers compile with Rollup and run the emitted JavaScript under nodemon. Do not replace that runner with `tsx --watch` or `node --watch`: their in-process watch protocols reach Hatchet's heartbeat worker-thread listener, which treats the watch message as a logger method and crashes with `TypeError: this.logger[message.type] is not a function`. When checking worker health, verify that the process stays alive for more than one four-second heartbeat interval; the initial `Connection established using LISTEN_STRATEGY_V2` message alone is insufficient. See [Hatchet heartbeat workers crash under in-process watch mode](./solutions/runtime-error/hatchet-heartbeat-workers-crash-under-in-process-watch-mode.md).
