# Close timed live-quiz blocks through Hatchet

## Approval card

- **Goal:** a timed live-quiz block closes on time even when the GraphQL Pod
  that activated it ends first (rollout, spot eviction, scale-down or crash).
  Today the close lives only in that Pod's memory, so the block stays open
  until the lecturer closes it by hand.
- **Approach:** replace the in-process `node-schedule` timer with a Hatchet
  task scheduled at activation, run by the general worker, which already
  holds every dependency the close needs. The close stays idempotent, and a
  guard skips a stale schedule.
- **Approval mode:** executable batch.
- **Authority requested:** implementation on `fix/live-quiz-durable-block-close`
  from `v3`, local commits, pushes to that branch, a draft PR into `v3`, CI,
  `/final-review`, and the reviews below. Merging, the `v3` → `v3-ai` sync,
  releases and deployment stay withheld.
- **Terminal:** draft PR with green exact-head CI, the integrated review
  dispositioned, and a staging-free verification record (see Verification).
- **Pause:** a new dependency, a schema migration, or any change to the
  public GraphQL contract returns to the user.

## Current behaviour

- `activateLiveQuizBlock` (`packages/graphql/src/services/liveQuizzes.ts`)
  sets `expiresAt` for a block with a time limit, then calls
  `schedule.scheduleJob(expiresAt + 10 s)` and keeps the job in a module-level
  map. The job calls `deactivateLiveQuizBlock(…, isScheduled = true)`.
- A manual close calls `deactivateLiveQuizBlock` without `isScheduled` and
  cancels the job from the map of the Pod that serves the request. A manual
  close on another Pod leaves the original job in place; it then runs and
  does nothing (below).
- `deactivateLiveQuizBlock` → `updateLiveQuizBlockResultsFromCache`
  (`packages/util/src/blocks.ts`) returns early when the block is not the
  quiz's active block, so a late close is already a no-op.
- The Hatchet worker context (`packages/hatchet/src/index.ts`) has Prisma, both
  Redis connections, a Redis-backed pubsub and `tasks`, which is everything
  `deactivateLiveQuizBlock` uses. Its `emitter` is worker-local; the GraphQL
  server's `invalidate` listener feeds a response cache that is disabled
  (`apps/backend-docker/src/app.ts`), so nothing is lost there.
- The general worker loads every task unless `HATCHET_WORKFLOWS` is set, and
  no environment sets it, so a new task needs no deploy change.

## Change

1. **Task:** add `closeExpiredLiveQuizBlock` (`close-expired-live-quiz-block`,
   `retries: 3`) to `prepareHatchetTasks` with input
   `{ liveQuizId, blockId, expiresAt }` (ISO string). Add it to
   `PreparedHatchetTasks` and the handler to `HatchetHandlers` in
   `packages/types/src/hatchet.ts`, and export the handler through `handlers`
   in `packages/graphql/src/index.ts`.
2. **Handler:** add `handleCloseExpiredLiveQuizBlock` next to the existing
   live-quiz handlers and export it through `handlers`. It loads the quiz and
   block and closes only when the quiz's `activeBlockId` is `blockId`, the
   block is `ACTIVE`, and the block's `expiresAt` equals the scheduled one.
   It compares `expiresAt` by `getTime()` (the column is `TIMESTAMP(3)`).
   Otherwise it logs and returns `false` without a Teams notification. It
   then calls `deactivateLiveQuizBlock({ quizId, blockId }, ctx, true)`.
   `deactivateLiveQuizBlock` takes a narrowed context (a `Pick` of
   `prisma`, both Redis clients, `pubSub`, `emitter` and `tasks`, the only
   fields it reads) so the worker context typechecks without a cast.
   Outcomes: the task wrapper retries only on a throw. A stale guard and a
   missing Redis cache return `false` and complete, since a retry cannot
   help. A throw after the guard retries, and the retry stops at the guard
   once the block is closed.
3. **Schedule:** in `activateLiveQuizBlock`, replace `schedule.scheduleJob` with
   `ctx.tasks.closeExpiredLiveQuizBlock.schedule(expiresAt + 10 s, …)`, using
   the `expiresAt` read back from the database. Schedule after the
   subscription publish and the cache setup, because `.schedule()` is an HTTP
   call to the Hatchet API and the countdown is already running. If
   scheduling throws, log it, send the existing Teams notification, and fall
   back to the in-process timer, so the worst case equals today's
   behaviour.
4. **Keep** `node-schedule` only for that fallback, with its job map and
   cancel branch. No stored schedule ID and no schema change: an early
   manual close leaves the scheduled run, which the guard turns into a no-op.
5. **Docs:** add `close-expired-live-quiz-block` to the task catalog in
   `docs/async-and-workers.md`. Note there that timed blocks rely on the
   general worker, and that a rollback leaves blocks activated on new code
   without the durable close.

## Rollout

- Backend and worker deploy in one Argo sync. Whether Hatchet accepts a
  schedule for a task no worker has registered yet is unverified. Verify it
  locally against the pinned Hatchet version, starting the backend before
  the worker. If it is rejected, the in-process fallback covers blocks
  activated in that window.
- Blocks activated by old Pods keep their in-memory timer until that Pod
  ends, as today. No migration of in-flight timers.

## Test portfolio

| Risk | Obligation | Seam | Existing protection |
| --- | --- | --- | --- |
| The worker closes a block it must not close: another block active, the block already EXECUTED, a reset that cleared `expiresAt`, or a changed `expiresAt` | add new | handler unit test with a mocked Prisma and a mocked `updateLiveQuizBlockResultsFromCache` from `@klicker-uzh/util` (same module, so `deactivateLiveQuizBlock` itself cannot be mocked), asserting whether the close ran | none |
| Activation stops scheduling the close, or loses the fallback | add new | activation unit test asserting the schedule call and its time, and the fallback when scheduling throws | none |
| The close itself (results, leaderboard, pubsub) | none | unchanged `deactivateLiveQuizBlock` path | none; no Playwright spec covers a timed auto-close |

## Verification

- `pnpm --filter @klicker-uzh/graphql check` and `test` and the hatchet
  package check, run in the devcontainer (the graphql suite needs Hatchet).
- A local devcontainer run with the worker: activate a 20-second block,
  restart the GraphQL process, and record how long after `expiresAt + 10 s`
  the block closes. Also start the backend before the worker once, to settle
  the rollout question above. Skip only if
  the local stack cannot run the worker; record that as a gap.
- Playwright live-quiz specs in CI.

## Slices

1. **S1 — durable close:** task, handler with guard, schedule call, removal of
   the in-process timer, the two unit tests. One commit.
2. **S2 — delivery:** the local restart check, draft PR, CI, integrated
   independent review, `/final-review`.

## Progress

- 2026-11-10 Plan drafted from the W12 expansion item X2 at the user's
  request. Independent critique: revise. Applied: narrowed context type,
  explicit retry outcomes, scheduling after the publish with an in-process
  fallback, unverified Hatchet registration order, test seams and stale
  cases, no Playwright coverage claim, typed task and handler maps, task
  catalog docs.
