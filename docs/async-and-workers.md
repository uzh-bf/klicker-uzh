---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-21'
tags:
  - backend
  - hatchet
---

# Async & Workers

**What silently breaks without workers: publication, scheduling, and live responses.** Publishing or scheduling an activity enqueues Hatchet work; if the Hatchet engine or the general worker isn't running, mutations can fail with `workflow not found` — or scheduled activities simply never go live. Live-quiz answers accepted by the UI are never processed into cockpit/evaluation state without the response processor. When a feature "does nothing" locally, check the workers before debugging the feature.

## Topology

```
student answer → apps/response-api (HTTP)
                 ↓ durable pending marker + Hatchet workflow
        apps/hatchet-worker-response-processor
                 ↓ PostgreSQL response + effect outbox
        atomic Redis result, vote, leaderboard, and XP effects

Legacy `response-received:assessment` events still enter the same durable
workflow during rollout. The separate aggregation task remains for older
queued events and shares the response correlation ID as its idempotency key.
```

Task definitions are centralized in `packages/hatchet/src/index.ts:prepareHatchetTasks`; the actual handlers are service functions exported from `@klicker-uzh/graphql` as the `HatchetHandlers` map — workers and the GraphQL backend share one business-logic codebase. The backend itself also constructs the tasks at startup and exposes them on the GraphQL context as `ctx.tasks`.

Hatchet clients use two distinct endpoints (`packages/hatchet/src/client.ts:setupClient`): `HATCHET_CLIENT_HOST_PORT` for gRPC worker and event traffic, and `HATCHET_API_URL` for HTTP API operations such as programmatic scheduled runs. Both must target the same Hatchet installation. A healthy worker proves only the gRPC path; publication and delayed aggregation can still fail if the HTTP URL points to a retired service.

## Response ingest (`apps/response-api`)

Bare `http.createServer`, two routes: `GET /healthz` and `POST /AddResponse`.
Non-assessment responses (`handleAddResponse`) emit
`response-received:authenticated|anonymous`. The assessment path
(`handleAddAssessmentResponse`) verifies a JWT correlation key, writes a
`LiveQuizResponse` pending marker under the quiz and response-identity locks,
checks course participation, and waits for
`process-assessment-response-workflow`. The signed block execution is copied
into the workflow input and must still match the cache before persistence. It
returns success only after the worker has persisted the response and applied
its Redis effects; a late response returns `409`, and workflow failure or an
incompatible worker returns a retryable `503`. A genuine response with a
pending `AssessmentResponseEffect` resumes the workflow on retry. Audit-log
events (`create-audit-log-entry`) remain best effort. Live-quiz versus
assessment behavior switches on the `ASSESSMENT_MODE` env var.

## Worker task catalog

`apps/hatchet-worker-response-processor` (`src/index.ts`):

- `processAnonymousResponseTask` — on `response-received:anonymous`
- `processAuthenticatedResponseTask` — durable
- `processAssessmentResponseWorkflow` — durable, with an on-failure audit-log hook
- `aggregateAssessmentResponsesTask` — keyed by `instanceId`; consumes older
  queued aggregation events and uses the same per-response marker as the
  synchronous workflow

After cache and response validation, assessment response persistence sets the
durable acceptance timestamp and creates an `AssessmentResponseEffect` row in
the same transaction as the genuine response or correction-only materialization.
The worker removes that row only after a watched Redis transaction has applied
the vote, result counters, response hashes, leaderboards, XP, and completion
marker. Before the transaction, it validates target key types and counter
values and surfaces command-level errors. Redis does not roll back earlier
commands in a `MULTI/EXEC`, so a partial transaction is not safely recoverable
from the completion marker alone; production release still requires a
per-response contribution ledger or reconciliation path. A retry with the same
correlation ID resumes the row, while a genuine response without a pending
effect remains a completed legacy duplicate. Terminally rejected or late
submissions clear their pending marker. Pre-migration responses without an
effect row remain compatible as already-complete data.

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
