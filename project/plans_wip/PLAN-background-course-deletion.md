# Background course deletion

## Goal

Soft-delete courses through Hatchet so large courses leave the active product
surfaces promptly without destroying their course data. Keep the existing
option to additionally delete linked draft activities, close the confirmation
modal as soon as Hatchet accepts the job, and keep deletion status tracking
invisible to the user.

## Non-goals

- Do not make assessment courses deletable.
- Do not add a restore UI or public restore API in this slice; the retained data
  is the recovery boundary.
- Do not delete participations, groups, results, leaderboards, or non-draft
  activities when a course is soft-deleted.
- Do not change the optional draft-activity cleanup default (off).
- Keep the deprecated `deleteCourse` field for rolling clients, but route it to
  the same Hatchet workflow rather than retaining a synchronous deletion escape
  hatch. A database trigger rejects hard deletion of active rows.
- Do not refactor course duplication into a generic background-job framework.
- Do not add user-visible progress, completion, or failure notifications.

## Approach

Retain the deletion-specific Redis/Hatchet lifecycle and concurrency fence, but
change its durable success marker from an absent course row to
`Course.isDeleted = true`. Hatchet acknowledgement writes a durable pending
marker to `Course`, which is the shared visibility and write-protection
boundary. Frontend status polling refreshes terminal state and provides an
immediate initiating-tab fallback; it renders no deletion-job dropdown or
terminal toast.

## Design

- **Domain vocabulary:** active `Course` rows have `isDeleted = false`; a
  deleted course is retained with `isDeleted = true` and excluded from normal
  lecturer, controller, and participant course surfaces. Course-owned data is
  retained. When `deleteDraftActivities` is selected, linked activities in
  `PublicationStatus.DRAFT` are permanently deleted using the repository's
  existing draft-activity semantics; scheduled, published, ended, graded, and
  template activities are retained.
- **Product primitives:** `Course` lifecycle is **extended** with a durable
  deleted state; draft-activity cleanup **composes** the existing hard-deletion
  rule for drafts; the background deletion job is **reused** as orchestration
  and concurrency state; the visible deletion notification/status surface is
  **retired** while invisible polling remains an implementation detail.
- **Layer footprint:** add the deleted marker plus durable pending job fields
  through an expand-only Prisma migration and Analytics schema sync. Update
  GraphQL course filtering,
  deletion logic, worker reconciliation, summary data, generated operations,
  and focused tests. Simplify the Manage confirmation modal and status provider,
  update paired i18n and Playwright coverage, and revise the domain/worker docs.
- **Auth:** starting deletion keeps `asUser` plus course-level
  `PermissionLevel.ADMIN`. The worker reconstructs the initiating user context
  and rechecks `ADMIN` immediately before deletion. Status reads are bounded to
  50 unique ids and only return jobs owned by the caller.
- **Job contract:** Redis stores `PENDING | RUNNING | COMPLETED | FAILED`, job
  id, course id/name, timestamps, initiating user context, and the draft cleanup
  option. The accepted job id and cleanup choice are mirrored durably on the
  course. Terminal records strip execution context and options while retaining
  the owner id for status authorization. A per-course lock prevents concurrent
  starts; a per-job renewable processing lease and heartbeat make Hatchet
  retries and stale normalization safe. A transaction-level PostgreSQL advisory
  lock fences destructive work across background retries.
- **Idempotency and failure:** event publication retries with the same job id.
  Ambiguous acknowledgements retain the pending job and lock; atomic sweep
  transitions retry publication every five minutes while no worker lease or
  heartbeat exists. They are returned as unacknowledged so the modal does not
  close before Hatchet confirms queuing. The worker treats
  `Course.isDeleted = true` as completed,
  rechecks access for an active course, and invokes the soft-deletion service.
  Stale normalization reconciles against that durable flag rather than row
  absence.
- **Reliability:** keep the 30-minute Hatchet attempt timeout, 60-minute queue
  timeout, low-priority serialized execution, renewable leases, and the
  transaction-level advisory lock. Snapshot optional draft ids when the job is
  accepted. Drain response-processing leases and install Redis deletion fences
  before committing the soft deletion and optional draft cleanup.
- **Gamification:** no rule changes and no gamification data deletion.
- **UI:** the confirmation modal explains retention and offers one optional
  draft-activity checkbox. It submits `startCourseDeletion` and closes after
  queue acknowledgement. The job id, course id, and draft-cleanup choice remain
  in `localStorage`; invisible polling keeps the affected course absent across
  tabs/reloads and refetches `GetUserCourses` at terminal status. When draft
  cleanup is selected, linked draft activities are absent from the activity
  overview while the job is active. There is no app-wide deletion dropdown and
  no start, completion, or failure toast.
- **Concurrent-write guard:** mutation permission checks resolve their target
  course and acquire renewable request-scoped Redis mutation leases. Deletion
  lock acquisition atomically rejects active mutation leases, while mutation
  admission atomically rejects an active deletion lock, closing the
  check-then-act race in both directions. `startCourseDeletion` remains exempt
  so its existing idempotent retry behavior is preserved. Direct
  activity-creation and legacy duplication paths perform the same course check
  explicitly, as do direct activity-review, object-removal, activity-log, and
  sharing-request approval mutations.
- **Cross-tab tracking:** each deletion job uses an independent local-storage
  key so acknowledgements from simultaneous tabs cannot overwrite one another.
  Legacy array storage is migrated on read, and stale in-flight status responses
  cannot resurrect a job that another tab already removed.
- **Test level:** update direct service tests for the retained course data and
  optional all-type draft cleanup. Update job tests for `isDeleted`-based
  completion/reconciliation and Playwright for the simplified modal, invisible
  status tracking, hidden pending targets, and eventual course removal. Run
  migration/schema sync, codegen, focused GraphQL tests, `check:all`, build, and
  browser verification in an explicitly authorized isolated environment.
- **Seeds/fixtures:** reuse existing course-deletion fixtures.

## Slices

1. Add the course deleted state, migration, Analytics sync, and active-course
   filters.
2. Convert the deletion service and worker reconciliation to soft deletion with
   optional all-type draft cleanup.
3. Simplify the modal and make status tracking invisible while hiding pending
   targets and preserving the backend mutation fence and refetch.
4. Update generated GraphQL artifacts, focused tests, Playwright, and durable
   documentation.
5. Run full verification and an independent integrated review before updating
   the existing draft PR.

## Acceptance criteria

- A confirmed deletion returns a job promptly and closes the modal after queue
  acknowledgement.
- The worker sets `Course.isDeleted = true`; participations, groups, results,
  leaderboards, and non-draft activities remain stored.
- With the option off, draft activities remain stored. With it on, linked draft
  activities of all four types are permanently deleted.
- Deleted courses are absent from normal lecturer, controller, and participant
  course surfaces.
- Active deletion survives navigation/reload and keeps the course absent,
  without a badge, notice, deletion dropdown, or lifecycle toast. When draft
  cleanup is selected, linked drafts are absent too.
- A failed job makes the active course and retained drafts available again;
  successful terminal polling keeps the soft-deleted course absent.
- Repeated starts and Hatchet retries cannot execute concurrent deletions or
  produce contradictory terminal states.
- Once deletion is accepted, lecturers cannot reopen the course from the list
  or perform course/activity mutations against it; stale clients and other
  managers are rejected by the backend as well as the initiating UI.
- Assessment and permission boundaries remain unchanged.
- Large valid deletions are not constrained by a GraphQL request timeout.

## Progress

- 2026-08-27: Traced the synchronous deletion path, modal lifecycle, GraphQL
  authorization, direct tests, and the production course-duplication job
  pattern. Selected a deletion-specific background lifecycle to minimize risk.
- 2026-08-27: Implemented the Redis/Hatchet deletion lifecycle, additive
  GraphQL contract, ten-minute deletion transaction budget, persisted manage
  status provider, prompt modal close, bilingual feedback, and durable docs.
- 2026-08-27: Codegen, seventeen focused deletion tests, GraphQL/types/Hatchet/
  frontend/Playwright typechecks, repository formatting, lint, and the changed
  package builds pass. The monorepo build completed the changed slices before
  unrelated auth/chat builds stopped producing output and was interrupted.
- 2026-08-27: No routed environment exists for this branch. Browser and runtime
  Playwright verification remain a draft-PR gap because starting Devrouter was
  not authorized; unrelated running environments were left untouched.
- 2026-08-27: Independent review identified ambiguous publication, lease-fence,
  post-commit recovery, and test-coverage risks. The lifecycle now keeps
  ambiguously acknowledged jobs pending with one sweep republish, fences worker
  status writes with the process token, stores recoverable cleanup metadata,
  rejects assessment conversion, and covers these paths in focused tests.
- 2026-08-27: Follow-up review found an overlap window during the database call
  and two sweep transition races. Course deletion now takes a transaction-level
  PostgreSQL advisory lock before destructive work, and publication recovery
  uses exact-value Redis transitions that require no process lease or heartbeat
  and retry on a bounded five-minute cadence until acknowledgement or staleness.
- 2026-08-27: Final review found stale terminalization needed the same atomic
  transition and that publication attempts could postpone staleness. Both now
  use an absolute 75-minute creation-time deadline and exact-record/no-worker
  transitions; focused tests cover active-worker and outage-deadline races.
- 2026-08-27: Independent final confirmation reported no remaining issue in the
  database fence, stale normalization, or publication-recovery race paths.
- 2026-08-27: Post-PR review extracted the duplicated GraphQL error-code parser
  and replaced text-based deletion-toast assertions with stable `data-cy`
  selectors. Focused frontend and Playwright typechecks plus changed-file
  formatting pass.
- 2026-08-27: Browser verification passed against an isolated synthetic stack.
  Deleting the seeded `Testkurs` (50 participations, 6 live quizzes, 3 practice
  quizzes, 5 microlearnings, 6 group activities, 19 participant groups, and 15
  leaderboard entries) closed the modal after queue acknowledgement, showed
  persisted background progress, completed successfully in the Hatchet worker,
  and removed the course after polling. Real screenshots are stored under
  `docs/screenshots/background-course-deletion/` for the draft PR.
- 2026-08-27: The final independent review found one low-severity E2E timing
  risk. The completion toast is now asserted before waiting for the asynchronous
  course-list refetch, preventing its six-second visibility window from expiring
  on a slow CI runner.
- 2026-08-28: Aligned the compact deletion status label with course duplication:
  `Course deletions` in English and `Kurslöschungen` in German. Both locales were
  verified in the real manage UI with an active synthetic deletion; paired
  screenshots are stored with the existing draft-PR evidence.
- 2026-08-28: Superseded the original hard-deletion and visible-status design.
  Course deletion now retains the course graph behind `Course.isDeleted`, can
  optionally hard-delete draft activities of all four types, and keeps Hatchet
  progress entirely invisible while preserving mutation fences and the terminal
  course-list refresh.
- 2026-08-28: The earlier visible-status/toast verification and screenshots are
  historical evidence for the superseded implementation. Replacement screenshots
  for the simplified modal and hidden pending targets remain pending an explicitly
  authorized isolated runtime. Duplication and deletion of the same
  source now share a transaction-level database fence so they cannot copy a
  partially deleted graph.
- 2026-08-28: The two-axis branch review additionally closed anonymous feedback
  and stack-response write gaps, removed global UI hydration blocking for
  unrelated courses, versioned the changed deletion-summary operation, moved
  guard target resolution out of the GraphQL schema, and made ambiguous Hatchet
  publication acknowledgements keep the modal open. Live-quiz response ingest
  now checks both the immediate Redis fence and the durable course marker.
- 2026-08-28: Pending deletion targets now disappear optimistically after queue
  acknowledgement. The course stays absent across navigation, reloads, and
  direct links; linked draft activities are absent only when optional draft
  cleanup was selected. A terminal failure removes the local target so retained
  data becomes visible again.
- 2026-08-31: Production hardening moved pending visibility and write
  protection into durable `Course` state, converted the deprecated GraphQL
  deletion field into a background compatibility adapter, snapshotted optional
  draft cleanup scope, added durable response admissions plus Redis leases
  before deletion fencing,
  and added a database
  trigger that blocks old pods from hard-deleting active course rows. The full
  migration chain was rehearsed on fresh PostgreSQL 15; active hard deletion
  was rejected, an explicitly soft-deleted row could be purged, and the
  pending-aware `UserActivities` view was installed successfully.
