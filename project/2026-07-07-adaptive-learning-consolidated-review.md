# Consolidated Review — Adaptive Learning (PR #5113) as a Generic Level-Classification Instrument

**Reviewed commit:** `1b2b4684d` (`feat(adaptive-learning): adaptive learning`), re-verified file-by-file in this worktree on 2026-07-07.
**Prior reviews:** `project/REVIEW-adaptive-learning-pr5113.md` (below: **R1**) and `project/2026-07-07-adaptive-learning-pr5113-review.md` (below: **R2**). This document is the third, consolidating pass. Every finding cited from R1/R2 was re-verified against the current source before inclusion; none was found stale.
**New in this review:**

1. The product goal is reframed from "Spanish CEFR placement" to a **generic instrument that classifies students into levels for any subject**. Section 4 covers what that changes.
2. The three open design questions — **how to set `a`/`b`/theta intervals, what stop conditions to use for a ≤30-minute test, and how to aggregate scores across (sub)competences** — are answered quantitatively in Section 5, backed by fresh Monte-Carlo sweeps that mirror the *production* code path (methodology and full tables in the Appendix).
3. Roughly a dozen findings that neither prior review contains, the most consequential being **N1** (the SE stop conditions are mathematically unreachable for realistic item pools — the "adaptive" stopping is dead code in practice) and **N2** (the seeded, published demo assessment ships with `showSolutions: true`).

**Severity scale:** 🔴 **Critical** — blocks any real-student use · 🟠 **Major** — blocks a production classification use case · 🟡 **Minor** — quality/polish.

---

## 1. Verdict

The verdict of both prior reviews stands and is sharpened by the new measurements:

- **The architecture is right and worth keeping** — for the generic use case too. A pure IRT library (`packages/adaptive-learning/src/index.ts`) with textbook-correct 3PL math (independently re-verified), a service layer (`packages/graphql/src/services/adaptiveLearning.ts`), thin resolvers, clean Prisma schema, and a deterministic simulation harness. Nothing here needs a rebuild; the level/competence/subcompetence structure is already subject-agnostic at the data-model level.
- **It is not safe for real students yet.** The critical security/integrity findings from R1/R2 are all still present at this commit: the answer key is reachable through the GraphQL type graph, saving an assessment destroys all attempts non-atomically, submit accepts arbitrary items any number of times, and any lecturer can attach any other lecturer's private question. These are Phase-0 blockers regardless of subject area.
- **The measurement layer works, but not the way the configuration promises.** New quantitative result: with the shipped defaults and a realistic single-choice item pool, the standard-error stop *never fires* — every test runs to the question cap, i.e. the test is fixed-length in practice and the "adaptive stopping" configuration is inert (N1). Accuracy is nonetheless decent (~0.75–0.85 exact, ~1.00 adjacent-level in simulation) because the cap forces enough items; but students see a whipsawing live estimate (R1-B1), thresholds that lecturers set have no effect, and the test is ~50 % longer than it needs to be for the precision it achieves.
- **The good news:** all of the above is fixable with modest, well-localized changes, and the sweeps in Section 5 give concrete numbers to configure the fixed version: a ~45–60-item test (≤30 min at ~30 s/item) reaches ~0.80–0.85 exact and ~1.00 adjacent-level accuracy on a 6-level scale — which is also roughly the ceiling of what expert-leveled (uncalibrated) items can deliver. For fewer levels (3–4, the typical generic case) the same budget reaches ~0.85 exact in 16–27 minutes.

---

## 2. System model in one paragraph (context for the findings)

Lecturers define levels (e.g. A1–C2), competences → subcompetences, and map question-bank elements into the pool, assigning each a level. Item parameters are **policy, not calibration**: difficulty `b` = the theta anchor of the assigned level, anchors spread evenly over `[thetaMin, thetaMax]` ([index.ts:81-107](../packages/adaptive-learning/src/index.ts), [adaptiveLearning.ts:2141-2150](../packages/graphql/src/services/adaptiveLearning.ts)); discrimination `a` = one global assessment setting with unused per-item override; guessing `c` derived from item format ([index.ts:122-133](../packages/adaptive-learning/src/index.ts)). At attempt time the service drains competences *in configured order*, picks the subcompetence with the most remaining level coverage, then the unanswered item with maximum Fisher information at the current subcompetence estimate ([adaptiveLearning.ts:2021-2114](../packages/graphql/src/services/adaptiveLearning.ts)). Ability is re-estimated after each answer by unprimed Fisher-scoring MLE; a subcompetence stops at its question cap, SE threshold, or coverage exhaustion ([adaptiveLearning.ts:1936-1972](../packages/graphql/src/services/adaptiveLearning.ts)); the overall score is the lecturer-weighted mean of per-competence pooled estimates ([adaptiveLearning.ts:1824-1866](../packages/graphql/src/services/adaptiveLearning.ts)). Because all same-level items in a subcompetence share identical `(a, b, c)`, the CAT behaves as a **level staircase with IRT bookkeeping** — which is a legitimate v1 whose validity rests on lecturers assigning levels correctly.

This also answers the question raised during review scoping — *"don't the parameters depend on the provided items?"* In classical CAT, yes: `a`/`b`/`c` are per-item properties estimated from response data. **In this design they are configuration choices**, and real items enter only through (i) how well the lecturer's level assignment matches the item's true difficulty and (ii) how sharply the item actually discriminates. That is why Section 5 can recommend values from simulation without the real items — and why every recommendation there is stress-tested against items that *violate* the assumptions (mis-leveled items, lower true discrimination), and why empirical calibration from accumulated responses is on the roadmap as the eventual replacement (§6, Phase 3).

---

## 3. Findings

Re-confirmed findings from R1/R2 are summarized with pointers (the prior reviews carry the full write-ups); new findings (**N-series**) are written out in full. All were verified in this worktree.

### 3.1 Security & data integrity

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| S1 | 🔴 | Answer key reachable by participants via `assessment.elements[].element` (incl. `choices[].correct`, free-text `solutions`) on `publishedAdaptiveAssessments` **and** on `AdaptiveAttemptState.assessment`; only `nextElement` is sanitized | R1-A1 / R2-F28 — re-verified: [schema/adaptiveLearning.ts:116,182,253](../packages/graphql/src/schema/adaptiveLearning.ts), [services/adaptiveLearning.ts:1188-1194,1244-1283](../packages/graphql/src/services/adaptiveLearning.ts) |
| S2 | 🔴 | No course-membership check on `getPublishedAdaptiveAssessments`; `publishedAdaptiveAssessmentInfos` has no auth at all | R1-A2 / R2-F28a — re-verified: [services/adaptiveLearning.ts:335-381](../packages/graphql/src/services/adaptiveLearning.ts), [schema/query.ts:253,267](../packages/graphql/src/schema/query.ts) |
| S3 | 🔴 | Every save of an existing assessment deletes **all responses and attempts**, then recreates config in a **second** transaction — mid-course edits destroy cohorts; a failure between the transactions leaves a published, config-less shell | R1-A3 / R2-F6+F7 — re-verified: [services/adaptiveLearning.ts:390-436](../packages/graphql/src/services/adaptiveLearning.ts) (deletes at 400-420, `createAdaptiveAssessmentConfig` outside at 436) |
| S4 | 🔴 | Submit accepts any enabled pool element, unlimited times; no `@@unique([attemptId, adaptiveElementId])`, no served-item check → placement manipulable from devtools | R1-A4 / R2-F8 — re-verified: [services/adaptiveLearning.ts:735-741](../packages/graphql/src/services/adaptiveLearning.ts), [adaptive.prisma:192](../packages/prisma/src/prisma/schema/adaptive.prisma) |
| S5 | 🔴 | No ownership filter on element IDs at config creation — a lecturer can attach any element in the system (and expose it, via S1/S6) | R2-F29 — re-verified: [services/adaptiveLearning.ts:1012-1019](../packages/graphql/src/services/adaptiveLearning.ts) plain `findMany({ id: { in } })` |
| S6 | 🟠 | `showSolutions` sends the unsanitized element *before* answering, on a production-visible toggle | R1-A5 / R2-F12 — re-verified: [services/adaptiveLearning.ts:1244-1248](../packages/graphql/src/services/adaptiveLearning.ts), manage tooltip [adaptive-learning.tsx:1291](../apps/frontend-manage/src/pages/courses/%5Bid%5D/adaptive-learning.tsx) |
| S7 | 🟠 | Submit writes response + attempt update in two separate transactions; concurrent submits race on `order` and `currentTheta`; duplicate IN_PROGRESS attempts possible | R2-F9+F30 — re-verified: [services/adaptiveLearning.ts:759-825,641-679](../packages/graphql/src/services/adaptiveLearning.ts) |
| S8 | 🟡 | `onDelete: Cascade` from `Element`/`Participation`/`Course` silently erases attempt history; `deleteCourse` has no adaptive guard | R1-A6 / R2-F10 — re-verified: [adaptive.prisma:118,156,187,35](../packages/prisma/src/prisma/schema/adaptive.prisma) |

**N2 🔴 The seeded demo assessment is published with `showSolutions: true`.**
[seedTEST.ts:250 and 270](../packages/prisma-data/src/data/seedTEST.ts) set `showSolutions: true` on the seeded, `PUBLISHED` "English CEFR Adaptive Learning" assessment. Every seeded environment (local dev, Cypress, any staging seeded from this script) therefore serves the correct answer alongside every question ([PWA SolutionPreview](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx), rendered at :578-580). Three consequences: (a) anyone demoing the feature shows a placement test that displays its own answers; (b) future E2E tests written against the seed will happily pass while the real student experience is broken, because the "expected" flow includes visible solutions; (c) it normalizes S6 — the toggle looks intended for production use.
*Fix:* seed with `showSolutions: false`; if a solutions-on variant is needed for a specific E2E spec, seed a second, clearly named assessment (`…-solutions-debug`) or toggle it inside the spec. Combined with the S6 fix (phase-aware redaction or env-gating), the flag should never be able to leak pre-answer solutions in production regardless of seed state.

**N3 🟡 Participant-facing attempt state also leaks configuration internals.**
Beyond the answer key (S1), `AdaptiveAttemptState.assessment` exposes `discrimination`, `standardErrorThreshold`, `questionThreshold`, `topInformationRatio`, and per-element `discrimination`/`exposure`/level mappings to students ([schema/adaptiveLearning.ts:159-189,110-131](../packages/graphql/src/schema/adaptiveLearning.ts)). None of it is needed by the PWA (the shipped fragments don't select it), and level assignments per item are exactly what a student needs to game a staircase test. This disappears for free if S1 is fixed the recommended way — a dedicated participant-facing assessment type (levels, display flags, theta range only) instead of reusing the lecturer type.

### 3.2 Computations & psychometrics

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| C1 | 🟠 | Unprimed MLE: theta slams to ±3 after the first answer; live UI shows top/bottom level after one response; the lib's MAP prior (`usePrior`) is never enabled | R1-B1 / R2-F34 — re-verified: [services/adaptiveLearning.ts:1798-1822](../packages/graphql/src/services/adaptiveLearning.ts) and both other `updateTheta` call sites pass no prior; [index.ts:178](../packages/adaptive-learning/src/index.ts) defaults `usePrior: false`. §5.1 adds a twist: the fix must *not* apply the strong prior to the final reported estimate (−9 pp exact accuracy in simulation) |
| C2 | 🟠 | Simulation validates a different system: mastery/floor level mapping + round-robin sequencing + third set of defaults, vs production nearest-anchor + drain-in-order | R1-B2 — re-verified: [simulation.test.ts:360-368,120-125,23-24](../packages/adaptive-learning/test/simulation.test.ts) vs [index.ts:109-120](../packages/adaptive-learning/src/index.ts), [services/adaptiveLearning.ts:2044-2111](../packages/graphql/src/services/adaptiveLearning.ts). §5.1 quantifies: the two mappings are equally accurate under their own semantics; **mixing** them costs ~30 pp exact accuracy |
| C3 | 🟠 | Frontend level bands (equal slices) disagree with backend level assignment (midpoint boundaries): badge and band marker contradict near boundaries | R1-B3 / R2-F15 — re-verified: [utils.ts:78-97](../packages/shared-components/src/adaptive/utils.ts) vs [index.ts:81-107](../packages/adaptive-learning/src/index.ts); 6 levels: frontend A1/A2 edge −2.0 vs backend −2.4 |
| C4 | 🟠 | Dead knobs: `topInformationRatio` written/edited but never read (selection is pure argmax); competence-level `questionThreshold`/`standardErrorThreshold` written but never read by stopping; `ABANDONED` status never set | R1-B4 / R2-F14 — re-verified: [index.ts:319-345](../packages/adaptive-learning/src/index.ts), [services/adaptiveLearning.ts:877-878,982-983,1962-1965](../packages/graphql/src/services/adaptiveLearning.ts) |
| C5 | 🟠 | Free-text grading is lowercase-exact-match: diacritics/synonyms/whitespace fail; wrong for language subjects and fragile for any subject | R1-B5 — re-verified: [grading/src/index.ts:142-155](../packages/grading/src/index.ts) |
| C6 | 🟡 | `elapsedSeconds` is cumulative wall-clock since `startedAt`; resumed attempts record days; timer resumes at the inflated value | R1-B6 — re-verified: [services/adaptiveLearning.ts:757,2250-2252](../packages/graphql/src/services/adaptiveLearning.ts), PWA local timer seeded from it (:124) |
| C7 | 🟡 | Nominal precision from author-assigned parameters should be labeled as such in the UI | R2-F13 — stands; see also §5.2 (a-misspecification measurably hurts) |

**N1 🟠 The standard-error stop conditions are mathematically unreachable for realistic pools — the test is fixed-length in practice and the thresholds are dead configuration.**
For a 3PL item answered at its own difficulty (θ = b), Fisher information has the closed form **I = a²(1−c) / (4(1+c))** (from [index.ts:146-158](../packages/adaptive-learning/src/index.ts) with p = (1+c)/2). That gives, per item, at best:

| Item type | c | I at θ=b (a=1.2) | I at θ=b (a=1.5) |
|---|---|---|---|
| SC, 4 choices | 0.25 | 0.22 | 0.34 |
| KPRIM | 1/16 | 0.32 | 0.50 |
| FREE_TEXT | 0.01 | 0.35 | 0.55 |

Minimum achievable SE after n items is 1/√(n·I). Consequences, all verified empirically in the sweeps (Appendix, stop-reason accounting):

- **Manage-UI defaults (cap 5, SE 0.3, a 1.2** — [adaptive-learning.tsx:240-242](../apps/frontend-manage/src/pages/courses/%5Bid%5D/adaptive-learning.tsx)): SE 0.3 with SC items needs ≥ **51 items** per subcompetence; the cap is 5. The SE rule can never fire. 100 % of simulated subcompetence stops are cap stops.
- **Simulation settings (cap 8, SE 0.55, a 1.5** — [simulation.test.ts:23-24](../packages/adaptive-learning/test/simulation.test.ts)): reachable only because the sim pool is FREE_TEXT (needs ~6 items). With an SC pool the same threshold needs ~11 items > cap 8 — never fires. The sim's SE-stop behavior does not transfer to real SC-heavy pools.
- **Lib defaults (cap 50, SE 0.4** — [index.ts:2-4](../packages/adaptive-learning/src/index.ts)): reachable (~30 SC items) but the cap of 50 per subcompetence is absurd for a multi-subcompetence test.
- The seeded assessment (SE 0.3, a 1.2, cap **90** — [seedTEST.ts:243-245](../packages/prisma-data/src/data/seedTEST.ts)) stops only by pool exhaustion: students see every item of every subcompetence.

So none of the three shipped default sets produces a test that actually adapts its length, and lecturer-entered SE thresholds silently do nothing in the realistic regime. This compounds R2-F18: `maxQuestions` = Σ caps makes the progress bar a fiction, and here even the *stopping* is a fiction.
*Fix (part of the §5.2 redesign):* (1) validate thresholds against the information budget at save time — warn when `standardErrorThreshold < 1/√(cap · I(a, c_dominant))`; (2) ship one blessed default set that is reachable (per-subcompetence SE ≈ 0.65 at cap 8 for SC pools — an early-exit bonus, not the primary control); (3) move the real convergence control to the competence level, where information pools across subcompetences (§5.2); (4) surface "why did the test stop" (cap/SE/coverage) per subcompetence in the lecturer results view — the data is derivable and it makes dead thresholds visible.

**N4 🟡 The MAP standard error omits the prior precision.**
`updateTheta` returns `standardError(roundedTheta, items)` ([index.ts:233-239](../packages/adaptive-learning/src/index.ts)) — likelihood information only — even when `usePrior: true` contributed 1/σ² to the Fisher-scoring updates (:216-219). Once C1 is fixed by enabling the prior, the reported SE will be *inconsistent with the estimator*: too large early (a 1-item MAP estimate reports SE ≈ 1.7 when the posterior SD is ≈ 0.9), which in turn makes SE-based stopping more conservative than intended. Not user-visible today only because the prior is never enabled.
*Fix:* when `usePrior`, return `1/√(Σ I_i + 1/σ²)`; add a unit test pinning the 1-response posterior SD. Decide explicitly whether *stop* rules should use posterior SE (recommended — it is the actual uncertainty) and document the choice.

**N5 🟡 Aggregation double-counts the prior once C1 lands.**
The overall estimate is built from per-competence estimates that would each include the same N(0,1) prior; the weighted mean of k such estimates effectively applies the prior k times toward `priorMean`. With competence weights summing to 1 and Σw²σ² variance ([index.ts:371-402](../packages/adaptive-learning/src/index.ts)) this is a bias, not an error term, and it is one of the reasons the "strong prior everywhere" variant loses ~9 pp exact accuracy in the sweeps (§5.1, Stage B2). The fix in §5.3 (weak/no prior for *reported* estimates, strong prior only for routing) resolves this as a side effect.

### 3.3 UX — student and lecturer

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| U1 | 🔴 | Zero i18n in both new pages and all 7 shared components (~165 hardcoded English strings) despite loaded message bundles | R1-C2 / R2-F19 — re-verified (0 `useTranslations` hits; bundle loaded at [PWA :967-977](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx)) |
| U2 | 🟠 | KPRIM rendered as generic multi-select; empty submission allowed and graded "all false"; custom renderer forks `StudentElement` | R1-C1 / R2-F23b — re-verified: [PWA :167-176 (`canSubmit`), :522-568](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx) |
| U3 | 🟠 | Instant start on card click, no intro/consent screen, no "Resume" signal, attempt stuck IN_PROGRESS if no first item selectable | R1-C3 / R2-F23 — re-verified: [PWA :359-371,596-601](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx) |
| U4 | 🟠 | Live theta/level badge shown after every answer (whipsaws with C1; invites gaming; progress denominator is Σ caps) | R1-C4 / R2-F18 — re-verified: [PWA :604-625,456-462](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx) |
| U5 | 🟠 | Results default to BEST attempt — wrong for placement/classification; retakes can grind upward | R1-C5 — re-verified: [services/adaptiveLearning.ts:508,1384-1400](../packages/graphql/src/services/adaptiveLearning.ts) |
| U6 | 🟠 | Publish/Archive with no confirm, no error handling, no pre-publish pool validation; Save has no destructive-edit warning (→ S3) | R1-C6 / R2-F20+F21 — re-verified: [manage :439-477](../apps/frontend-manage/src/pages/courses/%5Bid%5D/adaptive-learning.tsx) |
| U7 | 🟡 | 3,679-line manage monolith, hand-rolled inputs/tabs instead of design-system, `any`-typed renderers, zero `data-cy`, internal ids shown to students (`Q-482`), brittle `message.includes('Unauthorized')` auth detection | R1-C7 / R2-F25+F26 — re-verified spot-wise |
| U8 | 🟡 | Charts under-labeled for non-psychometrician lecturers; hidden Y axis on ICC | R2-F24 — stands |

**N6 🟡 Back-navigation is blocked with a misleading message, while reload/close lose the UI state anyway.**
During an active attempt, `router.beforePopState` unconditionally cancels back-navigation and shows *"Your standing updates after each answer. Please finish the active test before leaving."* ([PWA :145-156](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx)). But (a) the message is wrong — the attempt is resumable by design ([services/adaptiveLearning.ts:641-652](../packages/graphql/src/services/adaptiveLearning.ts)), nothing is lost by leaving; (b) it traps the user: there is no "leave anyway" path; (c) it is inconsistent — reload and tab-close are not guarded at all, and after a reload the student lands on the picker with a button labeled "Start adaptive test" that actually resumes (attempt state lives only in a `useState`, never rehydrated from `adaptiveAttemptState` on mount). The combination teaches students that leaving is dangerous when it isn't, and that starting is fresh when it isn't.
*Fix:* drop the popstate block (or replace with a non-blocking "your attempt will be saved" toast); on mount, query the in-progress attempt and render a "Resume test (question N)" card; keep one honest message about resumability on the intro screen (U3).

**N7 🟡 The "error interval" is a ±1·SE band presented as *the* interval.**
The completed view labels `theta ± 1·SE` as "Error interval" with "+/− SE around the estimate" ([PWA :667-668,720-730](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/adaptive-learning.tsx)); the same 1·SE convention is drawn on `LevelBand`. A ±1·SE band is ~68 % coverage — students and lecturers will read it as "the truth is in here", and with 6 levels the band often spans two levels without saying so. Once C7 (honest labeling) is done, this becomes the natural place: either show a ~90 % band (±1.64·SE) or label the band's coverage explicitly, and state the level-classification implication ("your level is X; adjacent level Y cannot be ruled out") — which the classification-aware stop from §5.2 makes decidable.

**N8 🟡 Load errors on the manage page are silently swallowed.**
The main assessments query destructures only `{ data, loading, refetch }` ([manage :281-285](../apps/frontend-manage/src/pages/courses/%5Bid%5D/adaptive-learning.tsx)); on error, `assessments` is `[]` and the page renders the pristine empty state — a lecturer with a broken session sees "no assessments" instead of an error (R2-F22 reported `error` as unrendered; it is now not even destructured).
*Fix:* copy the error branch from the sibling `index.tsx`.

### 3.4 Code quality, tests, process

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| Q1 | 🔴 | CI red: package never built before graphql codegen in `check-types.yml`/`test-graphql.yml`; branch conflicts with `v3`; 8 Cypress live-quiz specs broken by seed changes | R2-F1–F3 — process findings; re-check after rebase |
| Q2 | 🟠 | The package's own tests (incl. the simulation — the main quality gate) never run in CI (`test`/`test:simulation` vs `test:run` convention) | R2-F4 — re-verified: [package.json scripts](../packages/adaptive-learning/package.json), no `test-adaptive-learning.yml` |
| Q3 | 🟠 | Service layer (2,252 lines: lifecycle, authz, races) has zero tests; no E2E touches either page | R1-E / R2-F27 — re-verified: no `packages/graphql/test/*adaptive*` |
| Q4 | 🟡 | No bounds validation on numeric config (`questionThreshold ≤ 0` instant-finalizes; negative weights partially guarded by `Math.max(0, …)` in the lib only) | R2-F32 — re-verified: [services/adaptiveLearning.ts:1070-1098](../packages/graphql/src/services/adaptiveLearning.ts) has no numeric range checks. Subsumed by N1's information-budget validation |
| Q5 | 🟡 | Plain `Error` instead of `GraphQLError` codes; missing timestamps on 5 child models; hand-edited migrations; whitespace-only prisma churn; internally inconsistent seed timing data | R2-F33 / R1-E — stands |
| Q6 | 🟡 | 17k-line single commit, no design doc; three migrations to squash | R1-E / R2-F5 — stands (this document series now partially fills the design-doc gap) |

### 3.5 Didactics

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| D1 | 🟠 | Validity rests on un-audited expert level assignment; no misfit detection surfaced (observed vs expected accuracy per item) | R1-D1 / R2-F13 — stands; §5.2's Stage F2 quantifies the damage (≤ −18 pp exact under plausible misspecification) and the roadmap keeps the calibration plan |
| D2 | 🟡 | "Learning" goal unserved: no per-answer feedback, generic practice CTA only | R1-D2 — stands |
| D3 | 🟡 | Level semantics (floor vs nearest, retake policy, anchor placement) are policy decisions to settle with the course team and then document | R1-D3 — stands, now with numbers: §5.1 shows the choice is didactic, not statistical |

---

## 4. From CEFR placement to a generic level-classification instrument

The data model is already generic (levels are arbitrary ordered labels; competences/subcompetences are free-form; the CEFR preset is just one button). What actually blocks generic use is smaller and mostly cosmetic — plus one conceptual decision:

**G1 🟠 Level colors are keyed to hardcoded English level names — and break for CEFR itself.**
`getLevelColor` matches labels against `novice|developing|proficient|advanced|expert` (or single letters `n/d/p/a/e`), else falls back to a positional index clamped to **5 palette entries** ([utils.ts:3-76](../packages/shared-components/src/adaptive/utils.ts)). Consequences today: CEFR labels match nothing → `LevelBadge` (called without index, default 2 — [LevelBadge.tsx:12](../packages/shared-components/src/adaptive/LevelBadge.tsx)) renders **every** CEFR badge in the same "proficient" blue; in the band chart, C1 and C2 share a color (index 5 clamps to 4); German or custom labels get whatever position happens to be passed at each call site, so the same level can have different colors in badge, histogram, and band (R2-F24 overlap).
*Fix:* colors must be a pure function of `(order, levelCount)` — interpolate the ordinal position into a fixed gradient (or repeat the 5-color palette by even spacing); delete label matching entirely. One shared function, used by badge/band/histogram, unit-tested for k = 2…10 levels.

**G2 🟠 The mapping rule (floor vs nearest) must become an explicit, per-assessment semantic — because "level" means different things in different subjects.**
For *placement* ("which course level do I join?"), the mastery/floor rule is didactically safer (assign the level the student demonstrably clears — R1-D3, R1 §5). For *proficiency reporting* ("which band describes me best?"), nearest-anchor is the natural reading. The sweeps show these are **equally accurate under their own semantics (0.84–0.85 exact) while mixing them costs ~30 pp** (Appendix, Stage A2) — so this is a free choice, but it must be made *once* and applied consistently in `mapThetaToLevel`, the simulation, the frontend bands (C3), and the result-message intervals. Recommendation: add `levelMappingRule: NEAREST | MASTERY` to the assessment (default per preset: MASTERY for placement presets, NEAREST for self-assessment presets), implement both in the lib behind that switch, and delete the sim's private mapping.

**G3 🟡 Presets over parameters.**
The config surface (a, c derivation, theta bounds, SE thresholds, `topInformationRatio`) is expert-level and — per N1 — partially inert. R2-F26's suggestion becomes the generic-use cornerstone: ship 2–3 opinionated presets ("Language placement (CEFR)", "Topic mastery check (3–4 levels)", "Diagnostic self-assessment") that pin the psychometric knobs to the blessed values from §5 and expose only structure (levels, competences, item mapping), texts, and display toggles. Keep the raw parameters behind an "advanced" disclosure. This also shrinks the misconfiguration surface that U6's pre-publish validation has to police.

**G4 🟡 Level-count guidance belongs in the product.**
Generic classification usually needs 3–5 levels, not 6. The sweeps (Appendix, Stage G2/D3) quantify what the UI should tell lecturers: at a fixed ~35-minute budget, exact accuracy is ~0.86 at 3–4 levels vs ~0.84 at 6 vs ~0.77 at 8 — and at 3–4 levels the same accuracy is reachable in **16–27 minutes** because the classification stop fires early (38–64 % of stops). Concretely: in the levels editor, show "more levels ⇒ longer test and/or less exact placement" with the expected item count per added level; warn above 6; and for the generic mastery preset default to 4 levels.

**G5 🟡 Anchor placement is an assumption to surface, not code to change.**
Equidistant anchors over `[−3, 3]` are fine as the default for any subject (the scale is arbitrary; only the anchors give it meaning). Two things should be documented for lecturers (docs page, D3): the interval `[thetaMin, thetaMax]` is not a knob to tune (see §5.1); and if a pilot shows bunched abilities (everyone lands in 2 of 6 levels), the remedy is fewer levels or re-leveled items — not moving theta bounds.

**G6 🟡 Subject-agnostic grading hardening.**
C5 (free-text exact match) generalizes beyond Spanish accents: any subject with numeric answers ("0.5" vs "1/2"), units, or synonyms will misgrade. For the generic instrument: keep SC/MC/KPRIM as the recommended pool types (and say so in the docs/preset), apply NFD + diacritic-strip + whitespace-collapse normalization in the adaptive grading path as the baseline, and treat free text as advanced-use with a visible warning on the mapping screen.

---

## 5. The three design questions, answered

All numbers below come from Monte-Carlo sweeps driven through the **production-shaped** algorithm (drain-in-order sequencing, coverage-weighted subcompetence choice, max-information item choice via the actual lib functions, per-subcompetence stop rules), with responses generated from a 3PL model at the learner's true theta — including scenarios where the items violate the configured parameters. Ground truth uses uniformly distributed true abilities and scores each mapping rule under its own semantics (the prior reviews' sim, with learners exactly at anchors, flatters nearest-mapping). Full methodology, tables, and reproduction script: Appendix.

### 5.1 How to set discrimination `a`, difficulty `b`, and the theta interval

**Theta interval: keep `[−3, 3]` and stop exposing it.** The theta scale has no external meaning — only the anchors and the response model give it one. Widening or narrowing `[thetaMin, thetaMax]` merely rescales anchor spacing (b-gaps) and every SE threshold simultaneously; there is no configuration goal a lecturer could achieve with it that isn't better achieved by changing the number of levels. Recommendation: hardcode `[−3, 3]` in the presets, move the fields behind "advanced", and validate `resultMessage` intervals against it (already done, [services/adaptiveLearning.ts:1100-1149](../packages/graphql/src/services/adaptiveLearning.ts)).

**Difficulty `b`: keep "b = level anchor", equidistant.** This is the design's load-bearing simplification and it survives stress-testing: with 10–20 % of items mis-leveled by one level, exact accuracy drops only 1–4 pp (Stage F2: 0.84 → 0.83/0.80) — the pooled estimates average the noise out. Two rules of thumb for authors follow from the information math: items are most informative for the *decision* when their true difficulty sits near the **boundaries** between adjacent levels, and every subcompetence needs coverage of every level the test should be able to assign (the coverage-based stop, [services/adaptiveLearning.ts:2000-2010](../packages/graphql/src/services/adaptiveLearning.ts), silently stops a subcompetence whose levels run out). Anchor spacing is determined by the level count: Δb = (θmax − θmin)/(K−1) = 6/(K−1); below Δb ≈ 0.85 (K = 8 on the default range) the levels stop being resolvable in any reasonable time (Stage G2: exact 0.77 at K = 8 vs 0.84 at K = 6).

**Discrimination `a`: default 1.2, allow 1.5 for vetted pools, and never overstate it.** The empirical result that matters most (Stage E2 vs F2):

| configured a | true a | exact | note |
|---|---|---|---|
| 1.0 | 1.0 | 0.80 | honest, low |
| 1.2 | 1.2 | 0.82 | **recommended default** |
| 1.5 | 1.5 | 0.84 | good if items really are sharp |
| 2.0 | 2.0 | 0.82 | over-peaked; no gain |
| **1.5** | **1.0** | **0.74** | *optimism penalty: −6 pp vs honest 1.0* |
| 1.5 | 0.8 (+20 % mis-leveled) | 0.66 | worst plausible case |

Overstating `a` hurts twice: the engine trusts each answer too much (over-confident routing and SE), and the SE-based stop under-samples. Understating it merely wastes a few items. Since real classroom items typically discriminate at a ≈ 0.8–1.5, the safe default is **1.2**; switch an assessment to 1.5 only when the pool is professionally written/reviewed (the CEFR case), and revisit per-item `a` only when empirical calibration lands (Phase 3). Keep `c` derived from the item format as implemented ([index.ts:122-133](../packages/adaptive-learning/src/index.ts)) — it is correct given the all-or-nothing dichotomization, and it is not worth exposing. What *is* worth surfacing (docs + pool-preview): the item **format** sets the information budget — FREE_TEXT/KPRIM items carry ~1.5–1.6× the information of 4-choice SC items (table in N1), which translates directly into ~25 % shorter tests at equal accuracy (Stage H2: 53 vs 69 items).

### 5.2 Stop conditions for a ≤ 30-minute test

**The budget arithmetic.** At ~30 s/item, 30 minutes buys **N ≈ 60 items**; leave headroom for intro/results screens and slow readers and plan for **N ≈ 45–55**. Since production drains structure exhaustively, the worst-case length is `C · S · cap`, so the parametric rule is:

> **cap ≈ N / (C · S)** — e.g. 3 competences × 3 subcompetences → cap 5–6; 3 × 2 → cap 8–10; 2 × 3 → cap 8.

and the structure size itself is the primary lever: **keep C · S ≤ 9 for a 30-minute, 6-level test**. (The 3 × 15 structure of the shipped simulation — 45 subcompetences — can never fit; it would need cap 1.)

**Which stop rules, and where.** The current per-subcompetence SE rule cannot work (N1): a subcompetence sees only `cap` items, and with SC items SE ≈ 0.61 is the floor at cap 8 — every threshold below that is dead, and thresholds above it stop on nearly no information. The redesign that the sweeps validate:

1. **Per subcompetence, keep only mechanical guards:** the item cap (from the formula above), coverage exhaustion (already implemented), and — if a fast-exit is wanted — SE ≤ **0.65** as an honest early-out for very consistent answer patterns (fires rarely; harmless).
2. **Move the convergence decision to the competence level,** where information pools across subcompetences (24 SC items ⇒ SE ≈ 0.35): stop the whole competence when its pooled estimate is precise enough, subject to a **minimum of 2–3 items per enabled subcompetence** for content coverage. This is a moderate service change (`isSubCompetenceStopped` gains a competence-criterion branch; [services/adaptiveLearning.ts:1936-1972](../packages/graphql/src/services/adaptiveLearning.ts)).
3. **Make the competence-level criterion classification-aware, not SE-based** (R1 §5.1's CCT recommendation, now validated): stop when the competence's `θ̂ ± 1.28·SE` (~80 % interval) lies **inside one level band** under the assessment's mapping rule. This targets the actual decision: clearly-placed students finish early, boundary students get the remaining budget. In the sweeps it fires for 16 % (6 levels) to 54 % (4 levels) of competences and cuts mean length by 4–35 % at unchanged accuracy (Stages C2/D3). A raw SE threshold then becomes a redundant knob — if kept for the UI, set it to ~0.35 at competence level and validate reachability at save time (N1's fix).
4. **Retire the assessment-level `questionThreshold` as a per-subcompetence default** (50 is meaningless) and repurpose it as a **total test cap** (= N), which also fixes the progress-bar fiction (U4/R2-F18): "Question 12 · at most 48" is honest.

**What to expect within the 30-minute budget** (SC-heavy pool, a = 1.5, recommended stops; full table in the Appendix):

| Structure | cap | Levels | Items (mean) | Minutes | Exact | Adjacent |
|---|---|---|---|---|---|---|
| 2 × 3 | 8 | 6 | 46 | **23** | 0.85 | 1.00 |
| 3 × 3 | 6 | 6 | 54 | **27** | 0.80 | 1.00 |
| 3 × 2 | 10 | 6 | 60 | **30** | 0.83 | 1.00 |
| 4 × 3 | 5 | 6 | 60 | **30** | 0.81 | 1.00 |
| 3 × 3 | 7 | 6 | 62 | 31 | 0.85 | 1.00 |
| 3 × 3 | 8 | **4** | 53 | **27** | 0.86 | 1.00 |
| 2 × 2 | 10 | **4** | 32 | **16** | 0.85 | 1.00 |

Three planning insights the table encodes: (i) **~0.85 exact / 1.00 adjacent is the practical ceiling** for 6 expert-leveled levels in 30 minutes — communicate that adjacent-level errors are expected and handle them procedurally (teacher review of boundary cases, easy level switch in week 1); (ii) **fewer competences with more subcompetences each beat the reverse** at equal budget (2×3 cap 8: 0.85 @ 46 items vs 3×2 cap 8: 0.76 @ 48 items) because the final score averages *competence* estimates and each competence needs ~20+ items to be individually solid — don't split reporting dimensions you don't need; (iii) with 3–4 levels the same machinery is comfortably inside budget with room for KPRIM/free-text pools to shrink it further (~25 %, Stage H2).

**Direct answer to "what SE value for the subcompetence stop":** with the current architecture (stop per subcompetence, SC items), there is **no good value** — anything ≤ 0.6 never fires at sane caps and anything above stops on ~2 items' worth of information. Set 0.65 as a cosmetic early-exit if the field must exist, and implement the competence-level classification stop as the real mechanism. If the team explicitly wants to keep a pure per-subcompetence SE stop instead, the pool must shift to KPRIM/free-text items and the threshold should be ≈ 1/√(0.5·cap) (cap 8 → 0.5, cap 10 → 0.45) — reachable, but it still spends items less efficiently than the competence-level rule.

### 5.3 How to aggregate scores within and across competences

The as-built pipeline is: subcompetence estimate = pooled MLE over that subcompetence's responses (display only); competence estimate = pooled MLE over **all the competence's responses directly** (not an average of subcompetence estimates — [services/adaptiveLearning.ts:1833-1852](../packages/graphql/src/services/adaptiveLearning.ts)); overall = lecturer-weighted mean of competence thetas with SE = √(Σ wᵢ²σᵢ²) ([index.ts:371-402](../packages/adaptive-learning/src/index.ts)); class dashboards additionally pool per-student estimates inverse-variance ([index.ts:347-369](../packages/adaptive-learning/src/index.ts)). **This layering is right — keep it**, with four adjustments:

1. **Keep pooling responses directly at the competence level.** Pooling all 20-odd responses into one likelihood is statistically strictly better than averaging 3 noisy 6-item subcompetence MLEs (which would need bias-prone small-sample estimates). The sweeps confirm ~20+ pooled items per competence is where estimates become individually reliable (§5.2, insight ii). Do **not** switch to inverse-variance aggregation of subcompetence estimates within a competence.
2. **Split the estimator by purpose (fixes C1 without the N5 penalty):** *routing and stopping* use MAP with the strong prior — N(warm-start θ₀, 1) at competence level, and at subcompetence level use the **current competence estimate as the prior mean** (hierarchical warm start; in the sweeps this beats a global-0 prior by up to 17 pp exact under anchor ground truth and never hurts); the *reported* estimates (final per-competence theta, overall theta, everything students/lecturers see) use a **weak prior N(0, 2) or plain MLE** — the strong prior as final estimator costs 9 pp exact (0.76 vs 0.85, Stage B2) via shrinkage of the top/bottom levels, and compounds across competences (N5).
3. **Keep lecturer weights for the overall score, and document what they are.** The weighted mean with normalized weights is the right composite when weights express *curricular importance* (a normative choice — exactly what the manage UI's rebalancing editor implies). Inverse-variance weighting (which the lib also offers) would instead let the *test's precision* set the weights — appropriate for pooling repeated measurements of the same construct (as used in the class dashboard), wrong for a curriculum-weighted report card. One sentence of docs/tooltip prevents future "why not inverse-variance?" churn. Note Σw²σ² assumes independent competence estimates — true here by construction (disjoint response sets), worth a code comment.
4. **Aggregate thetas, then map to a level once per reporting node — never average levels.** The current code does this correctly (maps at subcompetence, competence, and overall separately via `mapThetaToLevel`); preserve it through the G2 mapping-rule refactor so all three tiers and the result messages use the same rule. Two display guards to add: suppress the level badge (show "insufficient data") for any node with fewer than ~4 responses — a 2-item subcompetence "level" is noise presented as fact — and keep reporting per-competence levels alongside the overall level, since a composite level can mask a two-level spread between competences (the existing `CompetenceBars` UI already supports this well).

---

## 6. Path to production (consolidated roadmap)

Merges R1 Part 4 and R2 §5 with this review's additions; ordering preserved where the prior reviews agreed. Each step names an acceptance check.

### Phase 0 — Unbreak & make safe (before any student, including pilots)

1. **Rebase onto `v3`, fix CI build order, make the seed additive again, wire package tests into CI** (Q1, Q2). *Check:* green CI including a `test-adaptive-learning.yml` that runs the simulation.
2. **Close the answer-key and membership leaks** (S1, S2, N3): delete unused `publishedAdaptiveAssessments`; introduce a participant-facing assessment type without `elements`/config internals; `requireCourseParticipation` on the info listing. *Check:* service test asserting no `correct`/`solutions`/`discrimination` in any participant payload; PWA flow works.
3. **Atomic, non-destructive upsert** (S3): single transaction; metadata edits never touch attempts; structural edits with attempts require explicit `confirmDiscardAttempts` + scary modal (U6). *Check:* title-only edit preserves attempts; forced failure in config creation leaves old config intact.
4. **Submission integrity** (S4, S7): persist served element id, require match on submit, `@@unique([attemptId, adaptiveElementId])`, single transaction for grade→insert→estimate→finalize, partial unique index for IN_PROGRESS attempts. *Check:* service tests for replay, foreign-element, and double-click paths.
5. **Element ownership filter at config time** (S5) — copy the `liveQuizzes.ts` permission filter. *Check:* foreign element id rejected.
6. **Defuse `showSolutions`** (S6, N2): phase-aware redaction (never on pending `nextElement`), env-gate the toggle, seed with `false`. *Check:* flag on + IN_PROGRESS attempt → sanitized element.

### Phase 1 — Measurement correctness (the §5 package)

7. **Estimator split** (C1, N4, N5, §5.3): MAP routing (competence-warm prior at subcompetence level), weak-prior/MLE reporting; posterior SE when prior active; regression tests: 1 correct answer → |θ| < 1.5, posterior SD ≈ 0.9.
8. **One mapping rule** (C2, C3, G2): `levelMappingRule` on the assessment; lib implements both; frontend bands/`mapLevelsToBands` computed from the lib's boundaries; sim's private mapping deleted. *Check:* unit test pinning badge-level == band-level == message-interval-level for a theta grid, both rules.
9. **Stop redesign** (N1, §5.2): competence-level classification stop (CI-in-band, z = 1.28, min 2–3 items/subcompetence), per-subcompetence cap from the N/(C·S) formula, `questionThreshold` repurposed as total cap, save-time reachability validation for any SE threshold, honest progress display ("Question 12 · at most 48"). *Check:* simulation shows early stop for clearly-placed learners; save with unreachable SE threshold → warning.
10. **One blessed default set + presets** (N1, G3): a = 1.2, cap by formula, 6-level CEFR preset and 4-level mastery preset; delete or implement `topInformationRatio` (recommended: implement as randomesque top-3 selection — it is also the exposure-control lever, R2-F14) and competence thresholds (now meaningful via step 9). *Check:* fresh assessment via preset matches §5.2 table behavior in the sim.
11. **Production-shaped simulation in CI** (C2, Q2): port the sweep harness (Appendix; drives the *actual* lib functions with production sequencing, uniform ground truth, misspecification scenarios) into `packages/adaptive-learning/test/`; re-baseline thresholds; assert mean length ≤ budget. *Check:* CI fails if accuracy or length regresses.
12. **Grading hardening** (C5, G6): NFD/diacritic/whitespace normalization for adaptive free-text; single-line input; docs recommending SC/MC/KPRIM pools.

### Phase 2 — UX & platform readiness

13. **i18n sweep** (U1) — all strings to `packages/i18n` (de + en), including the 7 shared components.
14. **Attempt lifecycle UX** (U3, N6, U4): intro screen (purpose, expected length from the §5.2 table, retake policy, resumability), resume detection on mount, finalize-on-start when no item selectable, remove the popstate trap, hide live theta/level by default behind a `showLiveEstimate` option.
15. **Shared question components for rendering** (U2): reuse `StudentElement`/choice renderers; KPRIM as explicit true/false rows with per-row requirement.
16. **Manage hardening** (U6, U7, N8, Q4): pre-publish readiness check (items per subcompetence × level from the existing pool preview), confirm modals, error branches, bounds validation (folded into step 9's reachability check), split the monolith, design-system inputs, `data-cy` everywhere.
17. **Results semantics** (U5, N7, C6): default LATEST attempt, per-question elapsed deltas, labeled confidence band, lazy `ABANDONED` marking, memoized results query + composite index (R2-F31).
18. **Tests & docs** (Q3, Q5, Q6): service-level vitest for the Phase-0/1 behaviors, one Playwright happy path, lecturer docs page (level semantics G5, level-count guidance G4, item-format information table from N1).

### Phase 3 — Pilot & calibration (per use case)

19. **Pool authoring to the sizing rules** (§5.1/5.2): C·S ≤ 9 for 30 min; ≥ 5 items per subcompetence × level; boundary-targeted difficulties; ≥ 2 independent levelers with reconciliation, pairwise comparison for contested items (R1 §5.5).
20. **Known-level dry run + standard setting** (D1, R1 Phase 3): compare against teacher judgment; go/no-go thresholds — exact ≥ 0.70, adjacent ≥ 0.95, median ≤ 25 min, max item exposure ≤ 40 %.
21. **Misfit surfacing → empirical calibration** (D1, C7): expected-vs-observed accuracy column with flag; then per-item logistic-regression `b̂` (and later `â`) from accumulated responses, cross-checked against `catR` (R1 §5.2); switch vetted pools to calibrated parameters and revisit a = 1.5.

---

## Appendix — Simulation methodology & full results

**Harness.** [`project/adaptive-learning-sweep-harness.mjs`](adaptive-learning-sweep-harness.mjs) (run with `node project/adaptive-learning-sweep-harness.mjs` after `pnpm --filter @klicker-uzh/adaptive-learning build`; step 11 ports it into the package's test suite) imports the built `@klicker-uzh/adaptive-learning` package and re-implement only the service-layer glue, faithfully to production: competences drained in configured order; subcompetence via `selectSubCompetence` with remaining-level-coverage weights; item via `selectNextItem` (max information at the subcompetence estimate); per-subcompetence stops (cap / SE / coverage). Variants under evaluation add: MAP routing prior (SD 1, subcompetence prior mean = pooled competence estimate), final estimator (strong SD 1 / weak SD 2 / MLE), competence-level classification stop (CI z = 1.28 inside one band, min 2 items per subcompetence), and both mapping rules. Final score: per-competence pooled estimate → `aggregateWeightedEstimates` (equal weights) → level.

**Learners.** 300 per configuration, true theta ~ U[−3 − Δ/2, 3 + Δ/2] (Δ = anchor gap), seeded RNG (mulberry32), responses drawn from 3PL at the *true* item parameters. Ground-truth level = the learner's band under the same semantics as the evaluated mapping rule (self-consistent), except where a crossed condition is stated. Item pool: 5 items per subcompetence × level; 4-choice SC unless stated (c = 0.25); misspecification scenarios shift 10–20 % of items ±1 level and/or generate responses with true a < configured a.

**Baseline re-runs:** `pnpm --filter @klicker-uzh/adaptive-learning test` → 14/14 pass; `test:simulation` → 1/1 pass (2.8 s).

**Stage A2 — mapping semantics** (3×3, cap 8, SE .55, a 1.5, final = weak): nearest/GT-nearest **0.85**, floor/GT-floor **0.84**, crossed either way **0.55–0.56** exact (adjacent 1.00 throughout). → mapping is policy; consistency is what matters (G2).

**Stage B2 — final estimator** (same config, GT nearest): strong prior **0.76**, weak prior **0.85**, MLE **0.86** exact. → §5.3 adjustment 2.

**Stage C2 — stop architecture** (3×3, a 1.5): sub-level SE .55 → never fires (100 % cap stops), 72 items; competence-level SE .40 → fires 7 %; classification stop → fires 16 %, 69.3 items at unchanged 0.84 exact; with 4 levels fires 54 % (53.1 items) and 3 levels 64 % (45.1→38.5 items at cap 6). Sub-level SE floor confirmed empirically: a = 2.0 is the only unprimed config where sub-level SE .55 fires (18 %).

**Stage D3 — feasibility table** (competence SE .35 + classification stop, map nearest, final weak, a 1.5, SC4, 30 s/item): the table in §5.2, plus: 2×2 cap 10 /6 levels → 39.9 items, 20 min, 0.80; 4×3 cap 8 /6 levels → 92.4 items, 46 min, 0.86 (the "accuracy costs time" upper row); 2×2 cap 10 /4 levels → 31.9 items, 16 min, 0.85; 3×3 cap 6 /3 levels → 38.5 items, 19 min, 0.86.

**Stage E2/F2 — discrimination & misspecification** (3×3 cap 8, competence stop): table in §5.1; robustness: misLevel 10 % → −1 pp, 20 % → −4 pp; trueA 1.0 under configured 1.5 → −10 pp (vs −4 pp when honestly configured 1.0); worst case (trueA 0.8 + 20 % mis-leveled) → 0.66 exact, adjacent still 0.98–1.00.

**Stage G2 — level count** (same config): 3 → 0.86 @ 45.1 items, 4 → 0.86 @ 53.1, 5 → 0.84 @ 60.6, 6 → 0.84 @ 69.3, 8 → 0.77 @ 72 (cap-bound). Adjacent 1.00 throughout.

**Stage H2 — item format** (same config): SC4 69.3 items / 0.84; KPRIM 58.1 / 0.82; FREE_TEXT 52.7 / 0.86. → information-budget table in N1 and the "prefer low-guessing formats" guidance (G6, §5.1).

**Stage I2 — shipped manage-UI defaults** (cap 5, SE 0.3, a 1.2, no prior, sub-level stops, MLE final): 45 items (22.5 min), **0.75 exact / 1.00 adjacent**, mean final SE 0.43, SE stop fired 0 times in 300 × 9 subcompetence runs. The shipped configuration classifies adequately but is neither adaptive in length nor honest about its knobs — and pays U4's whipsaw UX for it.

**Closed forms used in §5:** I(θ=b) = a²(1−c)/(4(1+c)); SE_min(n) = 1/√(n·I); classification-stop feasibility: z·SE ≤ Δb/2 with Δb = 6/(K−1).
