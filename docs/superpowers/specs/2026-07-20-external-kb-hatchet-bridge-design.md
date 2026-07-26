# External KB Hatchet Bridge Design

Date: 2026-07-20

Status: approved in conversation on 2026-07-20

Related implementation record: `project/2026-07-15-pr-5174-kb-poc-plan.md`

## Goal

Extend the existing KB POC so that clicking **Ingest** keeps the local `ingest-kb-resource` Hatchet log and also triggers a workflow on a separate Hatchet instance. The external workflow processes only the selected resource and exports it to a FalkorDB graph for the knowledge base.

The external workflow remains unchanged and does not call Klicker's webhook. Klicker monitors the external run and updates its own resource status through the existing signed webhook.

## Existing Behavior Retained

- KB files remain in the existing Azure storage account configured by `BLOB_STORAGE_ACCOUNT_NAME` and `BLOB_STORAGE_ACCESS_KEY`.
- KB files remain separate from media-library files. They are stored in private per-user containers named `kb-<user UUID>` and are represented by `KBResource`, not `MediaFile`.
- The local Hatchet task remains named `ingest-kb-resource` and retains its existing privacy-safe log.
- GraphQL continues to atomically claim a resource before dispatch.
- Resource status changes continue to use the signed webhook transition rules.
- Only one ingestion can be active for a resource at a time.

## User Experience

Each resource row receives a speed-mode selector beside **Ingest** with these values:

- `balanced` (default)
- `quality`
- `fast`

The selection applies only to that ingestion click. It is sent through the GraphQL mutation and local Hatchet task but is not persisted as a resource preference.

GraphQL exposes the choice as a `KBSpeedMode` input enum with `BALANCED`, `QUALITY`, and `FAST`. The bridge maps those API values to the lowercase strings expected by the Python workflow.

The existing live UI behavior remains:

- `QUEUED` and `PROCESSING` resources are polled by the browser.
- `READY` and `FAILED` are terminal UI states.
- Re-ingestion remains available from the existing allowed terminal states.

## External Hatchet Client

The general Hatchet worker creates a second, lazily initialized Hatchet client for the separate Hatchet server and tenant. It uses the installed `@hatchet-dev/typescript-sdk` client rather than a custom HTTP wrapper.

The workflow is triggered by its environment-configured name with `runNoWait(workflowName, payload, options)`. The returned workflow run ID is persisted before the local dispatch task completes.

Required configuration:

| Variable                                   | Purpose                                                               | Secret |
| ------------------------------------------ | --------------------------------------------------------------------- | ------ |
| `KB_INGESTION_HATCHET_CLIENT_TOKEN`        | External Hatchet client token and tenant identity                     | yes    |
| `KB_INGESTION_HATCHET_CLIENT_HOST_PORT`    | External Hatchet engine address, normally cluster service DNS         | no     |
| `KB_INGESTION_HATCHET_API_URL`             | External Hatchet API address used for run inspection and cancellation | no     |
| `KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY` | External Hatchet TLS behavior                                         | no     |
| `KB_INGESTION_HATCHET_WORKFLOW_NAME`       | External Python workflow name                                         | no     |
| `KB_INGESTION_TIMEOUT_SECONDS`             | Maximum external runtime; defaults to `3600`                          | no     |

The connection values are Kubernetes/Infisical configuration. No namespace, service name, tenant ID, URL, or token is hard-coded.

An absent timeout uses `3600`. A present timeout must parse as a positive integer; invalid configuration fails worker initialization rather than silently using an unintended duration.

## External Workflow Payload

One click sends one source:

```json
{
  "course_id": "<KB UUID>",
  "sources": [
    {
      "source_id": "<KB resource UUID>",
      "source_url": "<public URL or temporary read SAS URL>"
    }
  ],
  "upload_markdown": true,
  "export_to_falkordb": true,
  "falkordb_graph_name": "klickeruzh:<KB UUID>",
  "speed_mode": "balanced"
}
```

Mapping decisions:

- `course_id` is the stable KB UUID, not the editable KB name.
- `source_id` is the stable resource UUID, not a title or filename.
- `sources` contains only the selected resource.
- `speed_mode` is the value selected for that click.
- The other processing options are fixed POC behavior.
- URL resources must use HTTP(S) without embedded credentials and a public hostname or IPv4 address. Klicker rejects local, private, reserved, IPv6-literal, and non-public test/internal destinations both when the resource is created and immediately before dispatch.
- The external ingestion service remains responsible for DNS-resolution and redirect egress controls; do not expose this bridge to lecturer traffic until that deployment boundary is verified.

The local ingestion-attempt UUID is attached as Hatchet `additionalMetadata`; it is not added to the Python workflow input.

## Private Blob Access

For a blob resource, the local Hatchet worker generates a blob-scoped Azure SAS URL immediately before triggering the external run:

- permission: read only (`r`)
- protocol: HTTPS only
- scope: the selected blob only
- clock-skew allowance: start time five minutes in the past
- expiry: one hour

The one-hour duration is represented by a clearly named constant. A nearby comment must state that it may need adjustment for larger files or slower ingestion workflows in future modifications.

The SAS URL is not stored in Klicker's database or local Hatchet input and is never logged. It is necessarily stored in the external Hatchet run input/history until that system's retention removes it, but becomes unusable after expiry.

The general worker must receive the same blob storage account name and access key already used by the backend. KB containers remain private; media-library container visibility is not changed.

## Latest-Attempt Data Model

Add these nullable fields to `KBResource`:

- `ingestionAttemptId` (`UUID`): newly generated for each accepted ingestion click
- `externalWorkflowRunId` (`String`): latest external Hatchet workflow run ID
- `externalWorkflowStartedAt` (`DateTime`): local acceptance time used for timeout evaluation

No ingestion history table is added. Starting a new attempt replaces the attempt ID and clears the previous external run ID/start time.

The attempt ID is the correlation guard across GraphQL, local Hatchet, the external Hatchet run metadata, the sweeper, and the signed webhook. Every conditional update verifies that the resource still belongs to the same attempt. An old dispatch retry or sweep result therefore cannot overwrite a newer attempt.

## Dispatch and Retry Flow

1. GraphQL validates ownership, current status, and speed mode.
2. GraphQL generates an attempt UUID and atomically changes the resource to `QUEUED`, storing the attempt ID and clearing previous external-run metadata.
3. GraphQL dispatches the existing local `ingest-kb-resource` task with the resource location, speed mode, and attempt ID.
4. The local task retains the existing identifier/type-only log.
5. On task execution or retry, the worker first confirms that the attempt is still current.
6. If an external run ID is already stored, the task returns without starting another run.
7. Otherwise, it looks for an external run carrying the same attempt ID in `additionalMetadata`. This recovers an accepted run after an ambiguous client/network failure.
8. If no matching run exists, it generates the source URL and triggers the configured external workflow.
9. The task conditionally stores the external run ID and start time only if the attempt remains current.
10. If the conditional store loses to a newer attempt, the just-created external run is cancelled on a best-effort basis.

If dispatch permanently fails, the final local failure path reports `FAILED` through the signed webhook using the attempt ID. Detailed connection and SDK errors remain in Hatchet logs; the user-facing message is sanitized.

A very small residual ambiguity remains if the external Hatchet server accepts a run but neither returns its ID nor makes the attempt metadata searchable before every local retry. This POC mitigates that window with metadata lookup but does not add a cross-system transactional outbox.

## Singleton Status Sweeper

Define one local task named `monitor-kb-ingestions` with the cron expression `* * * * *`. It is configured with a constant concurrency expression, `maxRuns: 1`, and `CANCEL_NEWEST` so overlapping sweeps cannot run simultaneously.

Each sweep queries `KBResource` rows with:

- local status `QUEUED` or `PROCESSING`
- non-null `ingestionAttemptId`
- non-null `externalWorkflowRunId`
- non-null `externalWorkflowStartedAt`

Resources are handled independently and sequentially for the POC. One external API or webhook failure is logged and does not prevent later resources from being checked. The next one-minute sweep retries any resource that remains active.

External Hatchet status mapping:

| External status | Klicker action                   |
| --------------- | -------------------------------- |
| `QUEUED`        | keep `QUEUED`                    |
| `RUNNING`       | signed webhook sets `PROCESSING` |
| `COMPLETED`     | signed webhook sets `READY`      |
| `FAILED`        | signed webhook sets `FAILED`     |
| `CANCELLED`     | signed webhook sets `FAILED`     |

If elapsed time exceeds `KB_INGESTION_TIMEOUT_SECONDS`, the sweeper attempts to cancel the external run and then reports `FAILED`. Cancellation failure is logged but does not prevent the local timeout transition.

Because the sweeper discovers active work from PostgreSQL, monitoring resumes automatically after local worker or pod restarts. No per-resource sleeping monitor tasks or recursive schedules are created.

## Signed Webhook Correlation

The local worker, not the external workflow, calls `KB_WEBHOOK_URL`. Requests continue to use HMAC-SHA256 over the exact raw body and timestamp with `KB_WEBHOOK_SECRET`.

The webhook payload is extended with `ingestionAttemptId`. Its database transition adds an equality condition for that attempt ID. Validly signed callbacks for stale attempts return the existing successful no-op response and cannot mutate the new attempt.

The worker and backend must share the same webhook secret through secret management. Move the byte-exact `signKBIngestionWebhook` implementation into a server-safe module under `packages/util`; `packages/graphql/src/services/knowledgeWebhooks.ts` imports and re-exports it to preserve the existing public API, and the general worker imports that same function. Generation and verification therefore use one implementation and one set of contract tests.

## Deployment Wiring

The general Hatchet worker ConfigMap/Helm values expose:

- external Hatchet host/API/TLS/workflow configuration
- `KB_INGESTION_TIMEOUT_SECONDS`, default `3600`
- `KB_WEBHOOK_URL`
- `BLOB_STORAGE_ACCOUNT_NAME`

The existing general-worker secret receives through the deployment secret-management process:

- `KB_INGESTION_HATCHET_CLIENT_TOKEN`
- `KB_WEBHOOK_SECRET`
- `BLOB_STORAGE_ACCESS_KEY`

The new variable names are also added to Turbo's global environment allow-list and local `.env.example` files. Real tokens, storage keys, namespace names, and environment-specific service addresses are never committed.

## Failure Semantics

- Missing external configuration: dispatch retries, then the current attempt becomes `FAILED` with a generic configuration message.
- Azure SAS generation failure: dispatch retries, then the current attempt becomes `FAILED`.
- External trigger failure: attempt-metadata lookup is used before retrying creation; final failure becomes `FAILED`.
- External status-query failure: only that resource is skipped until the next sweep.
- Webhook failure: only that resource is retried during the next sweep.
- External `FAILED`/`CANCELLED`: local `FAILED` with a sanitized message.
- Timeout: best-effort external cancellation followed by local `FAILED`.
- Stale attempt or terminal resource: dispatch/sweeper exits without mutation.

No external SDK error, token, SAS URL, storage key, or webhook secret is returned to the browser or written to application logs.

## Verification Strategy

### GraphQL and database integration tests

- Accept `balanced`, `quality`, and `fast`; reject invalid values.
- Generate a fresh attempt UUID and clear previous external metadata.
- Preserve the existing ownership and allowed-status checks.
- Keep concurrent ingest clicks to one active attempt and one local dispatch.
- Guard webhook transitions by attempt ID.
- Prove stale callbacks cannot mutate a newer attempt.

### Bridge tests with mocked Azure and external Hatchet clients

- Generate a one-hour, read-only, HTTPS-only SAS for the exact blob.
- Pass a URL resource through unchanged.
- Build the exact agreed Python workflow payload.
- Read workflow and connection settings from the dedicated environment variables.
- Attach the attempt ID as external run metadata.
- Reuse a previously accepted external run found by attempt metadata.
- Persist only the latest run ID and cancel a run that loses the attempt guard.
- Sanitize final dispatch failures.

### Sweeper tests

- Select only active resources with complete external-run metadata.
- Map all five external Hatchet statuses correctly.
- Send signed webhook requests containing the attempt ID.
- Skip stale and terminal resources.
- Apply the environment-configured timeout, defaulting to `3600`.
- Attempt external cancellation on timeout.
- Continue processing after one resource's lookup or webhook fails.
- Verify the non-overlapping one-minute cron declaration.

### Browser verification

- Selector defaults to `balanced`.
- All three modes can be selected.
- Ingest sends the chosen value and changes only the selected resource to `QUEUED`.
- Sweeper-driven `PROCESSING`, `READY`, and `FAILED` states appear through existing UI polling.
- Recheck desktop/mobile and English/German states affected by the new selector.

### Cluster smoke test

After environment-specific credentials and service addresses are configured:

1. Upload a real PDF into the private KB container.
2. Select a speed mode and trigger ingestion.
3. Confirm the external Hatchet run receives the agreed payload and a working read SAS URL.
4. Confirm the external run ID is stored on the KB resource.
5. Confirm the singleton sweep advances the UI status.
6. Confirm FalkorDB contains `klickeruzh:<KB UUID>`.
7. Confirm the resource reaches `READY`.
8. Exercise one external failure or cancellation and confirm `FAILED`.

The shared external cluster is not used for deterministic race, timeout, or failure-path tests; those remain mocked and locally repeatable.

## Out of Scope

- Changes to the external Python workflow.
- An ingestion-attempt history table or webhook inbox/outbox.
- Course-to-KB relationships; the KB UUID remains `course_id`.
- Multiple selected sources in one external run.
- Making KB containers public.
- Persisting speed-mode preferences.
- Consuming the FalkorDB graph from chat/runtime features.
- Eliminating the final cross-system trigger ambiguity with a transactional outbox.
