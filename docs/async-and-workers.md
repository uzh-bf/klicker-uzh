---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-30'
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

## Permission propagation rollout

The approved grant-propagation design uses a durable generation row, one database-global transaction advisory lock shared by source mutations and workers, at-least-once Hatchet delivery, one-minute reconciliation, a persistent sanitized failure sink, and a five-minute recovery target. The general worker registers `permission-propagation` with its `recompute-derived-permissions` task. A stale delivery intentionally loads and full-rederives the latest durable generation under the database fence, then marks that observed generation processed in the same transaction. A failed attempt records one sanitized `WORKER_EXECUTION_FAILED` row against the exact observed generation before Hatchet's fixed-message failure hook runs.

When `PERMISSION_PROPAGATION_RECONCILIATION_ENABLED=true`, `reconcile-permission-propagation` runs every minute. Under the same database fence it advances a one-minute safety-lagged, 100-signal page cursor, unions recent permission, group, audit, activity, catalog-assignment, and element-instance signals, and advances a two-object rotating sample. It then records overdue unresolved generations independently and dispatches at most 100 generations whose accepted delivery is missing or at least one minute old. Accepted delivery updates `lastDispatchedAt`; dispatch failures and five-minute recovery breaches use fixed sanitized failure codes. `sweep-permission-propagation` runs every five minutes from 00:00 through 05:59 UTC and advances an independent 25-object scan. Sample and sweep progress is stored per object type so a busy type cannot starve later types.

The schedules are disabled by default. Do not enable them until every permission source mutation and synchronous derived-permission writer takes the shared database fence; otherwise a sampled worker can race an unfenced revoke and reintroduce stale access. No sharing mutation creates or enqueues durable work yet, so sharing mutation latency remains synchronous. See [ADR-0001](./adr/0001-fail-closed-permission-propagation.md) and [Data & Migrations](./data-and-migrations.md).

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
- `permission-propagation` — durable, idempotent full rederive under the shared database fence
- `reconcile-permission-propagation` — gated one-minute unresolved recovery and recent-signal/sample discovery
- `sweep-permission-propagation` — gated bounded off-peak full-graph cursor
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
