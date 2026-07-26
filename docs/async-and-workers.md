---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-26'
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
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Knowledge-base ingestion

`packages/hatchet/src/index.ts:prepareHatchetTasks` registers two local workflows:

- `ingest-kb-resource` accepts the selected resource, version, and attempt identifiers, prepares the exact source bytes, then calls `packages/hatchet/src/kbIngestion.ts:dispatchKBIngestion`. Dispatch awaits `POST /v1/resources`, stores the returned operation identifier, and reuses the same version, digest, source URL, and idempotency key when an attempt is retried.
- `monitor-kb-ingestions` runs every minute and calls `packages/hatchet/src/kbIngestion.ts:monitorActiveKBIngestions`. It polls `GET /v1/operations/{operation_id}` with bounded concurrency and applies only responses matching the local operation, resource version, and content digest.

Operation events also return through the raw-body `/api/webhooks/kb-ingestion` route registered by `apps/backend-docker/src/app.ts:prepareApp`. `packages/graphql/src/services/knowledgeWebhooks.ts:handleKBIngestionWebhook` accepts the strict canonical event body and the four `X-Ingestion-*` headers, verifies an HMAC-SHA256 signature within the five-minute replay window against the current or previous webhook secret, then applies the same operation/version/digest correlation guards as polling. A resource becomes `READY` only when the platform reports that the expected version and digest are actively serving.

URL resources are registered only with public HTTP(S) destinations using ports 80 or 443 and without credentials, fragments, or secret-like query parameters. Before dispatch, every redirect hop is resolved to a public IPv4 address and fetched through that pinned address while the original public URL remains the ingestion source identity. Private blobs are exposed to the ingestion platform through the authenticated backend source gateway; no Azure storage credential or SAS URL crosses the API contract.

The general worker requires `KB_INGESTION_API_URL`, `KB_INGESTION_API_KEY`, and `KB_SOURCE_GATEWAY_URL`; `KB_INGESTION_PROJECT_ID` defaults to `klicker-course-materials`. The backend requires `KB_SOURCE_GATEWAY_KEY` and `KB_WEBHOOK_SECRET`, with optional `KB_WEBHOOK_PREVIOUS_SECRET` during webhook-key rotation. The API key, gateway key, and webhook keys are secrets and must stay outside chart ConfigMaps.

Both Hatchet workers intentionally run `tsx` without `--watch`; watch restarts unregister workflows during development.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
