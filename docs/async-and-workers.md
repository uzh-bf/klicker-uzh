---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-12'
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
        apps/hatchet-worker-response-processor
                     ↓                 ↓
                 Postgres           Redis aggregates

        apps/hatchet-worker-general (lifecycle + block closure + scheduled jobs)
```

Task definitions are centralized in `packages/hatchet/src/index.ts:prepareHatchetTasks`; the actual handlers are service functions exported from `@klicker-uzh/graphql` as the `HatchetHandlers` map — workers and the GraphQL backend share one business-logic codebase. The backend itself also constructs the tasks at startup and exposes them on the GraphQL context as `ctx.tasks`.

## Response ingest (`apps/response-api`)

Bare `http.createServer`, with `GET /healthz`, `POST /InitializeLiveQuizResponseIdentity`, `POST /AddResponse`, and `POST /AddCorrelatedResponse`. Aggregate responses keep the legacy cookie-forwarding path; correlated admission owns typed response validation, accepted instance metadata, identity creation, and the encrypted transactional outbox. Assessment responses remain on their separate no-outbox path and emit `response-received:assessment`; live-quiz vs assessment behavior switches on the `ASSESSMENT_MODE` env var.

For `CORRELATED_EXPORT`, initialization is the only route that may mint an anonymous quiz-scoped token. The dedicated correlated submission endpoint validates the complete response against the acceptance-time metadata before acknowledging it. The locked transaction rechecks the published mode, active block execution, and current quiz PIN, then stores the accepted identity, response key, encrypted snapshot, and `LiveQuizPendingResponse` row. Hatchet receives only `{ messageId }`; the worker loads that row and retries until terminal handling settles the receipt and erases the ciphertext. Keep `LIVE_QUIZ_CORRELATED_RESPONSES_ENABLED` disabled until the response API, worker, and migration are deployed together.

The response processor binds aggregate and correlated events to separate processors. The aggregate processor owns participant-cookie verification, legacy duplicate handling, Redis pipelines, and leaderboard effects; aggregate and assessment validation remains compatible with already-materialized cache entries that predate the correlated-response metadata. The correlated processor loads and decrypts the matching outbox row, validates the admitted owner’s live-quiz scope without rechecking acceptance-time token expiry, and persists through normal quiz end but not abort or execution changes. Database uniqueness handles concurrent duplicate delivery; the processed marker makes Redis effects converge. Before correlated Redis effects are applied, the worker holds a shared database lock on the quiz and addressed block through the Lua mutation, so a block transition either wins first and suppresses the stale mutation or waits until the mutation is complete. Ended or closed blocks settle after durable persistence without late aggregate writes, and terminal handling marks the receipt settled. Invalid-response diagnostics contain identifiers and reasons, not response payloads.

## Worker task catalog

`apps/hatchet-worker-response-processor` (`src/index.ts`):

- `processAnonymousResponseTask` — on `response-received:anonymous`
- `processAuthenticatedResponseTask` — durable
- `processCorrelatedResponseTask` — durable, loads its encrypted database outbox row by message id
- `processAssessmentResponseWorkflow` — durable, with an on-failure audit-log hook
- `aggregateAssessmentResponsesTask` — keyed by `instanceId`

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- `reconcile-live-quiz-publications` — every minute, repairs published quizzes whose Redis publication metadata or scheduled task cleanup is incomplete
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

Publication is deliberately two-phase: the database transaction records the published generation first, then the backend materializes the matching Redis metadata and marks it complete. The reconciliation cron retries incomplete materialization and removes stale scheduled-publication tasks idempotently. Aborting a quiz records a Redis generation tombstone and clears only the generation whose persisted start timestamp was aborted, so a delayed older publication cannot recreate stale metadata and a newer publication cannot be deleted by older cleanup.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. The response API and both response processors must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a process pointed at the wrong database happily accepts or processes events into nowhere. Drain `LiveQuizPendingResponse` before rotating `APP_SECRET`; queued payloads encrypted with the old value cannot be decrypted with the new one. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
