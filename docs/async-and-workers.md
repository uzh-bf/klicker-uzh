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
        apps/hatchet-worker-response-processor
                     ↓                 ↓
                 Postgres           Redis aggregates

        apps/hatchet-worker-general (lifecycle + block closure + scheduled jobs)
```

Task definitions are centralized in `packages/hatchet/src/index.ts:prepareHatchetTasks`; the actual handlers are service functions exported from `@klicker-uzh/graphql` as the `HatchetHandlers` map — workers and the GraphQL backend share one business-logic codebase. The backend itself also constructs the tasks at startup and exposes them on the GraphQL context as `ctx.tasks`.

## Response ingest (`apps/response-api`)

Bare `http.createServer`, with `GET /healthz`, `POST /InitializeLiveQuizResponseIdentity`, `POST /AddResponse`, and `POST /AddCorrelatedResponse`. POST requests require JSON; browser origins must be explicitly allowed. The two standard response endpoints share typed parsing and instance lookup only: `aggregateResponse.ts` owns cookie forwarding and legacy events, while `correlatedResponseAdmission.ts`, `correlatedResponseOutbox.ts`, and `correlatedResponseHandler.ts` own identity/admission, durable registration/dispatch, and request orchestration respectively. Complete answer-shape validation is shared through `packages/util/src/liveQuizResponseValidation.ts:validateStudentResponse`. The assessment path (`handleAddAssessmentResponse`) verifies a JWT correlation key, dedupes via `hget` on the assessment Redis, then emits `response-received:assessment`; audit-log events (`create-audit-log-entry`) are emitted throughout. Live-quiz vs assessment behavior switches on the `ASSESSMENT_MODE` env var.

For `CORRELATED_EXPORT`, initialization is the only route that may mint an anonymous quiz-scoped token. The PWA calls it lazily immediately before the first correlated submission; viewing or joining an aggregate quiz never creates this identity. The token stays in a host-only HttpOnly cookie on the response API; neither the initialization response nor the PWA exposes it to JavaScript or sibling applications. Submission uses the dedicated `/AddCorrelatedResponse` endpoint, validates the complete response against the acceptance-time question type and restrictions, admits the signed identity into durable storage, and checks for an existing response before enqueueing. Old response API replicas do not implement the dedicated endpoint and therefore cannot silently accept a new correlated submission through the legacy aggregate path.

Before enqueue acknowledgement, the response API locks the `LiveQuiz` row, rechecks that it is still published in correlated mode, and creates a `LiveQuizPendingResponse` outbox row keyed by the event message id. Its unique response key is the authoritative first-response gate, so a synchronous duplicate acknowledgement always corresponds to a durable pending or completed response. The encrypted payload contains the validated response, admitted identity, and acceptance-time instance metadata snapshot, but no browser token or cookie. Quiz ending and export therefore serialize against ingress. Hatchet receives only `{messageId}`; a non-overlapping dispatcher reserves due unsettled rows with `FOR UPDATE SKIP LOCKED` and republishes that envelope until terminal worker settlement sets `settledAt` and erases the ciphertext. The receipt and unique response key remain until the quiz is deleted, closing the completed-response admission race. An ambiguous immediate Hatchet push is acknowledged as queued and left for that dispatcher rather than discarded.

The worker binds aggregate and correlated events to separate processors. The aggregate processor owns participant-cookie verification, legacy duplicate handling, Redis pipelines, and leaderboard effects. The correlated processor loads and decrypts the matching outbox row instead of trusting Hatchet event contents. It validates the admitted owner's current database scope without rechecking acceptance-time JWT expiry, always uses the acceptance snapshot rather than current Redis metadata, and serializes duplicate processing with a lease. Its persistence transaction locks the quiz and accepts the row only while the quiz is still published in correlated mode; abort uses the same quiz lock and deletes respondents, responses, pending receipts, and labels before returning the quiz to draft. After persistence, the worker applies a pure, directly constructed aggregate mutation plan plus the processed marker in one Lua operation. It deliberately skips participant response hashes, leaderboard scores, and XP for correlated quizzes so those identity-bearing surfaces cannot be matched back to exported rows. Export holds the quiz lock and returns `LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY` while unsettled outbox rows remain, and performs a bounded count/payload-size preflight before materializing response rows.

## Live quiz publication

Manual, scheduled, and reconciliation publication share `packages/graphql/src/services/liveQuizPublication.ts:materializeLiveQuizPublication`. The operation writes Redis execution metadata from the persisted `startedAt`, then acknowledges only that matching publication generation in PostgreSQL; no Redis network call runs inside the lifecycle transition transaction. Keeping Redis materialization and its acknowledgement behind one public operation prevents callers from accidentally performing only half of the recovery contract.

`reconcile-live-quiz-publications` runs every minute in the general worker. It repairs published rows whose Redis metadata has not been acknowledged and cleans retained scheduled-task ids. Failed rows receive a durable five-minute retry timestamp, so one permanently failing quiz cannot occupy every bounded batch. Reconciliation is a recovery path, not a substitute for surfacing manual or scheduled publication failures.

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
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`
- Minute cron (`* * * * *`): `reconcile-live-quiz-publications`

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. The standard response API and workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a process pointed at the wrong database happily accepts or processes events into nowhere. Drain `LiveQuizPendingResponse` before rotating `APP_SECRET`; queued payloads encrypted with the old value cannot be decrypted with the new value. The assessment response API remains on its separate no-outbox path. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
