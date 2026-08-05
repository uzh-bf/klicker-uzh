---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-05'
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

### Per-element response processing counts

For every started live-quiz element instance, execution Redis stores two sets:
`lq:<quiz-id>:i:<instance-id>:responses:received` and
`lq:<quiz-id>:i:<instance-id>:responses:processed`. Standard responses use the
response API's generated `messageId` as the member of both sets; assessment
responses use their deterministic `correlationId`, after the existing duplicate
check. Set membership makes both counts idempotent across Hatchet retries
(`packages/util/src/liveQuizResponseTracking.ts:getLiveQuizResponseTrackingKey`,
`apps/response-api/src/index.ts:handleAddResponse`, and
`apps/response-api/src/index.ts:handleAddAssessmentResponse`).

The response API adds the received member before enqueueing a known instance.
The standard response processor adds the matching processed member in the same
Redis pipeline that updates live results; assessment mode adds it only when
`aggregateAssessmentResponses` updates those results, not when the database row
is first stored
(`apps/hatchet-worker-response-processor/src/processors/processor.ts:processResponseMessage`
and
`apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:aggregateAssessmentResponses`).
The authorized `cockpitQuiz` query reads both set cardinalities per started
element, and the lecturer cockpit's existing two-second polling displays them;
scheduled elements have no counts
(`packages/graphql/src/services/liveQuizzes.ts:getCockpitQuiz` and
`apps/frontend-manage/src/pages/quizzes/[id]/cockpit.tsx:Cockpit`).

The difference between received and processed is an operational signal, not
exact queue depth. It can include queued work as well as invalid, duplicate,
late, rejected, or failed responses. Tracking does not change the response
pipeline's existing validation or result-aggregation retry behavior. The keys
remain under the existing per-instance wildcard, so live-quiz cleanup applies
the same one-day expiry as the other instance keys
(`packages/graphql/src/services/liveQuizzes.ts:removeCacheEntriesBlock`).

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

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
