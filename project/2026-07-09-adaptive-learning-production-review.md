# Review - Adaptive Learning Production Readiness

**Reviewed state:** branch `adaptive-learning` at `2480cda80` (`Merge branch 'v3' of github.com:uzh-bf/klicker-uzh into adaptive-learning`), reviewed on 2026-07-09.

**Scope:** adaptive learning as currently present in this branch: the pure `@klicker-uzh/adaptive-learning` package, the new competence-tree / adaptive-practice-quiz Prisma model, the removed standalone adaptive activity surface, remaining old adaptive schema and seed code, the standard practice-quiz GraphQL and PWA surfaces that are intended to host adaptive mode later, and the prior review/plan documents in `project/`.

**Verification run for this review:**

- `pnpm --filter @klicker-uzh/adaptive-learning check` - passed.
- `pnpm --filter @klicker-uzh/adaptive-learning test` - 22/22 passed.
- `pnpm --filter @klicker-uzh/adaptive-learning test:simulation` - 1/1 passed.

**Not run:** full `pnpm run check:all`, full build, GraphQL local tests, or browser verification. This is a review artifact only, and the new adaptive practice-quiz UI/runtime is not implemented yet, so there is no new end-to-end adaptive flow to exercise in the browser.

## Executive Verdict

The branch is in a much safer and cleaner place than the original standalone adaptive-learning implementation. The most dangerous prior findings are no longer publicly reachable: the standalone Manage/PWA adaptive pages and their GraphQL service layer have been removed, and the future product direction is now correctly centered on reusable competence trees plus `PracticeQuizMode.ADAPTIVE`.

The current feature is **not production-ready yet**, but for a different reason than before: the public adaptive activity is gone, while the replacement product surface is mostly a foundation. The pure measurement package and Prisma schema are promising; the GraphQL services, permission model, authoring UI, student runtime, and results workflow still need to be built.

The highest-priority production blockers are:

1. **No adaptive practice-quiz product surface exists yet.** Prisma has `PracticeQuiz.mode` and `PracticeQuizAdaptiveConfig`, but GraphQL does not expose mode/config, `manipulatePracticeQuiz` still only creates stack-based quizzes, and the PWA still renders the standard stack runner. Evidence: [quiz.prisma](../packages/prisma/src/prisma/schema/quiz.prisma), [practiceQuiz.ts](../packages/graphql/src/schema/practiceQuiz.ts), [practiceQuizzes.ts](../packages/graphql/src/services/practiceQuizzes.ts), [PracticeQuiz.tsx](../apps/frontend-pwa/src/components/practiceQuiz/PracticeQuiz.tsx).
2. **The new authorization contract is still unwritten in code.** The old vulnerable service was deleted, but there is not yet a competence-tree service enforcing tree ownership, course permissions, element permissions, linking rules, participant access, or result anonymization.
3. **The psychometric engine is better, but the simulation gate is still not production-shaped.** Core tests pass, but the simulation still uses FREE_TEXT-only pools, old private final mapping, large caps, and no SC/MC/KPRIM/numerical mix.
4. **UX is still a plan, not a product.** The competence-tree editor, adaptive mode wizard, student adaptive runner, completion level-band overview, and anonymous lecturer results dashboard do not exist yet.
5. **CI and docs still lag the feature.** Adaptive package tests are not wired to the repo's `test:run` convention or a package workflow; no engineering wiki page records the mapping/reachability decisions.

## Findings

Severity legend:

- **P0:** blocks any production or pilot exposure.
- **P1:** should be fixed before a controlled pilot.
- **P2:** important before broad rollout.
- **P3:** polish or maintainability.

### F1. P0 - Adaptive practice quiz mode exists in Prisma only, not in the API or UI

`PracticeQuizMode.ADAPTIVE` and `PracticeQuizAdaptiveConfig` are present in the schema ([competence.prisma](../packages/prisma/src/prisma/schema/competence.prisma), [quiz.prisma](../packages/prisma/src/prisma/schema/quiz.prisma)), but the GraphQL `PracticeQuiz` type still picks and exposes only standard fields: `id`, `name`, `displayName`, `pointsMultiplier`, `resetTimeDays`, `orderType`, `status`, `stacks`, etc. It does not expose `mode`, `adaptiveConfig`, levels, competence tree, attempt state, or adaptive results ([practiceQuiz.ts](../packages/graphql/src/schema/practiceQuiz.ts)).

`manipulatePracticeQuiz` accepts `stacks`, `courseId`, `multiplier`, `order`, and `resetTimeDays`; it never accepts mode or adaptive config, and it always writes stack data ([practiceQuizzes.ts](../packages/graphql/src/services/practiceQuizzes.ts)). The Manage wizard likewise has no mode selector or competence-tree selection; its settings page only offers course, gamification multiplier, reset interval, and order. The PWA practice quiz page fetches `GetPracticeQuiz` and renders the standard `PracticeQuiz` component with stacks and local-storage progress.

**Impact:** no student can take the new adaptive quiz, no lecturer can create one, and no owner can configure tree weights or see adaptive result distributions. This is expected for an intermediate branch, but it must be treated as the central production blocker.

**Recommendation:** implement the backend product surface before adding more UI shell:

- GraphQL types for competence trees, tree nodes, levels, coverages, assignments, adaptive config, attempt state, estimates, and anonymized result buckets.
- Mutations for tree CRUD, tree-course linking, element assignment, adaptive practice-quiz create/edit, start attempt, submit response, abandon/resume attempt.
- Query fields for owner preview, participant-safe next item, student completion summary, and lecturer anonymous distributions.
- Generated operations and frontends only after those contracts are stable.

### F2. P0 - Permission semantics for reusable competence trees are still not encoded

The model supports reusable trees via `CompetenceTree.ownerId` and `CompetenceTreeCourse` links, including `linkedById` ([competence.prisma](../packages/prisma/src/prisma/schema/competence.prisma)). That is a good v1 shape. But because no GraphQL service exists yet, the actual authorization rules are absent.

The permissions contract must be explicit before resolvers are added:

- Tree CRUD: tree owner or future tree-shared users only.
- Linking tree to course: require both manage permission on the course and access to the tree.
- Element assignment to tree: require permission on the element plus write/admin access to the tree.
- Adaptive quiz creation/edit: require practice quiz write permission and tree access; require the tree to be linked to the target course or link it transactionally with audit.
- Student runtime: require a `Participation` row for the course, not `Participation.isActive`; `isActive` is leaderboard state, not generic access.
- Results: participant-safe personal summaries for students; anonymous distributions for lecturers with small-bucket suppression.

**Impact:** cross-course reuse is a content-disclosure boundary. Linking a tree to a course effectively exposes its assigned element pool to that course's participants through delivery. Without precise authorization, a course owner could accidentally or deliberately use trees/elements they should not distribute.

**Recommendation:** implement all adaptive services through the repo's permission helpers and service conventions, not raw `ownerId === ctx.user.sub` checks. Add service tests for each operation's positive and negative cases.

### F3. P0 - Served-item integrity must be designed before the attempt runtime exists

The new schema stores `nextAssignmentId` on `AdaptivePracticeQuizAttempt`, stores `assignmentId` per response, and enforces one response per assignment per attempt via `@@unique([attemptId, assignmentId])` ([competence.prisma](../packages/prisma/src/prisma/schema/competence.prisma)). This is the right direction.

The runtime must preserve the invariant in service code:

- The server chooses and persists the next assignment.
- The participant can only submit the currently served assignment.
- The submit mutation must ignore or reject client-supplied arbitrary assignment ids.
- The response must snapshot the delivered element data and grading-relevant options into `elementSnapshot` before grading or at delivery time.
- The service must verify the assignment still belongs to the quiz's competence tree, enabled pool, linked course, and allowed element types.

**Impact:** the original feature allowed manipulation by re-answering or choosing arbitrary pool items. The new schema can prevent that, but only if the service is strict.

**Recommendation:** write the attempt runtime around a `getEffectiveAdaptivePool(configId)` helper and a `getServedAssignmentForSubmit(attemptId, participantId)` helper. Unit-test attempts to submit a disabled item, foreign-tree item, already answered item, non-served item, and item from another participant's attempt.

### F4. P1 - The competence-tree model is good, but shape validation has to move into services

The new tree model supports the requested hierarchy:

- `MAX_COMPETENCE_TREE_DEPTH = 5` in the package.
- `CompetenceTree.maxDepth`.
- `CompetenceTreeNode.depth`, `kind`, parent/children, and `weight`.
- Leaf-level coverage rows and element assignments.

The database cannot express the full tree semantics. As written, it can store a root `SUBCOMPETENCE`, a child `COMPETENCE`, a node whose `depth` does not match its parent chain, a depth beyond `maxDepth`, one-level taxonomies, non-leaf assignments, or weights on nodes that the algorithm later ignores.

**Impact:** if the authoring UI saves an invalid tree, adaptive selection and reporting can become inconsistent or pedagogically meaningless.

**Recommendation:** enforce these rules in the competence-tree service:

- Tree must have at least two levels; recommend at least three for level classification.
- Depth must be `1..min(tree.maxDepth, 5)`.
- Roots must be competences.
- Assignable nodes must be leaves.
- Every enabled competence must have at least one enabled leaf.
- Every enabled leaf must have at least one enabled coverage level.
- Root weights must be non-negative and normalized at quiz-config time.
- Non-root weights should either be explicitly ignored in UI or supported in aggregation. Do not leave them ambiguous.
- Each assigned element type must be one of `NUMERICAL`, `SC`, `MC`, `KPRIM`, `FREE_TEXT`.

The package's `validateEnabledStructure` currently checks only the minimal enabled competence/subcompetence shape. That is useful but far too small for persistence validation.

### F5. P1 - Measurement semantics are much clearer, but presets must choose the mapping rule

The package now supports `NEAREST` and `MASTERY` mapping rules in `mapLevelsToTheta` and `mapThetaToLevel`. The MASTERY geometry has the previously requested shifted-grid behavior: for `K` levels, mastery thresholds occupy the lower edge of each band and the top band has real width. This fixes the former top-band dead zone.

However, the Prisma defaults for both `CompetenceTree.levelMappingRule` and `PracticeQuizAdaptiveConfig.levelMappingRule` are `NEAREST`. That is fine for self-assessment/proficiency description, but not necessarily for placement. For placement, MASTERY is didactically safer: "B1" means "B1 is the highest level demonstrably cleared." For descriptive progress reporting, NEAREST is easier to explain.

**Impact:** a global default can silently pick the wrong didactic interpretation. This can affect course placement and student trust more than small estimator differences.

**Recommendation:** do not expose mapping rule as a raw early knob. Use presets:

- Placement/mastery preset: `MASTERY`, no live estimate, conservative result language.
- Diagnostic/self-assessment preset: `NEAREST`, level-band result language.
- Research/calibration preset: advanced settings visible, clearly marked.

The result UI and result messages must name the semantics. Under MASTERY, say "highest level you demonstrably cleared," not just "your level."

### F6. P1 - Stop conditions need pool-aware reachability validation before publishing

The package now has the right helper: `minimumReachableStandardError({ itemCount, a, c })`, based on closed-form information at item difficulty. This directly addresses the old issue where SE thresholds could be mathematically unreachable for SC-heavy pools.

The schema has:

- `targetItemCount` per leaf-level coverage.
- `totalQuestionCap`, `perLeafQuestionCap`, `minQuestionsPerLeaf`, `classificationZ`, and optional `standardErrorThreshold` on adaptive quiz config.
- `questionCap` overrides per node.

What is missing is the save/publish validator that ties them together.

**Impact:** lecturers can create configurations where the advertised adaptive stop cannot fire, where leaves have zero items at some levels, or where the question cap forces an assessment far longer than intended.

**Recommendation:** block publishing when any enabled leaf-level cell has zero enabled items. Warn, with numbers, when item count is below target, when the configured SE threshold is unreachable for the item pool's dominant `c`, or when the expected question count exceeds the product's time budget. Store the validation result in the owner preview, not just as transient UI text.

### F7. P1 - The simulation still does not represent the intended production runtime

The package tests pass, including the CEFR simulation. That is good. But the simulation remains an old-style harness:

- FREE_TEXT-only item pool.
- A private `mapMasteryThetaToLevel` helper rather than calling the canonical mapping rule.
- Very large total cap (`240`) and a submodule cap (`8`) divorced from the intended practice-quiz UX.
- No SC, MC, KPRIM, numerical, mixed pools, percent input, or item exposure scenarios.
- No explicit classification-stop or reachability gates.

**Impact:** the simulation proves the math can recover levels in an idealized setup. It does not yet prove the production configuration can classify students accurately in realistic pools.

**Recommendation:** port `project/adaptive-learning-sweep-harness.mjs` into the package tests and make it production-shaped:

- Presets: placement/mastery, diagnostic/nearest, short-form, long-form.
- Item mixes: SC-only, SC/MC/KPRIM, numerical/free-text, mixed.
- Pool sizes: sparse, target, rich.
- Mislabel noise: item level shifted by one band in a configurable percentage of items.
- Metrics: exact-level accuracy, adjacent-level accuracy, mean absolute level error, mean/95th question count, stop-reason distribution, per-level bias.
- Gates: no preset can ship unless exact/adjacent accuracy and length are within defined bounds.

### F8. P1 - Numeric and free-text response normalization are better but need product boundaries

Supported adaptive item types are explicit and correct for v1: numerical, SC, MC, KPRIM, and free text. Guessing parameters are sensible: SC uses `1 / choices`, MC uses `1 / (2^n - 1)`, KPRIM uses `1 / 2^n`, and numerical/free-text use `0`.

Numerical normalization now accepts decimal comma, unicode minus, whitespace/apostrophe grouping, fractions, scientific notation, and percent input when enabled per assignment. It deliberately rejects ambiguous single-comma thousands input like `1,200`.

Remaining issue: `0,500` is rejected as ambiguous by the current regex, but a leading-zero comma value is unambiguously decimal in this product context. This is a small edge case, but it matters in European numerical input.

Free text normalization lowercases, strips diacritics, and collapses whitespace. That is enough for short controlled-answer items, not for open language production or grammar correction.

**Recommendation:**

- Relax comma ambiguity for `0,xxx` and add tests for `0,5`, `0,500`, `1,200`, and `12,000`.
- Treat free-text adaptive items as controlled-answer only unless there is explicit answer-collection/synonym support in the grading service.
- Exclude selection, content, and case study from adaptive assignment in service validation and UI.

### F9. P1 - Existing adaptive shared components are dead code and still wrong if reused

`packages/shared-components/src/adaptive/` is not currently imported by the active adaptive flow because no active adaptive flow exists. But if these components are revived, `mapLevelsToBands` still divides the theta range into equal slices, which matches neither canonical `NEAREST` midpoint bands nor `MASTERY` shifted bands. `getLevelColor` is keyed to English labels like `novice`, `developing`, and `expert`, which does not generalize to CEFR labels or arbitrary competence levels.

**Impact:** a future UI could silently reintroduce the old "badge says one level, band shows another" defect.

**Recommendation:** either delete the dead adaptive shared components before Phase 4 and rebuild against the package helpers, or immediately refactor them to consume `mapLevelsToTheta` semantics and index-based palettes. Add tests asserting frontend band assignment equals package `mapThetaToLevel` for both mapping rules.

### F10. P1 - Old adaptive tables and seed helpers remain and should get a planned cleanup

The public old surface is removed, but `packages/prisma/src/prisma/schema/adaptive.prisma` still creates the old standalone `AdaptiveAssessment*` models. `seedTEST.ts` still has helpers that create a DRAFT old CEFR adaptive assessment and seeded old attempts.

The seed was made safer (`status: DRAFT`, `showSolutions: false`), which resolves the critical leak in practice. But keeping old schema plus old seed helpers has costs:

- Fresh dev databases still create a dead data model.
- Future migrations have to account for both old and new adaptive concepts.
- Developers can accidentally revive old concepts in code search and UI work.
- User deletion, element deletion, and historical audit semantics remain muddier than needed.

**Recommendation:** once no real old adaptive data needs migration, add a cleanup migration that drops old standalone adaptive tables, removes old seed helpers, removes old relations from `Course`, `Element`, `Participant`, and `User`, and documents the no-data assumption. Until then, keep old helpers clearly marked as legacy and do not expose them through GraphQL.

### F11. P1 - Account deletion and tree ownership lifecycle need a policy

`CompetenceTree.owner` cascades on user deletion. But adaptive configs restrict deletion of linked trees, and adaptive responses restrict deletion of element assignments. This is safer than silent history deletion, but it means deleting a user who owns a used tree can hard-fail unless the service handles reassignment or soft deletion first.

**Impact:** this becomes a GDPR/account-lifecycle problem once real attempts exist.

**Recommendation:** decide now:

- Prefer soft-delete/reassign: user deletion marks owned trees `isDeleted` or reassigns them to a system/course owner if attempts exist.
- Prevent hard deletion with a clear admin-facing error when trees are linked or have attempts.
- Add a service test for deleting a user who owns a tree with completed adaptive quiz attempts.

### F12. P2 - Aggregation is reasonable for didactic weights, but must not be oversold statistically

The package has two aggregators:

- `aggregateInverseVariance`, statistically efficient when entries are comparable independent estimates.
- `aggregateWeightedEstimates`, which respects lecturer/root competence weights and propagates variance as `sum(w_i^2 * se_i^2)`.

For competence trees, didactic weighting is the right default: a course owner may legitimately say grammar matters 40 percent and reading 30 percent. But the resulting standard error is not a full psychometric population estimate; it is an uncertainty summary under the tree's weighting policy.

**Recommendation:** use weighted estimates for the overall adaptive quiz result, and inverse-variance aggregation only for combining repeated estimates of the same construct. Label lecturer dashboards as "attempt-level estimate under this quiz's competence weights," not as population ability.

### F13. P2 - The package test scripts are outside the repo's CI convention

`@klicker-uzh/adaptive-learning` defines `test` and `test:simulation`, but the root test convention is `test:run`. The repo's current workflow search shows no adaptive-specific workflow. `check-types.yml` hand-builds several dependency packages but not `adaptive-learning`; that is harmless while GraphQL does not import it, but it will fail again once the adaptive runtime starts importing the package.

**Recommendation:**

- Add `"test:run": "vitest run"` or `"test:run": "run-s test test:simulation"` to `packages/adaptive-learning/package.json`.
- Add a `test-adaptive-learning.yml` workflow or include it in existing package test workflows.
- Add `packages/adaptive-learning` to hand-built dependency lists before GraphQL imports it, or move those workflows to `turbo run build --filter=...` with proper dependency expansion.

### F14. P2 - Engineering documentation is missing after the v3 merge

The v3 merge moved agent/developer knowledge toward `docs/`, but there is no `docs/adaptive-learning.md`. The important design facts are currently scattered through `project/` reviews and plans:

- v2 direction: competence trees plus `ADAPTIVE` practice quiz mode, not a standalone activity.
- Reachability formula: `I = a^2(1-c)/(4(1+c))`, `SE_min = 1/sqrt(nI)`.
- Mapping rule semantics: NEAREST vs MASTERY.
- `b` semantics: item difficulty is assigned from the level anchor, not calibrated yet.
- Supported item types and guessing parameters.

**Recommendation:** add `docs/adaptive-learning.md` and link it from `docs/index.md` before implementation continues. Keep the project review files as history, but put stable engineering facts in docs.

### F15. P2 - The current code has useful core helpers, but too much future behavior is still implicit

The library now contains helpers for most difficult parts: level mapping, guessing parameters, 3PL probability/information, MAP estimate, standard error, randomesque item selection, reachability, classification intervals, numerical/free-text normalization, aggregation, result messages, and enabled-structure validation.

That is a strong foundation. The risk is that the service layer re-derives details differently. The previous implementation already suffered from frontend/backend band mismatch and simulation/runtime mismatch.

**Recommendation:** in the new GraphQL service, centralize these contracts in a small number of helpers:

- `deriveAdaptiveItemParameters`
- `getEffectiveTree`
- `getEffectiveQuizPool`
- `validateAdaptiveQuizReadiness`
- `selectAdaptiveNextAssignment`
- `gradeAdaptiveResponse`
- `computeAdaptiveEstimates`
- `serializeParticipantAdaptiveState`
- `serializeLecturerAdaptiveResults`

Each helper should have service-level tests. Do not scatter enablement, weight, mapping, and parameter precedence across resolvers and components.

## Didactics And Psychometrics Review

### What Is Strong

- **Competence trees are the right base object.** They match the user's requested model: reusable trees, competences, nested subcompetences, leaf assignments, per-level coverage, and tree/quiz weights.
- **The item-type scope is sane for v1.** Numerical, SC, MC, KPRIM, and free text can be graded automatically. Content, case studies, and selection are excluded from adaptive classification for now.
- **The default discrimination `a = 1.2` is conservative.** It avoids overconfident jumps compared with the original `1.5` default.
- **The theta scale is treated as internal.** The useful product language is levels and bands, not raw theta.
- **The package now supports both level semantics.** NEAREST works for descriptive reporting; MASTERY works for placement/mastery interpretations.

### What Is Still Missing

- A formal blueprint process: who validates that items assigned to B1 really test B1, and that each competence/leaf has coverage across levels?
- Calibration signals: item observed-vs-expected correctness, over/underfit by level, exposure counts, near-boundary instability.
- A pilot plan per subject: CEFR language placement is not the same as math diagnostic practice or programming concept mastery.
- Clear retake policy: best attempt vs first attempt vs latest attempt has didactic consequences.
- Feedback policy: if this is "learning," not just placement, students need post-completion guidance that points to competences/subcompetences and practice material.

### Required Didactic Product Decisions

1. **Preset semantics:** default placement to MASTERY, default diagnostic self-assessment to NEAREST.
2. **Result wording:** never show raw theta to students by default; show level bands and confidence language.
3. **Item authoring:** use coverage matrix and item counts as publish gates, not optional hints.
4. **Free text:** limit to controlled-answer questions unless richer grading is implemented.
5. **Retakes:** decide whether results dashboards use first, latest, or selected attempt. For placement, avoid "best attempt" unless course policy explicitly wants grindable placement.

## Computation Review

The core 3PL implementation is correct in shape:

- Probability uses `c + (1-c) * logistic(a(theta-b))`.
- Information follows the 3PL Fisher information formula.
- Guessing `c` is inferred by item type.
- MAP prior support is implemented and reflected in returned standard error when enabled.
- Randomesque selection and information reachability helpers exist.

The important remaining computational concerns are not formula bugs. They are **integration risks**:

1. Routing estimates and reported estimates should not blindly use the same prior. Use a stabilizing prior for early routing; report final estimates with a documented estimator and avoid applying the same prior independently to every competence before aggregation.
2. Exposure penalty is currently in raw information units. Normalize it before exposing or make it an internal preset value.
3. Stop thresholds must be validated against pool information and caps.
4. Service/runtime should use canonical `mapLevelsToTheta` everywhere, including frontend band visualizations.
5. Production simulation must cover mixed item pools and mapping-rule presets.

## Permission Review

The critical old permission findings are mostly neutralized by deletion of the old standalone GraphQL/page surface. The new permission model still needs implementation.

Minimum permissions matrix:

| Operation | Actor | Required authorization |
| --- | --- | --- |
| Create tree | Lecturer/user | Authenticated user |
| Edit/delete tree | Lecturer/user | Tree owner or future tree admin |
| Link tree to course | Lecturer/user | Tree access plus course WRITE/ADMIN |
| Assign element to tree leaf | Lecturer/user | Tree write plus element READ/WRITE according to sharing policy |
| Create adaptive practice quiz | Lecturer/user | Practice quiz/course write plus tree access |
| Publish adaptive practice quiz | Lecturer/user | Course/practice quiz execute/admin plus readiness validation |
| Start attempt | Participant | Participation row for quiz course |
| Submit response | Participant | Own in-progress attempt and currently served assignment |
| View own result | Participant | Own completed attempt |
| View class results | Lecturer/user | Practice quiz owner/admin; anonymous buckets only |

Small-bucket suppression should be part of results serialization, not just UI rendering. Recommended default: suppress leaf-level level buckets below `n < 5`; suppress all adaptive results when cohort size is below the institutional threshold chosen for course analytics.

## UX Review

The adaptive UX is not implemented yet. The standard practice quiz remains the active UI.

Required Manage UX:

- Competence tree editor with tree outline, max-depth guard, level editor, root weights, leaf coverage matrix, and validation summary.
- Element editor integration: assign element to tree, leaf, and level; only supported types; per-assignment percent-input flag; inferred `c`; recommended/default `a`.
- Practice quiz wizard: mode selector (`STANDARD` vs `ADAPTIVE`), tree selector, tree preview, enable/disable competences/leaves, quiz-level weights, element pool preview, publish readiness.
- Results dashboard: anonymous distributions overall, by competence, by leaf, and by level; suppressed small cells; stop reasons and insufficient data states.

Required student UX:

- Intro screen before starting: purpose, expected length, no backtracking, resume behavior, result use, data/privacy note.
- Honest progress: "question X of at most Y" or competence coverage, not a fake fixed denominator.
- No live theta or live level by default.
- Clear resume state.
- Completion screen with level bands, overall result, competence/subcompetence bands, confidence/near-boundary wording, and recommended next practice.
- If the test stops due to insufficient pool, say so gently and avoid overconfident classification.

All user-visible text needs `de` and `en` i18n entries and `data-cy` hooks from the first implementation slice.

## Code Quality Review

Strong points:

- The dangerous old GraphQL service layer is gone.
- The pure adaptive package is small and testable.
- The new schema has good audit-oriented structures: attempts, responses, estimates, `elementSnapshot`, stop reasons, next assignment, and response uniqueness.
- Partial unique indexes in the migration cover root node order and one in-progress attempt per participant/quiz.
- Relation fixes for `finalLevelId` and `nextAssignmentId` are present.

Concerns:

- The schema and migration are ahead of services. That is fine short-term, but validation cannot remain implicit.
- Old adaptive schema remains and should be cleaned up before broad rollout.
- Adaptive package tests are not CI-native.
- `packages/graphql` already declares a dependency on `@klicker-uzh/adaptive-learning`, but no service imports it yet. When that changes, workflow build order must change too.
- `project/` has excellent review history, but stable engineering knowledge needs to move to `docs/`.
- The active working tree has unrelated devcontainer changes outside this review. Do not mix those with adaptive production changes.

## Path To Production

### Phase 0 - Lock The Foundation

1. Keep the old standalone adaptive pages and GraphQL service deleted.
2. Add `docs/adaptive-learning.md` with the stable decisions.
3. Add adaptive package `test:run` and CI workflow.
4. Add missing package build steps wherever GraphQL will import adaptive-learning.
5. Decide account-deletion/tree ownership policy.
6. Mark old adaptive schema/seed as legacy or remove it if no data migration is needed.

Exit criteria:

- Adaptive package tests run in CI.
- Engineering docs exist.
- No public old adaptive route or operation exists.
- No production-visible feature flag exposes unfinished adaptive mode.

### Phase 1 - Backend Contracts

1. Implement competence-tree CRUD and validation.
2. Implement tree-course linking with audit and permissions.
3. Implement element assignment to tree leaves.
4. Implement adaptive practice quiz create/edit config.
5. Implement readiness validation with pool coverage and SE reachability.
6. Add GraphQL schema and operations, then regenerate codegen artifacts.

Exit criteria:

- Service tests cover permissions and validation.
- Create/edit flows cannot persist invalid trees or invalid adaptive quizzes.
- Owner preview can explain exactly why a quiz can or cannot be published.

### Phase 2 - Attempt Runtime

1. Start/resume/abandon attempt.
2. Server-side next-assignment selection.
3. Participant-safe item payload with no solutions.
4. Submit response for the served assignment only.
5. Automatic grading for SC/MC/KPRIM/numerical/free-text controlled answers.
6. Persist response snapshots, estimates, stop reasons, and final bands.
7. Results serialization for student and lecturer.

Exit criteria:

- Tests prove no arbitrary item submission, repeat submission, cross-participant submission, or foreign-tree submission.
- Completed attempt has overall, competence, and leaf estimates.
- No raw solutions or hidden grading data are sent to participants.

### Phase 3 - Production-Shaped Measurement Gates

1. Replace or extend the simulation with mixed item pools and presets.
2. Add exact/adjacent accuracy and mean-length gates.
3. Add reachability tests for SC/MC/KPRIM/numerical/free-text pools.
4. Add calibration dashboard data collection: exposure, observed/expected correctness, item misfit, near-boundary attempts.

Exit criteria:

- Every shipped preset has explicit simulation evidence.
- Publish validation rejects mathematically impossible stopping settings.
- Pilot owners can inspect pool weaknesses before students use the quiz.

### Phase 4 - Manage And PWA UX

1. Competence tree editor.
2. Element editor assignment controls.
3. Adaptive practice quiz wizard mode.
4. Student adaptive runner inside the existing practice quiz route.
5. Student completion level-band summary.
6. Lecturer anonymous results dashboard.
7. Full i18n and `data-cy`.

Exit criteria:

- Browser-verified Manage tree creation, adaptive quiz publication, student attempt, completion summary, and results dashboard.
- Screenshots captured via `npx agent-browser`.
- No raw theta shown to students by default.

### Phase 5 - Controlled Pilot

1. Feature flag adaptive mode to selected courses.
2. Pilot with a tree that passes coverage/readiness.
3. Monitor stop reasons, question counts, near-boundary rates, item exposure, and support tickets.
4. Review result distributions with teaching staff before using for high-stakes placement.

Exit criteria:

- Pilot data supports the preset's expected accuracy/length.
- No permission or data-leak findings.
- Teaching team signs off on result interpretation.

### Phase 6 - Broad Rollout And Cleanup

1. Remove legacy old adaptive schema if no migration is required.
2. Keep calibration reports and readiness validation as permanent product surfaces.
3. Document support playbooks.
4. Add E2E coverage to Playwright for adaptive creation and student runtime.

## Final Recommendation

Proceed, but keep calling this a foundation until Phase 2 exists. The right next engineering move is not more UI polish; it is the backend contract layer: competence-tree CRUD, adaptive practice quiz config, permissions, readiness validation, and attempt runtime. Once those are deterministic and tested, the UX can be built confidently on top of them.

The implementation has already absorbed the most important prior safety feedback. The remaining work is substantial but well-bounded. If the team keeps the service helpers centralized and makes simulation/readiness gates non-negotiable, this can become a production-quality adaptive practice-quiz mode rather than a fragile standalone assessment experiment.
