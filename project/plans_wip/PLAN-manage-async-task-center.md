# Manage asynchronous task center

## Goal

Add a persistent task center to the top-right Manage KlickerUZH navigation so
lecturers can follow asynchronous work across navigation, reloads, browser
tabs, and devices. Ship the first end-to-end producer by migrating course
duplication status into the generic task contract.

## Non-goals

- Do not implement knowledge-graph construction or question generation.
- Do not expose Hatchet workflow or Redis coordination details to clients.
- Do not add generic marketing, announcement, participant, or push
  notifications.
- Do not add cancellation or retry actions before a producer defines safe,
  idempotent semantics for them.
- Do not change course-duplication concurrency, locking, leases, heartbeats,
  retry timing, stale reconciliation, or transactional copy behavior.
- Do not change points, XP, leaderboards, or other gamification behavior.

## Product primitive boundary

| Primitive | Disposition | Contract delta | Consumers | Evidence |
| --- | --- | --- | --- | --- |
| `AsyncTask` | Add | User-owned record with a typed kind, lifecycle status, subject/result references, stable failure code, read state, and timestamps. Postgres owns product state; workers own computation. | Manage task center, async producers | New Prisma model and GraphQL type |
| Course duplication job | Extend | Keep Redis coordination and the copied course as outcome proof; mirror lifecycle changes into the matching `AsyncTask` using the existing job id. | Course duplication worker, Manage course flow | `packages/graphql/src/services/courseDuplication.ts` |
| Manage notification menu | Add | Bell menu shows active tasks plus recent terminal tasks. Badge counts active tasks and unread terminal outcomes. | Lecturer navigation | `apps/frontend-manage/src/components/common/Header.tsx` |

## Design

- **Domain vocabulary:** `AsyncTask` is a background product operation owned by
  a lecturer `User`. It is not a `Participant` notification. Initial kinds are
  `COURSE_DUPLICATION`, `KNOWLEDGE_GRAPH_GENERATION`, and
  `QUESTION_GENERATION`; only course duplication has a producer in this slice.
  Lifecycle statuses are `QUEUED`, `RUNNING`, `SUCCEEDED`, and `FAILED`.
- **Persistence:** Postgres is the cross-device source of truth. Store no
  prompts, uploaded material, worker payloads, email addresses, or Hatchet
  identifiers. Preserve a bounded subject/result reference and user-authored
  name snapshots needed to render a useful row after a target is renamed or
  removed. Retain terminal records for 30 days through query filtering; a
  cleanup job is deferred until operational volume warrants one.
- **Layer footprint:** add a Prisma model and migration; GraphQL object, query,
  acknowledgement mutation, service, operations, and tests; course-duplication
  service updates; Manage provider/header component; bilingual i18n; generated
  public SDL; and the async-worker wiki contract. Analytics receives the synced
  Prisma model automatically and does not consume it in Python code.
- **Auth:** `asyncTasks` and `acknowledgeAsyncTasks` use `asUser` and scope every
  database query/update to `ctx.user.sub`. Reading a task never grants access to
  its subject or result. Existing `ADMIN` permission on course duplication and
  destination-page authorization remain authoritative.
- **Gamification:** none.
- **Async behavior:** task creation occurs before Hatchet publication with the
  existing idempotent duplication job id. The worker changes `QUEUED` to
  `RUNNING`, then `SUCCEEDED` or `FAILED`; the stale sweeper mirrors its
  reconciled terminal result. Redis remains responsible for source locks,
  leases, heartbeat, and short-lived retry payloads. Product-task update errors
  must not corrupt an already committed course copy; they are logged and can be
  reconciled from existing course-duplication status handling.
- **UI:** insert the task center between the running-live-quiz and user menus.
  Query on app load, refetch every five seconds while active tasks exist or a
  locally started task awaits its terminal result, and refetch on menu
  open/window focus. Group active and recent tasks, show
  text and icons for every state, avoid fabricated percentages, retain terminal
  rows until acknowledged, and keep existing completion/error toasts. Add
  stable `data-cy` hooks and keyboard-accessible popover behavior. Cap the
  popover width to the available viewport; the existing Manage navigation's
  phone-width responsiveness remains outside this feature. Scope locally
  tracked completion-toast ids by lecturer, validate and cap them before
  querying, and prune ids that a successful owner-scoped response does not
  return.
- **Failure semantics:** expose stable `errorCode` values and localize them in
  the frontend. Unknown failures render a generic message. Terminal state is
  monotonic. A task-record write failure never authorizes a second duplication
  and never changes the existing copy transaction outcome.
- **Test level:** add GraphQL service tests for owner scoping, ordering,
  acknowledgement, and lifecycle mirroring. Run GraphQL codegen/check/tests,
  Prisma sync/check, Manage check, `check:all`, and build. Browser evidence must
  cover empty, queued/running, succeeded unread/read, failure, menu keyboard
  behavior, desktop/mobile widths, and English/German copy. A focused
  course-duplication e2e is warranted if the local host runtime is explicitly
  authorized; CI remains the full e2e gate.
- **Seeds/fixtures:** no persistent seed changes. GraphQL tests create isolated
  task rows. Browser state can be verified through a synthetic local test seam
  or a real duplicated seeded course without adding production fixtures.

## Slices

1. Add `AsyncTask` schema/migration, service, GraphQL type/query/mutation,
   operations, and focused tests.
2. Mirror course-duplication start/running/terminal transitions into the task
   record while retaining all Redis and Hatchet behavior.
3. Replace the course-specific floating status UI with the global task-center
   provider and header popover; add bilingual copy and actions.
4. Regenerate Prisma/GraphQL outputs, sync Analytics, verify static and runtime
   behavior, update async-worker documentation, and run independent review.

## Progress

- 2026-08-28: Approved visual and product direction. Traced the current Manage
  header, app-level course-duplication provider, Redis job lifecycle, Hatchet
  worker, auth conventions, and Catalyst public/private boundary. Settled on a
  durable `AsyncTask` entity with course duplication as the first producer.
- 2026-08-28: Implemented the Prisma model, owner-scoped GraphQL contract,
  monotonic course-duplication adapter and reconciliation paths, header task
  center, bilingual copy, service tests, and migrated Playwright coverage.
  Prisma, GraphQL, Manage, and Playwright typechecks pass; targeted Biome and
  Prettier checks pass.
- 2026-08-28: Independent review tightened missing-Redis reconciliation,
  task-before-republish ordering, start/refetch failure semantics, unread-result
  pagination, immutable completion timestamps, and result-action accessibility.
- 2026-08-28: Generated and applied migration
  `20260828152851_add_async_tasks` against an isolated PostgreSQL 17 database.
  The focused database-backed GraphQL suite passed 7/7 tests, including owner
  scoping, bounded ordering, acknowledgement, missing-Redis reconciliation,
  and lifecycle mirroring.
- 2026-08-28: Verified the real Manage UI with a local GraphQL fixture at
  1440×1000 and 1024×768. Confirmed all three task kinds, active/recent groups,
  success and failure states, result action, the attention badge, mark-as-read
  transition from 3 to 1, and the zero-task state. Accessibility snapshots
  exposed the expected trigger labels and section names. A 390px probe also
  confirmed the pre-existing Manage header itself overflows at phone width;
  this slice does not change that navigation baseline.
- 2026-08-28: Final verification passed GraphQL, Manage, and Playwright
  typechecks; Prisma/Analytics synchronization; added-file Biome; Prettier;
  repository lint; diff checks; GraphQL build; and Manage production build.
  The runtime console still reports the pre-existing disabled-Analytics tooltip
  nesting a button and the production builds retain existing warning output;
  neither originates in the task center.
- 2026-08-29: A second independent standards/spec review added an exact
  owner-scoped attention aggregate beyond the bounded row list, reload-safe
  local completion toasts with explicitly tracked rows, stale-task
  reconciliation outside both display windows, resilient refetch/polling and
  acknowledgement handling, shared error-code/route helpers, and focused
  regressions for the corrected behavior.
