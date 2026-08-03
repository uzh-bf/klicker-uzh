# Review: Adaptive Learning (PR #5113)

**Scope:** full review of `feat(adaptive-learning): implement adaptive learning test` (branch `adaptive-learning`, 59 files, ~17k additions) covering didactics/psychometrics, computations, security, UX, code quality, and the path to production. First production use case: **placing students into Spanish language course levels (CEFR)**.

**Reviewer verdict (TL;DR):** The foundation is genuinely good — the IRT math in `packages/adaptive-learning` is correct, the layering (pure lib → GraphQL service → UI) is clean, and there is a simulation harness, which is more than most CAT implementations ship with. But the PR is **not safe to expose to real students yet**: correct answers are leakable through the GraphQL schema, saving an assessment silently destroys all student attempts, the ability estimate slams to the extreme (±3 → "C2"/"A1") after the very first answer, and the simulation that "validates" 70% placement accuracy tests a *different* level-assignment rule than production uses. All of these are fixable with modest effort; the prioritized plan is in [Part 4](#part-4--roadmap-to-production). A follow-up literature check on whether this approach is the right one for CEFR placement at all — classification vs. estimation stopping, estimator choice, what DIALANG/Linguaskill do, multistage testing as the alternative — is in [Part 5](#part-5--is-this-the-right-approach-literature-check); verdict: right architecture, keep it, with five evidence-backed roadmap adjustments (§5.7).

Everything below was verified against the actual branch code; each finding cites `file:line`. The verification commands and outputs are in the [Appendix](#appendix--how-this-was-verified).

---

## Part 1 — How the feature works (read this first)

For the junior picking this up, the 5-minute mental model:

1. **Lecturer side** (`apps/frontend-manage/.../adaptive-learning.tsx`): a lecturer defines an assessment for a course: *levels* (e.g., A1…C2), *competences* → *subcompetences* (e.g., Grammar → Verb tenses), and maps existing question-bank elements (SC/MC/KPRIM/FREE_TEXT) into the pool, assigning each one a level. Result messages (per level / theta interval / fallback) are configured, then the assessment is published.
2. **Item parameters** are *not* calibrated from data. Each item gets a 3-parameter-logistic (3PL) model where:
   - `b` (difficulty) = the theta anchor of its assigned **level** — levels are spread evenly over `[thetaMin, thetaMax]` (`packages/adaptive-learning/src/index.ts:81-107`, `packages/graphql/src/services/adaptiveLearning.ts:2141-2150`),
   - `a` (discrimination) = a global default with optional per-item override,
   - `c` (guessing) = derived from the question type (1/n for SC, 1/(2ⁿ−1) for MC, 1/2ⁿ for KPRIM, 0.01 for free text) (`index.ts:122-133`).
3. **Student side** (`apps/frontend-pwa/.../adaptive-learning.tsx`): starting an attempt picks the next question by (a) choosing the first non-stopped competence *in configured order*, (b) choosing the subcompetence with the most remaining level coverage, (c) picking the item with **maximum Fisher information** at the current subcompetence theta estimate (`services/adaptiveLearning.ts:2021-2114`). After each answer, theta is re-estimated per competence via Fisher-scoring maximum likelihood and aggregated with configured weights (`services/adaptiveLearning.ts:1824-1866`). A subcompetence stops when it hits its question cap, its SE threshold, or runs out of level coverage (`services/adaptiveLearning.ts:1936-1972`). When everything stops, the attempt is finalized and the theta is mapped to the nearest level anchor.
4. **Results**: students see level, theta, SE band, and per-competence bars; lecturers see distribution, per-student rows (BEST or LATEST attempt), and per-item stats (exposure, accuracy).

This is effectively a **level-staircase test with IRT bookkeeping**, not calibrated IRT: all items of the same level within a subcompetence are psychometrically identical (same `a`, `b`, `c` for the same type/choice count), so max-information selection reduces to "pick a random unanswered item from the most informative level". That is a legitimate pragmatic v1 design — but its validity rests entirely on lecturers assigning correct levels to items, which drives several recommendations below.

---

## Part 2 — Findings

Severity: 🔴 **critical** (blocks any real-student use) / 🟠 **major** (blocks the Spanish placement use case) / 🟡 **minor** (quality/polish).

### A. Security & data integrity

**A1 🔴 Correct answers are leakable to students through the GraphQL schema.**
The participant-guarded query `publishedAdaptiveAssessments` (`packages/graphql/src/schema/query.ts`, `asParticipant`) returns the full `AdaptiveAssessment` type, which exposes `elements[].element` (`packages/graphql/src/schema/adaptiveLearning.ts:108-131, 182`) — the *raw* `Element` including `options.choices[].correct` (`packages/graphql/src/schema/element.ts:579`) and free-text `solutions`. The sanitization in the service (`adaptiveAttemptElement`, `services/adaptiveLearning.ts:1244-1283`) is only applied to `nextElement`, never to `assessment.elements`. The same leak exists on `adaptiveAttemptState.assessment.elements` and on the `AdaptiveAttemptState` returned by `startAdaptiveAssessmentAttempt`/`submitAdaptiveAssessmentAnswer`. Any student can craft a query in devtools and download the full item pool **with solutions and level assignments**.
Note: the PWA never queries these fields (`packages/graphql/src/graphql/ops/QPublishedAdaptiveAssessments.graphql` uses the safe `publishedAdaptiveAssessmentInfos`; the attempt fragment only fetches `nextElement`), and `publishedAdaptiveAssessments` has **zero client usage** — it is pure attack surface.
*Fix:* delete the `publishedAdaptiveAssessments` query, and introduce a participant-facing assessment type **without** `elements` for `AdaptiveAttemptState` (or reuse the `PublishedAdaptiveAssessmentInfo` shape plus the display flags). Never expose `AdaptiveAssessmentElement` to participants.

**A2 🔴 No course-membership check on the published-assessment queries.**
`getPublishedAdaptiveAssessments` (`services/adaptiveLearning.ts:335-348`) does not call `requireCourseParticipation` — any logged-in participant of *any* course can read any course's assessment config (and, per A1, its solutions). `publishedAdaptiveAssessmentInfos` (`query.ts`, plain `t.field`) has **no auth guard at all** — unauthenticated callers can enumerate course IDs and read course names + assessment metadata (`services/adaptiveLearning.ts:350-381`).
*Fix:* `asParticipant` + `requireCourseParticipation(courseId, ctx)` on both.

**A3 🔴 Saving an assessment silently destroys all student data, non-atomically.**
`upsertAdaptiveAssessment` on an existing id issues `deleteMany` for **all responses, attempts, messages, elements, subcompetences, competences, levels** (`services/adaptiveLearning.ts:400-420`) inside transaction #1, then recreates the config in a **separate** transaction #2 (`:436`, `createAdaptiveAssessmentConfig` `:958-1068`). Consequences: (a) a lecturer fixing a typo in a result message mid-course wipes every student attempt with no warning — the manage UI has a plain Save button and no confirmation (`apps/frontend-manage/.../adaptive-learning.tsx:479-482`); (b) if transaction #2 throws (e.g., `Invalid adaptive item mapping`, `:1033`), the assessment is left published but stripped of levels/competences/elements *and* the attempts are already gone.
*Fix:* single transaction; and block (or explicitly confirm + version) structural edits once attempts exist. A published assessment with responses should be effectively immutable except for cosmetic fields.

**A4 🔴 Students can manipulate their placement by re-answering arbitrary items.**
`submitAdaptiveAssessmentAnswer` accepts **any** enabled `adaptiveElementId` of the assessment — it never checks that the submitted element is the currently selected next item, nor that it hasn't been answered before (`services/adaptiveLearning.ts:735-742`). There is no unique constraint on `(attemptId, adaptiveElementId)` (`packages/prisma/src/prisma/schema/adaptive.prisma:170-196` — only `(attemptId, order)` is unique). Because the estimate re-derives from all response records, repeatedly submitting a correct answer to the same easy A1 item drives theta (and the assigned course level) up. For a placement test this is a cheating vector requiring only devtools.
*Fix:* add `@@unique([attemptId, adaptiveElementId])` + server-side check that the submitted element equals the currently selected next element (return current state idempotently on retry of the same element), and wrap grade→insert→re-estimate→finalize in one transaction (currently split, `:759-825`, so concurrent submits race on `currentTheta`).

**A5 🟠 `showSolutions` is a production toggle that sends solutions before answering.**
The manage UI offers "Show solution during attempts" under "Testing options … for local testing only" (`apps/frontend-manage/.../adaptive-learning.tsx:1286-1310`). When enabled, the *unsanitized* element goes to the student before submission (`services/adaptiveLearning.ts:1244-1248`; rendered as a "Solution shown for testing" box, PWA `:879-895`). A lecturer who misreads this as "show solutions after answering" (the common expectation) exposes every answer.
*Fix:* remove it from the production UI (gate behind NODE_ENV/seed flag), or re-implement as post-answer feedback (see D2).

**A6 🟡 `Element` deletion cascades through adaptive history.** `AdaptiveAssessmentElement.element` and `AdaptiveAssessmentResponse.element` are `onDelete: Cascade` (`adaptive.prisma:118, 187`), so deleting a question-bank element silently deletes response rows from completed placements, corrupting stored attempt histories (thetaHistory no longer matches responses). Element deletion in KlickerUZH is usually soft (`isDeleted`), which mitigates, but the hard-cascade is still the wrong semantics for an audit-relevant assessment record. *Fix:* `Restrict` (or snapshot the needed element data onto the response).

### B. Computations / psychometrics

The core math is right — verified by hand and by running the suite: 3PL probability `c + (1−c)·logistic(a(θ−b))` (`index.ts:135-144`), the 3PL Fisher information `a²·(q/p)·((p−c)/(1−c))²` (`:146-158`), the Fisher-scoring update using score `(u−p)·P′/(p(1−p))` (`:203-231`), and inverse-variance aggregation (`:347-369`) are all textbook-correct. The problems are in how the service *uses* the lib:

**B1 🟠 Theta slams to the boundary after the first answer (verified empirically).**
With no prior, the MLE for an all-correct (or all-wrong) response pattern does not exist; the Fisher-scoring loop walks to the clamp. Measured on this branch: **one correct answer → θ = 3.00 (SE 7.4); one wrong answer → θ = −3.00** (see Appendix). Because the PWA displays the live theta, level badge and level band during the attempt (`apps/frontend-pwa/.../adaptive-learning.tsx:604-625`), a student who gets question 1 right is shown **"C2"**, then bounces around; item selection also ping-pongs to the extreme levels for the first few questions of every subcompetence. The lib already implements the fix — a MAP prior (`usePrior`, `priorMean`, `priorSD`, `index.ts:216-219`) — but the service never passes it (`estimateRecords`, `services/adaptiveLearning.ts:1798-1822`).
*Fix:* `usePrior: true, priorMean: initialTheta, priorSD: 1` (≈ standard N(0,1) Bayes-modal estimation; warm-start retakes with the previous final theta, which `initialThetaForAttempt` already provides). Add a regression test: after 1 response, |θ| must stay < 1.5. Re-run the simulation afterwards since this changes early routing.

**B2 🟠 The simulation validates a different system than the one shipped (verified).**
`packages/adaptive-learning/test/simulation.test.ts` is the only evidence of placement accuracy (70% exact, 95% adjacent) — but it differs from production in three load-bearing ways:
  1. **Level mapping**: the sim assigns the highest level whose anchor is ≤ θ (mastery/floor rule, `simulation.test.ts:360-368`); production assigns the *nearest* anchor (`mapThetaToLevel`, `index.ts:109-120`). Measured: θ = 0.3 → production says **B2**, sim says **B1** — a systematic ~half-level upward shift relative to what was validated.
  2. **Sequencing**: the sim interleaves competences round-robin per cycle (`:120-125`); production drains competence 1 fully before competence 2 ever starts (`selectNextAdaptiveElement` iterates competences in order and returns the first non-stopped one, `services/adaptiveLearning.ts:2044-2111`).
  3. **Stopping config**: sim uses cap 8 / SE 0.55 / a 1.5; production defaults are 50 / 0.4 / 1.5 (`index.ts:2-4`) and the manage-UI defaults are 5 / 0.3 / **1.2** (`apps/frontend-manage/.../adaptive-learning.tsx:143-146, 240-242`). Three inconsistent default sets; note SE 0.3 is mathematically unreachable under a 5-question cap (5 items at a=1.2 yield SE ≈ 0.6 at best), so the SE stop never fires with UI defaults.
*Fix:* decide the mapping **as a placement-policy decision** (for course placement, the mastery/floor rule is didactically safer — it assigns the level a student demonstrably clears, rather than rounding up); implement it in `mapThetaToLevel`; make the simulation exercise the *actual* service functions (`selectNextAdaptiveElement`, `isSubCompetenceStopped`, `buildOverallEstimateFromRecords`) instead of re-implementing them; align the three default sets with whatever the sim then validates.

**B3 🟠 The student-facing level band disagrees with the assigned level (verified).**
`mapLevelsToBands` in `packages/shared-components/src/adaptive/utils.ts:78-97` splits the theta range into **N equal-width bands**, while the backend derives **anchors at i/(N−1) with midpoint boundaries**. With 6 CEFR levels on [−3, 3]: backend boundary A1/A2 is −2.4, frontend draws it at −2.0. A student with θ = −2.2 gets badge "A2" (backend) while the marker on the band visualization sits inside "A1". Same component is used in the attempt view, the standing view, and the lecturer histogram (`AbilityHistogram`, `LevelBand`).
*Fix:* export a single band-edge function from `@klicker-uzh/adaptive-learning` (`mapLevelsToTheta` already computes `lowerBound`/`upperBound`) and use it in the shared components. Add a unit test asserting frontend edges == backend edges.

**B4 🟠 Dead configuration knobs mislead lecturers.**
- `topInformationRatio` is stored, defaulted, editable and persisted (`services/adaptiveLearning.ts:877-878`) but **never read** by item selection — `selectNextItem` is a pure argmax with random tie-break (`index.ts:319-345`). Either implement randomesque selection (pick uniformly among the top-k% information items — also your only exposure-control lever) or delete the field.
- Competence-level `questionThreshold`/`standardErrorThreshold` were added by migration `20260603110000`, are written (`services/adaptiveLearning.ts:982-983`) and edited in the UI, but the stopping logic reads only the **sub**competence/assessment values (`isSubCompetenceStopped`, `:1962-1965`; `isCompetenceStopped` checks nothing numeric, `:1901-1934`). Implement or remove.
- `AdaptiveAssessmentAttemptStatus.ABANDONED` exists in the enum (`adaptive.prisma:1-5`) but nothing anywhere sets it → stale `IN_PROGRESS` attempts accumulate forever and inflate the lecturer's "in progress" count (`services/adaptiveLearning.ts:546-551`). Add an expiry (e.g., mark abandoned after 24–48 h in the results query, or lazily on next start).

**B5 🟠 Free-text grading is lowercase-exact-match — wrong for Spanish.**
`gradeQuestionFreeText` lowercases and trims only (`packages/grading/src/index.ts:142-155`). `"esta" ≠ "está"`, `"adios" ≠ "adiós"`: students with correct knowledge but sloppy accents (or the wrong keyboard layout) are scored wrong on a *language placement* test, biasing placements down in a way that correlates with typing environment, not ability. The multi-line `<textarea>` (PWA `:570-576`) invites full-sentence answers that can never match a solution list.
*Fix:* for adaptive grading, normalize with NFD + strip combining marks (and consider punctuation trimming); use a single-line input with a hint about expected format; prefer SC/MC/KPRIM items for the pilot pool.

**B6 🟡 Aggregation notes (acceptable, but document them).** The overall score is a weighted mean of per-competence MLEs with variance Σw²σ² (`aggregateWeightedEstimates`, `index.ts:371-402`) — sound under independence. `elapsedSeconds` per response is cumulative wall-clock since `startedAt` (`services/adaptiveLearning.ts:757, 2250-2252`), so resumed attempts (close tab, return tomorrow) record days-long durations, the visible timer resumes at that value, and time-on-task analytics are unusable; store per-question deltas server-side instead. The class mean of clamped thetas is fine but should be labeled as attempt-conditional, not a population estimate.

### C. UX (student and lecturer)

**C1 🟠 KPRIM is rendered as a plain multi-select and can be submitted empty.**
KPRIM in KlickerUZH means "judge each of 4 statements true/false"; grading counts unchecked as "false" (`gradeAdaptiveAnswer`, `services/adaptiveLearning.ts:2187-2192`). The PWA renders generic checkboxes with no true/false semantics (`apps/frontend-pwa/.../adaptive-learning.tsx:522-568`) and `canSubmit` for KPRIM is `choices.length > 0` — i.e., **always true**, allowing a blank submission scored as "all false" (`:167-176`). Students cannot know that not ticking a box is an active "false" judgment.
*Fix:* reuse the existing student question components (`StudentElement`/choices renderers in `packages/shared-components`) which already handle KPRIM correctly, plus i18n, a11y and markdown; the custom renderer here is a maintenance fork.

**C2 🟠 Zero i18n in both new pages.** The repo is bilingual (DE/EN, `next-intl`); both pages hardcode English strings throughout (0 `useTranslations` hits in either file) even though the PWA page already loads the message bundle in `getServerSideProps` (`:967-977`). For a UZH language-course audience this is a launch blocker. *Fix:* move all strings to `packages/i18n` (both `de` and `en`) and use `useTranslations`, matching every other page.

**C3 🟠 No intro/consent screen; instant start; weak resume affordance.** Clicking an assessment card immediately starts the attempt (`onSelect` = select + start, PWA `:359-371`). A placement test should first show: purpose, expected length ("stops automatically, typically after ~N questions"), retake policy, and that you cannot go back. On return after closing the tab, the card just says "Start adaptive test" although it will resume — label it "Resume". Also: if the pool has no selectable first item, the attempt is created `IN_PROGRESS` but can never be finalized (finalization only happens inside submit, `services/adaptiveLearning.ts:786-825`) — the student sees "No further question is available" (`PWA:596-601`) forever; `startAdaptiveAssessmentAttempt` should finalize immediately when no element is selectable.

**C4 🟠 Live ability display during the test is didactically counterproductive.** Showing θ, the level badge and the SE band after every answer (PWA `:604-625`) invites anxiety and answer-gaming, and with B1 unfixed it shows absurd jumps ("C2" after one answer). Placement instruments (e.g., DIALANG-style tests) reveal the result at the end. *Fix:* hide the live estimate by default (show answered-count progress only); if you keep it, make it an assessment-level option (`showLiveEstimate`) and display the *level band* rather than raw theta. Related: `maxQuestions` = Σ subcompetence caps (`effectiveAttemptQuestionThreshold`, `services/adaptiveLearning.ts:1216-1242`) makes the progress bar a worst-case bound — misleading for an adaptive test that usually stops earlier; prefer "Question 12 · test stops automatically".

**C5 🟠 Lecturer results default to BEST attempt — wrong for placement.** `selectOverviewAttempt` defaults to the highest `finalTheta` (`services/adaptiveLearning.ts:1384-1400`, default `BEST` at `:508`), and retakes may repeat identical items (exclusion is per-attempt only), so motivated students retake until variance places them a level up. For placement, default to LATEST (or first completed), keep BEST as an explicit toggle, and consider a retake cooldown/limit per assessment.

**C6 🟡 Manage-page workflow gaps.** No confirmation on Save (see A3) or Archive (irreversible: sets `isDeleted`, no unarchive path, `services/adaptiveLearning.ts:458-470`); no unsaved-changes guard when switching assessments in the dropdown (form state simply replaced, `:353-359`); question-bank picker caps at 200 elements with no pagination or "more results" hint (`:286-296`); Publish runs no pool-coverage validation (an enabled subcompetence with zero items is silently "stopped" instantly — combined with C3 this can produce 0-question "completed" placements). A "readiness check" panel before publish (items per subcompetence × level matrix — the data already exists via `adaptiveAssessmentItemPoolPreview`) would prevent most misconfigurations.

**C7 🟡 UI polish/consistency.** The manage page is a 3,679-line single file with ~30 inline components including hand-rolled `TextInput`/`NumberInput`/`Select`/`IconButton` (`:2771-2848`) instead of `@uzh-bf/design-system` + Formik used everywhere else in `frontend-manage`; tab labeled "Algorithm (3PL)" leaks psychometric jargon at lecturers; zero `data-cy`/`data-test` attributes in either page (repo E2E conventions); PWA shows internal element IDs to students ("Q-482", PWA `:507-509`); auth failure detection by `message.includes('Unauthorized')` (`:213`) is brittle; "Unstarted" shown as the level for a completed-but-empty standing (`:715`).

### D. Didactics for the Spanish placement use case

**D1 🟠 Validity rests on un-calibrated, lecturer-assigned difficulty.** Since `b` = level anchor, a mis-leveled item systematically distorts theta in its subcompetence, and nothing currently detects this. The per-item accuracy/exposure dashboard (`buildItemResults`, `services/adaptiveLearning.ts:1733-1784`) is the right foundation: add the *expected* accuracy at the cohort's mean theta next to observed accuracy, flag items that deviate (e.g., |obs − exp| > 0.25 with n ≥ 20) for re-leveling. Plan a **pilot calibration pass**: run the test with students of known level (last year's placements), check per-item difficulty ordering, re-level outliers before the real placement round. Long-term: estimate empirical `b` from response data (even a simple logistic regression per item) and compare against anchors.

**D2 🟡 "Learning" goal is not yet served.** The stated goal includes *learning*, but the flow is pure assessment: no per-answer feedback (correct/incorrect + explanation — the `Element.explanation` field already exists), and the final "Focus next on X" recommendation links only to generic practice quizzes (PWA `:800-823`). A post-answer feedback mode (server-side reveal *after* grading — the safe version of A5's `showSolutions`) and per-subcompetence practice links would make retakes genuinely formative.

**D3 🟡 Level semantics to settle with the language-course team (policy, not code):** (a) equidistant CEFR anchors on [−3,3] are an assumption — fine to start, but the cut interpretation should be sanity-checked against teacher judgment of a pilot cohort (standard setting); (b) mastery vs. nearest mapping (B2) is the "when in doubt, place down vs. up" decision — placing down is usually cheaper pedagogically (students can be moved up after week 1); (c) define the official attempt policy (first attempt counts? latest? cooldown?) and state it on the intro screen; (d) item-pool sizing guidance for authors: ≥5 items per subcompetence × level (the simulation assumed exactly 5), with items written to *level boundaries* being the most informative for placement decisions.

### E. Code quality & repo conventions

- 🟡 **Tests**: lib unit tests are happy-path only — no test for the all-correct/all-wrong boundary behavior (B1), none for `updateTheta` with prior, none for `mapLevelsToTheta` boundary edges; the **service layer (2,252 lines) has zero tests** even though `packages/graphql/test/` has an established vitest+DB harness; no Cypress/Playwright spec touches the new pages.
- 🟡 **Diff hygiene**: `sharing.prisma` (700 lines), `resources.prisma`, `user.prisma`, `chat.prisma` changes are almost entirely re-indentation churn that inflates the review surface — worth a `prisma format` on `v3` separately. Three migrations for one PR should be squashed into one before merge (feature branch, nothing deployed).
- 🟡 **Docs**: no entry in `apps/docs`, no lecturer-facing explanation of levels/thresholds; `AGENTS.md` got a useful learnings entry (good).
- ✅ Typecheck passes (`pnpm --filter @klicker-uzh/graphql check` → 0 errors after building deps), lib tests pass (15/15), lockfile is in sync (`pnpm install --frozen-lockfile` OK), codegen artifacts are committed, migrations are purely additive (safe on existing data), lecturer-side resolvers consistently enforce `requireCourseOwner`, and the seed ships a complete English CEFR example (`packages/prisma-data/src/data/seedTEST.ts`) usable for local testing with `testuser1…50`.

---

## Part 3 — What is good (keep it)

- The pure-function lib with dependency-injected `random` is well designed and the 3PL math (probability, information, Fisher scoring, inverse-variance pooling) is **correct** — verified independently.
- Existence of a seeded, deterministic **simulation harness** is the right instinct; it just needs to target the production code path (B2).
- Prisma schema is well-normalized with sensible unique constraints on the config tables and correct indexes for the attempt lookup paths.
- Clean split: lib → service → thin resolvers; participant ownership checks on attempt state/standing are done correctly (`services/adaptiveLearning.ts:704, 728, 605`).
- Snapshotting `thetaBefore/After`, `standardErrorAfter` per response gives a full audit trail for later calibration — exactly what D1 needs.

---

## Part 4 — Roadmap to production

Ordered; each step has an acceptance check a junior can verify. Steps within a phase are independent unless noted.

### Phase 0 — Safety (before any student touches it, including pilots)

1. **Close the solution leaks (A1, A2).** Delete the unused `publishedAdaptiveAssessments` query; add a `ParticipantAdaptiveAssessment` type without `elements`; use it in `AdaptiveAttemptState`; add `requireCourseParticipation` to `getPublishedAdaptiveAssessmentInfos` and guard it `asParticipant`. Regenerate ops (`pnpm --filter @klicker-uzh/graphql generate`).
   *Check:* as `testuser1`, a handcrafted query for `adaptiveAttemptState { assessment { elements { element { ... } } } }` is a GraphQL validation error; the PWA flow still works end-to-end.
2. **Make upsert safe (A3).** Merge config deletion+creation into one `$transaction`; refuse structural edits (competences/levels/elements) when `attempts.count > 0` unless a new `force` arg is passed; manage UI shows a destructive-action modal ("This deletes N student attempts") before sending `force`.
   *Check:* saving a published assessment with attempts without confirmation → error surfaced in UI, attempts intact; with confirmation → wiped as warned. Kill the process between the two former transactions is no longer possible (single transaction).
3. **Lock down submission (A4).** Add `@@unique([attemptId, adaptiveElementId])` (+ migration); in `submitAdaptiveAssessmentAnswer`, reject elements ≠ current `selectNextAdaptiveElement(attempt)?.id` (idempotent success for a retry of the just-answered element); wrap grade→insert→estimate→update/finalize in one transaction.
   *Check:* new service-level vitest: submitting the same element twice → second returns state unchanged; submitting a non-selected element → error.
4. **Remove `showSolutions` from the lecturer UI (A5)** or gate it to non-production; keep the flag for the seed/E2E.
   *Check:* checkbox gone in prod build; seed assessment still usable for E2E.

### Phase 1 — Measurement correctness (before the Spanish pilot)

5. **MAP estimation (B1).** Pass `usePrior: true, priorMean: initialTheta, priorSD: 1` in `estimateRecords`; add lib regression tests (1 correct → |θ| < 1.5; 1 wrong → symmetric).
6. **One level-mapping rule (B2).** Decide with the course team (recommendation: mastery/floor for placement); implement in `mapThetaToLevel`; delete the sim's private `mapMasteryThetaToLevel`.
7. **Make the simulation test production code (B2).** Refactor `selectNextAdaptiveElement` / stopping helpers to accept plain data (they nearly do) and drive the simulation through them with the *shipped* defaults; re-baseline exact/adjacent accuracy and, new, **mean test length** — assert ≤ some agreed max (e.g., 60 questions).
8. **Fix the band mismatch (B3).** Compute band edges in the lib; consume them in `LevelBand`/`AbilityHistogram`/`mapLevelsToBands`; unit test equality with backend boundaries.
9. **Reconcile defaults (B4/B2-3).** One blessed set (suggestion pending sim re-run: per-subcompetence cap 8, SE 0.55, a 1.5, per-assessment total cap ~60) applied in lib constants, Prisma defaults, and manage-UI defaults; delete `topInformationRatio` and competence-level thresholds or implement them (randomesque top-k selection is worth implementing — it is also the exposure-control mechanism).
10. **Accent-insensitive free-text grading (B5)** in the adaptive path (NFD-normalize, strip diacritics, collapse whitespace) + tests with Spanish examples; switch the PWA to a single-line input.

### Phase 2 — UX & platform readiness

11. **Reuse shared question components (C1)** for SC/MC/KPRIM/FT rendering in the PWA page; KPRIM gets true/false rows and requires explicit judgment for every statement before submit.
12. **i18n (C2)**: extract all strings in both pages to `packages/i18n` (DE + EN).
13. **Intro screen + resume + completion fixes (C3, C4)**: pre-start screen (purpose, length expectation, retake policy, "no going back"); "Resume" label on in-progress attempts; finalize-on-start when no item is selectable; hide live theta/level by default; progress shows count, not a fake denominator.
14. **Placement-safe results defaults (C5)**: default `LATEST`, label the toggle; add attempt-expiry job or lazy `ABANDONED` marking (B4); optional retake cooldown field.
15. **Manage hardening (C6/C7)**: publish-time readiness check (items per subcompetence×level, warn on gaps); confirmation modals; unsaved-changes guard; split the page into `components/adaptive/` modules; replace hand-rolled inputs with design-system + Formik; add `data-cy` attributes.
16. **Tests**: service-level vitest for start/submit/finalize/auth paths (harness exists in `packages/graphql/test`); one Cypress or Playwright happy-path spec (lecturer creates+publishes from seed, student completes, both see results). Docs page in `apps/docs` for lecturers.

### Phase 3 — Spanish pilot & calibration (didactics)

17. **Author the Spanish pool** to the sizing guidance (≥5 items per subcompetence × level; boundary-targeted items preferred; SC/MC/KPRIM over free text).
18. **Dry-run with known-level students** (or last cohort volunteers): compare assigned vs. teacher-judged levels; standard-setting session on the boundaries; re-level items flagged by the misfit view (add expected-vs-observed accuracy column, D1).
19. **Go/no-go criteria** for real placement: exact-match ≥ 70% and adjacent ≥ 95% against teacher judgment on the pilot (mirroring the sim baseline), median test length ≤ 25 min, no item with exposure > 40% of attempts (after randomesque selection).
20. **During the real run:** results-page performance guard — precompute/persist per-attempt competence estimates at finalization instead of recomputing every dashboard load (`getAdaptiveAssessmentResults` currently loads *all* participations × attempts × responses × element JSON and re-runs IRT per request, `services/adaptiveLearning.ts:505-587`); fine for a pilot course, not for hundreds of students.

---

## Part 5 — Is this the right approach? (literature check)

Follow-up question after the code review: is an item-level, 3PL, maximum-information CAT with lecturer-assigned level difficulties actually the right instrument for assigning CEFR levels in a Spanish course — or should it have been built differently? Short answer: **the architecture is defensible and has real-world precedent, and nothing found here requires a rebuild.** But the literature reframes three things: (a) placement is a *classification* problem, and classification tests stop differently than measurement tests; (b) the estimator the service uses (unprimed MLE) is the one option operational CATs avoid — the B1 fix is not just a bug fix, it is alignment with standard practice; (c) expert level assignment is the weakest link, and the field has cheap, validated remedies. Sources below were retrieved via literature search (scite) and web lookup; citations in the [References](#references).

### 5.1 Placement is classification, not estimation

The current design stops when the standard error of θ falls below a threshold — a *measurement* criterion. But the product goal is to put a student into one of six CEFR levels: a *classification* decision. There is a dedicated literature on computerized classification testing (CCT) whose stopping rules target the decision directly — sequential probability ratio tests (SPRT) between adjacent categories and confidence-interval rules that stop once the classification is settled (Eggen, 2011; Nydick, 2014), including stopping rules designed specifically for **multi-category** decisions like a six-level CEFR scale (Wang, Chen, & Huebner, 2021). The practical point: a student can be confidently "B1" long before the SE threshold fires (their interval sits fully inside one band), and conversely an SE-based stop can fire while the student sits exactly on a boundary — the one place where more questions would actually change the outcome.

**Concrete, low-cost adoption** (no rebuild): keep the existing machinery and add a classification-aware stop to `isSubCompetenceStopped` — stop when the interval `θ̂ ± z·SE` lies entirely within a single level band (a confidence-interval CCT rule), and *don't* stop on SE alone while θ̂ is within a small margin of a boundary (up to the question cap). This typically shortens clearly-placed students' tests and lengthens borderline ones — exactly the right trade for placement. A refinement worth knowing about but optional here: CCT selects items for information *at the cut score* rather than at θ̂; because this design's item difficulties sit on level anchors flanking each boundary, max-information-at-θ̂ already approximates that.

### 5.2 Estimator choice: unprimed MLE is the one option the literature advises against

The comparison study for ability estimators in CAT (MLE vs. weighted-likelihood vs. Bayesian EAP/MAP) is Wang and Vispoel (1998). The failure measured in B1 — MLE undefined for all-correct/all-wrong patterns, so the algorithm walks to the clamp — is the textbook reason operational CATs use a Bayesian estimator (EAP/MAP) or Warm's weighted likelihood estimator (WLE) instead; WLE specifically corrects MLE's bias and its precision in CAT settings is well studied (Wang & Wang, 2001). This *endorses* the Phase 1 plan (B1: MAP via the lib's existing `usePrior`) and adds one nuance: consider reporting the **final** score from a WLE or MAP with a weak prior (SD ≈ 1.5–2) so the prior doesn't pull long tests toward the mean, while using the stronger prior early for routing. The open-source `catR` package implements all of these estimators and selection rules (Magis & Raîche, 2012) — use it as an independent cross-check of the simulation (same item parameters in, compare θ trajectories out), which also de-risks the home-grown implementation.

### 5.3 What established CEFR instruments do

- **DIALANG** — the reference CEFR diagnostic suite, built directly on the Framework (Alderson & Huhta, 2005) — does not cold-start item-level adaptation from zero. It routes learners with a **vocabulary-size placement test plus CEFR "can-do" self-assessment statements** to an appropriately difficult test version, and reveals results **after** the test. Two takeaways map straight onto findings here: a 30-second self-placement step is a validated, cheap warm start (feed it into `initialTheta`/`priorMean` — strictly better than starting every competence at θ=0), and end-of-test result reveal is the established pattern (supports C4's "hide live theta").
- **Linguaskill (Cambridge)** — an operational CEFR-reporting test — is adaptive with variable length: "The Reading module is adaptive, meaning the number of questions presented to candidates and the duration of the module varies … The test finishes when the candidate has answered enough questions for Linguaskill to identify their level accurately" (Wikipedia, n.d.). So item-level adaptivity with a "stop when the level is identified" rule (§5.1) is exactly how a major operational CEFR test behaves — precedent for this PR's overall shape.

### 5.4 Multistage testing: the alternative design — and why not switching is fine

The standard alternative to item-level CAT is **multistage testing** (MST): pre-assembled item modules with routing between stages, valued operationally because test forms are reviewable in advance, content balance is guaranteed by construction, and QA is far simpler (Hendrickson, 2007). With *uncalibrated* items — this PR's situation — MST's advantages are real: nothing hinges on per-item parameters being right. However, note what this PR actually built: since all items of a level are psychometrically identical (Part 1), the "CAT" already behaves like a level-staircase — effectively an MST whose modules are single items, with routing after every response. That means the practical benefits of MST (predictable, explainable behavior; robustness to calibration error) are largely already present, and the CAT superstructure becomes genuinely superior the moment empirical calibration lands (D1 long-term). **Verdict: keep the current design; don't rebuild as MST** — but use the MST lens for QA: enumerate the reachable "routes" (level sequences) per subcompetence and eyeball them with the course team, exactly as MST panels are reviewed.

### 5.5 Expert-assigned difficulty: the literature backs the calibration plan — and offers a cheaper leveling method

The design's validity rests on lecturers assigning correct levels (= difficulties) to items (D1). Measurement research treats absolute expert judgments of item difficulty as noisy, and has explored **comparative judgment** — experts *rank pairs* of items by difficulty rather than rating each in isolation — as the more reliable way to get difficulty estimates out of humans (Attali, Saldivia, Jackson, Schuppan, & Wanamaker, 2014). Two applications for Phase 3: (1) when building the Spanish pool, have two or more lecturers independently level the items and reconcile disagreements (disagreement = flag for the pilot); (2) for contested items, pairwise "which is harder?" comparisons are quicker and more reliable than re-rating. This complements, not replaces, the empirical misfit detection already planned in D1.

### 5.6 Exposure control

Unconstrained maximum-information selection concentrates usage on a few items; exposure-control methods (randomesque top-k selection, Sympson–Hetter and relatives) are a standard CAT component with well-studied trade-offs (Lee & Dodd, 2012). In this design the same-level items are interchangeable, so the random tie-break already spreads exposure *within* a level — the residual risk is small pools making individual items predictable between friends taking the test in sequence. Implementing `topInformationRatio` as randomesque selection (B4) is the standard, sufficient answer for these stakes; nothing heavier (Sympson–Hetter) is warranted.

### 5.7 Implications for the roadmap (deltas to Part 4)

1. **Phase 1, extend step 5 (B1/MAP):** use the strong prior (SD 1) during the attempt for routing; for the **final reported** theta, use a weak prior (SD ≈ 2) or WLE so long attempts aren't shrunk toward the mean. Add a comment documenting the choice.
2. **Phase 1, new step 7b:** add a classification-aware stop (§5.1): stop a subcompetence early when `θ̂ ± 1.28·SE` (~80% interval — tune on the sim) lies inside one level band; do not SE-stop within a margin of a band boundary. Re-baseline the simulation for accuracy *and* mean length — expect shorter tests at equal accuracy.
3. **Phase 1, extend step 7 (simulation):** cross-validate the simulation against `catR` (same parameters, compare trajectories/placements) as an independent implementation check (§5.2).
4. **Phase 2, extend step 13 (intro screen):** add an optional 6-statement CEFR self-assessment ("can-do" checkboxes) on the intro screen; map the result to `initialTheta` (DIALANG precedent, §5.3). Small UI, meaningful cold-start improvement — and it doubles as the intro/expectation-setting screen C3 wants anyway.
5. **Phase 3, extend steps 17–18:** pool authoring uses ≥2 independent levelers with reconciliation; contested items resolved by pairwise comparison (§5.5). Keep the empirical misfit column from D1 as the ground truth.
6. **No change:** don't rebuild as MST (§5.4); don't implement heavyweight exposure control (§5.6) — randomesque top-k from B4 suffices.

### References

- Alderson, J. C., & Huhta, A. (2005). The development of a suite of computer-based diagnostic tests based on the Common European Framework. *Language Testing, 22*(3), 301–320. https://doi.org/10.1191/0265532205lt310oa
- Attali, Y., Saldivia, L., Jackson, C., Schuppan, F., & Wanamaker, W. (2014). Estimating item difficulty with comparative judgments. *ETS Research Report Series, 2014*(2), 1–8. https://doi.org/10.1002/ets2.12042
- Eggen, T. J. H. M. (2011). Computerized classification testing with the Rasch model. *Educational Research and Evaluation, 17*(5), 361–371. https://doi.org/10.1080/13803611.2011.630528
- Hendrickson, A. (2007). An NCME instructional module on multistage testing. *Educational Measurement: Issues and Practice, 26*(2), 44–52. https://doi.org/10.1111/j.1745-3992.2007.00093.x
- Lee, H., & Dodd, B. G. (2012). Comparison of exposure controls, item pool characteristics, and population distributions for CAT using the partial credit model. *Educational and Psychological Measurement, 72*(1), 159–175. https://doi.org/10.1177/0013164411411296
- Magis, D., & Raîche, G. (2012). Random generation of response patterns under computerized adaptive testing with the R package catR. *Journal of Statistical Software, 48*(8). https://doi.org/10.18637/jss.v048.i08
- Nydick, S. W. (2014). The sequential probability ratio test and binary item response models. *Journal of Educational and Behavioral Statistics, 39*(3), 203–230. https://doi.org/10.3102/1076998614524824
- Wang, C., Chen, P., & Huebner, A. (2021). Stopping rules for multi-category computerized classification testing. *British Journal of Mathematical and Statistical Psychology, 74*(2), 184–202. https://doi.org/10.1111/bmsp.12202
- Wang, S., & Wang, T. (2001). Precision of Warm's weighted likelihood estimates for a polytomous model in computerized adaptive testing. *Applied Psychological Measurement, 25*(4), 317–331. https://doi.org/10.1177/01466210122032163
- Wang, T., & Vispoel, W. P. (1998). Properties of ability estimation methods in computerized adaptive testing. *Journal of Educational Measurement, 35*(2), 109–135. https://doi.org/10.1111/j.1745-3984.1998.tb00530.x
- Wikipedia. (n.d.). Linguaskill. Retrieved July 7, 2026, from https://en.wikipedia.org/wiki/Linguaskill

---

## Appendix — How this was verified

Environment: branch `adaptive-learning` (head `1b2b4684d`), `pnpm install --frozen-lockfile` ✅, `turbo run build --filter=@klicker-uzh/graphql...` ✅.

- `pnpm --filter @klicker-uzh/adaptive-learning test` → 15/15 pass.
- `pnpm --filter @klicker-uzh/graphql check` → 0 errors.
- **B1 measurement** (temporary vitest against `packages/adaptive-learning/src`):
  `updateTheta({responses:[{item:{a:1.5,b:0,c:0.25},correct:true}]})` → `{ theta: 3, standardError: 7.395 }`;
  same with `correct:false` → `{ theta: -3, standardError: 35.8 }`;
  same with `usePrior:true, priorSD:1` → `{ theta: 0.361, standardError: 1.709 }`.
- **B2 measurement**: for 6 CEFR levels on [−3,3], θ = 0.3 → `mapThetaToLevel` = **B2**, simulation's mastery rule = **B1**.
- **B3**: backend A1/A2 boundary = −2.4 (midpoint of anchors −3 and −1.8); `mapLevelsToBands` draws it at −2.0 (equal sixths). Overlap zone [−2.4, −2.0) renders badge A2 with marker in the A1 band.
- Leak paths (A1/A2) verified by reading the Pothos type graph: `AdaptiveAttemptState.assessment → AdaptiveAssessment.elements → AdaptiveAssessmentElement.element → ChoicesElement.options.choices.correct` (`schema/element.ts:579`) with no participant-side sanitization on that path; `grep -rn "publishedAdaptiveAssessments\b"` (excluding `Infos`) → no client usage.
- Dead knobs: `grep -n topInformationRatio packages/graphql/src/services` → only write-side hits (`:877`); `grep -rn ABANDONED` in source (excluding generated ops) → no hits.
