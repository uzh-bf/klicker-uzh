---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-16'
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

`packages/hatchet/src/index.ts:prepareHatchetTasks` registers six local workflows:

- `ingest-kb-resource` accepts the selected resource, version, and attempt identifiers, prepares the exact source bytes, then calls `packages/hatchet/src/kbIngestion.ts:dispatchKBIngestion`. Dispatch awaits `POST /v1/resources`, stores the returned operation identifier, and reuses the same version, digest, source URL, and idempotency key when an attempt is retried. Source identity and accepted-operation correlation update `KBResource` and its `KBIngestionRun` in one transaction.
- `monitor-kb-ingestions` runs every minute and calls `packages/hatchet/src/kbIngestion.ts:monitorActiveKBIngestions`. It rotates through at most 32 active operations per tick, polls `GET /v1/operations/{operation_id}` eight at a time, and applies only responses matching the local operation, resource version, and content digest. Operation state, safe error details, and active serving identity update atomically. A succeeded replacement remains `PROCESSING` with a `SUCCEEDED` run while an older version is serving; it becomes `READY` only when the observed digest and actively serving version/digest match.
- `delete-kb-resource` sends the exact canonical `DELETE /v1/resources/{external_resource_id}` request with the delete-run UUID as its stable idempotency key. Polling and webhooks fence that attempt as `DELETE`, require `expected_sha256=null`, and consider the tombstone served only when both active serving fields are null.
- `maintain-kb-resources` runs every 15 minutes with one active run. Each pass handles at most 32 items per class and at most eight concurrently: re-dispatching a live `QUEUED` UPSERT that is at least one maintenance interval old and still has no external operation id; retrying undispatched tombstones with their stable attempt; starting a freshly fenced attempt after a terminal external delete failure; removing expired unconfirmed uploads after the 24-hour grace; deleting confirmed blob storage only after the current external delete succeeded; hard-deleting those resource rows; and finally removing empty pending KBs. UPSERT recovery reuses the stored `ingestionAttemptId`, so the external Idempotency-Key stays stable whether the earlier process crashed before or after acceptance. The bounded windows rotate on each schedule slot so retained failures cannot starve later rows, and dispatch setup failures do not stop independent storage or row cleanup. Storage or API failures retain the exact ticket or tombstone for another pass (`packages/hatchet/src/kbMaintenance.ts:maintainKBResources`).
- `build-kb-knowledge-graph` rechecks the global graph kill switch, the persisted per-KB opt-in, and a complete cost reservation at the worker effect boundary before dispatching the active KB's immutable source manifest to the external graph workflow. It first records a conditional durable dispatch claim. A queued build that fails those gates is failed closed, releases an ordinary reservation, or holds an incomplete legacy reservation for human review; if the provider accepts a run but its id cannot be correlated and persisted, the claim keeps the reservation and active KB build slot in `NEEDS_HUMAN_REVIEW` and prevents a duplicate external start until recovery, cancellation, settlement, or manual resolution. The worker correlates the returned run id and never publishes an unverified graph or artifact path.
- `monitor-kb-graph-builds` runs every minute, reconciles graph workflow status, cancels timed-out runs, and requires a versioned terminal-result callback before settlement or publication. Provider `COMPLETED` is not sufficient. A missing callback or malformed result clears the active slot without moving the published pointer and holds the reservation as `NEEDS_HUMAN_REVIEW`; a valid non-success result with metering settles actual usage without publishing, while a non-success result without metering releases only an ordinary `RESERVED` build. A late success after a timeout is reconciled under KB and serving-resource locks: it can reclaim the slot and publish only when no newer build exists and the pinned source digest still matches; stale or superseded late results settle metered usage without publication. A malformed or late failure result remains held and every callback still passes the same identity, artifact, currency, counter, and metering checks.

Single and bulk lecturer deletion both create their fenced runs inside the database transaction and enqueue only after commit. Bulk dispatch is bounded to eight concurrent tasks; each rejection records retry state independently so one unavailable Hatchet call cannot prevent sibling tombstones or later W5 maintenance.

Operation events also return through the raw-body `/api/webhooks/kb-ingestion` route registered by `apps/backend-docker/src/app.ts:prepareApp`. `packages/graphql/src/services/knowledgeWebhooks.ts:handleKBIngestionWebhook` accepts the strict canonical event body and the four `X-Ingestion-*` headers, verifies an HMAC-SHA256 signature within the five-minute replay window against the current or previous webhook secret, then applies the same operation/version/digest correlation guards and atomic resource/run updates as polling. Client-initiated lifecycle events remain attempt-scoped. The distinct platform `resource.content_refreshed` event requires a non-null serving version/hash matching `resource_version`, locks the live resource, writes a terminal UPSERT ledger row correlated to `operation_id`, and advances only the active serving fields and `ingestedAt`; repeated delivery is deduplicated by operation ID and an older refresh is retained as `SUPERSEDED`. The owner resource list resolves its operation status through the resource's stored attempt rather than ledger timestamp order, so a refresh cannot display success over a concurrent lecturer operation. Later serving events can complete a successful replacement cutover; terminal run guards prevent delayed processing or failure events from regressing it.

URL resources are registered only with public HTTP(S) destinations using ports 80 or 443 and without credentials, fragments, or secret-like query parameters. Before dispatch, every redirect hop is resolved to a public IPv4 address and fetched through that pinned address while the original public URL remains the ingestion source identity. Private blobs are exposed to the ingestion platform through the authenticated backend source gateway; no Azure storage credential or SAS URL crosses the API contract.

Source preparation also verifies that the task's KB id matches the resource's persisted live parent. It records the exact fetched byte size. Under a parent-KB row lock, URL replacement accounting applies `current usage - previous resource size + observed size`; an over-limit candidate becomes `FAILED` with `KB_STORAGE_LIMIT_REACHED` before any external API call. Production-v1 source preparation accepts PDF and plain text; lecturer Markdown uploads are deliberately stored as `text/plain`.

The interim backend kill switch `KB_INGESTION_DISABLED=true` is checked by `packages/graphql/src/services/knowledge.ts:assertKbIngestionEnabled`. It refuses new upload tickets, URL resources, and ingestion attempts while leaving reads, deletion, cleanup, and already-queued worker reconciliation live. The separate `KB_GRAPH_DISABLED=true` switch refuses graph opt-in and rebuild mutations; the worker checks it again before an external start, fails an unstarted queued build closed, and continues reconciling a run already accepted externally. It does not revoke an already published graph. The graph switch and cost settings must be injected into the GraphQL backend's environment; the chart currently maps only the non-secret external graph-worker connection settings.

The general worker requires `KB_INGESTION_API_URL`, `KB_INGESTION_API_KEY`, and `KB_SOURCE_GATEWAY_URL`; `KB_INGESTION_PROJECT_ID` defaults to `klicker-course-materials`. The backend requires `KB_SOURCE_GATEWAY_KEY` and `KB_WEBHOOK_SECRET`, with optional `KB_WEBHOOK_PREVIOUS_SECRET` during webhook-key rotation. The API key, gateway key, and webhook keys are secrets and must stay outside chart ConfigMaps.

KB graph builds use the separate `KB_GRAPH_HATCHET_*` connection and workflow settings plus `KB_GRAPH_TIMEOUT_SECONDS` and the named standard/high model pairs. The worker validates a partially configured graph integration at startup, then dispatches only a pinned build manifest and reconciles its external run. The GraphQL backend owns quota reservation and exposes `settleKbKnowledgeGraphResult` for the W1 terminal-result handoff; `prepareHatchetTasks` accepts the result-fetch and settlement callbacks so the worker never treats provider status as a publication contract. The production backend and general worker explicitly pass `getKBGraphTerminalResult` (the external Hatchet run output) and `settleKbKnowledgeGraphResult` into `prepareHatchetTasks`; omitting either adapter is not a supported runtime composition. `KB_GRAPH_HATCHET_CLIENT_TOKEN` remains in the general-worker secret; the non-secret settings belong under `hatchet.kbGraph` in the chart values. Graph build input URLs and generated Blob SAS values must never be logged or placed in ConfigMaps.

Both Hatchet workers intentionally run `tsx` without `--watch`; watch restarts unregister workflows during development.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
