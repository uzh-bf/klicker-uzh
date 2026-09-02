# Background course deletion

## Goal

Turn the existing permanent course deletion into a Hatchet-backed operation:
accept a course deletion request quickly, remove the affected course and
activities from user-facing reads immediately, and perform the existing
irreversible cleanup in the background.

## Non-goals

- Do not add deletion progress, polling, task-center entries, success toasts,
  delayed failure notifications, or browser-persisted job state.
- Do not introduce permanent soft deletion or a new retention policy.
- Do not change which activities permanent course deletion deletes or retains.
- Do not make assessment courses deletable.
- Do not add repository-wide mutation guards, response-admission fencing,
  analytics behavior changes, or a cancellation UI.
- Do not copy PR #5618's Redis job/status machinery, deletion-status provider,
  analytics/response rewrites, or broad deployment changes.

## Product primitive boundary

| Primitive                       | Disposition | Contract delta                                                                                                                                                        | Consumers                                                   | Evidence                                                   |
| ------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Permanent course deletion       | Reuse       | Execute the existing destructive semantics in an idempotent Hatchet worker instead of the initiating GraphQL request.                                                 | GraphQL service, Hatchet general worker                     | `packages/graphql/src/services/courses.ts:deleteCourse`    |
| Course deletion request         | Create      | An accepted request immediately removes the course and activities destined for deletion from user-facing reads. It has no user-visible status or cancellation action. | Manage modal, course/activity/chatbot reads, Hatchet worker | `CONTEXT.md`; this plan                                    |
| Optional draft-activity cleanup | Reuse       | Preserve the generic checkbox and its current semantics: asynchronous activities already cascade in every status; opting in additionally deletes draft live quizzes.  | Manage confirmation modal, deletion service                 | `project/plans_wip/PLAN-delete-course-draft-activities.md` |

## Observable contract

- The existing confirmation modal and checkbox remain the only deletion UI.
- After confirmation is accepted, the course disappears from the lecturer's
  course list without waiting for permanent deletion.
- Subsequent server reads in manage, control, participant/PWA, join, and chat
  surfaces do not expose the pending course or activities destined for
  deletion. Reloading or opening a direct URL cannot bring them back.
- Retained live quizzes remain visible as unassigned activities while the
  course request is pending. Their real database association is left intact
  until permanent deletion.
- There is no progress, success, or delayed failure notification.
- A synchronous validation or persistence failure leaves the modal action
  unaccepted. In particular, a course with a `PUBLISHED` live quiz cannot enter
  the requested state and gets one localized error message.
- Ordinary technical failures keep the request hidden and recover server-side.
  Only a worker-time safety cancellation restores visibility.
- Lecturers cannot cancel an accepted request.

## Domain and deletion semantics

Use the glossary terms added to `CONTEXT.md`:

- **Course deletion request**: accepted, immediately hidden intent.
- **Permanent course deletion**: irreversible cleanup.

Preserve the existing permanent deletion behavior exactly:

| Activity                             | Existing and future outcome                              |
| ------------------------------------ | -------------------------------------------------------- |
| Practice quiz                        | Hard-deleted through the course cascade in every status. |
| Microlearning                        | Hard-deleted through the course cascade in every status. |
| Group activity                       | Hard-deleted through the course cascade in every status. |
| Draft live quiz, option selected     | Hard-deleted explicitly.                                 |
| Draft live quiz, option not selected | Retained and disconnected.                               |
| Non-draft live quiz                  | Retained and disconnected.                               |

Gamification, participation, result, leaderboard, scheduled-task, and derived
permission cleanup remain owned by the existing permanent deletion primitive.

## Data model and migration

Add only these fields to `Course` in
`packages/prisma/src/prisma/schema/course.prisma`:

```prisma
deletionRequestedAt             DateTime?
deletionRequestedById           String?   @db.Uuid
deleteDraftActivitiesOnDeletion Boolean   @default(false)
```

`deletionRequestedById` is an actor identifier, not a new relation. If that
user no longer exists, worker-time authorization fails and clears the matching
request.

### State invariants

- Available course: request timestamp and requester are `null`; the option is
  `false`.
- Requested course: timestamp and requester are both non-null; the option is
  the immutable choice from the first accepted request.
- The timestamp is also the request-version token. Hatchet events carry its ISO
  value alongside the course ID.
- Clearing a request atomically restores timestamp/requester to `null` and the
  option to `false`.
- The course row disappearing is the durable proof that permanent deletion
  completed. No completed job row is retained.

### Expand-only migration

Create one new migration that:

1. adds the nullable/defaulted course fields;
2. drops and recreates `UserActivities` with the same output columns;
3. changes only its row predicates and retained-live-quiz course projection.

Do not edit a historical migration. Keeping the view's column contract
unchanged makes the migration backward-compatible with the previous app while
the ArgoCD PreSync hook runs.

For `PracticeQuiz`, `MicroLearning`, and `GroupActivity` view arms, require:

```sql
WHERE c."deletionRequestedAt" IS NULL
```

For the `LiveQuiz` arm, retain every row except a selected draft:

```sql
WHERE
  c."deletionRequestedAt" IS NULL
  OR lq.status <> 'DRAFT'
  OR c."deleteDraftActivitiesOnDeletion" IS FALSE
```

For visible live quizzes linked to a pending course, project `courseId`,
`courseName`, `courseLanguage`, and `courseStartDate` through `CASE` expressions
that return `NULL`. The activity therefore appears unassigned without changing
its real relation. Clearing a safety-cancelled request automatically restores
the original projection.

Run the full schema ritual during implementation:

```bash
pnpm run prisma:migrate
pnpm run prisma:sync
pnpm --filter @klicker-uzh/prisma generate
```

The sync-generated `apps/analytics/prisma/schema/course.prisma` change is in
scope; analytics service behavior changes are not.

## Request acceptance state machine

Add a small `packages/graphql/src/services/courseDeletion.ts`; do not revive the
large service from PR #5618.

### GraphQL boundary

- Add `requestCourseDeletion(id, deleteDraftActivities)` under the existing
  `asUser` role gate and course `ADMIN` `withPermission` wrapper.
- Return a `CourseDeletionRequestPayload` containing only `courseId`.
- Add `COURSE_DELETION_ACTIVE_LIVE_QUIZ` for synchronous rejection and map it to
  one English/German message in the existing modal.
- Keep `deleteCourse` in the schema temporarily, mark it deprecated, and route
  it through the same request service. It returns the still-present course row
  so existing persisted clients keep their current response shape.
- Keep `MDeleteCourse.graphql` and
  `MDeleteCourseWithDraftActivities.graphql` byte-for-byte unchanged for old
  persisted hashes. Add `MRequestCourseDeletion.graphql` for the new frontend.

### Acceptance transaction

1. Under the existing request-time `ADMIN` check, load a non-assessment course
   and test for any linked non-deleted live quiz with
   `PublicationStatus.PUBLISHED`.
2. Reject assessment courses and courses with a published live quiz before
   writing request state.
3. Attempt a conditional update with `deletionRequestedAt: null` in the
   predicate. Set the timestamp, requester, and immutable option together.
4. If another request won the race, load and return that accepted request. Do
   not change its requester or widen its draft-activity option.
5. Commit the marker before handing work to Hatchet. This database commit is
   the user-visible acceptance point.
6. After commit, publish `process-course-deletion` with `{ courseId,
deletionRequestedAt }`. If publication fails or its acknowledgement is
   ambiguous, log it and still return the accepted payload; the sweep owns
   recovery.

A repeated request returns the same acceptance and attempts publication again.
The initiating frontend may optimistically remove the course, but the server
marker—not Apollo state—is the durable visibility source.

## Worker and recovery state machine

### `process-course-deletion`

Register the task in `packages/hatchet/src/index.ts` with the shipped
course-duplication limits:

- event: `process-course-deletion`;
- payload: `{ courseId: string; deletionRequestedAt: string }`;
- retries: `3`;
- backoff: factor `60`, maximum `120` seconds;
- execution timeout: `30m`;
- schedule timeout: `60m`;
- priority: `LOW`;
- one global `course-deletion` concurrency slot with group round-robin.

One handler attempt performs these steps:

1. Load the course using both ID and request timestamp.
2. If the course no longer exists, return success: permanent deletion already
   committed.
3. If the course exists but the timestamp no longer matches, return success:
   the event is stale or the request was cancelled/replaced.
4. Recheck that the recorded requester still has current course `ADMIN` access.
5. Recheck immediately before deletion that no linked live quiz is
   `PUBLISHED`.
6. If either safety check fails, conditionally clear all request fields using
   the same timestamp token, invalidate affected reads, log the cancellation,
   and return success. Do not notify the frontend.
7. Otherwise call the extracted permanent deletion primitive with the expected
   request timestamp and immutable option. Recheck the matching marker as close
   to the destructive transaction as possible.
8. Rethrow database, Hatchet, or other technical failures. The marker remains,
   so retries and the sweep preserve the accepted intent.

The design explicitly accepts the tiny race between the final `PUBLISHED`
check and deletion instead of introducing publication or response mutation
fences. This is the agreed scope boundary.

Refactor the current `courses.ts:deleteCourse` into an internal permanent
deletion primitive rather than reimplementing its transaction. Preserve its
draft-live-quiz handling, cascades, sequential permission recomputation,
scheduled-task cleanup, invalidations, and 60-second transaction limit. Make
"course already absent" an idempotent success for worker retries.

### `sweep-pending-course-deletions`

Register a server-side cron every five minutes with zero Hatchet-level retries.
Each run:

1. reads a bounded oldest-first batch of pending course markers;
2. republishes each current `{ courseId, deletionRequestedAt }` token;
3. logs individual publication failures and continues the batch;
4. emits a warning for requests older than 75 minutes so existing operational
   logging can alert on prolonged failures.

No Redis lock, heartbeat, browser polling, job status, or stale-failure state is
needed. Global task concurrency plus the timestamp token makes duplicate
deliveries safe; queued duplicates become fast no-ops after completion.

Add the process/sweep contracts to `HatchetHandlers` and
`PreparedHatchetTasks`, register both handlers in
`packages/graphql/src/index.ts`, and extend the GraphQL test task stubs. The
general worker and backend already consume `prepareHatchetTasks`; no worker-app,
Helm, response-worker, or deployment wiring change is expected.

## User-facing read boundary

Filter only normal user-facing reads. Do not add a generic mutation guard.

### Course collections, pickers, and details

Require `deletionRequestedAt: null` in these existing service roots:

- `packages/graphql/src/services/activities.ts:getUserActivitiesCourses`
- `packages/graphql/src/services/courses.ts:getUserCourses`
- `packages/graphql/src/services/courses.ts:getActiveUserCourses`
- `packages/graphql/src/services/courses.ts:getParticipantCourses`
- `packages/graphql/src/services/participants.ts:getParticipations`
- `packages/graphql/src/services/courses.ts:getControlCourses`
- `packages/graphql/src/services/courses.ts:getCourseData`
- `packages/graphql/src/services/courses.ts:getCourseOverviewData`
- `packages/graphql/src/services/courses.ts:getControlCourse`
- `packages/graphql/src/services/courses.ts:getCourseActivities`
- `packages/graphql/src/services/courses.ts:getCoursePracticeQuiz`
- `packages/graphql/src/services/courses.ts:getStudentCourseLeaderboard`
- `packages/graphql/src/services/groups.ts:getCourseGroupActivities`
- `packages/graphql/src/services/practiceQuizzes.ts:getCoursePublishedPracticeQuizzes`
- `packages/graphql/src/services/microLearning.ts:getCoursePublishedMicroLearnings`
- `packages/graphql/src/services/liveQuizzes.ts:getCourseRunningLiveQuizzes`

Also gate course discovery and joining in:

- `packages/graphql/src/services/courses.ts:basicCourseInformation`
- `packages/graphql/src/services/courses.ts:checkValidCoursePin`
- `packages/graphql/src/services/courses.ts:joinCourseWithPin`

### Direct activity details

Require a non-pending parent course in these direct reads for activities that
will be cascade-deleted:

- `packages/graphql/src/services/practiceQuizzes.ts:getPracticeQuizData`
- `packages/graphql/src/services/practiceQuizzes.ts:getSinglePracticeQuiz`
- `packages/graphql/src/services/microLearning.ts:getMicroLearningData`
- `packages/graphql/src/services/groups.ts:getGroupActivity`
- `packages/graphql/src/services/groups.ts:getGroupActivityDetails`

For live quizzes, exclude only a draft linked to a pending course whose stored
option is true. When a retained live quiz includes its pending parent course,
map the exposed nullable `course` field to `null` without changing the database
relation. Apply this rule to the lecturer, control, participant, and running
entry points:

- `packages/graphql/src/services/liveQuizzes.ts:getLiveQuizData`
- `packages/graphql/src/services/liveQuizzes.ts:getLecturerViewLiveQuiz`
- `packages/graphql/src/services/liveQuizzes.ts:getControlLiveQuiz`
- `packages/graphql/src/services/liveQuizzes.ts:getRunningLiveQuiz`
- `packages/graphql/src/services/liveQuizzes.ts:getUserRunningLiveQuizzes`

The `UserActivities` view owns overview filtering and count consistency; do not
add a service-side pending-course prequery.

### Course chatbots

Exclude a pending parent course from:

- `packages/graphql/src/services/chatbots.ts:getParticipantCourseChatbots`;
- `apps/chat/src/services/chatbots.ts:getChatbotById`;
- `apps/chat/src/lib/server/apiGuards.ts:getChatbotOr404`;
- `apps/chat/src/lib/server/apiGuards.ts:withChatbotAuth`.

Do not change chatbot retention, response workers, OLAT, export, or analytics
logic in this feature.

## Frontend behavior

Update only
`apps/frontend-manage/src/components/courses/modals/CourseDeletionModal.tsx`:

- use `MRequestCourseDeletion`;
- keep the existing optimistic removal from `GetUserCourses` using the returned
  course ID;
- close/reset the modal after request persistence succeeds;
- map `COURSE_DELETION_ACTIVE_LIVE_QUIZ` to one localized error;
- retain the current loading state only for the short request operation.

Do not add a provider, `_app.tsx` integration, local storage, polling, status
query, task center, progress copy, success toast, delayed failure toast, action
suppression, or activity-page cache coordinator. The activity overview already
uses a network-only query and the database view governs subsequent reads.

## Failure and race matrix

| Scenario                                                      | Required result                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Validation or marker transaction fails                        | Mutation errors; Apollo optimistic removal rolls back.                                                                                     |
| Hatchet publish fails or acknowledgement is lost              | Request remains accepted and hidden; sweep republishes.                                                                                    |
| Concurrent requests use different options                     | First committed request wins; later calls cannot widen it.                                                                                 |
| Same event is delivered more than once                        | One deletion runs; later attempts see a missing/stale request and succeed.                                                                 |
| Old event arrives after safety cancellation and a new request | Timestamp mismatch makes the old event a no-op.                                                                                            |
| Requester loses `ADMIN` or disappears                         | Matching request is cleared and visibility returns.                                                                                        |
| Live quiz becomes `PUBLISHED` while queued                    | Matching request is cleared and visibility returns.                                                                                        |
| Technical worker failure exhausts ordinary retries            | Request remains hidden; five-minute sweep creates another attempt.                                                                         |
| Permanent deletion committed before a retry                   | Missing course is successful completion.                                                                                                   |
| Scheduled-task cancellation fails after commit                | Preserve existing best-effort logging; do not restore deleted data.                                                                        |
| App is rolled back while requests remain                      | Old code can expose marked courses and cannot process them; drain pending requests or keep the new worker/backend running before rollback. |

## Expected file footprint

### Data and generated schema

- `packages/prisma/src/prisma/schema/course.prisma`
- one new migration under
  `packages/prisma/src/prisma/schema/migrations/`
- sync-generated `apps/analytics/prisma/schema/course.prisma`

### GraphQL and Hatchet

- new `packages/graphql/src/services/courseDeletion.ts`
- targeted edits in existing course/activity/participant/chatbot services named
  above
- `packages/graphql/src/schema/course.ts`
- `packages/graphql/src/schema/mutation.ts`
- new `packages/graphql/src/graphql/ops/MRequestCourseDeletion.graphql`
- `packages/graphql/src/public/schema.graphql`
- `packages/graphql/src/index.ts`
- `packages/graphql/test/helpers.ts`
- `packages/types/src/hatchet.ts`
- `packages/hatchet/src/index.ts`

### Frontend, tests, and documentation

- `apps/frontend-manage/src/components/courses/modals/CourseDeletionModal.tsx`
- `apps/chat/src/services/chatbots.ts`
- `apps/chat/src/lib/server/apiGuards.ts`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- focused GraphQL tests, plus the existing course Playwright flow
- `CONTEXT.md`
- `docs/domain-model.md`
- `docs/async-and-workers.md`
- this plan

Explicitly out of scope: response APIs/workers, analytics Python services,
OLAT, export, deployment charts, Redis job state, frontend global providers,
and repository-wide permission/mutation guards.

## Implementation slices

This is substantial cross-layer work with independently reviewable runtime
boundaries. Before implementation, use the repository's native stacked-change
workflow and obtain approval for this three-layer topology:

1. **Expand-only persistence foundation**
   - Add course request fields and the new `UserActivities` migration.
   - Sync the analytics Prisma schema.
   - Add focused database/view evidence; no request can be created yet.
2. **Backend request and worker pipeline**
   - Add request state machine, compatibility adapter, permanent-delete
     extraction, Hatchet process/sweep, read gates, chat gate, GraphQL tests,
     operation, codegen, and SDL.
   - This layer is deployable with old frontends because `deleteCourse` remains.
3. **Explicit frontend contract and final evidence**
   - Switch the modal to `requestCourseDeletion`, add the active-live-quiz
     error copy, extend Playwright/browser evidence, and update durable docs.

If a single PR is explicitly preferred, retain the same slice order in commits
and review each boundary separately.

## Test matrix

### Focused service and worker tests

- Acceptance writes all request fields atomically and rejects assessment or
  `PUBLISHED`-live-quiz courses.
- Simultaneous requests prove first-request-wins and immutable option behavior.
- A failed/ambiguous event push still returns the accepted payload.
- The sweep republishes the current timestamp token and continues after one
  publication failure.
- Stale tokens and already-absent courses are idempotent successes.
- Revoked/missing requester and newly published live quiz clear only the
  matching request and restore read visibility.
- Technical deletion failure leaves the marker and is rethrown for Hatchet.
- Retry after permanent commit does not repeat deletion or permission cleanup.
- Existing default/opt-in deletion tests continue proving live-quiz retention,
  draft deletion, cascades, permission recomputation, scheduled-task cleanup,
  and invalidation.

### Read-boundary tests

- `UserActivities` excludes all cascade activities for a pending course.
- It excludes only selected draft live quizzes and projects retained live
  quizzes as unassigned.
- Clearing a request restores the original rows and course projection.
- Course lists, participant participations, direct details, join/pin, control,
  and chatbot reads reject pending courses.
- Analytics/internal direct Prisma reads remain unchanged until permanent
  deletion.

### Frontend and browser evidence

- Existing confirmation rows and draft checkbox are visually unchanged in
  English and German.
- Confirming removes the course immediately and remains absent after reload.
- Selected draft activities are absent on the next network-only activity read;
  retained live quizzes appear unassigned.
- A published live quiz keeps the course visible and shows the localized
  synchronous rejection.
- No progress/status UI, success toast, or task-center entry appears.

Reuse existing fixtures; no new seed path is expected.

## Verification commands

During implementation, in the authorized project environment:

```bash
pnpm run prisma:migrate
pnpm run prisma:sync
pnpm --filter @klicker-uzh/prisma generate
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql test
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/hatchet check
pnpm run check:all
pnpm run build
```

Also:

- apply the migration to a disposable database and prove the recreated view's
  pending/restored matrix;
- run the focused Hatchet path with the general worker and inspect the producer
  and worker logs for the same course ID/request token;
- run the targeted course Playwright scenario;
- use `agent-browser` for mandatory before/after screenshots at relevant
  viewports and in both locales;
- run `git diff --check` and inspect every changed/generated file before handoff.

Do not start Devrouter/DevPod or reset a database without explicit authorization
for the implementation task.

## Rollout and rollback

- Migration is expand-only and safe while the previous app serves.
- Deploy the backend/general worker before the frontend operation switch; the
  deprecated adapter protects old frontend clients on the new backend.
- No feature flag is required. A request accepted before Hatchet is reachable
  remains hidden and is picked up by the sweep after worker recovery.
- Before rolling the backend/worker back to a version that does not understand
  deletion requests, query the count of pending markers and let them drain or
  keep the new worker running. Old code ignores the course marker and can expose
  pending courses; rollback is therefore an operational drain boundary, not an
  automatic cancellation.
- A rollback never removes the nullable fields or rewinds the view migration;
  schema recovery is forward-only.

## Documentation

The implementation change set updates:

- `CONTEXT.md` for the two domain terms (already captured by this design);
- `docs/domain-model.md` for requested versus permanent deletion and preserved
  activity outcomes;
- `docs/async-and-workers.md` for the process/sweep tasks, recovery, and rollback
  boundary.

No ADR is warranted: the design is a feature-local, reversible extension of the
existing Hatchet pattern rather than a new hard-to-reverse platform decision.

## Progress

- 2026-09-02: Created `feat/background-course-deletion-v2` from refreshed
  `origin/v3` in a clean repository-local worktree.
- 2026-09-02: Audited current deletion, shipped Hatchet duplication, and PR
  #5618. Retained worker/idempotency lessons and rejected status UI, broad soft
  deletion, response fencing, and analytics/deployment expansion.
- 2026-09-02: Completed five grilling rounds covering visibility, preserved
  activity semantics, active-live-quiz safety, failure recovery, permission
  changes, cancellation, durable state, GraphQL compatibility, duplicate
  requests, concurrency, event delivery, read boundaries, worker mechanics,
  rollout, and synchronous error handling.
- 2026-09-02: The design frontier is empty and the implementation slices and
  verification matrix are ready for engineering handoff.
