# Review: PR #4954 — Course Duplication (2026-07-07)

Reviewer: Roland (via Claude Code review session). Branch `course-duplication` @ `8a1ff39c7`, merge base `d6c7772f8` (v3).

## Verdict

The feature is functionally complete and the earlier critical review findings (missing permission check, NaN group sizes, silent partial duplication, test isolation/races) are **all fixed and verified** — evidence below. What still blocks the merge is two failing CI gates (SonarCloud duplication, GitGuardian) plus a handful of UX/i18n gaps that are cheap to fix. With the "Blocking" and "Must fix" lists below done, this is production-ready for the MeF stakeholder use case.

## Verified as solid (with evidence)

- **Security (previously critical):** `duplicateCourse` now enforces layered, fail-closed access checks before reading anything: course-level ADMIN check plus re-check after `recomputeDerivedPermissions` (`packages/graphql/src/services/courses.ts:3387-3401`), per-activity ADMIN checks for every selected activity type (`courses.ts:3414-3446`), and a per-element-instance ADMIN/OWNER count check (`courses.ts:3487-3507`). The resolver routes `createCourse(id: …)` to this guarded path (`packages/graphql/src/schema/mutation.ts:1352-1357`).
- **Atomicity:** the whole duplication runs in a single interactive transaction with a 120s timeout (`courses.ts:3509-3609`, timeout constant at `courses.ts:37`). Missing group-activity stacks now throw up front (`courses.ts:3448-3453`) and again in the copy helper (`courses.ts:3173-3177`) instead of the earlier silent `console.log` + skip. There is a dedicated E2E test: "Does not leave a partial course when activity duplication fails" (`playwright/tests/N-course.spec.ts:2600`).
- **Reuse instead of re-implementation:** copies go through the existing `manipulateLiveQuiz/PracticeQuiz/MicroLearning/GroupActivity` creation paths with an optional `transactionPrisma` parameter; the standalone `$transaction` fallback is preserved in all four services (e.g. `packages/graphql/src/services/liveQuizzes.ts:505-507`, `practiceQuizzes.ts:371-372`, `microLearning.ts:402-403`, `groups.ts:1071-1072`).
- **Auditability:** every copied permission writes an `AuditLogEntry` (`courses.ts:2944-2954`, `2997-3006`).
- **Earlier bot findings fixed:** NaN group sizes handled via `getCourseDuplicationGroupSize` with fallback to source-course values (`apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx:49-61`); German grammar in the new tooltips corrected (`packages/i18n/messages/de.ts:2657-2675`); the playwright test that depended on a copy from an earlier test now creates its own copy (`playwright/tests/N-course.spec.ts:3545-3556`); the cypress permission-deletion race was resolved by deleting the source permission *before* duplicating (`cypress/cypress/e2e/N-course-workflow.cy.ts:2734-2739`); `resetElementResults` now zeroes counts recursively while preserving the object structure (`playwright/util/fixtures/courses.ts:931-961`).
- **Test coverage is broad:** duplication as owner, without group creation, assessment courses, shared courses with individual and user-group permissions, ADMIN-level duplication by a non-owner, button hidden for non-managers, shared-element reference semantics, and the atomicity case — in both the cypress and playwright suites.
- **Docs discipline:** the permission contract is recorded in `project/CODEBASE_NOTES.md`.

## Blocking (CI gates — must be green before merge)

### 1. SonarCloud quality gate: 13.3% duplicated lines on new code (limit ≤ 3%)

Where the duplication comes from:

- `cypress/cypress.config.ts` (+1220 lines) re-implements the same Prisma seed/cleanup logic that `playwright/util/fixtures/courses.ts` (+1345 lines) contains.
- The four `copyCourseLiveQuizzes/PracticeQuizzes/MicroLearnings/GroupActivities` helpers in `courses.ts:3014-3211` are structurally near-identical.
- `CourseDuplicationModal.tsx` copies large parts of `CourseManipulationModal.tsx`.

**How to fix (pick in this order):**

1. Extract the shared DB seed/cleanup helpers into one module both test stacks import. Both cypress tasks and playwright fixtures run in Node with the same Prisma client, so a plain shared file works — e.g. create `packages/prisma-data/src/testing/courseFixtures.ts` (or a top-level `test-utils/` folder) and have `cypress/cypress.config.ts` register thin task wrappers around it while `playwright/util/fixtures/courses.ts` re-exports from it. This alone should remove most of the 13.3%.
2. If leftovers remain, collapse the four backend copy helpers into one generic helper parameterized by activity type (the shapes only differ in `blocks` vs `stacks` vs single `stack` + `clues` and the date-shift fields).
3. Only if the gate still fails: discuss with Roland whether `cypress/**` and `playwright/**` should be excluded from the Sonar duplication metric (`sonar.cpd.exclusions`). Do NOT silently change Sonar config without sign-off.

### 2. GitGuardian: "1 secret uncovered" across the 16 branch commits

Pattern scans over the full branch diff and per-commit patches found no real credential — everything auth-related goes through `Cypress.env(…)` (e.g. `STUDENT_PASSWORD` at `cypress/cypress/support/commands.ts`) — so this is likely a false positive on a test credential or a JWT-shaped test string. Still, it must be triaged, not ignored:

1. Open the GitGuardian check from the PR (link in the failed check) and identify the exact commit/file/secret type.
2. If it is a seeded test credential or dummy token: mark it as a false positive / test credential in the GitGuardian dashboard and re-run the check.
3. If it is a real secret: rotate it immediately, then rewrite the branch history (`git rebase -i` to drop/amend the offending commit, force-push) — a revert commit is NOT enough since GitGuardian scans all commits. Tell Roland before any history rewrite.

## Must fix before merge (small, concrete)

### 3. German UI shows an English duration string

`CourseDuplicationModal.tsx:327-330` builds the duration as English text (`"1 year 2 months 3 days"`, hand-rolled pluralization) and injects it into the localized `fixedDateInterval` key → German users see "Fixes Datumsintervall: 1 year 2 months". Fix: move the pluralization into the i18n layer. next-intl supports ICU plurals, e.g. `fixedDateInterval: 'Fixes Datumsintervall: {years, plural, =0 {} one {# Jahr } other {# Jahre }}{months, plural, =0 {} one {# Monat } other {# Monate }}{days, plural, =0 {} one {# Tag} other {# Tage}}'` and pass `{years, months, days}` as numbers. Mirror in `en.ts`.

### 4. Backend errors surface as "check your form inputs"

The only error path is the toast in `CourseDuplicationModal.tsx:381-394` (`courseCreationFailed` + `considerFormErrors`). That message is wrong when: the user lost ADMIN access mid-flight (`duplicateCourse` returns `null`, `courses.ts:3391/3401/3408`), or the backend throws "Not all selected activities could be duplicated" (`courses.ts:3445/3452/3505`). Fix in `CourseOverviewHeader.tsx` onSubmit: inspect `result.errors` / the caught `ApolloError`, and show a dedicated i18n message for duplication failures (add e.g. `courseDuplicationFailed` + `courseDuplicationNoAccess` keys in both locales). Keep the form-errors hint only for actual validation failures.

### 5. No success feedback, no navigation to the copy

After success the modal just closes (`CourseOverviewHeader.tsx`, the `if (result.data?.createCourse)` branch) — the lecturer stays on the *source* course and has to hunt for the copy in the course list. Fix: show a success toast and `router.push(\`/courses/\${result.data.createCourse.id}\`)` (router is already available in the component). Update the E2E tests that currently navigate to the course list manually after submitting.

### 6. No progress affordance for a potentially 120s operation

The submit button only gets `disabled` while `isSubmitting` (`CourseDuplicationModal.tsx:740-748`). For a large course the transaction can legitimately run tens of seconds; the modal looks frozen. Fix: use the design-system `Button` `loading` prop (or a spinner + i18n hint "Duplication can take a while for large courses…") while `isSubmitting`.

## Should fix (quality; OK as fast-follow if Roland agrees)

7. **Dead validation + inverted test:** `earliestGroupDeadline`, `earliestStartDate`, `latestEndDate` props (`CourseDuplicationModal.tsx:31-33`) are never passed at the call site (`CourseOverviewHeader.tsx:243-248`), so the related yup `.test`s never run — and the `afterEarliestActivityStart` test is inverted anyway (`isBefore` for an "after" rule, `CourseDuplicationModal.tsx:181-191`). Either wire the props with correct semantics or delete the props + dead tests.
8. **Unused props:** `containsActivities`/`containsGroups` are destructured but never used (`CourseDuplicationModal.tsx:150-151`). Remove — or better, use them to hide/disable the copy switches when the source course has nothing to copy in a category.
9. **Leftover TODO:** `// TODO: take over functionality of createCourse` in `CourseOverviewHeader.tsx` onSubmit. Resolve or delete.
10. **Button label:** submit says `shared.generic.create` ("Create") — use "Duplicate"/"Duplizieren" (`CourseDuplicationModal.tsx:747`) to match the modal title.
11. **Possibly unreachable warning:** the "group deadline moved to past" warning requires `touched.groupCreationDeadline` (`CourseDuplicationModal.tsx:716-721`) but that field is permanently `disabled` (`CourseDuplicationModal.tsx:568`), so the user can never touch it. Verify whether `CourseDateChangeMonitor` sets touched programmatically; if not, drop the `touched` gate.
12. **Product decision to confirm with Roland/MeF:** duplicating a shared course silently grants the *source owner* ADMIN on the copy (`grantDuplicatedCourseAccessToSourceOwner`, `courses.ts:2963-3012`) and copies all direct permissions including user groups. The info notification mentions permission copying but not the owner-ADMIN grant. Confirm this is desired and state it explicitly in `courseDuplicationCopyInfo`.
13. **Duration-lock escape hatch:** the tooltips promise "you can change the dates for the duplicated course afterwards" (`courseDatesForCourseDuplicationTooltip`). Manually verify course settings actually allow shrinking the window once shifted activities exist — otherwise lecturers can get stuck and the tooltip is wrong.

## Path to production — ordered checklist for the junior

1. **Fix the two CI gates** (items 1-2). Nothing merges while they are red — `mergeStateStatus` is BLOCKED.
2. **Implement items 3-6** (i18n duration, error surfacing, success redirect, loading state). All are contained in `CourseDuplicationModal.tsx`, `CourseOverviewHeader.tsx`, and the two locale files. If you touch any `.graphql` op, rerun `pnpm --filter @klicker-uzh/graphql generate`.
3. **Run the checks locally** before pushing: `pnpm run check` (typecheck), `pnpm run format`, and the affected suites (`playwright/tests/N-course.spec.ts`, `cypress/cypress/e2e/N-course-workflow.cy.ts` — CI runs them too; local runs need the seeded dev DB, see `pnpm run prisma:setup` and `pnpm run dev:test`).
4. **Manual UX verification with agent-browser** (mandatory per repo rules — `.agents/skills/agent-browser/SKILL.md`): log in as `lecturer`/`abcd` (delegated login), duplicate the seeded "Testkurs" once with all switches on and once with group creation off. Verify: copy appears in course list; activities exist in DRAFT/SCHEDULED state with shifted dates; results/leaderboards on the copy are empty; the source course is untouched; permission list on the copy matches the source; **switch the UI to German** and screenshot the modal (this catches item 3). Attach before/after screenshots to the PR description.
5. **Scale sanity check on staging:** duplicate the largest real course available (most activities). Time it. If it approaches the 120s transaction timeout (`courses.ts:37`), tell Roland — the likely follow-up is moving duplication into a Hatchet background job, which is out of scope for this PR but should be ticketed.
6. **Get product sign-off** on item 12 (owner-ADMIN grant semantics) and item 13 (duration lock) before merge — one Slack message to Roland/MeF stakeholders with the two questions is enough.
7. **Docs:** add a short lecturer-facing section on course duplication (what is copied, what is not — results, participants, groups are NOT copied; elements are shared, not cloned) under `apps/docs`.
8. **After merge:** watch backend logs for `duplicateCourse` transaction timeouts/failures during the first weeks; the generic `Error` throws in `courses.ts` will show up in the standard error stream.

## Explicitly out of scope / accepted for v1

- Course duration locked to the source interval (paired effects in `CourseDuplicationModal.tsx:64-97`) — a deliberate correctness mechanism so activity offsets stay inside the course window; documented in tooltips.
- Elements are shared between source and copy (instances reference the same elements) — documented in the modal info box and `CODEBASE_NOTES.md`.
- Participants, groups, results, and leaderboards are not copied — correct for the use case.
- Dual cypress+playwright coverage is current repo convention during the migration (see commit `8119fd53e`); dedupe via shared fixtures (item 1) rather than deleting either suite.
