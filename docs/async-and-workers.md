---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-24'
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

For every started live-quiz element instance, execution Redis stores two sets:
`lq:<quiz-id>:i:<instance-id>:responses:received` and
`lq:<quiz-id>:i:<instance-id>:responses:processed`. Standard responses use the
response API's generated `messageId` as the member of both sets; assessment
responses use their deterministic `correlationId`, after the existing duplicate
check. Set membership makes both counts idempotent across Hatchet retries
(`packages/util/src/liveQuizResponseTracking.ts:getLiveQuizResponseTrackingKey`,
`apps/response-api/src/index.ts:handleAddResponse`, and
`apps/response-api/src/index.ts:handleAddAssessmentResponse`).

The response API attempts to add the received member before enqueueing a known
instance. Tracking is best-effort: a tracking failure is logged but does not
reject or delay the participant response.
The standard response processor and assessment aggregation both build their
Redis commands locally, then run one atomic processing script. The script
claims the processed member before applying the commands, captures command
errors with `redis.pcall`, and mirrors instance-info retention. A retry after a
lost Redis reply therefore sees the marker and cannot apply scoring, results,
or leaderboard updates a second time. A connection-level script failure still
throws so Hatchet can retry; tracking-retention errors are logged as best effort
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
late, rejected, failed, or untracked responses. Tracking does not change the
response pipeline's existing validation or result-aggregation retry behavior.

Tracking sets stay persistent while their element instance is active, matching
the rest of the live execution cache. When a block closes, cleanup first starts
the canonical instance-info key's one-day retention and then scans the instance
keys. A concurrent tracking write atomically reads that info-key TTL with its
set update and mirrors any remaining retention; if the info key is already
missing, the tracking key receives a one-day safety expiry. This ordering covers
writes on both sides of cleanup's key scan without erasing counts from an
unlimited active block. The tracking keys also remain under the existing
per-instance wildcard
(`packages/graphql/src/services/liveQuizzes.ts:removeCacheEntriesBlock`).

Deployment ordering matters: the shipped `GetCockpitQuiz` operation selects the
new count fields, so the GraphQL API must deploy before frontend-manage — an old
API rejects the whole operation and takes the cockpit down for that window (the
reverse mix is safe because the fields are additive and nullable).

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
