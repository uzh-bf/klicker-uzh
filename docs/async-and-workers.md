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

For every started live-quiz element instance, new execution Redis writes use
two numeric counters:
`lq:<quiz-id>:i:<instance-id>:responses:received:count` and
`lq:<quiz-id>:i:<instance-id>:responses:processed:count`. The response API
increments the received counter once for each accepted event. The regular and
assessment processors increment the processed counter only after every result,
leaderboard, and response-hash command in the batch succeeds.

The response API attempts the received-counter increment before enqueueing a
known instance. One Redis script checks the instance-info TTL and updates the
counter and its retention atomically; an inactive instance returns without
creating a tracking key. Tracking is best-effort: a tracking failure is logged
but does not reject or delay the participant response.
The new
`lq:<quiz-id>:i:<instance-id>:responses:processed:claims` sorted set is an
age-trimmed replay claim for the response `messageId` or assessment
`correlationId`; each member keeps its own timestamp within the 24-hour replay
horizon. After closure, the claim key itself follows the shorter remaining
instance-info retention, but that key-level expiry does not shorten the
member-trimming horizon while the key remains. The legacy
`lq:<quiz-id>:i:<instance-id>:responses:processed` set is read only during the
worker rollout and provides the initial processed-counter baseline. A
processing retry after a lost Redis reply therefore cannot apply the same
completed batch twice during that horizon. The script validates command
targets and numeric increment fields before any aggregation mutation. If
validation fails, it returns an explicit aggregation failure without creating
a claim so the worker can retry safely. If an unexpected command failure occurs
after an earlier command has applied, the script retains the claim and returns
`reconciliation_required`; the worker acknowledges the message and logs the
partial result instead of retrying and duplicating non-idempotent updates. A
command failure before any command applies releases the claim and remains
retryable.

The legacy received set
`lq:<quiz-id>:i:<instance-id>:responses:received` is read-only compatibility
input while old response-api instances drain. The cockpit adds its cardinality
to the new received counter. If a processed counter is not initialized yet,
the cockpit falls back to the legacy processed-set cardinality as an opaque
pre-cutover baseline. New code never writes the legacy received set.

Connection-level processing script failures still throw so Hatchet can retry.
The authorized `cockpitQuiz` query reads the counters and compatibility values
per started element, and the lecturer cockpit's existing two-second polling
displays them; scheduled elements have no counts
(`packages/util/src/liveQuizResponseTracking.ts`,
`apps/response-api/src/index.ts:handleAddResponse`,
`apps/response-api/src/index.ts:handleAddAssessmentResponse`,
`apps/hatchet-worker-response-processor/src/processors/processor.ts:processResponseMessage`,
`apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:aggregateAssessmentResponses`,
and `packages/graphql/src/services/liveQuizzes.ts:getCockpitQuiz`).

The difference between received and processed is an operational signal, not
exact queue depth. It can include queued work as well as invalid, duplicate,
late, rejected, failed, or untracked responses. Tracking does not change the
response pipeline's validation semantics. Result aggregation uses the replay
claim as a bounded replay guard for completed batches: after a successful
claim-and-aggregation, a retry is a no-op. Preflight command errors release no
claim, are logged as aggregation failures, do not increment the processed
counter, and cause the worker to retry. Unexpected errors after a command has
applied retain the claim, return `reconciliation_required`, and are
acknowledged without retry; errors before any command applies release the claim
and remain retryable.

Counters stay persistent while their element instance is active, matching the
rest of the live execution cache. Replay claims are bounded independently of
active-instance lifetime. When a block closes, cleanup first starts the
canonical instance-info key's one-day retention and then expires the response
keys. A concurrent tracking write atomically reads that info-key TTL and
mirrors the remaining retention; if the info key is already missing, the
tracking key receives a one-day safety expiry. The keys also remain under the
existing per-instance wildcard
(`packages/graphql/src/services/liveQuizzes.ts:removeCacheEntriesBlock`).
Cleanup-retention failures are logged and propagated so the mutation reports a
failure and the caller can retry the cleanup.

Deployment ordering matters: deploy GraphQL before new response ingress, drain
old response-processor replicas before initializing processed counters, and then
run only the new processors. Frontend-manage remains safe after GraphQL because
the fields are additive and nullable. Old and new processors cannot overlap
after counter initialization because old workers do not increment the new
processed counter.

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
