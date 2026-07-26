---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-13'
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

LiveQuiz Escape Room responses take a synchronous validation branch (`apps/response-api/src/escapeRoom.ts:handleEscapeRoomValidation`). Only regular participants with an explicitly started block attempt may answer. The API validates instance-to-block-to-quiz binding, authoritative `ACTIVE`/`activeBlockId` state, cached `blockClosedAt`, lockout, and server expiry with the shared five-second grace policy before grading. Start, response processing, and lecturer reset acquire the same owner-token Redis lifecycle claim for the participant/block target; response processing then rechecks the DB block state, Redis closure marker, attempt status, lockout, expiry, and current stage while holding it. A response arriving after lecturer closure therefore fails before grading, publishing, clearing a stage, or completing an attempt. Concurrent answer permutations and lifecycle mutations cannot interleave with grading against stale attempt state. Claim release uses compare-and-delete so an expired claim owner cannot delete a successor's lock. Correct instances are tracked in an attempt-scoped Redis set, and only clearing every answerable block instance completes the attempt. Deterministic `escape:<attempt>:<instance>` message IDs make accepted retries stable. The response processor wraps those deterministic events with a Redis lock/done marker so concurrent delivery or a retry after response-api acceptance-marker failure cannot apply statistics twice. Before the response mutations and done marker execute together, a Lua preflight rejects incompatible Redis hash-key state without applying response changes (`apps/hatchet-worker-response-processor/src/processors/processor.ts:processResponseMessage`).

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
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`
- Daily cron (`0 2 * * *`, 02:00 UTC): `prune-escape-rooms` marks finished Escape Room attempts as processed and applies retention cleanup

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).

Both development workers compile with Rollup and run the emitted JavaScript under nodemon. Do not replace that runner with `tsx --watch` or `node --watch`: their in-process watch protocols reach Hatchet's heartbeat worker-thread listener, which treats the watch message as a logger method and crashes with `TypeError: this.logger[message.type] is not a function`. When checking worker health, verify that the process stays alive for more than one four-second heartbeat interval; the initial `Connection established using LISTEN_STRATEGY_V2` message alone is insufficient. See [Hatchet heartbeat workers crash under in-process watch mode](./solutions/runtime-error/hatchet-heartbeat-workers-crash-under-in-process-watch-mode.md).
