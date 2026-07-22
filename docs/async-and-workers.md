---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-07-22'
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

`apps/hatchet-worker-general` (`src/index.ts`) selects workflows via the `HATCHET_WORKFLOWS` env var. Every runtime except explicit development/test requires an allowlist and rejects empty, duplicate, unknown, or missing required import/export maintenance keys. This fails closed for missing, staging, or misspelled `NODE_ENV` values. Development/test defaults to all workflows. Assessment workers derive a no-maintenance responsibility from the shared runtime configuration, exclude the import/export workflows from the development/test default, and reject them if explicitly configured:

- `create-audit-log-entry` (event-driven)
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
- `aggregate-block-closure-*` — live-quiz block aggregation
- `refresh-import-export-fingerprints` — defense-in-depth didactic refresh for unexpected historical or manually introduced dirty state affecting either one element or one answer collection plus its linked elements. Successful authored writes establish the fingerprint invariant synchronously before commit; this workflow is recovery, not their correctness boundary. Collection fan-out uses keyset continuation; the task has a five-minute execution timeout and a four-minute cooperative work budget. It stops between ten-row chunks on budget or Hatchet cancellation and never enqueues a continuation after stopping.
- `repair-import-export-fingerprints` — every 15 minutes (`*/15 * * * *`) with a ten-minute execution timeout and eight-minute cooperative work budget, repairs at most five 100-row batches for answer collections and then five for elements; after processing, re-queries the actual active null-fingerprint-or-version-stale predicate and reports only exact processed counts plus fresh backlog booleans. A single-flight `CANCEL_NEWEST` limit keeps an active run instead of overlapping it with the next cron.
- `cleanup-import-export-packages` — hourly record-scoped package-artifact, import-staging, abandoned direct-upload, and receipt cleanup at minute 30 with a 45-minute execution timeout; no container enumeration. Direct uploads become eligible after one hour, are claimed by exact `direct-upload-pending:<id>` → `direct-upload-cleanup:<id>` CAS, and keep that durable claim when exact blob deletion fails. It isolates per-record failures, processes up to ten 100-row batches per category, reports remaining backlog, and returns a failed task result when a hard cleanup/unsafe-target failure remains. The handler stops cooperatively between records or batches after 40 minutes (or Hatchet cancellation), preserving a five-minute margin and its durable backlog for the next run. A single-flight `CANCEL_NEWEST` limit prevents a slow run from overlapping the next cron.
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

Incremental import/export fingerprint refresh is idempotent. Successful authored writes compute and persist the current didactic fingerprint synchronously in the authoring transaction, so every active element and answer collection commits with both the current fingerprint version and a non-null fingerprint. Refresh and scheduled repair are defense-in-depth for historical data, manual database changes, or other unexpected drift; cleanup remains asynchronous lifecycle maintenance. These workflows use zero immediate Hatchet retries because their durable backlog makes the next bounded continuation or cron the retry boundary without extending one run across its cadence. The scheduled repair closes drift without turning it into an unbounded scan: each invocation starts at the lowest still-dirty IDs and stops at fixed per-resource limits. An active row with a null fingerprint remains dirty even when its version is current. `repairImportExportFingerprints`, `refreshImportExportFingerprints`, and `cleanupImportExportPackages` are all required normal-worker keys, including while the user-facing feature gate is dark. Assessment workers reject all three.

Historical media and fingerprint backfills are deliberately operator-controlled GraphQL CLI operations rather than globally triggerable Hatchet tasks. Operators run `./util/import-export-backfill.sh stg` or `./util/import-export-backfill.sh prd`; each media, didactic, or constraint-validation process holds one shared rollout mutex on a dedicated PostgreSQL session, while bounded keyset batches use protected database-identity-bound progress manifests for automatic resume. On the first stale-media page, the media pass invalidates every active element once by changing only its fingerprint fields; authored `Element.version` and `updatedAt` remain untouched. Media classification then finishes without downloading blobs inside database transactions. The didactic pass rescans every active element and answer collection from the beginning, including current-version rows, after all media classifications are durable. Total canonicalization ensures that active didactic rows are fingerprintable rather than allowing the cursor to advance past a permanently null result. The runner finally executes the invariant-only verifier, which checks one database snapshot and requires the current didactic version plus a valid non-null SHA-256 fingerprint on every active element and answer collection and the current media classification version on every media row. The 15-minute repair maintains future drift but is not a substitute for the rollout backfill or its invariant evidence. The production operation aliases and worker allowlist are executable repository contracts, while target execution evidence remains a release gate in the production runbook.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service (gRPC 7077, UI 8888); workers need a client token minted by `./util/_create_hatchet_token.sh` (Cypress/CI variant: `_create_hatchet_token_cypress.sh`, which has an HTTP-API fallback for containers without Docker). Workers must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a worker pointed at the wrong database happily processes events into nowhere. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).
