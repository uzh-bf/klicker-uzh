---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-23'
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

Bare `http.createServer`, with `GET /healthz`, `POST /InitializeLiveQuizResponseIdentity`, `POST /AddResponse`, and `POST /AddCorrelatedResponse`. POST requests require JSON; browser origins must be explicitly allowed. Aggregate non-assessment responses emit `response-received:authenticated|anonymous`; correlated responses use the versioned durable event `response-received:correlated-v1`. The assessment path (`handleAddAssessmentResponse`) verifies a JWT correlation key, dedupes via `hget` on the assessment Redis, then emits `response-received:assessment`; audit-log events (`create-audit-log-entry`) are emitted throughout. Live-quiz vs assessment behavior switches on the `ASSESSMENT_MODE` env var.

For `CORRELATED_EXPORT`, initialization is the only route that may mint an anonymous quiz-scoped token. The token stays in an HttpOnly cookie; neither the initialization response nor the PWA exposes it to JavaScript. Submission uses the dedicated `/AddCorrelatedResponse` endpoint, checks for an existing durable response, and acquires a five-minute per-identity Redis lease before enqueueing. The lease only provides synchronous duplicate feedback at ingress; it is not a delivery prerequisite after Hatchet accepts the versioned durable event. Old response API replicas do not implement the dedicated endpoint and therefore cannot silently accept a new correlated submission through the legacy aggregate path.

Before enqueue acknowledgement, the response API locks the `LiveQuiz` row, rechecks that it is still published in correlated mode, and creates a `LiveQuizPendingResponse` receipt keyed by the event message id. Quiz ending and export therefore serialize against ingress. The worker's correlated path validates the signed owner and event claim shape, serializes duplicate processing with a lease, writes the `LiveQuizResponse`, then applies all Redis hash mutations plus the processed marker in one Lua operation. Terminal handling removes the pending receipt; operational failures retain it for Hatchet retry. Export holds the quiz lock and returns `LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY` while receipts remain, so an acknowledged queued response cannot be silently omitted.

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

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
