# Review: Course Duplication Feature (2026-07-09)

Reviewer: Claude (senior-engineer review session). Scope: branch `codex/course-duplication-devrouter` @ `59c83d47d` **plus uncommitted working-tree changes** in this worktree (`/Users/paldov/.codex/worktrees/f1e3/klicker-uzh`). Merge base: `v3` @ `bd6df485b`.

Dimensions requested: didactics/psychometrics, computations, permissions, UX, code quality, path to production — plus a follow-up audit of the two previous reviews (`2026-07-07-pr4954-course-duplication-review.md`, `2026-07-07-pr4953-pr4954-independent-review.md`).

Verification performed for this review: source review of the full branch diff (`v3...HEAD` + working tree), `pnpm --filter @klicker-uzh/graphql check` and `pnpm --filter @klicker-uzh/frontend-manage check` (both pass, exit 0), and a numerical reproduction of the date-delta finding (§ Computations). No E2E suites or browsers were run; CI gates (SonarCloud, GitGuardian) cannot be verified locally.

## Verdict

The feature is in strong shape. The backend design is the best part: layered fail-closed authorization, a single atomic transaction, reuse of the existing `manipulate*` creation services, zeroed results/statistics, and audit-logged permission copies. **Nearly all code-level findings from the two previous reviews were demonstrably addressed** (item-by-item audit below). What remains before production is: one newly found computation bug (day-delta truncation across DST, § Computations), a documentation regression (the duplication permission contract was lost when `project/CODEBASE_NOTES.md` was retired — nothing about duplication exists in the new `docs/` wiki, which the repo now mandates), two still-open product decisions (source-owner ADMIN grant wording; duplicating already-ended courses), the externally-verifiable CI gates, and a discussion-worthy late change: commit `59c83d47d` replaced design-system form components with hand-rolled native inputs, which fixes complexity/duplication metrics but regresses visual consistency and accessibility.

---

## 1. Follow-up: were the previous reviews considered?

Yes — substantially. Commit `6ae8936d8` ("apply changes suggested by review"), commit `59c83d47d`, and the current uncommitted changes map directly onto the review checklists. Status of every prior item:

| # | Prior finding | Status | Evidence |
|---|---|---|---|
| B1 | SonarCloud: 13.3% duplicated lines / cognitive complexity S3776 | **Partially / unverifiable locally** | Modal fully restructured (helpers extracted, no longer a `CourseManipulationModal` fork); backend checks extracted (`assertCourseDuplication*`, `getCourseDuplication*` in `courses.ts:3377-3541`); generic `copyMappedActivityPermissions` added. But the ~1,220-line Cypress vs ~1,345-line Playwright fixture duplication was **not** unified, and the gate itself needs a push + PR re-analysis to confirm. |
| B2 | GitGuardian "1 secret uncovered" | **Open** | No triage evidence in the repo; must be resolved from the PR check UI. |
| 3 | English duration string in German UI | **Fixed** | ICU plurals in both locales (`en.ts:2624`, `de.ts` `fixedDateInterval`); modal passes `{years, months, days}` numbers (`CourseDuplicationModal.tsx:774-778`). |
| 4 | Backend errors shown as "check your form inputs" | **Fixed, then hardened** | Dedicated `courseDuplicationFailed/NoAccess/PartialFailure` keys in both locales; error-type mapping in `CourseOverviewHeader.tsx:105-128`. The uncommitted changes add a proper `GraphQLError` with `extensions.code = COURSE_DUPLICATION_PARTIAL_FAILURE` on the backend (`courses.ts:39-46`) and recursive code extraction on the frontend — a real improvement over the earlier message-sniffing. |
| 5 | No success feedback / navigation | **Fixed (code); test gap remains** | Success toast + `router.push(/courses/{id})` (`CourseOverviewHeader.tsx:381-389`). The owner-duplication E2E still navigates to the course list manually (`N-course.spec.ts:2443`) instead of asserting the redirect URL or toast — flagged as "partially covered" in the independent review and unchanged since. |
| 6 | No progress affordance for a 120 s operation | **Mostly fixed** | `courseDuplicationInProgress` hint + button label swap while submitting (`CourseDuplicationModal.tsx:966-980`). However, `59c83d47d` replaced the design-system `Button` with a native `<button>`, so the recommended `loading` spinner is gone — text-only affordance now. |
| 7 | Dead validation props + inverted `afterEarliestActivityStart` test | **Fixed** | Props and dead yup tests removed from the duplication modal. |
| 8 | Unused `containsActivities`/`containsGroups` | **Fixed** | Removed from the modal (header still passes them to `CourseManipulationModal`, which uses them — correct). |
| 9 | Leftover TODO in onSubmit | **Fixed** | Gone. |
| 10 | Submit label "Create" | **Fixed** | `shared.generic.duplicate` ("Duplizieren") at `CourseDuplicationModal.tsx:979`. |
| 11 | Unreachable group-deadline warning (`touched` gate on disabled field) | **Fixed** | Warning now value-based (`getCourseDuplicationWarningNotifications`, `CourseDuplicationModal.tsx:301-321`). New nit: it compares Date object identity (`!==`) rather than value — see § Code quality. |
| 12 | Product decision: source-owner ADMIN grant not disclosed | **Open** | `courseDuplicationCopyInfo` now says direct permissions are preserved, but still does not mention that the source owner is granted ADMIN on a copy made by another admin (`grantDuplicatedCourseAccessToSourceOwner`, `courses.ts:2972-3021`). Needs product sign-off + one sentence in the info text. |
| 13 | Verify "dates can be changed afterwards" tooltip claim | **Open** | No verification evidence; tooltip unchanged (`courseDatesForCourseDuplicationTooltip`). |
| P2 | Old courses duplicate with already-ended dates | **Deliberate but undecided** | Now documented in code ("keep past source courses duplicatable without forcing the old end date forward", `CourseDuplicationModal.tsx:568`) and the `endDatePast` escape hatch is cleanly scoped. Still no UI warning when the copy would end in the past; the product decision the independent review asked for was never recorded. |
| P2 | PR #4953: `data-cy="live-quiz-display-name"` + cockpit assertion | **Open** | No such selector exists in `frontend-manage` (only `template-live-quiz-display-name` in template settings). |
| — | Cypress/Playwright shared fixture extraction | **Not done** | `cypress/cypress.config.ts` and `playwright/util/fixtures/courses.ts` still carry parallel seed/cleanup/summary logic. Maintenance smell; only a merge blocker if Sonar counts it. |
| — | Lecturer-facing docs (what is/isn't copied) under `apps/docs` | **Not done** | No course-duplication tutorial content found. |
| — | Staging scale timing vs. 120 s timeout | **Not done** | No evidence. |
| — | Docs discipline (previously praised) | **Regressed** | The permission contract recorded in `project/CODEBASE_NOTES.md` was wiped when the v3 merge turned that file into a pointer stub. Nothing about course duplication was migrated into the `docs/` wiki — see § Path to production. |

Bottom line: the team clearly worked through both reviews; every purely code-level item is done or improved upon. The residue is concentrated in **process items** (CI gates, docs, product sign-offs, staging test) plus one test-assertion gap.

---

## 2. Didactics / psychometrics

**Sound core model.** The duplication semantics fit the primary use case (reuse last semester's course):

- **Results are a clean slate.** Duplicated instances are new rows with zeroed `results`/`anonymousResults` (`getInitialInstanceResults`) and fresh `instanceStatistics` (`getInitialInstanceStatistics`), created via `getActivityInstanceConnectOrCreate` case 2 (`packages/util/src/elements.ts:422-460`). No response, leaderboard, XP, or participation data leaks into the copy — verified by the E2E "clean state" and response-separation assertions (`N-course.spec.ts:2530-2547`). This is the right psychometric baseline: per-cohort item statistics stay per course.
- **Item content parity.** Copied instances reuse the source instance's `elementData` snapshot — the *same item version* the previous cohort saw, even if the underlying element has since been edited. The activity's `areInstancesOutdated` flag is set when versions have drifted (`liveQuizzes.ts:115-123`), so the lecturer is prompted to update deliberately rather than silently receiving a different item. Good: content equivalence across cohorts is the default, divergence is an explicit act.
- **Elements are shared, not cloned** (instances point at the same `elementId`). Didactically this is what lecturers want (one question bank), and the accompanying `getInstanceUpdateActivities` change (dedupe by `activityId`, show `courseName`) makes the cross-course propagation of element edits visible. Caveat worth documenting for lecturers: editing an element after duplication now affects *both* semesters' activities when they accept instance updates.
- **Scoring parameters are copied faithfully**: `pointsMultiplier` (activity × element multiplier product preserved — same formula as source, `elements.ts:446-447`), `defaultPoints`, `defaultCorrectPoints`, `maxBonusPoints`, `timeToZeroBonus`, gamification flag, practice-quiz `orderType`/`resetTimeDays`. Comparable point economies across cohorts.
- **Publication state resets to DRAFT** for all activity types (asserted in `verifyCopiedCourseActivities`). Practice-quiz `availableFrom` is intentionally not carried over (`manipulatePracticeQuiz` has no such arg). Didactically correct — the lecturer must consciously re-publish — but it means republishing every activity is part of the semester-start workflow and should be stated in the lecturer docs.
- **Groups and participants are not copied**; group formation restarts with a deadline derived from the new start date. Correct for a new cohort.

**Didactic gaps (non-blocking, worth a product conversation):**

1. **Weekday drift.** Activity dates shift by the raw day offset from the old course start. A one-year shift is 365 days, not 364/371, so a microlearning that used to open "every Monday 08:00" can land on Sundays in the copy. The info notification says dates are adjusted, but nothing nudges the lecturer to *review* the shifted schedule. A post-duplication hint ("check your activities' availability windows") on the redirect target would close this cheaply.
2. **Past-dated copies** (`endDatePast` path): a lecturer duplicating an old course gets a copy that has already ended unless they move the dates. Legitimate for archival copies, risky for the main workflow. Minimum viable fix: a warning notification when the copy's end date is in the past (the modal already has the warning-notification machinery).
3. **Gamification is inherited, not chosen** (`isGamificationEnabled` copied from source, no switch in the modal, explained via `gamificationFixed` notifications). Defensible — it protects the copy's activity/gamification consistency — and the constraint is at least surfaced in the UI.

## 3. Computations

**One real bug found (new):**

- **Day-delta truncation across DST / non-midnight timestamps.** `duplicateSelectedCourseActivities` computes `deltaCourseStart = dayjs(startDate).diff(dayjs(oldCourse.startDate), 'day')` (`courses.ts:3243-3246`), which **truncates**. Course start dates are local-midnight instants converted to UTC (`CourseOverviewHeader.tsx:321`), so a source start in winter (CET, 23:00 Z) and a new start in summer (CEST, 22:00 Z) differ by `N − 1/24` days on a UTC server. Reproduced numerically: old start 2026-02-16T23:00 Z, new start 2026-10-18T22:00 Z → exact diff 243.958, truncated to **243**, one day short. Every microlearning and group activity then lands **one calendar day earlier** than the intended offset — possibly before the course starts — plus the DST hour shift. Fix is one line: `Math.round(dayjs(startDate).diff(dayjs(oldCourse.startDate), 'day', true))` (or diff on `startOf('day')` in a fixed zone), plus a unit test spanning a DST boundary. Also covers legacy courses whose `startDate` carries a non-midnight time component.

**Verified correct:**

- Duration decomposition into years/months/days for the ICU message uses successive residual diffs (`getCourseDuplicationDurationParts`) — correct algorithm.
- The fixed-interval pairing is symmetric and self-consistent: changing start shifts end and group deadline by the same day deltas; changing end back-computes start (`updateDatesFromStartDate`/`updateDatesFromEndDate`). The group deadline is displayed read-only and always derived, so it cannot desynchronize.
- The NaN group-size regression is guarded (`getCourseDuplicationGroupSize` with source-course fallback, `CourseOverviewHeader.tsx:56-67`).
- `numSharedUsers = max(permissions − 1, 0)` on the returned course avoids negative counts (`courses.ts:3695`).
- Live-quiz `accessMode` restore and new PIN generation (`isPinProtected: !!oldLiveQuiz.pinCode` → fresh pin, never pin reuse) are correct; course `pinCode` is nulled only for SSO courses (`courses.ts:3644-3647`).

## 4. Permissions

This is the strongest dimension. The chain is layered and fail-closed:

1. Course-level ADMIN check **before any read**, then `recomputeDerivedPermissions` and a **re-check** (`courses.ts:3569-3583`) — closes the stale-derived-permissions window.
2. Per-activity ADMIN checks for every selected activity type via `checkAccess` (`getCourseDuplicationActivityAccessChecks`, `courses.ts:3377-3423`), which requires *all* checks to pass.
3. Per-element-instance check: every instance selected for copying must map to an element on which the user holds ADMIN/OWNER in the **derived** permission table (`assertCourseDuplicationInstanceAccess`, `courses.ts:3507-3541`). I verified `element.permissions` is `DerivedPermission[]` (deduplicated per-user rows that materialize user-group grants and ownership — `schema/element.prisma:52-53`, `sharing.prisma`), so group-shared elements are correctly honored; this matches the pre-existing convention in `splitActivityInstances` (`liveQuizzes.ts:96-113`).
4. Defense in depth inside the transaction: `splitActivityInstances` re-filters with the same predicate and `getActivityInstanceConnectOrCreate` **throws** if a required instance is missing (`elements.ts:428-430`) → full rollback, no silent partial copy. The pre-checks now throw a typed `GraphQLError` with a stable `extensions.code` (uncommitted) instead of string-matched `Error`s — good.
5. Atomicity: everything (course create, activity copies, permission copies, derived-permission recompute) runs in one interactive transaction with a 120 s timeout (`courses.ts:3605-3705`), with an E2E rollback test.
6. Auditability: every copied permission and the source-owner grant write `AuditLogEntry` rows and emit cache invalidations (`courses.ts:2953-2968`, `3006-3020`).
7. Sensible copy semantics: the duplicator's own permission row is skipped (they become OWNER), rows with neither user nor group are skipped, `upsert` for the source-owner grant avoids unique-constraint failures, and the resolver routes `createCourse(id: …)` through the guarded path under `asUserFullAccess` (`mutation.ts:1353-1357`).

**Open permission questions (product, not code):**

- The **source-owner ADMIN grant** on copies made by a non-owner admin is still undisclosed in the UI (prior item 12). It also means a course ADMIN can, by duplicating, mint themselves an OWNER-level object while the original owner drops to ADMIN on the copy — accepted in earlier reviews as intended for the MeF sharing model, but it must be confirmed and stated in `courseDuplicationCopyInfo`.
- Copied permissions preserve `permissionLevel` and `propagation` verbatim, including user-group grants. Anyone in those groups silently gains access to the new course; the info text covers this generically ("preserves direct sharing permissions") — adequate if sign-off on the previous point lands.

## 5. UX

Fixed since the last reviews: duplication-specific error toasts, success toast + redirect to the new course, in-progress hint, "Duplicate" submit label, localized duration. Remaining issues, roughly by impact:

1. **Accessibility regression from the native-input rewrite (`59c83d47d`).** `FormLabel` supports an `id` prop that becomes `htmlFor` (verified in `@uzh-bf/design-system` 4.1.6 source), but none of the new `FormikNative*` components pass it — the `useId()` values are set on the inputs and never referenced, so labels are not programmatically associated (screen readers, click-to-focus). Date inputs and the select have no `aria-label` fallback either. One-line fix per component: `<FormLabel id={inputId} …>`.
2. **Visual inconsistency.** The modal now mixes hand-rolled native date/color/select/checkbox inputs with design-system `FormikTextField`/`FormikNumberField`/`EditorField`, and looks different from `CourseManipulationModal` (its sibling flow, still fully design-system). The "switches" are now plain checkboxes with a faked `data-state` attribute kept only so existing tests pass. The native `<button>` lost the design-system loading spinner. If the rewrite was Sonar-motivated, that trade-off needs maintainer sign-off; extracting these primitives to `shared-components` or reverting to design-system components with the duplication logic factored out would both be better ends states.
3. **No warning when the copy ends in the past** (see § Didactics gap 2).
4. **Owner-grant disclosure** (see § Permissions).
5. Minor: the error area under the form renders only `errors.description` (`CourseDuplicationModal.tsx:934-939`) — a leftover; other field errors render inline, so either drop it or generalize it. The copy-name suffix is hardcoded English (`"… Copy"`, `getCourseDuplicationCopyName`) regardless of course language — trivially localizable. `de.ts` uses "anschließend" (ß) where the file predominantly uses Swiss "ss".

## 6. Code quality

**Good:** typechecks pass; the backend decomposition (`courseDuplicationInclude` + typed payloads, selection/checks/copy helpers, generic `copyMappedActivityPermissions`) is clean and much less repetitive than the four-way copy-paste the first review criticized; error handling is now typed via `extensions.code` with a defensive message-sniffing fallback; the modal's pure helpers (`getCourseDuplicationDateDefaults`, schema builders, notification builders) are unit-testable; the Playwright partial-failure test got `try/finally` cleanup and toast disambiguation (uncommitted).

**Issues:**

1. **~430 lines of generic form primitives live inside a feature modal** (`FormikNativeDateInput/ColorInput/Select/Switch`). If they stay, they belong in `packages/shared-components`; duplicating design-system functionality per-feature is the same disease the Sonar gate flagged, one layer down.
2. **Date identity comparison**: `values.groupCreationDeadline !== groupDeadlineDateInit` (`CourseDuplicationModal.tsx:314`) compares object references. It works today only because the initial value is the same object; changing start date and changing it back still flips the warning on. Compare timestamps (`+a !== +b` or `dayjs().isSame`).
3. **Fallback error sniffing** (`includes('not all')`, `includes('access')` in `CourseOverviewHeader.tsx:113-127`) is brittle against copy changes; now that the backend emits a typed code for partial failures, consider a code for the access path too and shrink the sniffing to a last resort.
4. **Test-fixture duplication** between `cypress/cypress.config.ts` and `playwright/util/fixtures/courses.ts` remains (~2.5k lines combined) — accepted during the migration, but every duplication-related fixture fix now happens twice (the uncommitted `createCourseDuplicationFailureFixture` fix touched only Playwright; check whether Cypress needs the same).
5. **Uncommitted state**: the working tree mixes feature work (error codes, test rework) with unrelated devcontainer/devrouter changes (`.devcontainer/devcontainer.json`, `docker-compose.devrouter.yml`). Split these into separate commits/PRs before review.
6. Success-path E2E still doesn't assert the redirect or success toast (the only place those two behaviors would be caught regressing).

## 7. Path to production — ordered checklist

1. **Commit and split the working tree**: feature changes (error code + tests) on the feature branch; devcontainer/devrouter tweaks separately.
2. **Fix the day-delta truncation** (`courses.ts:3243`, `Math.round(…, 'day', true)`) + a unit test across a DST boundary. Small, but it corrupts every shifted schedule for half-year duplications.
3. **Restore the documentation contract (mandatory per repo rules).** The duplication permission/reference semantics must be written into the `docs/` wiki (likely `domain-model.md` + a note in `graphql-api-layer.md`) — the former `CODEBASE_NOTES.md` entry is gone and the wiki has zero mention of duplication; the repo now requires wiki updates in the same PR as behavior changes. Add the lecturer-facing "what is copied / what is not" page under `apps/docs` (prior checklist item, still open).
4. **Push and clear the CI gates** with evidence: SonarCloud duplications view (confirm whether the modal rewrite + backend extraction moved the metric; only then decide about fixture extraction or `sonar.cpd.exclusions` — with maintainer sign-off), and GitGuardian triage of the exact flagged commit (false-positive marking or rotation + history rewrite).
5. **A11y + design-system decision**: wire `FormLabel id={inputId}` everywhere; get maintainer sign-off on native inputs vs. design-system components (or move the primitives to `shared-components`).
6. **Close the two product decisions** (one message to Roland/MeF): (a) source-owner ADMIN grant — confirm and add a sentence to `courseDuplicationCopyInfo`; (b) past-dated copies — confirm or add the past-end-date warning.
7. **Test additions**: assert success toast + `toHaveURL(/courses/{id})` after duplication; mirror the fixture cleanup fix in Cypress if applicable; (carry-over) `data-cy="live-quiz-display-name"` + cockpit assertion for PR #4953.
8. **Mandatory browser verification** (`npx agent-browser`, delegated login `lecturer`/`abcd`): duplicate the seeded Testkurs in **English and German**, screenshot the modal (checkbox styling, duration string, group-deadline output field), verify redirect + toast, copied DRAFT activities with shifted dates, empty results, untouched source, permission list on the copy. Verify the "dates can be changed afterwards" tooltip claim against a copy with shifted activities (prior item 13).
9. **Staging scale test**: duplicate the largest realistic course, time it against the 120 s transaction timeout; if it gets close, ticket a Hatchet background-job follow-up (do not extend the interactive transaction).
10. **Post-merge**: watch for `COURSE_DUPLICATION_PARTIAL_FAILURE` and transaction-timeout errors in backend logs during the first weeks.

## Processing update (2026-07-09, same session)

The locally fixable findings from this review were addressed after it was written:

- **Day-delta truncation (§ Computations)**: `deltaCourseStart` now uses `getCourseStartDayDelta` (exported from `courses.ts`), which rounds a float day diff instead of truncating. Covered by a new pure unit test `packages/graphql/test/courseDuplicationDates.test.ts` (5 tests, including the DST-boundary case reproduced in this review — all pass).
- **A11y label association (§ UX 1)**: all four `FormikNative*` components now pass `id={inputId}` to `FormLabel` (→ `htmlFor`); the read-only group-deadline `<output>` got a static id and matching label.
- **Past-end-date warning (§ Didactics gap 2 / UX 3)**: the modal now shows a warning notification (`courseDuplicationEndDateInPast`, both locales) whenever the copy's end date lies in the past.
- **Owner-ADMIN disclosure (§ Permissions / prior item 12)**: `courseDuplicationCopyInfo` now states in both locales that the original owner keeps administrative access to a copy created by somebody else. Product sign-off on the *behavior* is still advisable, but the UI no longer hides it.
- **Date identity comparison (§ Code quality 2)**: group-deadline warning now compares values via `dayjs().isSame` instead of object references.
- **Leftover `errors.description` block (§ UX 5)**: removed, along with the unused `errors` destructuring.
- **Hardcoded English " Copy" suffix (§ UX 5)**: localized via new `courseCopySuffix` key ('Copy'/'Kopie'); E2E defaults unaffected (suites run in English). The German "anschließend" was changed to Swiss "anschliessend".
- **Success-path E2E assertions (§ Code quality 6)**: the owner-duplication Playwright test now asserts the success toast text and the `/courses/{id}` redirect URL before visiting the course list.
- **Cypress fixture mirror (§ Code quality 4)**: `createCourseDuplicationFailureFixture` in `cypress/cypress.config.ts` now deletes stale activities together with the course, mirroring the Playwright fixture fix.
- **PR #4953 carry-over**: `data-cy="live-quiz-display-name"` added to the cockpit `LiveQuizTimeline.tsx` H4, plus a display-name assertion in the Playwright live-quiz cockpit flow (`O-live-quiz.spec.ts`).
- **Wiki regression (Path item 3)**: `docs/domain-model.md` gained a "Course duplication" section (permission contract, atomicity, shared elements, copied/not-copied lists, rounded date shifting), with a `docs/log.md` entry and timestamp bump. Lecturer-facing docs added to `apps/docs/docs/tutorials/course_management.mdx` ("How can I duplicate a course?").

Verification after processing: `pnpm --filter @klicker-uzh/{i18n,graphql,frontend-manage} check` all pass; `tsc --noEmit` passes in both `playwright/` and `cypress/`; the new unit test suite passes; Prettier applied to every touched file.

**Still open (not locally fixable):** staging scale timing, mandatory `agent-browser` browser verification in EN + DE (needs a running dev stack for this worktree), the design-system-vs-native-inputs maintainer decision, splitting the unrelated devcontainer changes out of the working tree, and formal product sign-off on the owner-ADMIN grant and past-dated-copy behaviors.

## CI-gate triage (2026-07-09, after push of `6de508471`)

### SonarCloud: 4.3% duplication on new code (gate ≤ 3%) — fixed locally

Exact breakdown from the SonarCloud API (102 duplicated / 2395 new lines):

| new dup | file | clone partner |
|---|---|---|
| 32 | `CourseDuplicationModal.tsx` | `CourseManipulationModal.tsx:291-322` (name/displayName/description block) |
| 31 + 31 | `en.ts` / `de.ts` | each other — the catalogs are whole-file structural clones (CPD anonymizes string literals), so **any** i18n addition counts as duplicated |
| 4 + 4 | `practiceQuizzes.ts` / `microLearning.ts` | the post-persist tail (`transactionPrisma` ternary + emitter + permission booleans) cloned across all four activity services |

Fixes applied (drops the metric to ~62/2440 ≈ 2.5%):

1. Extracted the shared name/displayName/description fields into `apps/frontend-manage/src/components/courses/modals/CourseInformationFields.tsx`, used by both `CourseDuplicationModal` and `CourseManipulationModal` — removes the 32-line clone and is a genuine dedup of the modal fork.
2. Extracted the identical post-persist tail of all four activity services into `packages/graphql/src/services/activities.ts:persistActivityWithPermissions` (persist in own transaction or reuse the provided transaction client, optional cache invalidation, permission-view derivation). `liveQuizzes`, `practiceQuizzes`, `microLearning`, and `groups` now share one implementation — removes the 8 counted lines and the four-way clone the earlier reviews called a maintenance smell.
3. The en/de 62 lines are structural and untouched: translation catalogs are parallel by design. **Recommendation for the maintainer:** add `sonar.cpd.exclusions=packages/i18n/messages/*.ts` to `sonar-project.properties` — otherwise every i18n-heavy PR will trip this gate. Not applied without sign-off (per the earlier review's ground rule).

### GitGuardian: "3 secrets uncovered" — false positives, dashboard triage required

All three findings are **dev-only credentials that entered this branch via `v3` merge commits** (`1af0602ca`, `cb7488c9e`) — nothing this branch authored, and all three are already public on the default branch:

| Incident | File | What it actually is |
|---|---|---|
| [26381906](https://dashboard.gitguardian.com/workspace/160640/incidents/26381906?occurrence=274704464) | `.agents/skills/agent-browser/templates/authenticated-session.sh` | commented-out login-flow template (env-var placeholders; historical blob had an example value) |
| [1509424](https://dashboard.gitguardian.com/workspace/160640/incidents/1509424?occurrence=278860626) | `.devrouter.yml:72` | a **comment** documenting the local dev psql connection string (`password=klicker`) |
| [1509424](https://dashboard.gitguardian.com/workspace/160640/incidents/1509424?occurrence=278860627) | `.devcontainer/docker-compose.yml:20` | `POSTGRES_PASSWORD: klicker` — the intentionally committed, dev-only devcontainer Postgres password (CLAUDE.md: "committed, dev-only — no real secrets") |

No rotation and no history rewrite is warranted (the content lives on `v3` mainline; rewriting this PR's history would change nothing). Remediation: open the two incidents in the GitGuardian dashboard and **mark them as test credentials / ignored**, then re-run the check from the PR. This needs dashboard permissions and cannot be done from the repo.

## Accepted for v1 (unchanged from previous reviews, still endorsed)

- Elements shared between source and copy (documented in the modal info box; must land in the wiki per item 3 above).
- Participants, groups, results, leaderboards, analytics not copied.
- Course duration locked to the source interval (paired date fields) as a correctness mechanism for activity offsets.
- Synchronous transaction-based implementation, contingent on the staging timing in item 9.
- Dual Cypress + Playwright coverage during the migration period.
