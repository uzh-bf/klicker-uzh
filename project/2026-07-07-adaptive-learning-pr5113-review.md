# Review — PR #5113 "feat(adaptive-learning): implement adaptive learning test"

**Reviewed commit:** `1b2b4684d` (branch `adaptive-learning`, diffed against `v3`; 59 files, ~17.4k insertions)
**Review date:** 2026-07-07
**Reviewer:** Claude (independent review pass over psychometrics/didactics, computations, backend integrity/authz, UX, quality, and production readiness)

> **Note:** a second independent review, `project/REVIEW-adaptive-learning-pr5113.md`, was pushed to this branch in parallel. The two overlap heavily and agree on all shared findings; where one is sharper, this file cross-references it (notably its A1/A2 on the unused `publishedAdaptiveAssessments` query — folded into F28 below — and its B1 boundary-slam finding — F34 below, both re-verified in code). Work from the union; the §5 ordering here already covers both.

---

## 1. Verdict

Ambitious and, at its core, technically credible: a real 3PL-IRT computerized-adaptive-testing engine with correct textbook math, competence/sub-competence structure, warm-started retakes, a genuinely formative student results screen, and a simulation test that validates ability recovery. This is far beyond a toy.

**Not production-ready.** CI is red (build-order), the branch conflicts with `v3`, every lecturer edit silently destroys all student attempts, the submit endpoint accepts answers for items that were never served (assessment-integrity hole), the attempt-state GraphQL type can expose the full answer key for every item in the assessment (currently held back only by client fragment shape and the prod persisted-operations allowlist — F28), lecturers can attach *any* element in the system, including other lecturers' private questions, to their assessment (F29), and both new pages ship 160+ hardcoded English strings with zero i18n at a German-speaking university. The psychometrics also need honest labeling: item parameters are author-assigned, not calibrated, so this is adaptive *practice*, not defensible adaptive *assessment* — the UI should say so. Section 5 is the ordered path to done.

---

## 2. What the feature actually is (for reviewers new to it)

- **Model:** 3-parameter-logistic IRT (`packages/adaptive-learning/src/index.ts`). Discrimination `a` defaults to 1.5 (assessment-level override, per-item override); difficulty `b` = the theta of the level the lecturer assigned the item to (levels equally spaced in `[thetaMin, thetaMax]`, default `[-3, 3]`); guessing `c` derived from item type (SC: 1/choices, MC: 1/(2^n−1), KPRIM: 1/2^n, FREE_TEXT: 0.01) — `deriveGuessingParameter`, `index.ts:122-133`.
- **Ability estimation:** Newton-Raphson MLE (optional MAP prior), clamped to the theta range (`updateTheta`, `index.ts:172-240`). Verified against the standard 3PL score function and Fisher information formula — the math is correct, including the `a²·(q/p)·((p−c)/(1−c))²` information term (`index.ts:146-158`) and the 3PL derivative (`index.ts:515-525`).
- **Item selection:** maximum information at current theta, random only among exact ties (`selectNextItem`, `index.ts:319-345`); sub-competence chosen by coverage-weighted argmax.
- **Stopping:** per-sub-competence, question count ≥ threshold (default 50) OR standard error ≤ threshold (default 0.4) (`shouldStop`, `index.ts:252-267`); attempt completes when all enabled sub-competences stop.
- **Grading:** delegates to `@klicker-uzh/grading` (same functions as the product) and dichotomizes at full score (`gradeAdaptiveAnswer`, `services/adaptiveLearning.ts:2158-2213`). Internally consistent with the all-or-nothing guessing parameters.
- **Retakes:** unlimited; new attempts warm-start from the previous final theta (`startAdaptiveAssessmentAttempt`, `services/adaptiveLearning.ts:654-678`).
- **Surfaces:** lecturer config + results page (`apps/frontend-manage/.../adaptive-learning.tsx`, 3,679 lines), student runner + standing page (`apps/frontend-pwa/.../adaptive-learning.tsx`, 1,001 lines), 7 shared chart/badge components, 8 Prisma models, 11 GraphQL ops.

---

## 3. What was verified as correct (don't re-flag)

| Area | Evidence |
| --- | --- |
| 3PL probability / information / derivative math | `packages/adaptive-learning/src/index.ts:135-158, 515-525` — matches textbook formulas; boundary cases guarded by clamping + EPSILON. |
| Simulation test is real validation, not smoke | `packages/adaptive-learning/test/simulation.test.ts:47-86` — CEFR simulation asserts ≥70% exact level recovery, ≥95% adjacent, MAE ≤ 0.35 levels. |
| Grading consistency with the product | `services/adaptiveLearning.ts:2158-2213` reuses `gradeQuestionSC/MC/KPRIM/FreeText` from `@klicker-uzh/grading` — analytics can never disagree with product scoring. |
| Answer/solution stripping for in-progress items | `adaptiveAttemptElement`, `services/adaptiveLearning.ts:1244-1283` — removes `correct` flags and FREE_TEXT `solutions` unless `showSolutions`. |
| Resolver-layer auth wiring | All lecturer ops `asUser` + `requireCourseOwner`, all participant ops `asParticipant` + `requireCourseParticipation`/`participantId` ownership check (`query.ts:196-301`, `mutation.ts:227-291`, `services/adaptiveLearning.ts:308-341, 388, 605, 637, 704, 728`). Publication status checked before participant access (`:597-603, :629-635`). Cross-participant attempt access blocked identically in `getAdaptiveAttemptState` and submit; submitting to a COMPLETED attempt is a safe no-op. **Gaps: element ownership at config time (F29); no membership check on `getPublishedAdaptiveAssessments` (F28a).** |
| Migrations & schema diffs | All 3 migrations replay cleanly in order and match `adaptive.prisma` model-for-model; no destructive ops on pre-existing tables. Changes to `course/element/participant/user.prisma` are purely additive back-relations; the large `resources.prisma`/`sharing.prisma` diffs are 100% whitespace (`git diff -w` is empty). |
| No SQL-injection surface | No raw SQL / string-concatenated queries anywhere in `services/adaptiveLearning.ts`; grading always server-computed from DB-fetched options, never trusting client solution data. |
| Participant PII scoping | `participantEmail` in results is only reachable via the course-owner-gated `adaptiveAssessmentResults` query. `publishedAdaptiveAssessmentInfos` is intentionally unauthenticated but metadata-only, matching the existing `getCoursePublishedPracticeQuizzes` convention. |
| Attempt resume | `startAdaptiveAssessmentAttempt:641-652` returns the existing IN_PROGRESS attempt — no student data loss on refresh/interruption (frontend signal missing, see F14). |
| Student results screen is formative | Plain-language theta explanation, error interval, per-competence bars, weakest-competence "focus next" nudge, practice CTA (PWA page `:643-694, 791-812`). Genuinely good didactic design. |
| Warm-start retakes | Didactically sensible: faster convergence, continuity of the ability estimate across attempts. |
| Config validation on save | Enabled-structure validation (`index.ts:467-498`), weight rebalancing, result-message interval overlap checks on the manage page. |

---

## 4. Findings

Severity: **[B] blocker before merge · [M] major, fix before real courses use it · [m] minor/follow-up.**
(Numbering note: F28–F34 come from a second, security-focused backend pass plus cross-checks against the parallel review; they are filed where they belong topically, so numbers are not globally sequential across sections.)

### 4.1 Build, CI, process

**F1 [B] — CI red: `@klicker-uzh/adaptive-learning` never built before graphql codegen.**
`check` and `test` jobs fail with `Cannot find module '.../@klicker-uzh/adaptive-learning/dist/index.js'`. Root cause: `.github/workflows/check-types.yml:38-51` (and the analogous list in `test-graphql.yml`) hand-build dependency packages in a fixed order — the new package is not in the list, and `turbo.json` has no `generate` task with `dependsOn: ['^build']` to save it.
*Fix (junior):* add `cd ../adaptive-learning && pnpm run build` before the `graphql` build step in **both** workflows (grep all workflows for the `cd ../grading` pattern to catch every copy). Locally reproduce with a clean checkout: `pnpm install && pnpm --filter @klicker-uzh/adaptive-learning build && pnpm --filter @klicker-uzh/graphql generate`.

**F2 [B] — Branch conflicts with `v3`.**
GitHub reports `CONFLICTING`; merge-tree shows the conflicts are only `packages/graphql/package.json` and `packages/prisma-data/src/data/seedTEST.ts`. *Fix:* rebase onto current `v3`, regenerate GraphQL artifacts (`pnpm --filter @klicker-uzh/graphql generate`), re-run the three migrations on a fresh DB to confirm they still apply in order.

**F3 [B] — Cypress: 8 existing live-quiz tests broken by seed changes.**
`cypress-run-parallel-draft (1)` fails 8/78 in `O-live-quiz-workflow.cy.ts` ("Unable to find … NR Question Content 1") — the `seedTEST.ts` changes altered fixtures existing specs depend on. *Fix:* after the rebase (F2), diff `seedTEST.ts` against `v3` and make adaptive seed data purely additive; re-run the failing spec locally (`pnpm run dev:test` + cypress) before pushing.

**F4 [M] — The package's own tests never run in CI.**
`packages/adaptive-learning/package.json:26-27` defines `test` and `test:simulation`, but root CI runs `turbo run test:run` and the per-package workflows (`test-grading.yml` etc.) don't include this package. The simulation suite — the single most important quality gate for this feature — is dead weight right now. *Fix:* rename scripts to the `test:run` convention (mirror `packages/grading/package.json`) and add a `test-adaptive-learning.yml` workflow copied from `test-grading.yml`.

**F5 [M] — Process: one 17k-line commit, no design doc, PR body is only an auto-generated ClickUp link.**
There is no `project/` plan explaining the psychometric choices (why 3PL over Rasch, why fixed a=1.5, why author-assigned b), no test plan, no screenshots. Reviewers must reverse-engineer everything (this document now partially fills that hole). *Fix:* write `project/adaptive-learning-design.md` capturing the model decisions + limitations (content of §2 here is a starting skeleton); regenerate the PR body covering the whole branch; split future work into reviewable commits.

### 4.2 Backend correctness & integrity

**F6 [B] — Every lecturer edit unconditionally deletes all student attempts and responses.**
`upsertAdaptiveAssessment`, `services/adaptiveLearning.ts:400-405`: editing *anything* (typo in the title, tweaking a tooltip-adjacent config) wipes `AdaptiveAssessmentResponse` + `AdaptiveAssessmentAttempt` for the whole assessment — irreversible student-data loss with no warning, on a published assessment mid-semester. (Also flagged by greptile; verified in code.)
*Fix (junior):* (1) separate metadata edits (name, description, result messages) from structural edits (levels/competences/elements) — metadata must never touch attempts; (2) for structural edits on an assessment **with attempts**, refuse with an explicit error and require the lecturer to either archive+duplicate or pass a `confirmDiscardAttempts: true` flag that the UI backs with a scary confirm dialog; (3) add a service test proving a title-only edit preserves attempts.

**F7 [B] — Config recreation runs outside the deletion transaction.**
`services/adaptiveLearning.ts:390-436`: the `$transaction` deletes levels/competences/sub-competences/elements/result-messages, then `createAdaptiveAssessmentConfig(assessment.id, input, ctx)` (`:436`) runs on `ctx.prisma` *after* the transaction commits. Any failure in config creation leaves a live assessment with zero configuration (and, combined with F6, zero attempts). (Also flagged by greptile; verified.)
*Fix (junior):* move `createAdaptiveAssessmentConfig` inside the same `$transaction` callback (pass the `prisma` tx client through), so delete+recreate is atomic. Test: make config creation throw (e.g. duplicate level label) and assert the old config survives.

**F8 [B] — Submit accepts any pool item, any number of times — assessment-integrity hole.**
`submitAdaptiveAssessmentAnswer`, `services/adaptiveLearning.ts:735-741`: the submitted `adaptiveElementId` is only checked to *exist in the pool* and be enabled — it is **not** checked against the served `nextAdaptiveElementId`, and the schema has **no** unique on `(attemptId, adaptiveElementId)` (`adaptive.prisma:170-195`). A student driving the GraphQL API directly can (a) answer items never shown to them, (b) answer the same easy item repeatedly to steer theta upward. For anything labeled "assessment", that's a cheating vector.
*Fix (junior):* persist the served element id on the attempt (`nextAdaptiveElementId` column), require `adaptiveElementId === attempt.nextAdaptiveElementId` on submit, and add `@@unique([attemptId, adaptiveElementId])` to `AdaptiveAssessmentResponse` as a backstop (+ migration). Service test for both rejection paths.

**F9 [M] — Concurrent submit / double-click → unique-constraint crash.**
`order: attempt.responses.length` (`:765`) with `@@unique([attemptId, order])` (`adaptive.prisma:192`): two in-flight submits read the same length and the second dies with a raw P2002. Same read-then-write race can create two IN_PROGRESS attempts via `startAdaptiveAssessmentAttempt` (findFirst + create, no unique). (Order race also flagged by greptile; verified.)
*Fix (junior):* wrap read-grade-write in one `$transaction` with the attempt row locked (`SELECT ... FOR UPDATE` via `$queryRaw`, or re-read `responses.length` inside the tx and catch P2002 → return current state idempotently). For attempts: add a partial unique index (`CREATE UNIQUE INDEX ... ON "AdaptiveAssessmentAttempt"("assessmentId","participantId") WHERE status = 'IN_PROGRESS'` in a migration) and catch the violation by returning the existing attempt.

**F10 [M] — Cascade rules silently destroy attempt history.**
`AdaptiveAssessmentResponse.element … onDelete: Cascade` (`adaptive.prisma:187`): deleting a question from the library deletes students' response rows inside completed attempts, leaving `order` gaps and `thetaHistory` arrays that no longer match the responses. Same concern for `participation` cascade on attempts (`:156`) — a student unsubscribing from the course erases their attempt records while aggregate results still reference them. And `AdaptiveAssessment.course` is `onDelete: Cascade` (`adaptive.prisma:35`) while `deleteCourse` (`services/courses.ts:3224-3283`) has explicit special-case handling for live quizzes and stack elements before deleting — but **no** guard for adaptive assessments: deleting a course silently erases all ability estimates and graded answer history. (Today the element-side cascade is latent because `deleteElement` is soft-delete only — `elements.ts:897-974` — but nothing in the schema stops a future hard-delete script.)
*Fix (junior):* decide retention semantics explicitly. Pragmatic v1: keep `elementId` cascade but snapshot the graded payload (already stored in `response` JSON + `correct`) by making the FK `onDelete: SetNull` with `elementId` nullable; block course deletion when published adaptive assessments have attempts (mirroring the live-quiz special-casing) or document the cascade as intended; document the participation cascade as intended privacy behavior in the design doc (F5).

**F11 [m] — `requireCourseOwner` bypasses the repo's permission system.**
Lecturer ops check `course.ownerId === user` (`services/adaptiveLearning.ts:830-841`) instead of the `withPermission(...)`/`PermissionLevel` pattern used elsewhere (e.g. `recomputeCourseAnalytics` in `courses.ts`). Delegated staff on team-taught courses can't manage adaptive assessments. *Fix:* confirm intended policy; if delegated access should work, switch to the `withPermission` wrapper with `PermissionLevel.ADMIN`.

**F12 [M] — `showSolutions` leaks the answer to the question the student is currently answering.**
The flag is a single per-assessment boolean (default false, `adaptive.prisma:26`), presumably meant for post-completion review — the manage tooltip even says "for local testing only". But `buildAttemptState` (`services/adaptiveLearning.ts:1191-1194`) passes it to `adaptiveAttemptElement` **regardless of attempt status**, so with the flag on, every IN_PROGRESS attempt's served `nextElement` carries its `correct`/`solutions` data — and the shipped `FAdaptiveElementFields.graphql` fragment actually requests those fields, so the leak is end-to-end, not theoretical. There is also no server-side environment gate.
*Fix (junior):* make redaction phase-aware — reveal answers only for already-answered items or when `attempt.status === COMPLETED`, never for the pending `nextElement`; additionally gate the flag behind a non-production env check or redesign it as an explicit post-answer feedback feature.

**F28 [B] — The full answer key is exposed to participants via `elements[].element` — two paths.**
The `AdaptiveAssessment` GraphQL type exposes `elements[].element` **unredacted** (`schema/adaptiveLearning.ts:116`, `t.expose('element', { type: Element })`) — including `options.choices[].correct` and FREE_TEXT `solutions`. Two participant-reachable paths return it:
(a) **`publishedAdaptiveAssessments`** (`schema/query.ts:253`, `asParticipant`) returns the full type; its service function `getPublishedAdaptiveAssessments` (`services/adaptiveLearning.ts:335-348`) additionally has **no `requireCourseParticipation` check** — any authenticated participant of *any* course can pull any course's full item pool with solutions. The query has zero client usage (only the safe `publishedAdaptiveAssessmentInfos` variant is used) — it is pure attack surface.
(b) **`AdaptiveAttemptState.assessment`** (`schema/adaptiveLearning.ts:253`) carries the same type from `startAdaptiveAssessmentAttempt`/`submitAdaptiveAssessmentAnswer`/`adaptiveAttemptState`; `buildAttemptState` (`:1188-1194`) only redacts `nextElement`, never `assessment.elements`.
Exploitation in prod is currently blocked only by accident: the shipped fragments don't select these fields, and the persisted-operations allowlist rejects arbitrary queries in production (`apps/backend-docker/src/app.ts:149-152`). Neither holds in dev/test/staging, and one future fragment edit re-opens it in prod.
*Fix (junior):* delete the unused `publishedAdaptiveAssessments` query outright; give participant-facing attempt state an assessment shape **without** raw elements (or sanitize `assessment.elements[].element` in `buildAttemptState` with the same stripping as `nextElement`); add `requireCourseParticipation` to whatever participant-facing listing remains. Add a service test asserting no `correct`/`solutions` appears anywhere in participant-facing payloads.

**F29 [B] — No ownership check on element IDs at config creation: any lecturer can attach any element in the system.**
`createAdaptiveAssessmentConfig` (`services/adaptiveLearning.ts:1012-1051`) fetches referenced elements with `prisma.element.findMany({ where: { id: { in: [...] } } })` — by ID only. The established pattern in `services/liveQuizzes.ts` (~`:98-138`) filters by `permissions: { some: { userId, permissionLevel: { in: [OWNER, ADMIN] } } }` for exactly this reuse case. As written, a course owner can map another lecturer's private, unshared question into their assessment, serving its content (and, via F28/F12, its answer key) to their participants.
*Fix (junior):* copy the permission filter from `liveQuizzes.ts` into the `findMany`, then throw if any requested `elementId` is missing from the filtered result. Service test: config referencing a foreign element ID must be rejected.

**F30 [M] — Response write and attempt update are two separate transactions — crash leaves attempts permanently stuck.**
`submitAdaptiveAssessmentAnswer` commits `$transaction([response.create, element.update])` (`:759-778`), then re-fetches and separately updates the attempt (`:780-825`, finalize or in-progress branch). A crash between the two leaves the response recorded but `currentTheta`/`status`/`completedAt` stale; if the answer should have finalized the attempt, it is stuck IN_PROGRESS forever with no `finalTheta`. Also note the duplicate-submit variant of F8: sequential resubmits of the same `adaptiveElementId` both succeed with different `order`, double-counting `exposure` and feeding duplicate evidence into theta.
*Fix (junior):* wrap response create + exposure increment + attempt update in one `$transaction(async (tx) => {...})`, reusing the already-computed next state instead of re-querying; short-circuit when `attempt.responses.some(r => r.adaptiveElementId === adaptiveElementId)` (mirroring the completed-attempt no-op at `:731-733`) — the `@@unique([attemptId, adaptiveElementId])` from F8 is the DB backstop.

**F31 [M] — Results query recomputes IRT estimates twice per attempt and loads the full roster unpaginated.**
`getAdaptiveAssessmentResults` (`:505-587`) batches the DB fetch properly (single `participation.findMany` with nested includes), but `buildAttemptCompetenceEstimates`/`buildAttemptSubCompetenceEstimates` — each re-running `updateTheta` over filtered response arrays — execute once for `students` (per participation) and again for `competences` (per attempt); `buildItemResults` filters the full flattened response list per element (O(elements × responses)); and there is no pagination, so a large course recomputes everything on every dashboard load. Also missing: an `@@index([participationId, assessmentId])` on `AdaptiveAssessmentAttempt` for this query shape (only `@@index([participationId])` exists).
*Fix (junior):* memoize per-attempt estimates in a `Map` keyed by attempt id and reuse for both return fields; build item results with one grouped pass; add the composite index in a migration. Pagination can wait until courses exceed a few hundred participants — note it in the design doc.

**F32 [m] — No bounds validation on numeric config inputs.**
`validateAdaptiveAssessmentInput` (`:1070-1149`) doesn't range-check `questionThreshold`, `standardErrorThreshold`, `discrimination`, `topInformationRatio`, or `weight` (top-level or per-competence overrides). A zero/negative `questionThreshold` or `standardErrorThreshold` instant-finalizes every attempt (0 answered ≥ 0 threshold). Lecturer-only blast radius, but produces a silently broken assessment. *Fix:* add `> 0` checks and `0 < x <= 1` where applicable, with clear error messages.

**F33 [m] — Backend hygiene bundle.**
(a) 25 of ~26 throw sites use plain `throw new Error(...)`; only `requireCourseParticipation` uses `GraphQLError` with `extensions.code` — the reference file `practiceQuizzes.ts` predominantly uses `GraphQLError`, and clients can't distinguish NOT_FOUND/FORBIDDEN/BAD_INPUT without it. Standardize. (b) 5 of 7 child models (`Level`/`Competence`/`SubCompetence`/`Element`/`ResultMessage` in `adaptive.prisma`) lack `createdAt`/`updatedAt` despite being lecturer-editable — hurts auditability. (c) Migrations `20260602120000_adaptive_show_solutions` and `20260603110000_adaptive_competence_thresholds` look hand-edited (missing standard Prisma markers, non-standard indent); content matches the schema, but run `pnpm run prisma:migrate` before merge to confirm zero pending diff. (d) The `resources.prisma`/`sharing.prisma` whitespace-only reformat should move to its own commit. (e) `seedTEST.ts`: per-response `elapsedSeconds` sums (~44,570s) contradict attempt-level `elapsedSeconds` (~900–2,500s), and the "first 30 participants" comment doesn't match the actual 50-participant loop — internally inconsistent seed data confuses anyone debugging against it.

### 4.3 Psychometrics / didactics

**F13 [M] — Item parameters are author-assigned, not calibrated — label the feature honestly.**
`b` is simply the theta of the lecturer-chosen level (`services/adaptiveLearning.ts:2141-2149`), `a` is a global constant 1.5 unless hand-overridden. Consequences: the reported standard error and the "±" precision shown to students are **nominal**, not empirical; a mislabeled item systematically biases theta; the SE-based stop rule stops on false confidence. This is the standard cold-start situation for CAT and acceptable **for low-stakes self-assessment** — but the product currently calls it an "assessment" and shows precision intervals as if they were measured.
*Fix (junior, staged):* (1) wording: in student and lecturer UI, describe results as an *estimate based on instructor-assigned difficulty* (one sentence in the existing "What is theta?" explainer); (2) exploit the data you already collect: `exposure` and per-item response records exist — add an item-analytics view showing empirical p-values (proportion correct) vs. assigned level, so lecturers can spot mislabeled items (partly exists in the results item table — add a "flag: empirical difficulty disagrees with assigned level" column); (3) longer-term ticket: periodic 2PL calibration job from accumulated responses (this is exactly what `apps/analytics` infrastructure is for).

**F34 [M] — Pure MLE with no prior: theta slams to the range boundary after the first answer.**
`updateTheta` supports a MAP prior but `usePrior` defaults to `false` (`index.ts:178`) and the service never enables it (all three call sites, `services/adaptiveLearning.ts:1492, 1559, 1807`). With an all-correct or all-wrong response set the MLE is unbounded, so Newton iterations run to the clamp: one correct answer → θ = +3.0 ("Expert"/"C2"), one wrong → −3.0. Early attempt states, thetaHistory, in-progress result messages, and the level badge all whip between extremes until mixed responses arrive — students see absurd provisional placements, and warm-started retakes (F16) inherit an extreme starting point if an attempt ends early. (Re-verified from the parallel review's B1.)
*Fix (junior):* pass `usePrior: true` with `priorMean = initialTheta` (or 0) and `priorSD = 1` at the service call sites — MAP is the standard CAT choice precisely for this cold-start reason; re-run `test:simulation` and adjust the recovery thresholds if needed (MAP shrinks estimates slightly toward the prior — that is expected and desirable here).

**F14 [M] — No exposure control: the item sequence is deterministic and leaks.**
`selectNextItem` (`index.ts:319-345`) picks max information with randomization only on *exact float ties* (i.e. never in practice); the `exposure` field is written (`services/adaptiveLearning.ts:774-777`) but **never read** in selection. Every student at the same theta gets the same items in the same order → screenshots in the course chat defeat the pool; retakes (warm-started at the same theta, F16) largely replay the same sequence.
*Fix (junior):* implement randomesque selection — pick uniformly among the top-k (k=3..5) information items — in `selectNextItem` (one small change + unit test), and add `exposure` as a tie-breaking penalty (`information − λ·normalizedExposure`). Re-run `test:simulation` to confirm recovery metrics stay above thresholds.

**F15 [M] — Frontend level bands disagree with backend level assignment near boundaries.**
Backend: levels at equally spaced thetas with **midpoint** boundaries (`mapLevelsToTheta`, `index.ts:81-107`). Frontend: `mapLevelsToBands` divides the range into **equal N slices** (`shared-components/src/adaptive/utils.ts:78-97`). Worked example (5 levels, range [−3,3]): θ=−2.0 → backend assigns level 2 "Developing" (boundary −2.25), but the band chart places the marker inside the "Novice" band (slice boundary −1.8). Students see a badge that contradicts the chart. (Also flagged by greptile; verified numerically.)
*Fix (junior):* delete the slice logic in `mapLevelsToBands` and compute bands from the same midpoint boundaries as the backend — port `mapLevelsToTheta` (it's exported from `@klicker-uzh/adaptive-learning`; if the package shouldn't be a frontend dep, copy the 20 lines with a comment naming the source of truth). Add a shared unit test pinning badge-level == band-level for a grid of thetas.

**F16 [m] — Retake policy: unlimited, warm-started, same pool — fine for practice, say so.**
No `maxAttempts`, no cooldown; warm start (`:654-678`) is didactically sound for mastery tracking, but combined with F14 it invites grinding. If any course intends to use results summatively (the results dashboard has "best attempt" toggles suggesting comparison), add per-assessment `maxAttempts`/cooldown config. Otherwise: rename user-facing copy from "assessment" toward "adaptive practice/placement".

**F17 [m] — Dichotomous grading discards partial knowledge (acceptable, document it).**
MC/KPRIM partial credit collapses to correct-iff-full-score (`:2199, :2209`) — consistent with the guessing parameters, standard for 3PL, but lecturers accustomed to KlickerUZH partial scoring will wonder why a 3/4 KPRIM counts as wrong. One tooltip sentence on the manage Algorithm tab fixes the surprise.

**F18 [m] — Default `questionThreshold: 50` is per-sub-competence and inflates `maxQuestions`.**
`effectiveAttemptQuestionThreshold` (`:1216-1242`) sums thresholds across enabled sub-competences: 3×3 structure ⇒ progress bar denominator 450. Students see "Question 12" against a bar at 3% and then the test suddenly completes on the SE rule. *Fix:* progress UI should show per-sub-competence progress or an indeterminate "measuring precision" indicator once SE stopping is near; and default the per-sub-competence threshold to something realistic (10–15) so the bar means something.

### 4.4 UX (both pages) — from the dedicated frontend review pass

**F19 [B] — Zero i18n across all new UI.**
0 `useTranslations` in the PWA page, manage page, and all 7 shared components; ~140+ hardcoded English strings in manage, ~25 in PWA (line-level list available — e.g. PWA `:271, :343-344, :355, :419, :584, :592, :607, :698, :704-721, :792-812`). Every sibling page uses `next-intl`. German-locale students/lecturers get untranslated UI on a UZH product. *Fix (junior):* move strings into `packages/i18n` (both `de` and `en`), mirroring the keys structure of `practiceQuizzes`; this is mechanical but large — do it before more UI work piles on top.

**F20 [B] — Manage Publish/Archive: no confirm dialog, no error handling.**
`apps/frontend-manage/.../adaptive-learning.tsx:439-477`: both mutations lack try/catch (unlike `save()` at `:361-386`) — a failed publish is a silent no-op; Archive additionally resets the form and switches selection with no undo. Combined with F6, an accidental edit-after-publish is catastrophic. *Fix:* wrap in try/catch + error banner (copy the `save()` pattern), add confirm modals (Archive especially), disable Publish until pre-publish validation passes (F21).

**F21 [M] — No pre-publish validation.**
Lecturer can publish with zero enabled items, weights not summing, or no result messages — nothing blocks it (`:441-444`). *Fix:* run the same validation as `save()` plus "≥1 enabled item per enabled sub-competence×level" before enabling the Publish button; surface failures as a checklist.

**F22 [M] — Main manage query `error` destructured but never rendered (`:281`); broken load = infinite skeleton.** *Fix:* copy the `error` branch from the sibling `index.tsx`.

**F23 [M] — PWA completion flash + KPRIM silent-false + missing resume signal.**
(a) On finishing, render guards fall through to the assessment picker while standing refetches (`apps/frontend-pwa/.../adaptive-learning.tsx:287-333`) — add a loading branch for `completed && loadingStanding`. (b) KPRIM `canSubmit` only requires one touched choice; untouched rows submit as `false` (`:167-176, :231-240`) — require an explicit judgment per row. (c) Backend resumes attempts but the picker gives no "Continue your attempt" signal — query in-progress state on mount and label the CTA "Resume".

**F24 [M] — Charts under-labeled for the lecturer audience.**
`ItemCharacteristicCurve.tsx:58-59`: information curve plotted on a *hidden* Y axis, no legend distinguishing P(correct) vs information; histogram lacks an axis caption; ability dots rely on hover tooltips only. Given the audience is non-psychometrician lecturers, label axes ("ability θ", "P(correct)"), add `<Legend/>`, and caption the theta scale ("−3 … +3"). Also `getLevelColor` (`utils.ts:50-76`) matches hardcoded English level names (novice/…/expert) and falls back to *different* positional indices per call-site — custom or German level names get inconsistent colors between badge, histogram, and band. Pass the ordinal index from the ordered levels array everywhere.

**F25 [M] — Accessibility gaps + missing `data-cy`.**
Hand-rolled tab buttons without `role="tablist"`/`aria-selected` (manage `:489-501, :1582-1594` — the design-system `Tabs` is already imported on the sibling page); form `<select>`s without programmatic labels; a delete control rendered as the literal letter "x"; **zero `data-cy` attributes across all new UI**, which blocks the Cypress/Playwright coverage this feature needs (see F27). *Fix:* use design-system `Tabs`, add labels/aria, adopt the `IconButton` + sr-only pattern, sprinkle `data-cy` on every interactive element (repo convention).

**F26 [m] — Integration inconsistencies.**
Manage course tab for Adaptive Learning lacks the `faCrown`/`disabled`/tooltip gating every sibling activity tab has — confirm whether the feature is meant to be free-tier or catalyst-gated. The 3,679-line manage page must be split into `components/adaptiveLearning/*` tab components (repo precedent: `index.tsx` is 464 lines and delegates). `IconButton icon: any` (`:2837`) and `({ row }: any)` table renderers (`:1977-2022`) violate strict-TS conventions. `CourseListButton.tsx` a11y fix is good but unrelated scope — move to its own PR/commit.

### 4.5 Testing gaps

**F27 [M] — No E2E coverage; unit tests don't cover the service layer.**
Package tests (good) cover the math; nothing tests `services/adaptiveLearning.ts` (2,252 lines: attempt lifecycle, races, authz) and no Cypress/Playwright spec touches either page. *Fix (junior, ordered):* (1) service-level vitest with a mocked/test Prisma covering F6-F9 regressions; (2) one Playwright happy-path spec (lecturer creates+publishes minimal assessment → student completes attempt → results visible) following `klicker-playwright-e2e` conventions — this also forces the `data-cy` work (F25).

---

## 5. Remaining steps to production readiness (ordered)

1. **Unbreak the branch:** rebase onto `v3` (F2), fix CI build order (F1), make seed additive + fix the 8 Cypress specs (F3), wire package tests into CI (F4). Outcome: green CI. *(~1 day)*
2. **Stop the data loss:** F6 (edit vs. attempts) + F7 (atomic config recreation) + regression tests. Nothing else matters if a lecturer edit deletes a cohort's attempts. *(1–2 days)*
3. **Close the security/integrity holes:** F28 (drop `publishedAdaptiveAssessments`, redact attempt-state elements, membership check), F29 (element-ownership filter), F8 (served-item check + `@@unique`), F12 (phase-aware `showSolutions`), F9 + F30 (races and single-transaction submit). These are all in `services/adaptiveLearning.ts`/`schema` + one migration, and each gets a service test. *(2 days)*
4. **i18n sweep (F19) + Publish/Archive safety (F20, F21, F22) + config bounds validation (F32).** *(1–2 days)*
5. **Didactic consistency:** F34 (enable the MAP prior — one-line change, biggest single quality win), F15 (level-band mismatch — small, high-visibility), F14 (randomesque + exposure), F13 wording changes, F18 progress semantics. *(1–2 days)*
6. **A11y + data-cy + one Playwright E2E (F25, F27), chart labeling (F24).** *(1–2 days)*
7. **Structural cleanup:** split the manage monolith, type the `any`s, separate the `CourseListButton` fix (F26); write the design doc + honest PR body (F5); decide gating (catalyst or free) and delegated-access policy (F11); document cascade/retention decisions incl. `deleteCourse` (F10); results-query memoization + composite index (F31); attempt-limit config or "practice" renaming (F16); grading tooltip (F17); error-code/timestamp/migration hygiene (F33).
8. **Manual verification before un-drafting:** run the full flow with `npx agent-browser` (delegated lecturer login → create/publish; `testuser1` → complete an attempt; screenshots of config, runner, results in both locales) and attach to the PR. Then a final `pnpm run check:all && pnpm run test:run` + fresh `prisma:setup` migration replay.

Realistic total: **~2.5 weeks of focused work** before this is safe for a real course.

---

## 6. Didactics / usefulness assessment (summary)

- **Usefulness: high potential.** Adaptive placement/practice is a genuine pedagogical differentiator for KlickerUZH, and the competence-structured results (weakest-area nudge, per-competence bars) are the right formative shape. The simulation-validated engine is a solid foundation.
- **Honesty gap:** without calibrated item parameters (F13) and exposure control (F14), the numbers shown to students are softer than the UI implies. Fine for self-assessment; misleading for anything summative. The cheapest, highest-value didactic fixes are wording (call it an estimate), the level-band consistency bug (F15), and the item-analytics "mislabeled item" flag that turns lecturer-assigned difficulty into a feedback loop.
- **Lecturer burden:** the config surface (3PL parameters, thresholds, theta ranges) is expert-level. The tooltips help, but consider shipping an opinionated preset ("CEFR language placement", "topic mastery check") that hides `a`/`c`/theta bounds entirely for the 90% case — the CEFR preset in the levels editor shows the team already thinks this way.

---

*Review method: full read of `packages/adaptive-learning/src/index.ts` and the attempt/submit/upsert/authz paths of `services/adaptiveLearning.ts`; schema constraint analysis of `adaptive.prisma` + all three migrations; a dedicated security-focused backend pass (authz matrix over all 11 ops, redaction/leak analysis incl. persisted-operations config in `apps/backend-docker/src/app.ts`, cascade audit of `deleteCourse`/`deleteElement`, `git diff -w` verification of the whitespace-only prisma diffs); a dedicated frontend review pass over both pages and all shared components; CI log analysis (check/test/cypress jobs); merge-tree conflict analysis; numerical verification of the F15 boundary mismatch; verification of both greptile P1 findings and the P2 race in code. Not run: the app itself (§5.8 mandates browser verification before un-drafting) and the package tests (no installed workspace in the review worktree — F4 makes CI run them instead); the concurrency races (F9, F30) are static-analysis findings, high confidence but not runtime-reproduced.*
