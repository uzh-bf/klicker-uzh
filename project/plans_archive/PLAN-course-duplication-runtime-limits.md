# Course duplication worker runtime limits

## Goal

Give the Hatchet general-worker deployments enough memory for large course
copies and ensure that only one course duplication job executes at a time.

## Non-goals

- Do not change course-copy semantics, retries, execution timeouts, permissions,
  or job status handling.
- Do not throttle unrelated Hatchet tasks or change response-processor workers.
- Do not change the GraphQL API, Prisma schema, frontend, i18n, or fixtures.

## Design

- **Domain vocabulary:** the affected unit is the asynchronous **course
  duplication job**, implemented by `process-course-duplication`.
- **Layer footprint:** update the task declaration in `packages/hatchet`, the
  staging and production Helm values for the Hatchet general worker, and the
  existing `docs/async-and-workers.md` runtime contract.
- **Auth and gamification:** unaffected; the existing GraphQL authorization and
  transactional copy behavior remain unchanged.
- **Async behavior:** add task-local Hatchet concurrency with one constant
  bucket and `maxRuns: 1`. This serializes course duplication globally while
  leaving every other workflow at its existing concurrency. Give queued runs a
  60-minute schedule timeout, below the existing 75-minute stale-job threshold.
- **Deployment behavior:** set the general worker memory limit to `2Gi` in both
  staging and production. Requests and replica counts remain unchanged.
- **UI, seeds, and fixtures:** unaffected.
- **Verification:** run the Hatchet package check/build, format checks for the
  changed files, and render both environment Helm charts to confirm only the
  general worker receives the `2Gi` limit. A live two-job scheduler test requires
  starting this checkout's opt-in Devrouter/Hatchet environment and remains an
  explicit gap because that environment start was not authorized for this task.

## Slices

1. Add course-duplication-only concurrency to the Hatchet task.
2. Raise staging and production general-worker memory limits.
3. Update the worker documentation and run focused verification.

## Progress

- 2026-08-26: Mapped the async workflow and confirmed Hatchet SDK 1.9.4 supports
  task-level concurrency. Selected a constant group-round-robin bucket so queued
  duplication jobs run one at a time without cancelling or throttling other
  tasks.
- 2026-08-26: Implemented task-local serialization and raised the staging and
  production Hatchet general-worker memory limits to `2Gi`.
- 2026-08-26: Independent review found that Hatchet's default five-minute queue
  timeout and the stale-job sweep were incompatible with global serialization.
  Added a bounded 60-minute queue timeout and corrected the stale-threshold
  rationale; running attempts still refresh their status and heartbeat.
- 2026-08-26: Hatchet typecheck and production build passed. Biome and Prettier
  checks passed with one pre-existing `PubSub<any>` warning. Both staging and
  production Helm charts linted and rendered the general worker at `2Gi` while
  preserving the response-processor limits. Repository documentation checks
  passed; the wiki skill's external validator script was not installed.
- 2026-08-26: Focused re-review confirmed the queue and stale-job correctness
  findings are resolved. Live scheduler behavior remains unverified for the
  opt-in environment reason recorded above.
