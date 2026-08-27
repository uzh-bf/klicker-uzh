# Background course deletion

## Goal

Move destructive course deletion out of the GraphQL request lifecycle so large
courses can finish reliably, close the confirmation modal as soon as the job is
accepted, and surface durable progress and completion feedback.

## Non-goals

- Do not change which course data is deleted or disconnected.
- Do not make assessment courses deletable.
- Do not change the optional draft-live-quiz cleanup default.
- Do not remove or repurpose the existing synchronous `deleteCourse` mutation;
  deployed clients retain their persisted operation during rolling releases.
- Do not refactor course duplication into a generic background-job framework.

## Approach

Use a parallel deletion-specific job lifecycle modelled on course duplication.
This is preferred over a fire-and-forget event because lecturers need reliable
failure feedback, and over generalizing the mature duplication path because
that would expand the regression surface without improving deletion semantics.

## Design

- **Domain vocabulary:** `Course` deletion retains the existing cascade and
  disconnection contract. `PracticeQuiz`, `MicroLearning`, and
  `GroupActivity` rows cascade with the course; linked `LiveQuiz` rows remain
  disconnected unless the existing `deleteDraftActivities` option selects
  draft live quizzes for hard deletion.
- **Layer footprint:** `packages/graphql` gets deletion-job persistence,
  status types, a start mutation, a status query, worker handlers, generated
  operations, and focused tests. `packages/hatchet` and
  `packages/types` register processing and stale-sweep tasks.
  `apps/frontend-manage` gets an app-wide persisted status provider and modal
  wiring. English and German i18n, the course Playwright flow,
  `docs/domain-model.md`, and `docs/async-and-workers.md` are updated. No Prisma
  migration, shared product type, seed, or gamification change is required.
- **Auth:** starting deletion keeps `asUser` plus course-level
  `PermissionLevel.ADMIN`. The worker reconstructs the initiating user context
  and rechecks `ADMIN` immediately before deletion. Status reads are bounded to
  50 unique ids and only return jobs owned by the caller.
- **Job contract:** Redis stores `PENDING | RUNNING | COMPLETED | FAILED`, job
  id, course id/name, timestamps, initiating user context, and the draft cleanup
  option. Terminal records strip execution context and options while retaining
  the owner id for status authorization. A per-course lock prevents concurrent
  starts; a per-job renewable processing lease and heartbeat make Hatchet
  retries and stale normalization safe. A transaction-level PostgreSQL advisory
  lock fences destructive work across background retries and legacy callers.
- **Idempotency and failure:** event publication retries with the same job id.
  Ambiguous acknowledgements retain the pending job and lock; atomic sweep
  transitions retry publication every five minutes while no worker lease or
  heartbeat exists.
  The worker treats an already-absent course as completed, rechecks access for
  an existing course, and invokes the existing deletion service as the single
  source of cascade/cancellation/invalidation behavior. Generic failures remain
  retryable; access failures become terminal. Stale normalization marks an
  absent course completed and an existing course failed only after its
  heartbeat expires.
- **Reliability:** raise the deletion transaction budget from 60 seconds to ten
  minutes, matching the proven course-duplication transaction envelope. Hatchet
  processing receives a 30-minute attempt timeout and a 60-minute queue timeout
  with low-priority serialized execution.
- **Gamification:** no rule changes. Existing course cascades continue to own
  leaderboard and participation cleanup.
- **UI:** the confirmation modal submits `startCourseDeletion`, closes only
  after the job is accepted, and stays open with a localized toast if starting
  fails. Job ids persist in `localStorage`; the provider polls every five
  seconds, shows an app-wide deletion progress popover, prevents duplicate
  starts in the current client, and refetches `GetUserCourses` on terminal
  status. The course remains in the list until `COMPLETED`; success removes it
  through the refetch, while failure leaves it available and shows an error.
- **Test level:** retain direct service tests for legacy deletion semantics and
  assert the longer transaction budget. Add focused deletion-job tests for
  start/status authorization, worker access recheck, successful completion,
  idempotent absent-course recovery, and retryable failure. Extend the existing
  course Playwright flow to prove prompt modal closure and completion feedback.
  Run codegen, GraphQL tests, `check:all`, build, and browser verification when
  an already-running authorized local environment is available; do not start
  Devrouter without explicit authorization.
- **Seeds/fixtures:** reuse existing course-deletion fixtures.

## Slices

1. Add the Redis job lifecycle, GraphQL status contract, Hatchet tasks, and the
   longer transaction budget.
2. Add focused backend tests and regenerate GraphQL artifacts.
3. Add the persisted manage provider, modal integration, bilingual copy, and
   Playwright assertions.
4. Update durable domain/worker documentation and verify the integrated change.
5. Run independent review, commit, push, and open a draft PR against `v3`.

## Acceptance criteria

- A confirmed deletion returns a job promptly and closes the modal after the
  start acknowledgement, without waiting for the course cascade.
- Active deletion survives navigation/reload and shows visible progress.
- The course disappears from the lecturer list only after confirmed completion.
- A failed job keeps or restores the course in the list and shows localized
  feedback.
- Repeated starts and Hatchet retries cannot execute concurrent deletions or
  produce contradictory terminal states.
- Assessment and permission boundaries match the existing synchronous API.
- Large valid deletions are not constrained by the former 60-second transaction
  timeout.

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
