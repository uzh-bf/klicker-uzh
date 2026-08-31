---
type: Async Architecture
title: Async & Workers
description: The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
timestamp: '2026-08-27'
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

## Worker task catalog

`apps/hatchet-worker-response-processor` (`src/index.ts`):

- `processAnonymousResponseTask` — on `response-received:anonymous`
- `processAuthenticatedResponseTask` — durable
- `processAssessmentResponseWorkflow` — durable, with an on-failure audit-log hook
- `aggregateAssessmentResponsesTask` — keyed by `instanceId`

`apps/hatchet-worker-general` (`src/index.ts`) — selects workflows via the `HATCHET_WORKFLOWS` env var (default all; unknown keys are rejected at startup):

- `create-audit-log-entry` (event-driven)
- `process-course-deletion` — async course deletion worker implemented by
  `packages/graphql/src/services/courseDeletion.ts`. One deletion runs globally
  while additional jobs queue for up to 60 minutes. The start mutation stores
  owner-scoped state in Redis, takes a per-course lock, and retries ambiguous
  event publication with the same job id. Lost publication acknowledgements
  keep the job pending and locked and are returned as unacknowledged so the
  confirmation modal stays open; the stale sweep uses an atomic
  pending/no-lease transition for bounded five-minute recovery publications
  until Hatchet acknowledges one or the job reaches its stale deadline. The
  acknowledged job is also recorded durably on `Course` through
  `isDeletionPending`, `deletionJobId`, `deletionPendingAt`, and the optional
  draft-cleanup choice. Server-side active-course filters therefore hide the
  course for every client, not only the browser that initiated the deletion;
  the `UserActivities` view also hides the snapshotted linked drafts when
  cleanup was selected. Terminal failure clears that durable pending state. The
  worker renews a token-checked process lease and heartbeat, fences status
  writes with the lease token, reconstructs the initiating user context,
  rechecks course-level `ADMIN`, and invokes the existing atomic deletion
  service with a ten-minute transaction timeout. The service soft-deletes the
  course and retains course-owned data by default; an optional flag permanently
  removes linked draft activities of all four activity types. It takes a
  transaction-scoped PostgreSQL advisory lock derived from the course id before
  destructive work, fencing background retries and same-source duplication.
  Draft activity ids are snapshotted when the job is accepted, so later drafts
  are not silently added to the destructive scope. Before the database
  transaction, the worker atomically installs each linked live quiz's Redis
  deletion fence only after all response-processing leases have drained. The
  response API acquires a Redis admission lease and creates a durable
  `LiveQuizResponseAdmission` before publishing to Hatchet. It acknowledges
  HTTP only after recording publication. Admission transactions take a shared
  form of the course advisory lock, so responses remain concurrent with one
  another while the exclusive deletion transaction is excluded. The response
  worker can therefore reacquire an expired Redis lease after a long backlog,
  renews it through processing, and removes the durable admission only after
  completing. Worker attempts deduplicate by the stable admission token (or the
  Hatchet message id for rolling tokenless events) while using a unique nonce
  for attempt ownership. Redis conditionally applies result increments and the
  completed marker in one owner-checked script. Concurrent attempts are
  serialized, an expired worker cannot act on its successor's claim, and a
  retry after an ambiguous commit observes the completed marker instead of
  counting the response twice.
  Retryable results fail the Hatchet task; after retries are exhausted, a
  retried workflow-failure handler marks the admission terminal so it cannot
  block deletion forever. The response API also records Hatchet's event ID,
  and the independent five-minute deletion sweep reconciles stale admissions
  whose events have no active workflow runs. This closes an admission even if
  the failure handler itself exhausts its retries; missing or ambiguous Hatchet
  state remains fail-closed. Reconciliation attempts are durably rotated so an
  ambiguous batch cannot starve newer terminal admissions. Course deletion
  waits for non-terminal durable admissions and Redis processing leases. Both
  services also recheck the durable parent-course state under compatible
  shared/exclusive PostgreSQL advisory locks. This prevents an HTTP 200 response
  from being discarded merely because deletion started while its Hatchet event
  was queued. Generic failures remain retryable; revoked access and assessment
  conversion are terminal.
  Stale normalization uses an absolute 75-minute deadline, then atomically
  requires the expected Redis record and no process lease or heartbeat before
  reconciling against Postgres: `Course.isDeleted = true` (or an absent legacy
  row) means `COMPLETED`, while an active course means `FAILED`. Terminal
  records strip execution identity, cleanup metadata, and deletion options
  while retaining the owner id for status-read authorization. The manage
  frontend persists each job id with its course id and optional draft-cleanup
  choice, polls `courseDeletionStatuses` invisibly, and hides the affected
  course plus selected linked drafts across tabs and reloads until terminal
  status. It then removes the local target and refetches course and activity
  queries. The deprecated `deleteCourse` mutation remains for rolling-client
  compatibility, but it only queues the same Hatchet workflow; there is no
  public synchronous deletion path. A database trigger rejects hard deletion
  unless the transaction explicitly enables the privileged purge context, and
  rejects updates to pending/deleted rows outside the deletion worker context.
  This prevents old application pods from mutating or destroying retained data
  during a rolling deployment.
  Production deliberately ships the first rollout with
  `COURSE_DELETION_ENABLED=false`. Enable it in a second rollout only after all
  Response API and response-worker pods have been replaced and tokenless events
  from the previous version have drained. Other environments default to
  enabled.
- `sweep-stale-course-deletions` — cron task (every 5 minutes) scanning
  non-terminal deletion records and applying heartbeat + Postgres
  reconciliation. It also scans stale durable pending rows and restores a
  course when its matching Redis job, process lease, and heartbeat have all
  disappeared, preventing a Redis eviction from hiding a course indefinitely.
- `process-course-duplication` — async course duplication worker implemented by `packages/graphql/src/services/courseDuplication.ts`. A task-local constant concurrency bucket allows one running duplication globally and queues additional duplication jobs for up to 60 minutes with group round-robin scheduling; unrelated Hatchet tasks retain their own concurrency. The GraphQL mutation stores job state in Redis and returns a job id; it retries an ambiguous Hatchet event publication with the same job id, and republishes an existing pending job on a later mutation retry, so a lost acknowledgement cannot open a second copy or strand the job. Each attempt allows 30 minutes, above the ten-minute database transaction limit, and waits 60 seconds before the first retry so a crashed worker's lease can expire. The worker uses a renewable, token-checked process lease plus a separate 120-second heartbeat key refreshed on the same cadence; rethrows generic failures for Hatchet retries; and records only access or partial-copy failures as terminal. Stale-job normalization (`COURSE_DUPLICATION_STALE_AFTER_MS`, currently 75 minutes — 15 minutes beyond the queue timeout) only fires when the record is old **and** no fresh heartbeat exists, then reconciles against Postgres before declaring failure: because a running attempt refreshes the record before starting and the copied course carries the job id as its primary key, live or committed work is not misclassified as a stale failure. Terminal records strip the stored mutation payload (including any notification email) and identity fields for the remainder of their TTL. A scheduled sweep (`sweep-stale-course-duplications`, every 5 minutes) normalizes abandoned jobs server-side, so recovery no longer depends on a user polling. The manage frontend polls `courseDuplicationStatuses` until the job completes or fails, then shows a localized action to open the copied course without navigating automatically.
- `sweep-stale-course-duplications` — cron task (every 5 minutes) scanning non-terminal duplication records and applying stale normalization with heartbeat + Postgres reconciliation.
- `publish-scheduled-*` / `end-expired-*` — activity lifecycle
  handlers treat a deleted parent course as a successful no-op; course deletion
  clears their stored task ids transactionally and cancels known Hatchet tasks
  after commit.
- `aggregate-block-closure-*` — live-quiz block aggregation
- Daily crons (`0 0 * * *`): `updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`

## Course duplication operations

Job state lives in Redis under three key families (all self-expiring): status records `course-duplication:job:<jobId>` and per-user/per-course source locks `course-duplication:source:<userId>:<sourceCourseId>` expire after **24 hours**; process leases `course-duplication:job:<jobId>:processing` and heartbeats `course-duplication:job:<jobId>:heartbeat` expire after 60/120 seconds. Postgres is the source of truth for outcomes: a committed course row whose id equals the job id proves the copy succeeded regardless of Redis state.

To correlate a user report ("my duplication vanished") with only a course name or approximate time: list their keys with `SCAN 0 MATCH "course-duplication:source:<userId>:*"` (keys carry the source course id), read the referenced job record with `GET course-duplication:job:<jobId>` while it exists, and check `prisma.course.findUnique({ where: { id: <jobId> } })` for the outcome. Permission `AuditLogEntry` rows written inside a successful copy transaction outlive the Redis record. Worker logs carry the job id.

**Rolling back this feature:** old code never registers the `process-course-duplication` workflow, so already-enqueued events stay QUEUED in Hatchet and mid-flight job records simply age out at their TTLs; users lose completion signals until the rollback completes, but no partial copies exist at any point (the copy is one database transaction). Recovery-by-resubmit works immediately after rollback because the legacy synchronous path ignores duplication locks. To release held source locks without waiting for TTL expiry: `SCAN 0 MATCH "course-duplication:source:*"` then `DEL` the listed keys.

## Course deletion operations

Deletion status records live at `course-deletion:job:<jobId>` and per-course
locks at `course-deletion:course:<courseId>` for 24 hours. Process leases and
heartbeats use the corresponding `:processing` and `:heartbeat` suffixes with
60/120-second expiry. Postgres remains the source of truth:
`Course.isDeleted = true` proves that the requested deletion is complete even
if the final Redis write was lost. An absent row remains a compatible success
marker for jobs committed by older versions.

To inspect a reported job, read the job id from the per-course lock while it
exists, then inspect its status record and worker logs using that id. Status
records are intentionally short-lived and are not an audit history. Rolling
back removes the worker registration, so queued events wait and active Redis
records eventually expire; the database hard-delete guard remains in effect.
The deprecated `deleteCourse` field is a background-queue adapter and must not
be changed back to direct deletion. Release an abandoned course lock only after
confirming that no worker attempt is active, and clear the matching durable
pending fields only after confirming the Hatchet job cannot resume.

## Running locally (config-derived — verify on your machine)

The Hatchet engine runs as the `hatchet` compose service using `hatchet-lite-dev` (gRPC 7077, UI 8888, no UI authentication required); workers pick up the client token automatically minted to `/config/authdisabled-token` or populated by `./util/_create_hatchet_token.sh`. The standard Response API and response processor now fail startup when `DATABASE_URL` is absent and verify the database connection before becoming ready. They must see the **same `DATABASE_URL`, `APP_SECRET`, and Redis settings** as the app stack — a service pointed at the wrong database rejects or processes events against the wrong course state. The v3 chart injects `DATABASE_URL` into both standard response workloads directly from the existing `backend-graphql` Secret; their own externally provisioned Secrets continue to provide service-specific credentials. In the managed devcontainer, `devrouter ensure . --profile live-quiz` starts Response API and both workers, then proves `/healthz` and one live runtime process per worker before reporting ready. The `packages/graphql` vitest suite also requires a live Hatchet + `HATCHET_CLIENT_TOKEN` (see [Testing](./testing.md)).

Both development workers compile with Rollup and run the emitted JavaScript under nodemon. Do not replace that runner with `tsx --watch` or `node --watch`: their in-process watch protocols reach Hatchet's heartbeat worker-thread listener, which treats the watch message as a logger method and crashes with `TypeError: this.logger[message.type] is not a function`. When checking worker health, verify that the process stays alive for more than one four-second heartbeat interval; the initial `Connection established using LISTEN_STRATEGY_V2` message alone is insufficient. See [Hatchet heartbeat workers crash under in-process watch mode](./solutions/runtime-error/hatchet-heartbeat-workers-crash-under-in-process-watch-mode.md).
