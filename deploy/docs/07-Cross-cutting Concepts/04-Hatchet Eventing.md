# Hatchet Eventing

Cross-cutting orchestration pattern using Hatchet events/tasks for async processing (responses, publications, aggregation) and cron-style background jobs.

## Concept

- Hatchet is used as the async “control plane” for jobs that should not run inline with user requests.
- Work is triggered either by events (push-based) or by cron schedules (pull-based).
- Workloads share a common Hatchet client (`hatchetClient`) and task definitions (`prepareHatchetTasks`) to keep event names and retry policies consistent.

## How it works

- Hatchet client initialization reads env and is reused across apps:
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/hatchet/src/client.ts`
- Global task dictionary and cron tasks are defined centrally:
  - `prepareHatchetTasks(...)` defines tasks, wiring a shared context `{ prisma, redisExec, redisAssessmentExec, redisCache, pubSub, emitter }`.
  - Cron tasks use `onCrons: ['0 0 * * *']` (daily at midnight UTC) for group/timeline maintenance.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/hatchet/src/index.ts`
- Response processing is event-driven and split by priority/durability:
  - `response-received:anonymous` → `process-anonymous-response` (`retries: 1`, `Priority.MEDIUM`).
  - `response-received:authenticated` → `process-authenticated-response` (durable, `retries: 3`, `Priority.HIGH`).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
- Assessment processing is a Hatchet workflow with failure handling and aggregation:
  - Workflow `process-assessment-response-workflow` on `response-received:assessment`.
  - Aggregation durable task `aggregate-assessment-responses` on `response-processed:aggregation` with concurrency key `input.instanceId`, `maxRuns: 1`, `GROUP_ROUND_ROBIN`.
  - Failure handler `log-assessment-response-failure` pushes `create-audit-log-entry`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
- General worker executes the shared task dictionary (selectable via env):
  - `HATCHET_WORKER_NAME` sets the worker identity.
  - `HATCHET_WORKFLOWS` optionally restricts which prepared tasks are registered.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-general/src/index.ts`
- Event producers:
  - `[[Response API]]` pushes response events via `hatchetClient.events.push(...)`.
  - `[[Backend GraphQL]]` uses Hatchet for scheduled publication tasks and invokes prepared tasks.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/backend-docker/src/index.ts`

## Affected workloads

- [[Response API]] / [[Response API - Assessment]]
- [[Hatchet Worker - Response Processor]] / [[Hatchet Worker - Response Processor - Assessment]]
- [[Hatchet Worker - General]]
- [[Backend GraphQL]] / [[Backend GraphQL - Assessment]]

## Configuration

- `HATCHET_CLIENT_TOKEN` — auth
- `HATCHET_CLIENT_HOST_PORT` — grpc
- `HATCHET_HOST_PORT` — grpc
- `HATCHET_CLIENT_TLS_STRATEGY` — tls
- `HATCHET_API_URL` — api
- `HATCHET_TENANT_ID` — tenant
- `HATCHET_LOG_LEVEL` — logs
- `HATCHET_WORKER_NAME` — worker
- `HATCHET_WORKFLOWS` — select

## Related docs

- [[01-Live Quiz - Non-assessment]]
- [[02-Live Quiz - Assessment]]
- [[01-Assessment vs Non-assessment Split]]
