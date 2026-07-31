---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-31'
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
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- `cleanup-live-quiz-reset-cache` — generation-fenced execution-cache cleanup plus historical weekly-timeline recomputation, three retries
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Live Quiz reset cache cleanup

Before resetting, GraphQL snapshots the quiz execution cache generation. After the database transaction commits, `packages/graphql/src/services/liveQuizReset.ts:runPostCommitCleanup` synchronously recomputes affected historical weekly timeline entries and delegates generation-fenced deletion of `lq:<quizId>:*` keys to `packages/graphql/src/services/liveQuizExecutionCache.ts:clearLiveQuizExecutionCache`. The correct standard or assessment Redis is cleared only when its keys still belong to the captured generation, preventing delayed cleanup from deleting a newly started run.

If synchronous recomputation or Redis cleanup throws, GraphQL schedules `cleanup-live-quiz-reset-cache`, an idempotent Hatchet task with three retries (`packages/hatchet/src/index.ts:cleanupLiveQuizResetCache`). `packages/graphql/src/services/liveQuizResetCleanup.ts:handleCleanupLiveQuizResetCache` owns the reset-specific recovery workflow, while the execution-cache module stays limited to generic Redis primitives. The serialized input contains the captured cache generation and exact historical weeks, so the fallback repeats the same fenced operations. Cleanup or fallback-delivery failures do not turn an already committed reset into a mutation failure.

Starting an eligible draft or scheduled quiz calls `packages/graphql/src/services/liveQuizExecutionCache.ts:initializeLiveQuizExecutionCache` before the status transition: one Redis script removes stale execution keys, writes new metadata, and assigns a fresh generation. If that initialization fails, the quiz does not transition to `PUBLISHED`.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
