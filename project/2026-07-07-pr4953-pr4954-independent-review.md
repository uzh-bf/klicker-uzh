# Independent review: PR #4954 course duplication and PR #4953 cockpit display name (2026-07-07)

Reviewer: Codex. Reviewed existing notes in `project/2026-07-07-pr4954-course-duplication-review.md` and `project/2026-07-07-pr4953-cockpit-displayname-retro-review.md`, then checked the current branch code directly.

Scope checked:

- Current branch `origin/course-duplication` at `6cc0bd766`, with feature commit `8a1ff39c7` on top of `v3` merge base `d6c7772f8`.
- Historical PR #4953 merged commit `41eefefa8d` (`enhance(apps/frontend-manage): add display name to lecturer cockpit (#4953)`).
- Main implementation paths in `packages/graphql/src/services/courses.ts`, `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`, `apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx`, generated GraphQL ops/schema files, E2E fixture additions, and the cockpit display-name files.

I did not run the full test suites. I did run `git diff --check v3...HEAD`, which was clean. The findings below are source-review findings, not runtime verification.

## Processing update

After the initial review, the linked SonarCloud issue `AZ79wbFPQrDWk7NzZlKK` was checked directly through the SonarCloud API. It is `typescript:S3776` on `apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx`: cognitive complexity 24 where the configured maximum is 15.

The current processing pass addresses that and the review findings around duplication UX/error reporting by:

- Extracting date defaults, fixed-duration parts, yup schema creation, toast message selection, and notification construction out of `CourseDuplicationModal`.
- Extracting duplicated-course activity and instance access checks out of `duplicateCourse` in `packages/graphql/src/services/courses.ts`.
- Replacing the English-built duration string with ICU plural messages in both locales.
- Adding duplication-specific failure, no-access, partial-failure, in-progress, and success messages in both locales.
- Showing a success toast and navigating to the duplicated course after a successful duplication.
- Updating Cypress and Playwright expectations for the partial-duplication rollback path.

Focused verification after processing:

- `pnpm --filter @klicker-uzh/frontend-manage check`
- `pnpm --filter @klicker-uzh/graphql check`

Both passed, with only the existing Node engine warning from `packages/word-cloud` because the shell is using Node v24 while the repo expects Node 20.

## Coverage re-review after processing

Re-reviewed the current worktree after the processing pass against all previous review items. Summary: the concrete PR #4954 code findings that were in scope for this pass are covered, but several external/process/product follow-ups remain open.

Covered now:

- The linked SonarCloud `typescript:S3776` issue on `CourseDuplicationModal.tsx` was addressed locally by extracting date defaults, duration calculation, yup schema creation, notification construction, and error-message selection into helpers.
- The backend `duplicateCourse` cognitive-complexity issue was addressed locally by extracting selected-activity access checks and selected-instance access checks.
- The German duration issue is fixed: the modal now passes `{ years, months, days }` to `fixedDateInterval`, and both locale files use ICU plural messages.
- Duplication errors no longer reuse `courseCreationFailed` plus `considerFormErrors`. The modal now displays duplication-specific generic, no-access, or partial-failure messages.
- Successful duplication now shows a success toast and routes to `/courses/{duplicatedCourse.id}`.
- Long-running duplication now has both `Button` loading state and an in-progress hint.
- The dead duplication-modal props/tests (`earliestGroupDeadline`, `earliestStartDate`, `latestEndDate`, `containsActivities`, `containsGroups`) were removed from `CourseDuplicationModal`; the similarly named props still exist in `CourseOverviewHeader` because they are used by `CourseManipulationModal`.
- The leftover duplication TODO was removed.
- The duplication submit button now says "Duplicate" instead of "Create".
- The group-deadline warning no longer depends on `touched.groupCreationDeadline`.
- Cypress and Playwright partial-duplication rollback expectations now assert `courseDuplicationPartialFailure`.

Partially covered:

- The success redirect is implemented in `CourseOverviewHeader`, but the existing Cypress/Playwright success-path tests still navigate back to the course list after submission instead of asserting the post-submit destination or success toast. This is a test-coverage gap, not a missing implementation.
- The linked SonarCloud issue is addressed locally, but SonarCloud itself cannot be proven green until the branch is pushed and the PR analysis reruns. The older review's separate "duplicated lines on new code" gate and the GitGuardian gate are external CI items and were not resolved by local code changes.
- Browser verification was attempted, but the running `localhost:3002` app belonged to `/Users/paldov/Documents/klicker-uzh`, not this worktree. I did not start a new Infisical-backed dev stack because the repo instructions say to avoid starting dev servers unless explicitly asked.

Still open from previous reviews:

- PR #4953 still lacks `data-cy="live-quiz-display-name"` on `LiveQuizTimeline.tsx` and still has no cockpit display-name regression assertion.
- The product decision on duplicating already-ended courses remains unchanged: old source dates are still accepted, including already-ended dates.
- The source-owner ADMIN grant on copies created by another admin is still not called out explicitly in the modal info text.
- The "dates can be changed afterwards" tooltip still needs manual verification against real copied activities.
- Staging scale timing for large courses was not performed.
- Lecturer-facing docs for what course duplication copies and does not copy were not added.

## Overall verdict

PR #4954 is architecturally on the right track and the highest-risk backend problems from earlier review rounds appear fixed: duplication is gated by course/activity/element access checks, executed inside one transaction, and covered by broad Cypress plus Playwright scenarios. After the processing pass, the main local code/UX blockers are covered. I would still keep merge blocked until the external CI gates are green and the remaining product/process follow-ups are either handled or explicitly accepted.

PR #4953 is a small, already-merged change and is acceptable as-is from a correctness perspective. Its main gap is process/test coverage: it added visible cockpit UI without a stable selector, an assertion, or screenshot evidence, and it also changed header layout more than the PR title suggests.

## Findings

### P0 - CI gates must be resolved before PR #4954 can merge

The previous review calls out SonarCloud duplication and GitGuardian as failing gates. Those are merge blockers regardless of whether the code is otherwise correct.

One important correction: do not assume the Sonar duplication is primarily from `cypress/**` and `playwright/**` until checking the SonarCloud duplications view. The checked-in scanner config has `sonar.sources=apps,packages,deploy` in `sonar-project.properties:11`, so root-level `cypress/` and `playwright/` should not be part of the default analyzed source set. If SonarCloud is respecting this config, extracting shared Cypress/Playwright fixtures will improve maintainability but may not move the quality gate.

Recommended order:

1. Open the SonarCloud "Duplications on New Code" view and identify the actual files counted by CPD.
2. If Sonar points at source files, focus first on `CourseDuplicationModal.tsx` versus `CourseManipulationModal.tsx`, and the four backend copy helpers in `courses.ts:3014-3211`.
3. If Sonar really points at root E2E files despite `sonar.sources`, then either extract shared fixtures or make the scanner scope explicit. Do not quietly add a broad `sonar.cpd.exclusions` without maintainer sign-off.
4. For GitGuardian, identify the exact commit/file/secret type from the PR check. If it is seeded test data, mark it as a false positive/test credential. If it is real, rotate and rewrite the offending commit history; a revert is not enough for a commit-history scanner.

### P1 - Course duplication errors are reported as form-entry failures

`CourseDuplicationModal.tsx:381-394` always shows `courseCreationFailed` plus `considerFormErrors`. That is misleading for the most important backend failures:

- `duplicateCourse` returns `null` when the user no longer has ADMIN access or the source course disappears (`courses.ts:3391`, `3401`, `3408`).
- `duplicateCourse` throws for partial-copy-prevention cases (`courses.ts:3445`, `3452`, `3505`).
- Apollo/network failures are caught in `CourseOverviewHeader.tsx:319-323` and collapsed into the same form hint.

This matters because the user can do everything right in the form and still fail due to stale permissions, source data corruption, or a backend transaction rollback. The UI should distinguish validation failures from duplication failures.

Fix:

- In `CourseOverviewHeader.tsx`, inspect `result.errors`, `result.data?.createCourse`, and caught `ApolloError`s.
- Add duplication-specific i18n keys in `packages/i18n/messages/en.ts` and `de.ts`, for example `courseDuplicationFailed`, `courseDuplicationNoAccess`, and possibly `courseDuplicationPartialFailure`.
- Keep `considerFormErrors` only when Formik/yup validation is the likely cause.

### P1 - Successful duplication leaves the lecturer on the source course with no confirmation

On success, `CourseOverviewHeader.tsx:313-315` only closes the modal. The copied course is inserted into the Apollo `GetUserCoursesDocument` cache (`CourseOverviewHeader.tsx:295-310`), but the lecturer remains on the source course and has to find the copy manually. The E2E tests then navigate back to the course list themselves (`playwright/tests/N-course.spec.ts:2443-2447`, `cypress/cypress/e2e/N-course-workflow.cy.ts:2383-2385`), which mirrors the current UX gap rather than validating a useful completion flow.

Fix:

- Show a success toast with the new course name.
- Navigate to the duplicated course, for example with `router.push('/courses/' + result.data.createCourse.id)`.
- Update the Cypress/Playwright assertions to expect the post-submit destination instead of manually hunting for the copy.

### P1 - Long-running duplication has no progress affordance

The backend transaction timeout is 120 seconds, and the implementation performs many sequential writes plus permission recomputation inside the transaction (`courses.ts:3509-3609`). The submit button only becomes disabled while `isSubmitting` (`CourseDuplicationModal.tsx:740-748`); there is no spinner or "this may take a while" hint.

For large real courses, this can feel frozen even when the backend is still working.

Fix:

- Use the design-system `Button` loading state if available.
- Add concise i18n copy near the submit action while submitting, for example "Duplicating large courses can take a while."
- On staging, time the largest realistic MeF course. If it approaches the timeout, ticket a Hatchet/background-job follow-up rather than further extending an interactive transaction.

### P1 - German UI receives an English hand-built duration string

`CourseDuplicationModal.tsx:316-330` builds `descriptionCourseDuration` in English (`year`, `month`, `day`) and passes it into `fixedDateInterval`. In German, `packages/i18n/messages/de.ts:2663` still receives that English phrase.

Fix:

- Move pluralization into next-intl ICU messages in both locales.
- Pass `{ years, months, days }` numbers, not a preformatted English string.
- Cover the German modal in browser verification.

### P2 - Duplicating an old course is submit-ready with old, already-ended dates

`CourseDuplicationModal.tsx:292-315` initializes duplication dates from the source course. If the source course has already ended, `endDatePast` disables the "end date must be future" validation (`CourseDuplicationModal.tsx:166-169`, `192-217`). That means a lecturer can open an old course, click duplicate, and create a new course that is already in the past unless they notice and manually shift the start date.

The behavior may be intentional for archival copies, but it is risky for the likely "reuse last semester's course" workflow.

Fix or product decision:

- Prefer defaulting the copied start date to a future date while preserving the source duration, or
- Keep the old dates but show a warning and require confirmation when the copy would end in the past.

### P2 - Dead/inherited validation props make the modal harder to reason about

`CourseDuplicationModal` accepts `earliestGroupDeadline`, `earliestStartDate`, and `latestEndDate` (`CourseDuplicationModal.tsx:31-33`) and uses them in yup tests (`181-213`, `245-255`). The duplication call site does not pass those props (`CourseOverviewHeader.tsx:243-248`). This is inherited from the edit modal, but for duplication the semantics are different because activities are shifted with the new course start date.

Also, `containsActivities` and `containsGroups` are passed by `CourseOverviewHeader.tsx:245-246` and destructured in `CourseDuplicationModal.tsx:150-151`, but never used.

Fix:

- Remove the unused date-boundary props/tests from the duplication modal unless there is a concrete duplication-specific validation to wire.
- Use `containsActivities`/`containsGroups` to hide or disable irrelevant copy switches, or remove those props too.

### P2 - Submit label says "Create" instead of "Duplicate"

The modal title is duplication-specific (`CourseDuplicationModal.tsx:349`), but the primary button uses `shared.generic.create` (`CourseDuplicationModal.tsx:747`). This is small, but it increases the chance that a lecturer treats this like a normal course-create form.

Fix: add/reuse `manage.course.duplicateCourse` for the submit label.

### P2 - The group-deadline warning is probably unreachable

The warning at `CourseDuplicationModal.tsx:716-724` requires `touched.groupCreationDeadline`, but the field is disabled at `CourseDuplicationModal.tsx:565-589`. If `CourseDateChangeMonitor` does not mark it touched programmatically, the warning will never render.

Fix: either verify the monitor behavior and add a test, or remove the `touched` guard.

### P2 - PR #4953 needs a stable selector and regression assertion

PR #4953 added the display-name heading at `LiveQuizTimeline.tsx:121-124`, but there is no `data-cy` / test id on the new visible text. Current Cypress and Playwright live-quiz suites do not assert that the cockpit shows the display name.

Fix:

- Add `data-cy="live-quiz-display-name"` to the `H4`.
- Add one assertion in the live-quiz cockpit flow, preferably Playwright first given the ongoing migration.

### P2 - PR #4953 changed cockpit layout as part of a text-display PR

The merged diff in commit `41eefefa8d` did more than thread `displayName`. It removed the compact `m-0 text-xl` styling from the cockpit `H1`, moved `RuntimeCounter`, changed centering behavior, and switched the action button container between grid and flex depending on `assessmentMode`.

This may be fine, but it expands the regression surface on narrow screens and assessment-mode cockpit layouts. There were no screenshots attached in the review note.

Fix/process:

- Treat future cockpit UI changes as UI changes, not just data plumbing.
- Include desktop and narrow/mobile screenshots with delegated login verification.

## Verified strengths in PR #4954

- Authorization is layered and fail-closed. `duplicateCourse` checks course ADMIN before reading, recomputes derived permissions and checks again, then checks ADMIN on every selected activity (`courses.ts:3387-3446`). It separately verifies ADMIN/OWNER derived access on every underlying element instance selected for duplication (`courses.ts:3487-3507`).
- The access helper itself requires all requested checks to pass. `checkAccess` returns `false` on the first missing permission and only returns `true` after the loop completes (`sharing.ts:5650-5807`).
- The duplication is atomic. The create/update/copy/recompute steps are inside one Prisma transaction with the duplication timeout (`courses.ts:3509-3609`).
- The copy path reuses existing activity manipulation services with a transaction client instead of reimplementing all creation invariants (`liveQuizzes.ts:505-507`, `practiceQuizzes.ts:370-372`, `microLearning.ts:401-403`, `groups.ts:1070-1072`).
- Missing group-activity stack data now throws before/inside the copy path (`courses.ts:3448-3453`, `3173-3177`), and the Playwright suite has an atomicity check (`playwright/tests/N-course.spec.ts:2600-2628`).
- Direct permissions are copied with audit log entries (`courses.ts:2907-2960`), and the source owner receives ADMIN on a copy created by another admin (`courses.ts:2963-3012`).
- The frontend guards the previous NaN group-size path with `getCourseDuplicationGroupSize` (`CourseOverviewHeader.tsx:49-60`).
- The branch includes broad E2E coverage for owner/admin duplication, group-creation-off duplication, assessment course duplication, shared permissions, copied activity references, and clean result state.
- The side change in `getInstanceUpdateActivities` is directionally good: deduplicating by `activityId` instead of activity name avoids collapsing two activities with the same name, and showing `courseName` helps explain shared element usage (`packages/graphql/src/services/elements.ts:1139-1267`, `InstanceUpdateSwitch.tsx:110-149`).

## Maintainability notes

The duplicated E2E fixture logic is still a real maintenance smell even if it is not the Sonar culprit. `cypress/cypress.config.ts` gained about 1,220 lines and `playwright/util/fixtures/courses.ts` gained about 1,345 lines. Much of this is structurally similar setup, reset, summary, and result-zeroing logic. Extracting shared DB fixture helpers would reduce future drift between Cypress and Playwright during the migration.

The four backend activity copy helpers in `courses.ts:3014-3211` are understandable but repetitive. I would not block v1 on a generic abstraction if the tests stay green, but a small typed helper for common activity metadata/date shifting would reduce future "new field copied in three of four activity types" bugs.

The duplication modal is a near fork of `CourseManipulationModal`. That was pragmatic, but now both files carry similar date/group validation logic with different semantics. After v1, extract only the stable shared form pieces, not the whole modal behavior.

## Recommended merge checklist

1. Resolve SonarCloud and GitGuardian with exact evidence from the PR checks.
2. Fix P1 UX/i18n items: localized duration, accurate duplication failure messages, success toast plus redirect, and loading/progress state.
3. Decide the old-course date behavior before release, or add a warning.
4. Clean the dead duplication-modal props/tests and the submit label.
5. Add at least one cockpit display-name assertion and selector as a small follow-up for PR #4953.
6. Run targeted checks: `pnpm run check`, GraphQL generation already appears present but rerun `pnpm --filter @klicker-uzh/graphql generate` if any ops/schema change, then the affected N-course E2E paths.
7. Perform mandatory frontend verification with `npx agent-browser`: duplicate a seeded course in English and German, verify redirect/success feedback, copied activities, empty result state, and permission display.

## Accepted for v1 if documented

- Activity instances are duplicated but still reference the same underlying elements.
- Participants, groups, results, leaderboards, analytics, and responses are not copied.
- Live/practice/group/microlearning activity copies reset runtime/publication state through the normal creation services.
- Source owner ADMIN retention on non-owner-created copies, if confirmed as a product requirement.
- A synchronous transaction-based implementation, provided staging scale testing stays well below the timeout.
