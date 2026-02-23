# Hatchet Worker - General

General-purpose Hatchet worker that runs background workflows defined in the monorepo (via `@klicker-uzh/hatchet` + `@klicker-uzh/graphql` handlers).

## Code

- App: `apps/hatchet-worker-general/`
- Entry point: `apps/hatchet-worker-general/src/index.ts`

## Responsibilities

- Connect to the Hatchet orchestrator and execute workflows/tasks.
- Prepare available tasks via `prepareHatchetTasks(...)` and select which ones to run.
  - Selection can be restricted via `HATCHET_WORKFLOWS` (comma-separated keys); otherwise defaults to all tasks.
- Provide PubSub/eventing support for workflows via Redis-backed GraphQL Yoga event target.

## Dependencies

- **Hatchet orchestrator** (worker registration + job execution)
- **Redis** (multiple logical instances, same set as backend):
  - standard Redis (`REDIS_*`)
  - assessment Redis (`REDIS_ASSESSMENT_*`)
  - cache/pubsub Redis (`REDIS_CACHE_*`)
- **GraphQL handlers** imported from `@klicker-uzh/graphql` (used by tasks)

## Deployment (Helm)

- Values: `hatchet.workers.general.*` in `deploy/charts/klicker-uzh-v3/values.yaml` and env overlays
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml` (component `hatchet-worker-general`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml` (`config-hatchet-worker-general`)
- Secret: `{{ releaseFullname }}-secret-hatchet-worker-general`

## Configuration (names only)

- `HATCHET_WORKER_NAME` (defaults to `hatchet-worker-general`)
- `HATCHET_WORKFLOWS` (optional workflow filter)
- Redis connection vars: `REDIS_*`, `REDIS_ASSESSMENT_*`, `REDIS_CACHE_*`
