# Adaptive Learning Production-Readiness Plan

Created: 2026-07-09

Updated: 2026-08-01

Status: Final code-boundary hardening is implemented and locally verified after the 2026-08-01 maintainability review. Keep adaptive learning disabled outside dedicated development/test courses: `IRT_V2_DIAGNOSTIC` did not pass a promotion threshold, pilot readiness still requires production-sized SLO evidence, the snapshot-retention decision, and an operational rehearsal, and broad rollout additionally requires every Phase 14 pilot gate and named signoff.

Review corpus:

- `project/REVIEW-adaptive-learning-pr5113.md`
- `project/2026-07-07-adaptive-learning-pr5113-review.md`
- `project/2026-07-07-adaptive-learning-consolidated-review.md`
- `project/2026-07-07-adaptive-learning-v2-review.md`
- `project/2026-07-08-adaptive-learning-v2-remediation-review.md`
- `project/2026-07-09-adaptive-learning-production-review.md`
- 2026-07-13 final senior review of the complete working tree; its findings and evidence are captured below.

Reference concept: stakeholder-provided `Adaptive Assessment (standalone).html`

## Goal

Turn the adaptive learning foundation into a production-quality adaptive practice quiz mode.

The feature is based on reusable competence trees:

- A `CompetenceTree` can be reused across different courses through course links.
- A tree contains one or more root competences.
- Each competence contains one or more nested subcompetences, up to `MAX_COMPETENCE_TREE_DEPTH = 5`.
- Assignable nodes are leaf subcompetences.
- Tree levels define the internal difficulty anchors for item difficulty `b`.
- Element assignments connect supported element types to a tree, leaf subcompetence, and level.
- The adaptive quiz is not a standalone activity. It is a new mode of `PracticeQuiz`.

Production readiness means lecturers can author valid competence trees, assign elements to leaf-level cells, configure an adaptive practice quiz against a tree, publish only when the pool is reachable and safe, students can complete an adaptive practice quiz through the existing practice quiz route, and owners can inspect anonymous level-band distributions. It also means privacy suppression is resistant to differencing and missingness, sharing revocation is honored before publication, lifecycle operations are serializable, migrations leave no invalid runtime state, authoring failures are recoverable, database work is bounded, production telemetry exists, and the actual shipped presets pass predeclared synthetic and real-course measurement gates.

The supplied standalone HTML is a product reference only. Its coverage matrix, resume flow, readiness feedback, and result trajectory inform the experience, but the implementation must use KlickerUZH's existing activity, navigation, design-system, permission, and evaluation patterns.

## Non-Goals For The First Production Slice

- Do not revive the old standalone adaptive assessment surface.
- Do not support `CONTENT`, `SELECTION`, `CASE_STUDY`, or `FLASHCARD` elements as adaptive items.
- Do not show raw theta values to students.
- Do not expose low-level psychometric knobs as default UI.
- Do not use adaptive outcomes for high-stakes placement until after a controlled pilot.
- Do not add AI/free-form essay grading. Free text means controlled-answer items only.
- Do not add an `AdaptiveAssessment` activity, route, activity tile, or seven-step standalone wizard.
- Do not copy the reference HTML's visual shell, implementation-note rail, bespoke phone frames, typography, spacing, or color treatment.
- Do not draw one result line per competence or subcompetence; depth-5 trees would make that chart unreadable.
- Do not enable adaptive scheduled publication until a transactional outbox and idempotent reconciler exist. Immediate publication is the supported production-v1 contract.
- Do not invent automated learning recommendations from confidence or uncertainty. Production v1 is explicitly diagnostic/placement practice; any future next-step recommendation must be teacher-authored and independently reviewed.

## Earlier Review Finding Coverage

| Finding | Plan coverage |
| --- | --- |
| F1: Adaptive practice quiz exists only in Prisma | Phases 1, 2, 3, 5, 6 add GraphQL contracts, services, Manage authoring, PWA runtime, and results. |
| F2: Permissions missing | Permission contract section plus Phase 1 and Phase 2 service tests. |
| F3: Served-item integrity | Phase 3 makes the server choose and persist the served assignment and rejects arbitrary submissions. |
| F4: Tree validation missing | Phase 1 moves full shape validation into the competence-tree service. |
| F5: Mapping semantics need presets | Product decisions and Phase 2 introduce presets over raw mapping-rule knobs. |
| F6: Stop conditions need reachability validation | Phase 2 added warnings; Phase 11 promotes structurally unreachable product-preset states to publication blockers. |
| F7: Simulation not production-shaped | Phase 4 ported the production runtime; Phase 11 removes preset drift and adds classification, hard-cap, exposure, and misspecification gates. |
| F8: Numeric/free-text boundaries | Phase 4 fixes `0,xxx` comma decimals and enforces controlled-answer free text. |
| F9: Dead adaptive shared components | Phase 4 deletes or refactors `packages/shared-components/src/adaptive/` before UI reuse. |
| F10: Old adaptive tables/seeds remain | Phase 0 marked legacy clearly; Phase 14 executes the staging/production decision before any cleanup. |
| F11: Account deletion/tree lifecycle | Phase 10 replaces the unsafe cascade with an enforced transfer/retention contract and deletion tests. |
| F12: Aggregation must not be oversold | Product decisions and Phase 3 use weighted estimates for quiz summaries and careful labels. |
| F13: CI mismatch | Phase 0 added package CI; Phase 8 makes the cross-layer trigger and Node/pnpm environment reproducible. |
| F14: Docs missing | Phase 0 adds `docs/adaptive-learning.md` and links it from `docs/index.md`. |
| F15: Future behavior implicit | Phases 9-13 extract explicit privacy, authorization, lifecycle, repository, cohort, and serializer modules. |

## Final Review And Production Gap Coverage

The final review found no P0 algorithmic corruption, but it did find release-blocking P1 behavior and additional production gaps in the earlier review corpus. Every row below must end in code/test evidence, a signed operational decision, or an explicit non-goal enforced by the product.

| ID | Remaining finding or gate | Current evidence | Required phase |
| --- | --- | --- | --- |
| R1 | Simulations pass while most clean Placement/Diagnostic attempts stop at `TOTAL_QUESTION_CAP`; test profiles also drift from shipped defaults. | `packages/adaptive-learning/test/simulation.test.ts:15-134`; `docs/adaptive-learning.md:248-267` | 11 |
| R2 | `standardErrorThreshold` and `showLiveEstimate` are saved and displayed but do not affect participant runtime. | `packages/graphql/src/services/adaptivePracticeQuizConfig.ts:759-798`; `packages/adaptive-learning/src/runtime.ts:25-33`; `packages/graphql/src/schema/adaptivePracticeQuizRuntime.ts:188-201` | 11, 12 |
| R3 | Cohort duration, anomaly, and insufficient-data fields can disclose a singleton through missingness or a complementary cell; query-time releases are not yet persisted as stable privacy-safe snapshots. | `packages/graphql/src/services/adaptivePracticeQuizzes.ts:1551-1603,1749-1818` | 9, 13 |
| R4 | Element access is checked when a tree assignment is created but not revalidated before grading data is snapshotted for publication. | `packages/graphql/src/services/competenceTreeInput.ts:237-267`; `packages/graphql/src/services/adaptivePracticeQuizPublication.ts:58-132` | 9 |
| R5 | Attempt start can race the zero-attempt decision in hard quiz deletion and then be removed by cascade. | `packages/graphql/src/services/practiceQuizzes.ts:969-1002`; `packages/graphql/src/services/adaptivePracticeQuizzes.ts:183-245` | 10 |
| R6 | The Phase 3 migration can retain an `IN_PROGRESS` attempt without `nextPoolItemId` because the state check is `NOT VALID`. | `packages/prisma/src/prisma/schema/migrations/20260710210000_adaptive_practice_quiz_runtime/migration.sql:18-24,102-106,187-195,251-275` | 10 |
| R7 | Element save and adaptive mapping are two commits; a mapping failure can be mistaken for a failed element save or silently abandoned. | `apps/frontend-manage/src/components/elements/manipulation/ElementEditForm.tsx:146-170` | 12 |
| R8 | Reparenting updates only nodes, leaving coverage/assignments on a node that became an internal node and is no longer visible in the matrix. | `apps/frontend-manage/src/components/resources/competenceTrees/HierarchyEditor.tsx:381-391`; `CoverageMatrix.tsx:39-46` | 12 |
| R9 | Terminal submission performs sequential per-node estimate upserts; cohort evaluation materializes all attempts/responses in application memory. | `packages/graphql/src/services/adaptivePracticeQuizzes.ts:652-692,1114-1141` | 13 |
| R10 | Adaptive runtime/config services mix commands, locking, persistence, privacy, diagnostics, read models, and serialization in files over 1,000 lines. | `packages/graphql/src/services/adaptivePracticeQuizzes.ts`; `adaptivePracticeQuizConfig.ts` | 13 |
| R11 | Competence-tree owner deletion still cascades, while course/participant deletion semantics can erase or reshape adaptive history without an explicit retention decision. | `packages/prisma/src/prisma/schema/competence.prisma:65,334-344`; `docs/adaptive-learning.md:275-286` | 10 |
| R12 | Unsaved tree navigation, hierarchy semantics, programmatic labels/focus, nested result disclosure icons, and transient-error recovery are incomplete. | `CompetenceTreeEditor.tsx:107-117`; `HierarchyEditor.tsx`; `AdaptivePracticeQuizResult.tsx:32-45`; `AdaptiveCompetenceProfile.tsx:84-94` | 12 |
| R13 | Tree catalogs and element mapping load unbounded lists, and the adaptive CI workflow does not trigger on all cross-layer dependencies. | `competenceTreeManagement.ts:150-183`; `.github/workflows/test-adaptive-learning.yml` | 8, 13 |
| R14 | Monitoring is query-time only; retry exhaustion, integrity rejection, cap rates, and rollout denials have no privacy-safe operational signal or alert. | `adaptivePracticeQuizzes.ts:1845-1889`; `docs/adaptive-learning-operations.md:58-91` | 13 |
| R15 | Browser automation does not assert every claimed privacy boundary, negative recovery flow, locale, viewport, and accessibility state. | `playwright/tests/Z-adaptive-learning.spec.ts:342-412`; `docs/adaptive-learning.md:299-310` | 12, 14 |
| R16 | The real-course pilot, teacher comparison, standard setting, fairness review, legacy-data decision, rollback rehearsal, and named signoffs remain open. | `docs/adaptive-learning-operations.md:94-175` | 14 |

## Production Release Definition

The course feature flag remains default-off throughout implementation. These states are intentionally distinct:

1. **Engineering-safe:** Phases 8-10 complete. No known direct serializer disclosure, permission, migration, deletion, or data-loss blocker remains; aggregate history remains test-only until Phase 13 adds stable privacy-safe release snapshots.
2. **Pilot-ready:** Phases 11-13 complete. Shipped presets pass synthetic gates, authoring/runtime UX is recoverable and accessible, scale SLOs pass, and deployment monitoring/rollback are rehearsed. Only named pilot courses may be enabled.
3. **Production-ready:** Phase 14 complete. The pre-registered real-course pilot meets every measurement and operational gate, legacy data has a signed disposition, and teaching, privacy, product/data-owner, and operations approvals are attached to the rollout record.

No phase may redefine a failing release gate merely to make CI green. A threshold change requires a documented psychometric or operational rationale and an independent review.

## Final Hardening Decisions

- Preserve the approved domain: reusable cross-course `CompetenceTree`, nested depth at most five, leaf-only assignment, and adaptive delivery as `PracticeQuiz.mode = ADAPTIVE`.
- Production v1 supports `NUMERICAL`, `SC`, `MC`, `KPRIM`, and controlled-answer `FREE_TEXT` only. Item `b` comes from the selected level, `c` is inferred from type/choice count, and `a = 1.2` remains the conservative uncalibrated default.
- Remove `standardErrorThreshold` and `showLiveEstimate` from production-v1 input, output, Prisma, Manage, and participant contracts. Classification-in-band is the only precision stop; students receive level-band results after completion, not a live estimate.
- A tree assignment is not an irrevocable element-content grant. The tree owner must still hold element `READ` permission when a new publication snapshot is materialized. A valid immutable snapshot remains authoritative for already-started/historical attempts.
- Keep `k = 5` as the v1 privacy threshold. Suppression applies to every value, complement, missingness cell, anomaly flag, percentile source population, and item diagnostic before serialization.
- Persist privacy-safe cohort release snapshots at fixed five-distinct-participant boundaries. Snapshots contain versioned aggregate payloads only: no participant ids, raw responses, or exact per-person timings. The privacy/data owner must approve whether such anonymous snapshots survive participant erasure; until then, broad rollout remains blocked.
- Hard deletion of a practice quiz, course, or tree is forbidden once adaptive attempts or published snapshots exist. Owner closure requires an explicit, idempotent transfer/retention operation; the database must not cascade used trees.
- Adaptive scheduling stays unavailable in production v1. The UI and API continue to reject it explicitly; it is not a hidden partial feature.
- The student result remains one overall trajectory plus nested final bands. The endpoint, headline, profile overall row, stored result, and text summary continue to use the same server computation.
- Production v1 is diagnostic/placement practice. Per-item correctness feedback and automated recommendations remain absent to protect the item bank and avoid unsupported pedagogy; result purpose and limitations must be explicit and teacher-approved.

## Domain Vocabulary

- `CompetenceTree`: reusable author-owned tree definition, optionally linked to multiple courses.
- `CompetenceTreeCourse`: link allowing a course to use a tree; includes audit through `linkedById`.
- `CompetenceTreeLevel`: ordered level anchors, for example A1 through C2 or custom bands.
- `CompetenceTreeNode`: tree node. Roots are competences; children are subcompetences; only leaves are assignable.
- `CompetenceTreeLeafLevelCoverage`: desired coverage and target item counts for a leaf and level.
- `CompetenceTreeElementAssignment`: assignment of an element to a tree leaf and level, including item parameters.
- `PracticeQuiz.mode`: `STANDARD` or `ADAPTIVE`.
- `PracticeQuizAdaptiveConfig`: per-quiz config, selected tree, preset, weights, caps, and stop settings.
- `AdaptivePracticeQuizPreset`: persisted `PLACEMENT`, `DIAGNOSTIC`, or `RESEARCH` product semantics.
- `AdaptiveAttemptSelectionPolicy`: persisted `FIRST_COMPLETED` or `LATEST_COMPLETED`; `BEST` is deliberately unsupported.
- `PracticeQuizAdaptiveNodeOverride`: quiz-specific enabled/disabled state, weights, and caps for nodes.
- `PracticeQuizAdaptiveElementOverride`: quiz-specific enabled/disabled state for assignments.
- `PracticeQuizAdaptivePoolItem`: immutable publication snapshot of an effective assignment, element version/data, leaf, level, and effective `a`/`b`/`c`. Runtime selection uses this snapshot rather than the mutable source `Element`.
- `AdaptivePracticeQuizAttempt`: participant attempt state, estimates, stop reason, and currently served assignment.
- `AdaptivePracticeQuizResponse`: immutable response record with delivered element snapshot and grading result.
- `AdaptivePracticeQuizEstimate`: overall, root competence, and every enabled subcompetence-node estimate with mapped level bands.
- `AdaptiveResultTrajectoryPoint`: participant-safe, server-computed chart point derived from the overall estimate after a response. This is an API view, not a separately authored domain object.

## Product And Didactic Decisions

### Presets

Expose presets first, not raw psychometric settings:

- Placement/mastery: `MASTERY`, conservative wording, no live estimate.
- Diagnostic/self-assessment: `NEAREST`, level-band wording, no high-stakes claims.
- Research/calibration: advanced selection/mapping settings visible, explicitly marked for internal or pilot use. Live participant estimates remain unavailable in every preset; Research changes analysis controls, not the student disclosure contract.

### Item Parameters

- Valid adaptive element types: `NUMERICAL`, `SC`, `MC`, `KPRIM`, `FREE_TEXT`.
- Difficulty `b` is selected from the assigned tree level anchor.
- Guessing `c` is inferred from item type:
  - `SC`: `1 / choiceCount`
  - `MC`: `1 / (2^choiceCount - 1)`
  - `KPRIM`: `1 / 2^choiceCount`
  - `NUMERICAL` and `FREE_TEXT`: `0`
- Discrimination `a` defaults to the package recommendation, currently `1.2`, unless a future calibration result overrides it.
- Free text is controlled-answer only.
- Numerical input accepts decimal comma and must be adjusted to accept leading-zero comma decimals like `0,500`.

### Selection And Stopping

- Begin with a coverage warm-up that obtains scorable evidence from every enabled root competence and required leaf-level cells.
- After coverage, select items by information within the eligible leaf/level pool, with the configured randomesque and exposure controls.
- Use competence-level classification stopping as the primary precision rule: a root competence is complete when its configured uncertainty interval lies inside one level band after minimum evidence.
- Do not use a per-subcompetence standard-error threshold as the main stopping mechanism. Leaf caps and coverage targets preserve breadth; subcompetence estimates remain diagnostic outputs.
- Complete the attempt when all enabled root competences are classified, or stop at the total question/time cap with explicit capped or insufficient-data reasons.

### Results Language

- Students see level bands, confidence language, and near-boundary wording.
- Students do not see raw theta by default.
- The primary student visualization is one overall estimate trajectory over answered questions, with level bands on the y-axis and an uncertainty ribbon derived from standard error.
- The trajectory is a composite across root competences. Nested node estimates appear in an expandable final profile below the chart, not as additional chart lines.
- The chart endpoint, headline level band, and stored final attempt result must come from the same server-computed estimate.
- Adaptive practice quizzes always show a completion result in v1. Do not expose the reference's `Show final result` toggle until there is a validated use case for hiding the promised result.
- Label the ribbon as an estimated range under this quiz's competence weights, not as a population confidence interval or calibrated probability of the student's true level.
- Lecturer dashboards label overall results as attempt-level estimates under the quiz's competence weights.
- Weighted estimates are used for overall quiz summaries.
- Inverse-variance aggregation is only used for repeated estimates of the same construct.

### Retakes And Gamification

- Adaptive practice quizzes award no points or XP in the first production slice. Standard practice quiz gamification remains unchanged.
- Placement/mastery presets use the first completed attempt as the canonical classification. A retake requires an explicit owner reset or later policy extension.
- Diagnostic/self-assessment presets use the latest completed attempt in aggregate dashboards while retaining prior attempts for audit.
- No preset uses a `BEST` attempt policy; that would make placement grindable and distort class distributions.

## Reference-Informed Experience Architecture

### Chosen Product Structure

Use a Klicker-native split instead of reproducing the reference's standalone assessment flow:

1. The reusable competence tree is authored in a Manage resource/library surface.
2. Elements are mapped to tree leaves and levels from the element editor and from a tree-centric assignment view.
3. The existing PracticeQuiz wizard branches by `PracticeQuiz.mode` and configures quiz-specific tree usage.
4. The existing participant PracticeQuiz route branches by mode and renders the adaptive runner.
5. The existing PracticeQuiz evaluation route adds adaptive result and item-analysis tabs.

This separation is required because competence trees outlive any single quiz and can be reused across courses. Quiz-specific enablement, weights, caps, and pool exclusions must not mutate the shared tree.

### Reference-To-Klicker Mapping

| Reference concept | KlickerUZH destination | Adaptation rule |
| --- | --- | --- |
| Basics and participant display options | Existing PracticeQuiz information, description, and settings steps | Keep current wizard structure and terminology; add only adaptive-specific fields. |
| Levels | Reusable competence-tree editor | Levels belong to the shared tree, not an individual quiz. |
| Competences | Reusable competence-tree editor | Support arbitrary nested subcompetences through depth 5, not only the two levels shown in the reference. |
| Question pool and coverage matrix | Tree assignment view plus adaptive PracticeQuiz setup | Tree view owns canonical mappings; quiz view owns enable/disable overrides and readiness. |
| Algorithm | Preset selector and collapsed advanced settings | Default to understandable presets; keep raw psychometric settings out of the primary flow. |
| Messages | Existing description/result-message conventions | Do not create a standalone wizard step unless configurable messages become a proven need. |
| Review | Existing PracticeQuiz completion and publishing flow | Show readiness errors and warnings before publish. |
| Student intro, question, and resume | Existing PracticeQuiz participant route | Same URL and page chrome; branch internally on mode. |
| Student result journey | Adaptive completion state in the existing route | Use one weighted overall trajectory and a nested final profile. |
| Lecturer results and item analysis | Existing PracticeQuiz evaluation route | Add adaptive tabs; retain aggregate-first privacy behavior. |

### KlickerUZH Visual Contract

- Reuse `WizardLayout`, `Workflow`, existing PracticeQuiz page chrome, `@uzh-bf/design-system`, Tailwind conventions, and existing responsive layout primitives.
- Use the product's normal headings, compact form density, border treatment, UZH-compatible palette, icon buttons, tooltips, accordions, tables, notifications, and publish modals.
- Do not add a second application shell, oversized title treatment, decorative phone/device frame, or implementation-note sidebar.
- Keep page sections unframed. Use cards only for repeated items, modals, or genuinely framed tools; do not nest cards.
- All visible strings require paired `de` and `en` translations. Important interactions require stable `data-cy` hooks.
- Every visible state must be verified at desktop and mobile widths with the real app through `agent-browser`.

## Nested Competence Tree Interaction Contract

### Tree Library And Ownership

- Add a competence-tree library in Manage for trees the user owns and trees available through linked courses.
- Owners can create, rename, duplicate, archive, and link trees to courses where they have the required course permission.
- Course managers with access to a linked tree can inspect it and use it in a quiz but cannot mutate the owner's shared definition. They can duplicate it into an owned tree when changes are needed.
- A tree used by a published adaptive quiz is structurally immutable in v1. Metadata may still be edited; changing levels, hierarchy, coverage, or assignments requires duplicating the tree and selecting the duplicate in a new or draft quiz.

### Outline Behavior

- Depth 1 nodes are root competences. Depths 2 through 5 are subcompetences.
- Render the hierarchy as a compact, collapsible outline with indentation, disclosure chevrons, node-kind labels, status counts, and a breadcrumb for the selected node.
- Selected-node details appear in an adjacent unframed panel on wide screens and below the outline on narrow screens.
- Node actions use icon buttons with tooltips: add child, move up, move down, reparent, duplicate branch, and delete.
- Do not require drag-and-drop in the first slice. Explicit reorder and reparent controls are keyboard-accessible, easier to validate, and avoid a new dependency. Drag-and-drop can be added later without changing the service contract.
- Disable `Add child` at depth 5 and explain the maximum-depth rule in a tooltip. The service remains authoritative and rejects any invalid depth.
- Reparenting validates the entire moved subtree before mutation so no descendant can exceed depth 5 and no cycle can be created.
- Tree nodes are not globally enabled or disabled. Quiz-specific node overrides own enablement so reuse in another course or quiz is unaffected.
- Only root competences expose default weights. Non-root weights are hidden and ignored.

### Levels, Coverage, And Assignments

- The level editor maintains ordered labels and a preview of their canonical level bands. Reordering levels warns when assignments already exist.
- The coverage matrix uses leaf paths as rows and levels as columns. A path such as `Language > Grammar > Verbs > Past tense` remains understandable at depth 5.
- Provide root filters, sticky level headers, search, and status summaries so large trees remain scannable.
- Matrix cells show enabled assignment count, target count, and blocking/warning state. Color is supplementary; every state also has text or an icon with accessible labeling.
- Clicking a matrix cell opens the element assignment view prefiltered to that leaf and level.
- An element can be assigned to multiple trees, but only once within a given tree. Within that tree it maps to exactly one leaf and one level.
- Assignment controls permit only `NUMERICAL`, `SC`, `MC`, `KPRIM`, and controlled-answer `FREE_TEXT` elements.
- Show `b` as the selected level, infer `c` from type and choice count, and show effective `a = 1.2` as read-only for normal presets. Expert overrides belong only to research/calibration mode.

## Student Result Trajectory Contract

### Hierarchical Estimation Without Double Counting

For response number `t` assigned to leaf `L`:

1. The response contributes to `L` and every ancestor of `L` up to its root competence.
2. Each node estimate is computed from all item responses in that node's subtree. Parent estimates pool descendant responses directly; they are never averages of child levels or child estimates.
3. Only enabled root competence estimates enter the overall result. Subcompetence estimates are diagnostic/profile outputs and must never be added to the overall result again.
4. Normalize effective quiz root weights across enabled roots: `sum(w_i) = 1`.
5. Compute `theta_overall(t) = sum(w_i * theta_i(t))`.
6. Because root response sets are disjoint, propagate uncertainty as `SE_overall(t) = sqrt(sum(w_i^2 * SE_i(t)^2))`.
7. Map the aggregate theta to a level once with the quiz's canonical mapping rule. Never average or vote on level labels.

Routing and stopping estimates remain separate from reported estimates. Routing may use the stabilizing MAP prior described in the psychometric review. The trajectory and final result use bounded pooled MLE values so repeated per-competence priors cannot create artificial precision in the weighted aggregate.

### When A Point Is Displayable

- Recompute the overall reporting estimate after each accepted response.
- Do not emit a chart point until every enabled root competence has at least one scorable response. Renormalizing weights over only the roots seen so far would create misleading jumps when a new competence first appears.
- Wide early uncertainty is valid and should be displayed. Do not promise that the interval shrinks after every individual response.
- A final node receives a level label only when it has at least `MIN_RESPONSES_FOR_REPORTED_NODE = 4` scorable responses. Otherwise return `INSUFFICIENT_DATA` with its response count.
- If any required root remains insufficient at the attempt cap, the overall result is explicitly incomplete instead of silently dropping that root.

### Storage And API Contract

- Use ordered `AdaptivePracticeQuizResponse` rows as the canonical trajectory history; do not maintain competing attempt-level theta/SE JSON histories.
- Before runtime implementation, rename or redefine response estimate fields as nullable overall reporting values, for example `overallThetaAfter` and `overallStandardErrorAfter`, because early responses may not yet produce a displayable point.
- Persist final node estimates in `AdaptivePracticeQuizEstimate` with node kind, node id, response count, theta, standard error, mapped level, and stop reason.
- The student serializer returns normalized chart coordinates rather than raw theta or raw standard error:
  - question number,
  - central position in `[0,1]`,
  - lower and upper interval positions in `[0,1]`,
  - central/lower/upper level labels,
  - optional answered competence path when that display option is enabled.
- The serializer also returns level-band boundaries in normalized coordinates. The PWA must not reconstruct psychometric boundaries.
- Lecturer-only result contracts may expose theta and standard error where needed for calibration, with explicit attempt-level labeling.

### Student Visualization

- X-axis: answered question number.
- Y-axis: ordered level labels and softly differentiated level bands; raw theta ticks remain hidden.
- One line: weighted overall reporting estimate.
- One ribbon: interval `theta_overall +/- classificationZ * SE_overall`, clipped to the configured theta range and converted to normalized chart positions by the server.
- The participant legend calls this an `estimated range`; it does not show a confidence percentage unless pilot calibration justifies one.
- Endpoint: visually emphasized and guaranteed to match the headline level band and final attempt result.
- Tooltip: question number, resulting level band, confidence wording, and optionally the answered competence path. It does not reveal item difficulty or correctness metadata.
- Copy describes evidence accumulating or the estimate settling; it must not claim every answer narrowed the interval.
- Below the chart, render the final competence hierarchy as a collapsed-by-default outline. Each node shows level band, confidence/near-boundary wording, response count, and insufficient-data state.
- Provide a textual summary equivalent to the chart for screen readers and users who cannot distinguish the visual bands.

## Layer Footprint

### Prisma And Seed Data

- `packages/prisma/src/prisma/schema/competence.prisma`
- `packages/prisma/src/prisma/schema/quiz.prisma`
- `packages/prisma/src/prisma/schema/adaptive.prisma` for old legacy cleanup
- Add persisted adaptive preset and attempt-selection policy fields (placement/first completed, diagnostic/latest completed, research/explicit policy) instead of inferring behavior from UI copy.
- Revise `AdaptivePracticeQuizResponse` so nullable, explicitly overall reporting estimates are the canonical trajectory source.
- Remove or stop writing duplicate attempt-level `thetaHistory` and `standardErrorHistory` JSON once ordered response rows provide the same history.
- Add a published adaptive pool snapshot model. Attempts and responses reference its immutable rows instead of selecting directly from live `CompetenceTreeElementAssignment` rows.
- `packages/prisma-data` seed helpers and test fixtures
- `apps/analytics` synced schema after Prisma changes

### Adaptive Package

- `packages/adaptive-learning/src/index.ts`
- `packages/adaptive-learning/test/index.test.ts`
- `packages/adaptive-learning/test/simulation.test.ts`
- Add hierarchy/trajectory aggregation tests for depths 1 through 5.
- `packages/adaptive-learning/package.json`

### GraphQL

- `packages/graphql/src/services/practiceQuizzes.ts`
- New `packages/graphql/src/services/competenceTrees.ts`
- New `packages/graphql/src/services/adaptivePracticeQuizzes.ts`
- `packages/graphql/src/schema/practiceQuiz.ts`
- New schema files for competence trees and adaptive attempts/results, including participant-safe level bands and trajectory points.
- `packages/graphql/src/graphql/ops/*.graphql`
- Generated GraphQL artifacts after schema and op changes

### Manage UI

- `apps/frontend-manage/src/components/activities/creation/practiceQuiz/*`
- `apps/frontend-manage/src/pages/resources/competenceTrees.tsx`
- New `apps/frontend-manage/src/components/resources/competenceTrees/*`
- `apps/frontend-manage/src/components/elements/manipulation/ElementEditForm.tsx` plus a focused adaptive-mapping section
- New adaptive PracticeQuiz setup components alongside the current PracticeQuiz wizard
- Adaptive result and item-analysis panels under `apps/frontend-manage/src/pages/practiceQuiz/[id]/evaluation.tsx`
- `packages/i18n` entries for `de` and `en`

### Student PWA

- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
- `apps/frontend-pwa/src/components/practiceQuiz/*`
- New adaptive runner, intro, resume, result trajectory, and nested profile components under the existing practice quiz route
- `packages/i18n` entries for `de` and `en`

### Shared Components

- `packages/shared-components/src/adaptive/` must be deleted or refactored before reuse.
- Any level-band UI must call canonical adaptive package helpers or receive server-computed bands from GraphQL.

### Docs And CI

- `docs/adaptive-learning.md`
- `docs/index.md`
- `.github/workflows/*`
- Root and package scripts for test/build/check conventions

### Async And Gamification Impact

- The first production slice adds no new Hatchet workflow. Standard PracticeQuiz scheduling remains unchanged; adaptive publication is immediate-only until a transactional outbox and reconciler can close the database/Hatchet crash boundary.
- Attempt updates, final estimates, and trajectory points are computed transactionally in the response submission service so the next served item and displayed state cannot diverge.
- Cohort analytics are query-time aggregates for the pilot. Add a background aggregation task only if measured volume requires it.
- Adaptive mode bypasses PracticeQuiz points, XP, and leaderboard updates in v1. This must be asserted in service tests.

## Permissions Contract

All adaptive GraphQL mutations and queries must use existing permission helpers and service conventions.

| Operation | Actor | Required authorization |
| --- | --- | --- |
| Create tree | Lecturer/user | Authenticated user. |
| Read own or linked tree | Lecturer/user | Tree owner, or course manager with READ access to a linked course. Linked-course access is read-only. |
| Duplicate tree | Lecturer/user | Read access to the source tree; the caller becomes owner of the duplicate and must separately link it to courses. |
| Edit tree | Lecturer/user | Tree owner only. Structural edits are rejected once a published adaptive quiz references the tree; duplicate the tree instead. |
| Delete tree | Lecturer/user | Tree owner/admin and no linked attempts, or soft-delete/reassign policy. |
| Link tree to course | Lecturer/user | Tree access plus course WRITE/ADMIN. |
| Assign element to tree leaf | Lecturer/user | Tree owner plus current element READ permission. The assignment does not outlive the owner's underlying authority for future publications. |
| Create/edit adaptive practice quiz | Lecturer/user | Course/practice quiz write plus tree access; tree must already be linked to the target course or linked transactionally with audit. Structural/config edits are blocked after attempts exist; duplicate the quiz instead. |
| Publish adaptive practice quiz | Lecturer/user | Practice-quiz publish permission, successful readiness, valid tree-course grant, and transactional revalidation that the tree owner still has READ access to every source element. |
| Start/resume attempt | Participant | Participation row for the quiz course. Do not use `Participation.isActive` as the access gate. |
| Submit response | Participant | Own in-progress attempt and currently served assignment only. |
| View own result | Participant | Own completed attempt; participant serializer exposes level bands and normalized chart positions, not raw theta/SE. |
| View class results | Lecturer/user | Practice quiz ADMIN; only fixed-release, `k = 5` privacy-safe aggregate snapshots. |

Small-bucket suppression belongs in one server policy and uses fixed `k = 5` for v1. Every released value, complement, missingness population, anomaly flag, percentile source, node distribution, and item diagnostic must pass the policy before serialization. React receives only released aggregate values or an explicit suppressed state.

## Canonical Service Helpers

Create a small service/helper layer that all GraphQL resolvers and UI-facing serializers use. Avoid reimplementing math or band mapping in React components.

- `deriveAdaptiveItemParameters`
- `getEffectiveTree`
- `getEffectiveQuizPool`
- `materializeAdaptiveQuizPool`
- `authorizeAdaptivePoolMaterialization`
- `validateCompetenceTreeShape`
- `validateAdaptiveQuizReadiness`
- `getReachabilityWarnings`
- `selectAdaptiveNextAssignment`
- `getServedAssignmentForSubmit`
- `gradeAdaptiveResponse`
- `computeReportingNodeEstimate`
- `computeAdaptiveEstimates`
- `computeOverallTrajectoryPoint`
- `normalizeAdaptiveResultForChart`
- `serializeParticipantAdaptiveState`
- `serializeStudentAdaptiveResult`
- `serializeLecturerAdaptiveResults`
- `suppressAdaptiveAggregate`
- `lockAdaptivePracticeQuizLifecycle`
- `bulkUpsertAdaptiveEstimates`
- `materializeAdaptiveCohortSnapshot`

These helpers should call `@klicker-uzh/adaptive-learning` for level mapping, guessing, 3PL probability/information, MAP estimates, reachability, classification intervals, normalization, aggregation, and result-message decisions.

## Implementation Phases

### Phase 0 - Lock The Foundation

Purpose: remove ambiguity before new GraphQL and UI surfaces expose the feature.

Tasks:

- [x] Add `docs/adaptive-learning.md` and link it from `docs/index.md`.
- [x] Document stable decisions: competence trees, reusable course links, adaptive as practice quiz mode, max depth 5, supported item types, `a`, `b`, `c`, mapping rules, reachability formula, results language, privacy rules.
- [x] Add `test:run` to `packages/adaptive-learning/package.json`.
- [x] Add adaptive-learning package checks to CI or the existing package-test workflow.
- [x] Ensure workflows build `@klicker-uzh/adaptive-learning` before `@klicker-uzh/graphql` imports it.
- [x] Record the initial account deletion/tree lifecycle policy: transfer or hard-block rather than deleting used history.
- [x] Implement and test that policy in Phase 10; used trees are retained or transferred instead of being deleted with their owner.
- [x] Mark old `packages/prisma/src/prisma/schema/adaptive.prisma` models and old seed helpers as legacy, or remove them if no data migration is required.
- [x] Ensure no production-visible flag exposes unfinished adaptive mode.

Acceptance criteria:

- Adaptive package tests run with repo-standard commands.
- Stable engineering docs exist outside `project/`.
- Old standalone adaptive routes and GraphQL operations remain absent.
- A tree ownership lifecycle decision is recorded before real attempts are stored.

Verification:

- `pnpm --filter @klicker-uzh/adaptive-learning check`
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`
- `pnpm run format:check`

### Phase 1 - Competence Tree Backend Contracts

Purpose: make reusable competence trees safe to create, validate, link, and assign elements to.

Tasks:

- [x] Add `packages/graphql/src/services/competenceTrees.ts`.
- [x] Add GraphQL types for competence trees, nodes, levels, coverages, assignments, and course links.
- [x] Add queries for tree list/detail, validation, and course-linked trees.
- [x] Add atomic full-snapshot create/replace, metadata update, delete, duplicate, and course link/unlink mutations. Full-snapshot replacement deliberately supersedes granular structural mutations so invalid intermediate states cannot be persisted.
- [x] Validate atomic reorder and reparent through the full snapshot:
  - [x] Reject cycles.
  - [x] Recompute depths for the complete hierarchy from parent keys.
  - [x] Reject a hierarchy when any descendant would exceed depth 5.
  - [x] Keep level and sibling order unique, zero-based, and contiguous.
- [x] Add the v1 structural lock: any adaptive practice-quiz config reference allows metadata edits but rejects level, hierarchy, coverage, and assignment changes with `COMPETENCE_TREE_STRUCTURE_LOCKED`. This is intentionally stricter than publication-only locking.
- [x] Enforce full tree validation in service code:
  - [x] Tree has at least two levels; warn/recommend at least three for classification.
  - [x] Node depth is `1..min(tree.maxDepth, 5)`.
  - [x] Roots are competences.
  - [x] Children are subcompetences.
  - [x] Every competence has a subcompetence descendant and assignments terminate on subcompetence leaves.
  - [x] Assignable nodes are leaves only.
  - [x] Every enabled root competence has at least one enabled leaf.
  - [x] Every enabled leaf has at least one enabled coverage level.
  - [x] Element assignments use only `NUMERICAL`, `SC`, `MC`, `KPRIM`, `FREE_TEXT`.
  - [x] Assignment level belongs to the same tree.
  - [x] Assignment leaf belongs to the same tree and is actually a leaf.
  - [x] Non-root weights are either explicitly ignored in the API/UI or implemented consistently.
- [x] Store or return normalized root weights for quiz configuration.
- [x] Add service tests for permission-positive and permission-negative cases.
- [x] Add tests for duplication, structural locks, cycles, depth-5 rejection, atomic rollback, cross-course read-only access, and hidden unrelated course links.
- [x] Serialize replace/link/delete decisions with a tree row lock and add database constraints for same-tree parent/coverage/assignment references and unique coherent overall estimates.
- [x] Regenerate GraphQL artifacts after schema and operation changes.

Acceptance criteria:

- Invalid tree shapes cannot be persisted through GraphQL.
- Cross-course tree reuse is possible only through explicit course links.
- Elements cannot be assigned to unsupported types or non-leaf nodes.
- Tree/course/element permission failures are tested.
- Referenced trees retain their hierarchy/mapping semantics because they cannot be structurally mutated. Immutable element data and effective item parameters remain a Phase 2 publication-pool requirement before quizzes can be published.

Verification:

- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/graphql check`
- Targeted GraphQL service tests for competence trees.

### Phase 2 - Adaptive Practice Quiz Configuration And Readiness

Purpose: turn `PracticeQuiz.mode = ADAPTIVE` and `PracticeQuizAdaptiveConfig` into a real owner-facing API contract.

Tasks:

- [x] Extend `packages/graphql/src/schema/practiceQuiz.ts` to expose `mode` and adaptive config fields where authorized.
- [x] Extend `packages/graphql/src/services/practiceQuizzes.ts` so create/edit can save `STANDARD` or `ADAPTIVE` mode.
- [x] Preserve the current standard PracticeQuiz input/output path unchanged; adaptive config fields are conditional on `mode = ADAPTIVE`.
- [x] Require adaptive quizzes to select a linked competence tree.
- [x] Support quiz-specific enabled/disabled nodes and assignments through overrides.
- [x] Support quiz-specific root competence weights and normalize them.
- [x] Support quiz caps: total question cap, per-leaf cap, minimum questions per leaf, classification z, optional SE threshold.
- [x] Add presets:
  - [x] Placement/mastery uses `MASTERY`.
  - [x] Diagnostic/self-assessment uses `NEAREST`.
  - [x] Research/calibration exposes advanced settings.
- [x] Persist the selected preset and attempt-selection policy in `PracticeQuizAdaptiveConfig` so evaluation semantics remain stable if defaults change later.
- [x] Encode attempt policy with the preset: first completed for placement/mastery, latest completed for diagnostic/self-assessment, never best.
- [x] Explicitly disable points, XP, and leaderboard writes for adaptive mode.
- [x] Force completion results on and live estimates off for normal presets; do not expose a `showFinalResult` toggle in Manage v1.
- [x] Implement `validateAdaptiveQuizReadiness`.
- [x] Block publish when any enabled leaf-level cell has zero enabled assignments.
- [x] Warn when item count is below target, SE threshold is unreachable, or expected length exceeds the product time budget.
- [x] Allocate the shared total cap across roots, apply nested caps to minimum evidence, evaluate item information at common theta points, and report `classificationZ` band feasibility.
- [x] Reserve each enabled leaf's minimum evidence before information-based fill so root reachability uses a runtime-feasible subset.
- [x] Use a 30-minute planning budget and a clearly labelled conservative estimate of 60 seconds per item for default readiness warnings until pilot timing data replaces it.
- [x] Persist or return validation status in the owner preview.
- [x] Add owner preview query for tree, enabled nodes, weights, reachable coverage, warnings, and element pool.
- [x] On publish, transactionally materialize every effective pool item with source assignment id, element id/version snapshot, leaf/ancestor path, level, and effective `a`/`b`/`c`.
- [x] Establish the materialized pool as the only supported Phase 3 runtime source. Element edits or tree changes after publication cannot alter an existing snapshot.
- [x] Reject deleted source elements for future pools while preserving already-published immutable rows.
- [x] Bind attempts to their quiz/config and pool-backed responses to one config/pool/assignment/element identity with composite database constraints.
- [x] Bind attempts to the same participant/participation/course/quiz identity and require a pool item for every new response while preserving legacy nullable rows.
- [x] Keep adaptive quizzes out of participant listings and direct participant quiz data until Phase 3 provides the runner.
- [x] Reject future-dated adaptive publication until a durable outbox/reconciler exists; preserve standard scheduling unchanged.
- [x] Batch pool inserts and enforce initial guardrails of 20 levels, 500 nodes, and 10,000 coverage/assignment rows.
- [x] Allow republishing to replace the snapshot only while the quiz has no attempts. Once an attempt exists, structural/config changes require duplicating the PracticeQuiz.
- [x] Add GraphQL operations for Manage UI.
- [x] Regenerate GraphQL artifacts.

Acceptance criteria:

- Standard practice quiz behavior remains unchanged.
- Adaptive practice quizzes cannot be published without a valid tree and reachable pool.
- Owner preview explains why a quiz is or is not publishable.
- Raw mapping rules are hidden behind presets in default UI-facing contracts.
- Adaptive config previews state the attempt policy and that adaptive classifications do not award points/XP.
- Editing a source element after publication does not change the published pool, served payload, or item parameters.
- Deleted source elements block a new pool, and valid all-false KPRIM items remain scorable.
- Participant APIs cannot expose an empty adaptive quiz before the runtime exists.

Verification:

- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/graphql check`
- Targeted service tests for standard/adaptive create/edit and publish validation.

### Phase 3 - Adaptive Attempt Runtime

Purpose: make the student runtime deterministic, tamper-resistant, and participant-safe.

Tasks:

- [x] Add `packages/graphql/src/services/adaptivePracticeQuizzes.ts`.
- [x] Add participant mutations:
  - [x] Start adaptive practice quiz attempt.
  - [x] Resume in-progress attempt.
  - [x] Submit response to currently served assignment.
  - [x] Abandon attempt.
- [x] Add participant queries for current adaptive state and completion result.
- [x] Enforce attempt policy at runtime: `FIRST_COMPLETED` blocks retakes after completion but permits replacing abandonment; `LATEST_COMPLETED` permits new attempts.
- [x] Server-select and persist the next immutable published pool item rather than a live tree assignment.
- [x] Add a coverage warm-up phase that serves scorable evidence from every enabled root before unrestricted information-based selection; this guarantees the overall trajectory can become defined.
- [x] Stop individual root competences with the canonical classification-interval-within-band rule after minimum evidence.
- [x] Finish when all enabled roots are classified; use total cap, pool exhaustion, and insufficient data as explicit fallback stop reasons.
- [x] Keep per-leaf caps and coverage targets for breadth, not as independent claims that every leaf estimate is precise.
- [x] Return participant-safe element payloads without solutions or hidden grading data.
- [x] Snapshot delivered element data/options into `elementSnapshot` at delivery or before grading.
- [x] Project routing-only pool fields for selection/reporting and load full `elementData` only for the currently served item.
- [x] Submit mutation must reject arbitrary assignment ids, foreign assignments, disabled assignments, repeated answers, and cross-participant attempts.
- [x] Verify the served pool item belongs to the quiz's published snapshot and supported type.
- [x] Grade supported element types:
  - [x] `SC`
  - [x] `MC`
  - [x] `KPRIM`
  - [x] `NUMERICAL`
  - [x] controlled-answer `FREE_TEXT`
- [x] Persist normalized response, correctness, score, order, estimates, stop reason, final level, and completion time.
- [x] For each accepted response, recompute the affected leaf and every ancestor from pooled descendant responses.
- [x] Compute final estimates for overall, all enabled root competences, and every enabled subcompetence node, including non-leaf intermediate nodes.
- [x] Use only normalized root competence weights for the overall estimate; never aggregate subcompetence estimates into it.
- [x] Propagate overall standard error as `sqrt(sum(w_i^2 * SE_i^2))` over disjoint root response sets.
- [x] Store a nullable overall trajectory point on the response once every enabled root has scorable evidence.
- [x] Make ordered response rows the sole trajectory history and stop writing duplicate attempt-level theta/SE arrays.
- [x] Serialize student results as level bands, normalized trajectory coordinates, confidence and near-boundary language, and a nested node profile.
- [x] Suppress a node level and return `INSUFFICIENT_DATA` when it has fewer than four scorable responses.
- [x] Serialize lecturer results as anonymous buckets with small-bucket suppression.
- [x] Convert exhausted Prisma/adapter serialization retries to the stable `ADAPTIVE_ATTEMPT_CONFLICT` API error.

Acceptance criteria:

- Students can complete an adaptive practice quiz through GraphQL without any UI-specific shortcuts.
- Completed attempts have overall and every enabled reporting-node estimate.
- Intermediate subcompetence nodes are estimated from all responses in their subtree.
- Inserting an intermediate node without changing leaf assignments cannot change a root or overall estimate.
- The final trajectory point exactly equals the stored final overall estimate and mapped level.
- No raw solutions or hidden grading data are sent to participants.
- Served-item integrity tests cover arbitrary item submission, repeat submission, disabled item, foreign tree, foreign participant, and foreign course.
- Snapshot-integrity tests prove that editing an assigned source element after publication cannot change an existing quiz attempt.

Verification:

- `pnpm --filter @klicker-uzh/graphql check`
- Targeted GraphQL service tests for adaptive runtime.
- Targeted adaptive package tests for computations used by runtime.
- Contract tests proving participant results contain no theta, standard-error, item-parameter, or solution fields.

### Phase 4 - Measurement Gates And Package Hardening

Purpose: ensure the math and normalization gates match production pools, not idealized simulations.

Tasks:

- [x] Replace `project/adaptive-learning-sweep-harness.mjs` with package-owned deterministic simulations that execute the production runtime.
- [x] Add product-profile and form-length simulations:
  - [x] Placement/mastery.
  - [x] Diagnostic/nearest.
  - [x] Short-form cap overlay (not a persisted preset).
  - [x] Long-form cap/rich-pool overlay (not a persisted preset).
- [x] Add item mix simulations:
  - [x] SC-only.
  - [x] SC/MC/KPRIM.
  - [x] Numerical/free-text.
  - [x] Mixed pool.
- [x] Add pool-size scenarios: sparse, target, rich.
- [x] Add mislabel-noise scenarios with shifted item levels.
- [x] Track exact accuracy, adjacent accuracy, mean absolute level error, mean and 95th percentile question count, stop reasons, per-level accuracy, and signed per-level bias.
- [x] Define explicit regression gates for every clean profile, including zero unexpected fallback.
- [x] Add analytical and routed reachability coverage for SC, MC, KPRIM, numerical, and free-text pools.
- [x] Add hierarchy invariants across legal maximum depths 2 through 5, while structural validation rejects a depth-1 root without a subcompetence:
  - [x] Node estimates pool all descendant responses exactly once.
  - [x] Reordering or inserting an intermediate subcompetence does not change root/overall estimates.
  - [x] Disabled roots and their descendants do not contribute.
  - [x] Root weight normalization is stable and rejects an all-zero configuration.
- [x] Add trajectory tests:
  - [x] No point is emitted before every enabled root has evidence.
  - [x] Every point has finite bounded coordinates and an ordered interval.
  - [x] Standard-error intervals may widen or narrow; tests do not assert false monotonicity.
  - [x] Final point, final estimate, level badge, and canonical mapping helper agree.
  - [x] Participant chart normalization never exposes raw theta or standard error.
- [x] Pin decimal-comma behavior with tests for `0,5`, `0,500`, `1,200`, and `12,000`.
- [x] Enforce free-text controlled-answer boundaries in tree, readiness, and runtime services.
- [x] Delete the unused `packages/shared-components/src/adaptive/` directory before UI reuse.
- [x] Keep canonical `NEAREST` and `MASTERY` mapping tests in the package; no frontend band-assignment helper remains.
- [x] Benchmark prepared runtime creation, first selection, and a 999-response decision at 500 nodes, 20 levels, and 10,000 items.
- [x] Obtain an independent psychometric/code review of the final gates and shared runtime before declaring Phase 4 complete.

Acceptance criteria:

- Every shippable preset has explicit simulation evidence.
- Numeric and free-text product boundaries are enforced by package and service tests.
- No frontend component can silently render bands using non-canonical mapping math.

Verification:

- `pnpm --filter @klicker-uzh/adaptive-learning test:run`
- `pnpm --filter @klicker-uzh/adaptive-learning test:simulation`
- Targeted shared-component tests if those components remain.

### Phase 5 - Manage UI

Purpose: let lecturers author, validate, publish, and inspect adaptive practice quizzes without touching raw schema concepts.

Tasks:

- [x] Add `/resources/competenceTrees`, `/resources/competenceTrees/new`, and `/resources/competenceTrees/[id]` using existing Manage navigation and page chrome.
- [x] Build the competence-tree library:
  - [x] Owned and linked/read-only filters.
  - [x] Search, create, duplicate, archive/restore, and course-link actions.
  - [x] Usage status showing linked courses and draft/published quiz references.
- [x] Build the tree editor using the interaction contract above:
  - [x] Ordered level editor with canonical band preview.
  - [x] Collapsible depth-5 outline with selected-node details.
  - [x] Add child, reorder, reparent, duplicate branch, and delete controls.
  - [x] Root competence default weights with automatic normalization preview.
  - [x] Leaf-by-level coverage matrix with filters and sticky headers.
  - [x] Validation summary that separates blocking errors from warnings and links each issue to its editor location.
  - [x] Structural-lock message and `Duplicate tree` action when any adaptive quiz config references the tree; v1 intentionally locks earlier than publication.
- [x] Add element editor integration as a focused `Adaptive mapping` section:
  - [x] Show all accessible tree assignments for the element.
  - [x] Select a competence tree, then select a breadcrumb-labelled leaf and level `b`.
  - [x] Show inferred `c`, read-only default/effective `a`, and numerical percent-input behavior.
  - [x] Hide assignment controls for unsupported element types and explain the supported set.
  - [x] Validate controlled-answer `FREE_TEXT` before assignment.
- [x] Extend the existing four-step PracticeQuiz wizard rather than adding a seven-step flow:
  - [x] Information step: segmented `STANDARD` / `ADAPTIVE` mode selector while the activity remains labelled Practice quiz.
  - [x] Description step: unchanged apart from adaptive-context copy when needed.
  - [x] Settings step: course, preset, attempt policy summary, timer/result display options, and collapsed expert settings for research mode.
  - [x] Questions step: keep `StackCreationStep` for standard mode; render a new adaptive setup step for adaptive mode.
- [x] Build the adaptive setup step:
  - [x] Select an accessible tree already linked to the chosen course.
  - [x] Offer a permission-checked transactional link for an owned tree that is not linked yet.
  - [x] Preview the complete nested hierarchy with quiz-specific enable/disable toggles.
  - [x] Cascading disable confirmation explains which descendants and elements leave the effective pool.
  - [x] Adjust quiz-specific root weights and show normalized percentages.
  - [x] Preview assignments in a dense filterable table with enable/disable overrides.
  - [x] Show the coverage matrix, expected length, reachability warnings, and authoritative publish readiness response.
- [x] Add adaptive panels under the existing PracticeQuiz evaluation route:
  - [x] Anonymous overall level distribution.
  - [x] Root competence distributions.
  - [x] Expandable nested subcompetence distributions.
  - [x] Completed, in-progress, abandoned, capped, pool-exhausted, and insufficient-data counts.
  - [x] Stop-reason and near-boundary summaries.
  - [x] Small-bucket suppression messaging from server-provided states.
  - [x] Keep item exposure/fit absent until pilot calibration data reaches its minimum sample threshold.
- [x] Add `de` and `en` i18n entries.
- [x] Add `data-cy` hooks for key workflows.

Acceptance criteria:

- A lecturer can create a reusable tree, link it to a course, assign elements, create an adaptive practice quiz, preview readiness, and publish only when valid.
- The tree editor handles a real depth-5 fixture without clipped labels, ambiguous ancestry, or invalid reparenting.
- The PracticeQuiz wizard still has four workflow steps and never presents adaptive learning as another activity type.
- The UI does not show unsupported item types as valid adaptive assignments.
- Readiness errors match backend validation, not duplicated frontend-only rules.
- A linked-course manager can inspect and use a tree but cannot mutate the owner's shared definition.

Verification:

- `pnpm --filter @klicker-uzh/frontend-manage check`
- `pnpm --filter @klicker-uzh/graphql generate`
- `npx agent-browser` screenshots for the tree library, depth-5 edit/reparent states, element assignment, standard/adaptive wizard branches, readiness errors/warnings, and results dashboard at desktop and mobile widths.

### Phase 6 - Student PWA Runtime And Completion Results

Purpose: put adaptive delivery inside the existing practice quiz route with honest student-facing language.

Tasks:

- [x] Update the existing practice quiz page to branch on `PracticeQuiz.mode`.
- [x] Render standard quizzes with the current stack runner.
- [x] Render adaptive quizzes with focused components under the same route, for example `AdaptivePracticeQuiz`, `AdaptivePracticeQuizIntro`, `AdaptivePracticeQuizQuestion`, `AdaptivePracticeQuizResult`, `AdaptiveResultTrajectoryChart`, and `AdaptiveCompetenceProfile`.
- [x] Add intro screen:
  - [x] Purpose.
  - [x] Expected length or cap.
  - [x] No backtracking if that is the selected runtime rule.
  - [x] Resume behavior.
  - [x] Result use and privacy note.
  - [x] Keep optional self-assessment absent while every production preset disables the retired warm start.
- [x] Reuse existing participant question renderers for `SC`, `MC`, `KPRIM`, `NUMERICAL`, and controlled-answer `FREE_TEXT`.
- [x] Show honest progress as `Question N, at most M` plus plain-language status such as building/refining the estimate.
- [x] Do not copy the reference's numeric "estimate settling" percentage; it implies precision and a fixed convergence path the runtime cannot guarantee.
- [x] Hide live theta and live level by default.
- [x] Support resume state, including attempts with zero submitted answers.
- [x] Support an explicit start-over action that atomically abandons the current attempt before creating another one.
- [x] Let the server expose whether a completed attempt may be repeated; show Practice again for `LATEST_COMPLETED` and keep it absent for `FIRST_COMPLETED`.
- [x] Derive owner/shared-lecturer preview capability from permissions so previews never invoke participant runtime.
- [x] Submit only through the served-assignment mutation.
- [x] Prevent a late initial state query from overwriting mutation-authored attempt state.
- [x] Preserve the existing PracticeQuiz embed completion signal. For adaptive mode, use the configured question cap as the upper-bound `totalSteps` until the embed protocol can carry an explicit upper-bound flag.
- [x] Add completion screen:
  - [x] Headline overall level band or explicit incomplete-result state.
  - [x] One line chart showing the weighted overall estimate over answered questions.
  - [x] Server-provided level-band backgrounds and central/interval positions.
  - [x] Confidence ribbon derived from standard errors without exposing raw theta/SE.
  - [x] Endpoint marker that matches the headline result exactly.
  - [x] Expandable depth-5 competence profile with root and nested subcompetence bands.
  - [x] Response counts and `INSUFFICIENT_DATA` states for under-measured nodes.
  - [x] Confidence and near-boundary wording.
  - [x] Gentle insufficient-pool or early-stop wording.
  - [x] Keep recommendations absent until a didactically valid server-authored rule exists; confidence alone must not select a competence.
  - [x] Textual chart/profile summary for screen-reader and nonvisual access.
- [x] Reset scroll and focus the progress heading for each newly served question; expose selected state and accessible names on all five answer controls.
- [x] Add `de` and `en` i18n entries.
- [x] Add `data-cy` hooks for student workflow.

Acceptance criteria:

- Students use the existing practice quiz URL and see an adaptive mode only when the quiz is adaptive.
- Students receive a level-band overview once they are done.
- The chart remains readable on a narrow mobile viewport and does not require horizontal scrolling to understand the result.
- The chart uses one line regardless of whether the tree has 2 nodes or a full depth-5 hierarchy.
- The chart endpoint, headline band, profile overall row, and textual summary are consistent for boundary values under both `NEAREST` and `MASTERY`.
- Disabling or inserting a nested subcompetence cannot double-count a response in the overall result.
- No raw theta or hidden solution data is visible in the client payload or UI.

Verification:

- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Component/unit tests for chart transformation, band boundaries, missing points, tooltips, and textual fallback.
- `npx agent-browser` screenshots for intro, question types, resume/start-over, boundary result, depth-5 profile, mobile chart, and insufficient-data states.
- Browser inspection of the participant GraphQL payload confirming no raw theta, standard error, solutions, or item parameters.

### Phase 7 - Controlled Pilot, Cleanup, And Broad Rollout

Purpose: ship safely, measure real behavior, then remove old adaptive leftovers.

Tasks:

- [x] Feature-flag adaptive practice quiz mode to selected courses with a default-off persisted course gate and reversible administrative mutation.
- [ ] Pilot with at least one tree that passes coverage and readiness gates.
- [x] Add anonymous monitoring for stop reasons, question counts/timing, near-boundary rates, response integrity, item exposure, observed/expected correctness, and item misfit.
- [ ] Monitor those signals and support tickets in a real selected-course pilot.
- [ ] Review result distributions with teaching staff before using for placement.
- [x] Add privacy-suppressed pilot diagnostics needed to decide whether deeper calibration work is warranted.
- [x] Add a read-only aggregate audit for the old adaptive tables and deliberately retain them pending environment evidence.
- [ ] Run the legacy audit in staging and production and decide whether real data needs migration, archival, or approved deletion.
- [ ] Remove old standalone adaptive schema, old seed helpers, and old relations from `Course`, `Element`, `Participant`, and `User` if no migration is needed.
- [x] Add Playwright E2E coverage for the rollout gate, depth-5 tree creation/reuse, assignment, adaptive PracticeQuiz creation/publication, student runtime/result bands, and anonymous lecturer results.
- [x] Close the Phase 7 production review findings for adaptive metadata access, fixed five-participant release batching, post-attempt rollback/republication, legacy terminal stop-reason migration, timer/timing integrity, and retry-safe end-to-end assertions.
- [x] Replace backend-authored English validation/readiness sentences with structured issue codes and parameters that Manage localizes while retaining the server message as a compatibility fallback.
- [x] Write the enable/rollback, support, privacy, ownership-transfer, pilot-gate, and legacy-audit operational runbook.

Historical Phase 7 status before the final review: rollout controls and local release evidence were implemented. Anonymous and unrelated callers cannot enumerate adaptive metadata; cohort analytics advance only at fixed five-distinct-participant boundaries; active/abandoned counts remain hidden; post-attempt unpublish/republish preserves the immutable pool; terminal legacy attempts receive meaningful stop reasons; and the student timer preserves missing timing as unknown. R1-R16 reopen engineering readiness because the initial suppression, lifecycle, migration, stopping, scale, and UX contracts are not yet sufficient for a pilot or broad rollout.

Acceptance criteria:

- Pilot data supports the chosen preset's expected accuracy and length.
- No permission or data-leak findings are open.
- Teaching team signs off on result interpretation.
- Legacy adaptive schema is either removed or deliberately documented as retained with migration rationale.

Verification:

- `pnpm run check:all`
- `pnpm run build`
- Targeted Playwright E2E suite for adaptive learning.
- Browser evidence captured with `npx agent-browser`.

Local Phase 7 evidence on 2026-07-13 includes a clean 184-migration PostgreSQL 17 replay, a populated pre-runtime migration fixture covering four terminal stop-reason paths, 79 focused adaptive/competence-tree GraphQL tests, 32 package tests, 19 runtime simulations, the 10,000-item guardrail, and a five-test Chromium journey with four distinct items and five completed participants. Root typecheck, formatting, Syncpack, affected lint, all 22 sequential production build tasks, and a 210-rule OpenGrep scan pass. The host-only `check:all` wrapper remains blocked by the unrelated existing `apps/chat` ESLint plugin resolution issue; its constituent gates pass in the development container. Browser screenshots confirm the question timer, the four-point student level-band result, and the first five-participant lecturer release. Sixth-participant fixed-release behavior is covered at the service layer but not yet asserted by the browser journey. This is local engineering evidence only; it does not establish pilot or broad-production readiness. The Phase 8-14, real-course, external-signoff, and staging/production gates remain open.

### Phase 8 - Reopen The Baseline And Make It Reproducible

Purpose: turn the current large working tree into a reviewable baseline, stop overclaiming readiness, and install regression gates before further behavior changes.

Tasks:

- [ ] Keep `Course.isAdaptiveLearningEnabled = false` for every non-test/non-pilot course. Record the enabled-course allow-list before each deployment.
- [x] Audit the current 95 modified tracked paths and 58 untracked paths. All 153 status entries on 2026-07-30 are adaptive implementation/configuration, tests and fixtures, migrations/audits, generated GraphQL artifacts, documentation, or screenshot evidence; no unrelated user path was identified. Re-audit immediately before staging because the worktree remains intentionally dirty.
- [ ] Regenerate GraphQL schema/operations and Prisma clients once, verify the generated diff, then create a coherent checkpoint commit for the already implemented Phases 3-7 so remediation commits remain reviewable. Do not push or open a PR as part of this phase unless separately requested.
- [x] Update `docs/adaptive-learning.md`, `docs/adaptive-learning-operations.md`, and this plan so they no longer claim engineering completion or browser proof that the Playwright spec does not assert.
- [x] Add named automated regressions, adjacent to the owning service/package tests, for every code-testable R1-R15 behavior before or together with its fix. For operational/external gates such as R16, add a versioned evidence checklist with named owner, artifact, threshold, and signoff instead. A test may be demonstrated red locally, but no intentionally failing test is committed.
- [x] Make `.github/workflows/test-adaptive-learning.yml` use the root Volta Node 24 and pnpm 11.5.0 pins, a frozen lockfile install, and path filters covering:
  - `packages/adaptive-learning/**`
  - adaptive Prisma schema/migrations/audits
  - adaptive GraphQL services/schema/ops/tests and generated contracts
  - Manage/PWA adaptive components and i18n
  - the focused Playwright spec/config/fixtures
  - the workflow itself
- [x] Keep the normal monorepo check/build workflows authoritative; the focused workflow is an early deterministic package/simulation gate, not a replacement.
- [ ] Reconcile the branch with current `v3` only after the checkpoint is reproducible. Resolve conflicts without discarding existing user changes and rerun affected gates.

Acceptance criteria:

- A fresh checkout of the checkpoint can install with the pinned toolchain, regenerate without unexplained drift, and run the focused adaptive checks.
- `git status --short` is empty after generation/formatting, apart from explicitly documented user-owned changes that are excluded from the adaptive commit.
- The course gate prevents a participant or lecturer from discovering an unfinished adaptive mode outside the allow-list.
- Documentation distinguishes historical Phase 7 evidence, newly reopened engineering blockers, pilot readiness, and broad production readiness.

Verification:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/adaptive-learning check`
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`
- `git diff --check`
- Two clean-cache focused CI runs on the same commit produce the same deterministic simulation metrics.

### Phase 9 - Close Privacy And Publication-Authorization Blockers

Purpose: make every lecturer aggregate non-disclosive and ensure element-sharing revocation is serialized with new publication snapshots.

Tasks:

- [x] Extract `packages/graphql/src/services/adaptivePracticeQuizPrivacy.ts` as the only implementation of adaptive suppression. Keep the public cohort serializer unable to bypass it.
- [x] Implement field-aware suppression helpers for categorical, binary, missingness, anomaly, and percentile metrics:
  - Every non-empty value cell and its complement must be either zero or at least `k = 5`.
  - Known and missing source populations for durations/estimates must each be zero or at least five before a percentile or missingness indicator is returned.
  - `insufficientData`, `nearBoundary`, integrity mismatch, missing duration, stop-reason, level-band, and item-diagnostic outputs use the same rule.
  - A suppressed value is `null` with an explicit suppression reason; never return zero as a substitute.
- [x] Move integrity/anomaly details that cannot be released under `k = 5` to privacy-safe operational telemetry. The event records only quiz id and anomaly type; it excludes participant ids, attempt ids, counts, raw responses, and timings.
- [x] Add a table-driven field-privacy suite spanning cohort sizes 0-15, release boundaries 5/10/15, `1/(n-1)` complements, one known or one missing duration, one sufficient/insufficient result, retakes, deletion, and repeated polling.
- [x] Persist immutable, versioned release aggregates at fixed five-participant boundaries and verify stable repeated reads, sixth-participant hiding, retakes, concurrent materialization, and erasure invalidation. The payload contains no release membership or person-level fields.
- [x] Define publication authority as follows: only the tree owner can author an assignment; the owner must still hold current element `READ` permission when a new immutable pool is materialized; a linked-course quiz manager may publish through the valid tree grant without receiving element content.
- [x] Add `packages/graphql/src/services/adaptivePracticeQuizPublicationAuthorization.ts` to resolve and revalidate all source elements inside the publication transaction.
- [x] Serialize sharing revocation and publication on the same element/derived-permission lock order. Publication takes source-element and matching derived-permission locks, rechecks current owner permission, then copies content. Direct and group-based revocation take a conflicting lock before removing derived/direct permission. The serial result is either a fully authorized snapshot or a failed publication with no pool/status change.
- [x] Mark revoked or deleted draft assignments unavailable in setup/readiness previews and return a structured localized issue code. Do not silently remove them from the shared tree.
- [x] Preserve already-published immutable snapshots for started and historical attempts. Use unpublish as the quiz-level operational takedown and the course rollout switch as the broader emergency stop; neither rewrites historical grading. Exceptional redaction requires privacy/content-owner approval and a separate audited migration.
- [x] Re-run the complete permission matrix: tree owner, linked-course manager, direct element share, revoked share, unrelated lecturer, quiz owner, enrolled participant, foreign participant, and anonymous caller.

Acceptance criteria:

- No field-level singleton or complementary disclosure remains at any release boundary or under missing data. Fixed aggregate releases prevent polling from exposing one completion at a time; real-course cohorts remain disabled pending the external retention decision and controlled pilot.
- Revoking element access before or concurrently with publication cannot produce a new snapshot from unauthorized content.
- Existing valid snapshots remain internally coherent and participant payloads still contain no solutions, `a`/`b`/`c`, theta, or standard error.
- The lecturer dashboard can explain suppression without exposing which student caused it.

Verification:

- `pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizzes`
- Focused publication/configuration/sharing service tests against PostgreSQL.
- GraphQL schema test for participant and cohort redaction.
- Browser inspection of suppressed five-person and ten-person cohorts, including one missing duration and one insufficient result.

Local Phase 9 evidence on 2026-07-13 includes 19 table-driven privacy-policy tests and 72 focused GraphQL tests across privacy, participant/cohort schema redaction, readiness, runtime, competence-tree permissions, tree-owner source authorization, linked-course manager publication, tree archive/delete, direct and group revocation races, and immutable prior snapshots. GraphQL, Manage, PWA, and Playwright typechecks pass; GraphQL/Manage/PWA production builds and generated operations pass; OpenGrep reports zero findings across 1,074 applicable community rules; and the five-test production-built Chromium workflow passes without a command-line timeout override. The browser workflow now distinguishes released zero/false, privacy-withheld, and minimum-sample states, checks German number/unit formatting, and exercises the 390 px item layout. Real browser screenshots cover released and field-withheld cohort states at desktop and 390 px widths. This closes R4 and the field-level portion of R3 only: real-course cohorts remain disabled until Phase 13 persists release membership and aggregates so erasure and repeated reads cannot reshape an already released cohort.

### Phase 10 - Repair Lifecycle, Migration, Ownership, And Retention

Purpose: guarantee valid serial outcomes for starts/deletes and make account/course deletion and migration forward-safe before real attempts exist.

Tasks:

- [x] Introduce one documented lock order used by publication, start, restart, unpublish, delete, and course disable: course gate -> `PracticeQuiz` -> adaptive config -> attempt. Put raw row-lock helpers in `adaptivePracticeQuizRepository.ts` rather than scattering SQL.
- [x] Move `deletePracticeQuiz` lookup, persisted permission check, `PracticeQuiz FOR UPDATE`, adaptive-config lock, attempt recount, and hard-delete/retention decision into one bounded transaction. Direct Permission rows are locked before DerivedPermission to serialize revocation without lock inversion.
- [x] Make attempt start take compatible course/quiz/config locks before checking publication state or creating an attempt. A start racing deletion either commits a durable attempt and forces retention, or fails with a stable not-found/unavailable error.
- [x] Add barrier-controlled concurrent service tests for start/delete, start/unpublish, restart/disable, double start, and permission-revocation/delete. The tests inspect PostgreSQL blockers before releasing each barrier and assert only valid serial outcomes.
- [x] Append a forward repair migration; do not rewrite a migration that may already have run:
  - Audit every `IN_PROGRESS` attempt with null/foreign `nextPoolItemId`.
  - Conservatively convert an unrecoverable row to `ABANDONED`, set `stopReason = ABANDONED`, clear the next item, and set `completedAt` deterministically.
  - Preflight-fail instead of guessing for cross-config/tree identities or corrupt response ordering.
  - Repair or quarantine violations of every active-runtime `NOT VALID` check, then `VALIDATE CONSTRAINT` with a bounded lock/statement plan.
- [x] Extend the populated upgrade fixture with null and non-null legacy next pointers, zero-response and answered in-progress attempts, malformed response snapshots, and every terminal status. A successful migration leaves no invalid or unresumable `IN_PROGRESS` row.
- [x] Change the `CompetenceTree.owner` foreign key from cascade to `Restrict`. Make the ownership-transfer script idempotent and add a locked account-closure preflight that blocks deletion until every tree has an approved disposition; record one internal audit event per transferred tree.
- [x] Prevent hard deletion of a PracticeQuiz or Course once adaptive attempts exist. Validated database `RESTRICT` constraints are the final guard and service-level retention is the user-facing contract; Phase 13 extends retention to persisted cohort snapshots.
- [x] Preserve participant erasure under the existing account policy. Until Phase 13, query-time cohorts recompute and suppress below a complete release boundary; Phase 13 implements the privacy owner's decision for non-identifying persisted snapshots.
- [x] Add lifecycle tests for unused, linked, draft-configured, published, attempted, and released-result trees/quizzes/courses, including account transfer, direct database retention, and query-time participant erasure. Phase 13 adds snapshot-retention variants.
- [x] Define the production migration executor and database/feature-owner responsibilities in `docs/data-and-migrations.md` and `docs/adaptive-learning-operations.md`; add an aggregate-only preflight, backup/restore checkpoint, lock/statement timeouts, abort thresholds, monitoring, and forward-fix procedure. Actual people and the timed staging record remain deployment evidence.
- [x] Rehearse the course kill switch with an active attempt: submit fails closed while disabled, abandon/support remains available, and re-enabling resumes the same immutable item without duplicate response or pool change.

Acceptance criteria:

- Repeated lifecycle concurrency tests show no successful start followed by a missing attempt and no deletion that silently removes adaptive history.
- A populated migration replay leaves all active runtime constraints validated and zero invalid `IN_PROGRESS` rows.
- Direct database deletion cannot cascade a used competence tree or quiz with adaptive history.
- Account closure is impossible until ownership transfer/retention succeeds and is auditable.
- A timed staging rehearsal and restore/forward-fix drill are approved by operations before production migration.

Verification:

- `pnpm run prisma:migrate`
- `pnpm run prisma:sync`
- Clean full-chain PostgreSQL 17 migration replay.
- Populated pre-repair -> latest upgrade fixture and constraint audit.
- Focused GraphQL lifecycle/concurrency/account-deletion tests.
- Staging disable/re-enable and migration rollback drill recorded in `docs/adaptive-learning-operations.md`.

Local Phase 10 evidence on 2026-07-13 includes a successful replay of 184 prior migrations plus a populated malformed fixture and all three forward migrations on PostgreSQL 17. All six runtime checks and four retention foreign keys are validated; direct attempted quiz/course deletion is rejected while participant erasure remains effective. Focused account-closure, transaction-retry, rollout, configuration, and runtime suites cover idempotent audited transfer, persisted administrator authorization, more-than-five-second lock survival, retry/backoff/exhaustion, proven database blocking, start/delete and start/unpublish in both orders, restart/disable in both orders, permission-revocation/delete, active-attempt pause, and immutable-item resume. This closes the local engineering tasks only. The timed staging deployment, backup restore, named-human approvals, and forward-fix drill remain open acceptance evidence and cannot be checked off locally.

### Phase 11 - Make The Shipped Measurement Contract Honest And Testable

Purpose: eliminate inert settings and preset drift, then test selection/stopping against production-shaped evidence without presenting mathematically impossible synthetic thresholds as psychometric validation.

Decision correction (2026-07-14): the original 90% six-band interior-classification, 25% cap, and 40% maximum-exposure requirements were rejected as an invalid synthetic contract rather than weakened silently. At 25% of a 1.2-wide band, `z = 1.28` requires `SE <= 0.234375`. Even ideal `a = 1.2`, `c = 0` items require at least 51 responses per root, so two roots cannot satisfy the interval inside a 50-item total cap. The 120-item target bank also has a roughly 40% average exposure lower bound at a 48-item mean form before adaptive concentration. Profile-aware engineering regression gates now detect code drift; the original `<= 0.25` cap and `<= 0.40` exposure requirements remain real-course pilot gates in Phase 14.

Tasks:

- [x] Define canonical product preset defaults once in `@klicker-uzh/adaptive-learning` and consume them from GraphQL configuration, Manage form defaults, readiness, runtime, seeds, and simulations. Add a contract test that fails when any layer drifts.
- [x] Remove `standardErrorThreshold` and `showLiveEstimate` from Prisma, GraphQL inputs/views/generated operations, Manage forms/i18n, seeds, and docs through a forward cleanup migration. Preserve `minimumReachableStandardError` only as an internal readiness diagnostic; it is not a runtime stop or lecturer knob.
- [x] Add a field-to-behavior contract test for every remaining adaptive setting. Each persisted/public field must name exactly one runtime, readiness, display, or audit consumer. Delete forced legacy fields whose value can never vary.
- [x] Extend `AdaptiveSimulationMetrics` with:
  - `classificationRate` and `totalQuestionCapRate`
  - rates by preset, level, root, and distance from the nearest level boundary
  - maximum/percentile item exposure
  - root failure reason: breadth missing, interval crossing a boundary, node cap, global cap, or pool exhaustion
  - timing estimates using the same product duration assumption as readiness
- [x] Generate Placement and Diagnostic simulations from canonical shipped defaults. Keep short/long forms as explicitly named stress overlays; never describe the short-form overlay as a shippable preset.
- [x] Add true-versus-configured discrimination sweeps with configured `a = 1.2` and true `a in {0.8, 1.0, 1.2, 1.5}`, plus 0%, 10%, and 20% adjacent-level mislabelling. Preserve all five supported item-type mixes and sparse/target/rich pools.
- [x] Diagnose why clean learners reach the cap before changing the algorithm. Boundary-targeted routing experiments were rejected when they worsened evidence; the accepted runtime change avalanches the stable selection hash to remove sequential-id skew without adding a simulation-only algorithm.
- [x] Keep classification-in-band as the primary stop. Clearly placed learners may stop early; boundary learners may consume the cap and receive honest near-boundary/capped language. Never stop merely because an estimate is numerically stable while its interval crosses a level boundary.
- [x] Promote impossible minimum-evidence/cap combinations and structurally unreachable root-level classification bands to publication blockers for Placement and Diagnostic. Research retains the diagnostics as editable warnings but cannot publish while any structural warning remains unresolved.
- [x] Require at least five independent, enabled, scorable items per enabled leaf-level coverage cell for production Placement/Diagnostic publication. Keep structural tree editing permissive; enforce the blueprint in adaptive readiness, with breadcrumb-labelled issue codes.
- [x] Add an authoring/standard-setting protocol to the operations guide: two independent subject experts level each pilot item, disagreements are reconciled, weighted kappa is reported, and level descriptors/boundaries are approved before the pilot.
- [x] Keep randomesque selection package-pure, measure maximum and P95 exposure, and document that the five-item target bank is a publication blueprint minimum rather than exposure certification. Retain maximum exposure `<= 0.40` as a real-course pilot gate; expand/recalibrate the bank or review cohort-stateful control if a course cannot meet it.
- [x] Produce one deterministic machine-readable simulation report artifact for CI and one concise Markdown summary for reviewers. Threshold changes require review of the report diff.

Synthetic engineering regression gates for the canonical clean target/rich Placement and Diagnostic profiles:

| Metric | Required gate |
| --- | --- |
| Exact level agreement | `>= 0.70` overall |
| Same-or-adjacent agreement | `>= 0.95` overall and per level where the stratum is populated |
| Per-level exact agreement | `>= 0.60` |
| Mean absolute level error | `<= 0.35` |
| Absolute signed per-level bias | `<= 0.50` bands |
| Interior learner classification | target `>= 0.15`; rich `>= 0.25` when true ability is at least 25% of a band width from a boundary |
| Overall `TOTAL_QUESTION_CAP` rate | target `<= 0.90`; rich `<= 0.80` |
| Unexpected pool/node/insufficient fallback | `0` in clean target/rich profiles |
| Maximum item exposure | target `<= 0.90`; rich `<= 0.60` |
| P95 item exposure | target `<= 0.80`; rich `<= 0.45` |
| Mean length | `<= 0.99 * totalQuestionCap` |
| Determinism | Identical metrics for identical seeds/configuration |

Acceptance criteria:

- High cap rates remain visible and cannot be misreported as psychometric readiness; Phase 14 retains the real-course `<= 0.25` gate.
- The shipped defaults, readiness model, runtime, UI copy, and simulation profile are identical by contract.
- All canonical profiles pass predeclared, profile-aware engineering regressions; those baselines are versioned in the machine-readable report and changes require report review.
- The final chart endpoint, stored estimate, headline band, nested overall row, and text summary remain exactly consistent after algorithm changes.
- Psychometric reviewers must still sign the simulation report and standard-setting protocol before any real-course pilot; local engineering cannot check this external gate.

Verification:

- `pnpm --filter @klicker-uzh/adaptive-learning check`
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`
- `pnpm --filter @klicker-uzh/adaptive-learning test:simulation:report`
- GraphQL configuration/readiness/runtime contract tests.
- Independent recomputation of hierarchy/root/overall estimates from deterministic fixture responses within `1e-9`.

### Phase 12 - Make Authoring And Participant UX Recoverable And Accessible

Purpose: close the remaining authoring-integrity and accessibility gaps while preserving KlickerUZH's existing practice-quiz routes and visual language.

Tasks:

- [x] Replace node-only reparenting with one pure full-form structural command in `treeHelpers.ts` that updates nodes, coverage, assignments, selection, and validation state together.
- [x] Use these explicit reparent rules:
  - Block reparenting onto a populated leaf; require the author to move/delete that leaf's assignments and coverage deliberately.
  - Remove only empty/default coverage when a target leaf becomes an internal node; never silently move real assignments to an arbitrary branch.
  - When the old parent loses its final child and becomes a subcompetence leaf, initialize visible default coverage cells that the author must complete before readiness can pass.
  - Reject root-kind violations, cycles, and any subtree whose new depth exceeds five before mutating the form.
- [x] Clear stale server-validation output on every structural/form edit and rerun server-authoritative validation before save. Never hide orphaned rows merely because the matrix now filters them out.
- [x] Add focused pure tests for add child, move, reorder, reparent, duplicate, and delete across depths 1-5, including every leaf/internal transition and preservation/removal rule.
- [x] Treat element persistence and tree mapping as two explicit domain outcomes rather than pretending they are atomic across all generic element mutations:
  - After element success, retain the returned element id and pending mapping durably in the existing autosave/local-storage state.
  - If mapping fails, show “Element saved; adaptive assignment not saved,” keep the modal in a retry state, and prevent duplicate element creation.
  - Provide idempotent Retry assignment and an explicit “Keep element unmapped” confirmation. Do not emit the combined success state until one is chosen.
  - Restore and reconcile the pending state after navigation/reopen; clear it only after the server confirms the mapping or the author explicitly abandons it.
- [x] Add a shared pages-router unsaved-changes hook covering `beforeunload`, browser back/forward, header/sidebar links, and programmatic navigation. Use it in the competence-tree editor and test save/discard/cancel behavior.
- [x] Use semantic nested lists or a conforming ARIA tree for the hierarchy. Expose expanded, selected, depth, and position state; bind every visible label to its control; keep add/reorder/reparent/delete keyboard-operable without drag-and-drop.
- [x] Fix the course-row composite interaction so the course link and action buttons are semantic siblings and nested keyboard activation cannot navigate unexpectedly.
- [x] Add programmatic labels to adaptive assignment search/filters, tree selection, weight/cap controls, and every dense coverage control. Keep a visible focus indicator on programmatically focused question/result headings.
- [x] Fix nested competence-profile disclosure state so opening an ancestor does not rotate closed descendant chevrons. Preserve a textual hierarchy/result equivalent.
- [x] Add localized Retry actions for publication readiness, setup preview, attempt state/submission, and result-query failures. A retry must preserve form/answer state and cannot duplicate a response.
- [x] Remove the two retired setting controls and verify that completed students still receive the requested level-band overview and one uncertainty trajectory.
- [x] Fix only the Manage shell/layout overflow necessary for adaptive pages. Verify no horizontal document overflow, clipped German labels, off-screen dialogs, or overlapping matrix controls at 390, 768, and desktop widths.
- [x] Keep all new copy paired in `de` and `en`, all commands on existing design-system controls, and all release-critical states on stable `data-cy`/test ids.

Acceptance criteria:

- No hierarchy edit can produce hidden invalid coverage/assignment state; every destructive reconciliation is visible and confirmed.
- A mapping failure is never silent, never creates a duplicate element on retry, and remains recoverable after reopening the editor.
- Dirty edits survive or produce a confirmation across every navigation path.
- Tree authoring, adaptive quiz setup, participant completion, and result review are keyboard-operable with zero critical/serious accessibility findings.
- Adaptive Manage and PWA surfaces fit the supported mobile/tablet/desktop viewports in English and German without incoherent overlap or horizontal page scrolling.

Verification:

- `pnpm --filter @klicker-uzh/frontend-manage check`
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Pure tree-helper and mapping-state tests.
- Focused Playwright flows for reparent reconciliation, mapping failure/retry, unsaved navigation, transient submit/result recovery, and sixth-participant privacy boundary.
- `npx agent-browser` desktop/mobile screenshots in `en` and `de`, keyboard pass, accessible-name inspection, and `scrollWidth <= clientWidth` assertions.

### Phase 13 - Bound Database Work, Split Services, And Add Operations Signals

Purpose: make runtime and cohort behavior scalable, maintainable, and observable without replacing the validated domain model.

Tasks:

- [x] Split `adaptivePracticeQuizzes.ts` behind a stable facade/re-export layer:
  - `adaptivePracticeQuizCommands.ts`: start/resume/restart/submit/abandon orchestration only.
  - `adaptivePracticeQuizRepository.ts`: selects, locks, bulk estimate writes, and retry primitives.
  - `adaptivePracticeQuizParticipantViews.ts`: participant state/result serialization only.
  - `adaptivePracticeQuizCohort.ts`: release selection and aggregate read model.
  - `adaptivePracticeQuizPrivacy.ts`: all `k = 5` suppression.
  - `adaptivePracticeQuizDiagnostics.ts`: timing, exposure, expected/observed, and misfit aggregation.
- [x] Split `adaptivePracticeQuizConfig.ts` into configuration command, preparation/validation, and read-model modules while retaining one public service facade for resolvers.
- [x] Keep modules acyclic and dependency-directed: schema -> service facade -> command/read model -> repository/pure package. React must not import GraphQL service internals. Architecture tests enforce facade size, implementation size, cycles, reverse facade dependencies, React imports, and schema-to-facade routing.
- [x] Replace sequential estimate upserts with one parameterized, chunked `INSERT ... ON CONFLICT DO UPDATE` repository operation for overall plus node estimates. Preserve unique/index/check invariants and use the same transaction as response/next-item completion.
- [x] Add an opt-in maximum-shape database benchmark harness (500 nodes, 10,000 pool items, 10,000 attempts, 500,000 responses) with concurrent persistence. It records query count, lock/retry rate, p50/p95/p99 transaction time, and sanitized explain plans; the smoke profile is executable evidence only.
- [ ] Run the full benchmark against the approved production-sized clone and archive its summary/EXPLAIN artifacts as SLO evidence.
- [x] Add a typed, versioned `AdaptivePracticeQuizCohortSnapshot` model containing only server-generated aggregate JSON, release size/watermark, policy version, and timestamps. It contains no participant/attempt ids, raw answers, or exact person-level timings.
- [x] Materialize at most one snapshot per fixed five-participant release boundary under a quiz/config lock. Build it lazily on the lecturer read path; participant submission performs no snapshot work.
- [ ] Obtain the privacy/data owner's retention decision for invalidated aggregate rows. The conservative implementation invalidates every affected release on participant erasure, returns only a fresh complete lower boundary, and has five/ten-participant deletion tests; invalidated rows are not returned or exported.
- [x] Select canonical first/latest attempts and calculate level/stop/timing/item aggregates in PostgreSQL and bounded cursor batches. No path loads an unbounded course history into application memory.
- [x] Add indexes matching completed-attempt release order, participant attempt selection, estimate node/level aggregation, and response pool-item diagnostics.
- [ ] Validate every critical index/query with production-shaped `EXPLAIN (ANALYZE, BUFFERS)` evidence on the approved clone.
- [x] Add cursor pagination and server-side search for competence-tree/course catalogs. Load current element mappings first and lazy-load bounded picker pages instead of fetching every readable tree on editor mount.
- [x] Add privacy-safe structured operational events through the repository's existing logger; do not add a telemetry dependency solely for this feature. Cover:
  - attempt start/completion/abandonment and stop reason
  - hard-cap/pool-exhaustion rates
  - serialization retries and exhaustion
  - stale/replayed/foreign-item rejection
  - readiness/publication blocks and sharing revocation
  - cohort snapshot generation latency/failure
  - course-gate denial and kill-switch activation
- [x] Use course/quiz ids and aggregate counts only where operationally necessary. Never log participant ids, attempt ids, raw responses, solution data, theta, or exact individual timings.
- [x] Define dashboards and alert thresholds in the operations guide. At minimum alert on pool exhaustion in a production preset, integrity rejection spikes, retry exhaustion, cohort snapshot failure, and hard-cap rate above the approved pilot ceiling.
- [x] Keep each extracted adaptive service focused and reviewable. Facades remain below 250 lines and implementation modules below 700 lines under an executable architecture guard.

Production-shaped engineering SLOs, measured on the approved staging/production-sized clone:

| Path | Gate |
| --- | --- |
| Submit response transaction | p95 `<= 750 ms`, p99 `<= 1.5 s`, retry exhaustion `0` in load test |
| Estimate persistence | Bounded/chunked query count independent of node count; no per-node awaits |
| Cohort result read at 10,000 participants / 500,000 responses | p95 `<= 2 s`, no full-history application materialization, process RSS increase `< 100 MB` |
| Tree catalog first page at 10,000 trees | p95 `<= 500 ms`, bounded payload/page |
| Cohort snapshot generation | Idempotent under concurrent reads; exactly one snapshot per release/policy version |

Acceptance criteria:

- Runtime submission and cohort evaluation meet the SLOs without weakening serializable integrity or privacy.
- The 1,893/1,061-line service concentration is removed and every extracted boundary has direct contract tests.
- Tree/mapping initial loads are bounded and remain responsive with production-shaped fixtures.
- A dashboard and alert-firing drill exist, and an audit confirms operational output contains no participant-level data.

Verification:

- GraphQL service tests and PostgreSQL integration/load fixtures.
- `EXPLAIN (ANALYZE, BUFFERS)` artifacts for the four critical queries.
- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/graphql build`
- `opengrep scan --config auto` over all adaptive service/schema/UI changes.

Local Phase 13 evidence on 2026-07-14 includes the executable benchmark smoke profile, bulk estimate persistence tests, bounded catalog/cohort tests, concurrent fixed-release snapshot tests, privacy-safe event allow-list tests, architecture guards, and a clean 189-migration PostgreSQL 17 replay. Smoke timings are not production SLO evidence. The full benchmark, production-clone EXPLAIN plans, alert-firing drill, and privacy-owner retention decision remain pilot blockers.

### Phase 14 - Controlled Pilot, Independent Review, And Broad Rollout

Purpose: prove subject-specific validity and operational safety, then move from a named pilot to broad production without weakening the course-level rollback boundary.

Tasks:

- [ ] Freeze the release candidate, generate clients, and run the complete verification matrix from a clean checkout. No untracked source/generated artifacts remain.
- [ ] Run the migration chain and forward-repair migration on a production-sized clone with the named operations owner, backup/restore point, lock budgets, abort criteria, and rollback/forward-fix drill.
- [ ] Execute the legacy `AdaptiveAssessment*` audit with read-only staging and production roles. Archive signed aggregate-only output and choose one outcome per environment:
  - no data: approved cleanup migration and restore proof
  - seed-only data: explicit approved purge/retention
  - real data: immutable archive or reviewed migration mapping before any drop
- [x] Extend `playwright/tests/Z-adaptive-learning.spec.ts` or split it into independent fixtures so it proves, rather than merely documents:
  - [x] Default-off course gate.
  - [x] Depth-5 cross-course tree reuse.
  - [x] Negative metadata non-enumeration and cross-owner/course permission boundaries.
  - [x] Invalid reparent prevention/reconciliation in the browser, including populated-leaf and cycle rejection.
  - [x] Element-save/mapping failure and idempotent retry after reopen.
  - [x] Publication revocation failure in the browser; both lock orders are service-tested.
  - [x] All five item types, resume/start-over, and stale/double submit in this production workflow.
  - [x] Transient result/submission recovery and completed level-band/trajectory consistency.
  - [x] Lost restart-response recovery by refetching authoritative attempt state and adopting the committed replacement attempt.
  - [x] Resuming legacy/partial attempts with unknown elapsed time without presenting a false zero-second timer.
  - [x] Explicit `MASTERY` versus `NEAREST` result interpretation in English and German.
  - [x] Retained-history course deletion guidance that keeps the modal open and directs the owner to archive the course.
  - [x] Semantic, keyboard-readable assignment tables with named switches and mobile overflow containment.
  - [x] Five-person release, sixth participant remaining hidden, and singleton duration suppression.
  - [x] Ten-person browser release and complementary-cell suppression; service privacy coverage spans 0-15.
  - [x] English/German and desktop/mobile critical paths.
- [x] Capture real app screenshots for the changed Manage/PWA states in `project/screenshots/adaptive-learning-final/`.
- [ ] Attach the final screenshots/traces to the PR description or comment once a PR exists.
- [x] Run an independent final branch review after implementation. The 2026-07-30 `$thermo-nuclear-code-quality-review` findings were resolved: mapping-rule interpretation is preserved end to end, used-course deletion has a stable retention contract, ambiguous restart commits recover from authoritative state, unknown timing remains unknown, and the assignment grid is a semantic table.
- [ ] Pre-register the pilot before enabling a course:
  - named course/tree/preset and intended diagnostic/placement use
  - inclusion/exclusion and missing-data rules
  - independent teacher labels and two-expert standard setting
  - target of at least 100 valid completed attempts overall and at least 30 in any level/subgroup for which a separate claim is made
  - confidence intervals and fairness strata approved by privacy/teaching owners
  - support owner, incident channel, kill-switch owner, and rollback rehearsal time
- [ ] Once Phases 8-13 and pilot preregistration are complete, add only the named pilot course to the allow-list. Run the pilot with no participant-identifying export. Review item-level diagnostics only where `n >= 30`; remove/rewrite/relevel or explicitly adjudicate every retained item with absolute observed-minus-expected residual `>= 0.25`.
- [ ] Recompute a sample of pilot attempts independently from immutable responses and verify one contribution per ancestor, root-only weighted aggregation, and final estimate agreement within `1e-9`.
- [ ] Require all pilot gates below. A failed gate returns the course to disabled, records the reason, remediates the pool/algorithm/content, and repeats the relevant pilot evidence.
- [ ] Obtain named teaching, privacy/DPO, product/data-owner, and operations approvals. Placement remains advisory and not high-stakes until those owners separately approve consequential use.
- [ ] After the named pilot and every Phase 14 gate pass, roll out progressively to limited additional courses and then broad availability. Observe at least one complete teaching cycle at each real-course expansion stage.

Local engineering verification on 2026-07-30 is green: 13 focused Chromium release/journey tests; 153 adaptive and competence-tree GraphQL tests when the database-initialization suite is run with its intended file isolation; 34 adaptive core/runtime/presentation tests; 33 deterministic simulation tests plus the report gate; 53 Manage navigation, mapping-recovery, and tree-helper tests; 10 grading tests; all 23 TypeScript workspace checks; full Prettier and Syncpack checks; GraphQL generation; repository lint in the pinned container; and all 22 production build tasks under Node 24 with `NODE_ENV=production`. The 10,000-item runtime guardrail passes in 11 ms on the local smoke environment. A feature-scoped OpenGrep scan before the final five remediations covered 97 source files with zero findings; the current rerun is not claimed because this sandbox rejected the ruleset download to `semgrep.dev`. This evidence establishes a local engineering release candidate only. It does not satisfy the production-sized benchmark/EXPLAIN, clean-checkout, migration rehearsal, legacy-data audit, retention-owner, real-course psychometric pilot, or named approval gates above.

Real-course go/no-go gates:

| Area | Required gate |
| --- | --- |
| Independent exact agreement | `>= 0.70` with 95% CI reported |
| Independent same-or-adjacent agreement | `>= 0.95` |
| Median / p95 completion time | `<= 25 min` / `<= 35 min` |
| `TOTAL_QUESTION_CAP` rate | `<= 0.25` overall; interior-learner failures separately investigated |
| Pool/node exhaustion and integrity failures | `0` unexplained cases |
| Item exposure | maximum `<= 0.40` |
| Item diagnostics | each retained flagged item has `n >= 30` and residual `< 0.25`, or signed adjudication and repeat evidence |
| Standard setting | two subject experts, weighted kappa `>= 0.70`, no unresolved disagreement over one band |
| Fairness | predeclared analyzable strata have `n >= 30`; no unexplained exact-agreement gap over 10 percentage points |
| Privacy and support | zero singleton/differencing disclosure, zero participant-level telemetry, successful incident/rollback drill |
| External approval | named teaching, privacy, product/data-owner, and operations signoff |

Acceptance criteria:

- All R1-R16 rows are closed with code/test/operational evidence; no safety-critical finding is deferred.
- All synthetic and pilot gates pass on the shipped preset/configuration, not a private test-only profile.
- Migrations, account/course retention, kill switch, and restore/forward-fix behavior have been rehearsed in the deployment environment.
- The final branch is clean, generated artifacts are current, CI is green, screenshots are attached, and an independent maintainability review has no unresolved blocker.
- The single preregistered pilot entry is permitted after Phase 13. Only after all Phase 14 criteria pass may the plan move from `project/plans_wip/` to the completed-plan location or the allow-list broaden beyond that pilot.

Verification:

- `pnpm run check:all`
- `pnpm run build` using the production-equivalent concurrency available in CI
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`
- `pnpm --filter @klicker-uzh/graphql test:local`
- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/playwright test -- tests/Z-adaptive-learning.spec.ts tests/Z-adaptive-learning-release.spec.ts --project=chromium`
- `npx agent-browser` against the real local stack for final desktop/mobile `en`/`de` screenshots and payload inspection
- Clean and populated PostgreSQL migration replays plus staging rehearsal evidence
- Final `opengrep scan --config auto` and `$thermo-nuclear-code-quality-review`

## Next Implementation Slice Recommendation

Do not start a real-course pilot next. The next slice is **Phase 8 followed immediately by the safety portions of Phase 9**:

1. Keep every non-test course disabled and record the allow-list.
2. Make the existing working tree reproducible, generated-artifact clean, and reviewable as a checkpoint.
3. Correct the readiness/documentation overclaims and focused CI triggers.
4. Add the privacy differencing/missingness regression matrix.
5. Extract the suppression policy and close R3 before moving to publication authorization, lifecycle, or measurement tuning.

This is the smallest stable slice because it establishes a trustworthy baseline and closes a live information-disclosure risk without depending on later algorithm or UI work.

## Phase 15: Final Code-Boundary Hardening

The 2026-08-01 thermo-nuclear maintainability review found three P1 boundaries that must be closed before the branch is pushed for review. This phase changes ownership and failure semantics without changing the IRT model, quiz lifecycle, permissions, or participant-facing result interpretation.

### 15.1 Atomic initial element assignment

- [x] Extend the supported element manipulation mutations (`SC`, `MC`, `KPRIM`, `NUMERICAL`, controlled `FREE_TEXT`) with one optional initial competence-tree assignment input.
- [x] Persist a newly created element and its initial tree assignment in one database transaction. Any tree permission, structural-lock, coverage, type, or controlled-answer failure must roll back the element, permissions, tags, and activity-log writes.
- [x] Reuse one transaction-level assignment command from both initial creation and the existing post-save assignment mutation.
- [x] Keep the existing assignment mutation for later edits and removals; reject initial assignment on existing-element edits so the API has one unambiguous first-save contract.
- [x] Remove the browser mapping-recovery protocol. Autosave retains only form values and the pending pre-save mapping, and a failed atomic mutation leaves the form open for correction/retry.
- [x] Cover successful atomic creation, rollback, permissions, structural lock, unsupported type, controlled free text, and generated GraphQL/client contracts.

### 15.2 Typed estimator transition pipeline

- [x] Move estimator-version-specific response calculations behind the estimator dispatcher.
- [x] Return one typed transition that contains the canonical response audit projection, estimate writes, attempt transition, exposure contribution, and optional shadow/telemetry facts.
- [x] Keep `submitAdaptivePracticeQuizResponse` as the common transaction orchestrator: lock and validate the attempt/served item, grade the immutable snapshot, request one transition, persist through one shared pipeline, and emit telemetry after commit.
- [x] Preserve lock order, retry behavior, audit identities, V1/V2 estimator outputs, stop reasons, exposure accounting, and participant serialization exactly.
- [x] Add architecture tests that prevent estimator-version branching from returning to the submission command, plus parity and transaction regression tests.

### 15.3 Canonical root-weight policy

- [x] Add one pure shared helper for validation and normalization of enabled root weights.
- [x] Treat an enabled root weight as a finite strictly positive relative weight; disabled roots may be zero and do not participate. Normalize enabled roots to sum to one and reject an empty/all-zero enabled set.
- [x] Use the same helper for competence-tree validation, quiz-configuration preparation, publication readiness, and previews.
- [x] Remove duplicate caller-specific checks and add shared unit cases plus service-level parity tests.

### 15.4 Independent-review follow-up

- [x] Make first-save retries idempotent across lost GraphQL responses with one autosaved UUID, one unique assignment record, exact owner/tree/mapping/body checks, and a best-effort post-commit list refresh.
- [x] Fence every calibration-export run with a persisted UUID, run-specific artifact keys, lease-matched terminal writes, and stale-worker cleanup that cannot affect the replacement run.
- [x] Bound scale-link submissions to 1,000 exact anchors and replace sequential per-anchor reads with 500-row batched lookups plus in-memory identity checks.
- [x] Cover first-save retry/body conflict, refresh rejection, two-worker reclaim, run-specific keys, artifact bounds, query count, and clean migration replay.

### 15.5 Completion gates

- [x] Regenerate GraphQL operations and persisted-query artifacts.
- [x] Update the adaptive-learning wiki and progress log with the final ownership contracts.
- [x] Run focused adaptive package, GraphQL, Manage, simulation, migration, and Playwright checks. The release simulator intentionally rejects every current v2 promotion threshold, so `IRT_V2_DIAGNOSTIC` remains disabled.
- [x] Verify first-save assignment in the real Manage UI with browser evidence, including the switch's programmatic accessible name.
- [x] Run `pnpm run check:all`, diff-scoped OpenGrep, and all 22 production build targets. The full build passes serially in the documented devcontainer with `NODE_ENV=production`; this avoids host-only Rollup nontermination and contention with active dev writers.
- [ ] Complete the independent final maintainability review and resolve or explicitly defer every accepted finding.
- [ ] Commit only the adaptive-learning change set, preserving unrelated PWA edits, and push `adaptive-learning` only when every code gate is green.

## Verification Matrix

| Change type | Required verification |
| --- | --- |
| Adaptive package helper change | `pnpm --filter @klicker-uzh/adaptive-learning check`, `pnpm --filter @klicker-uzh/adaptive-learning test:run`, simulation tests when math changes. |
| Prisma schema change | `pnpm run prisma:migrate`, `pnpm run prisma:sync`, generated client, targeted service tests. |
| GraphQL schema/op change | `pnpm --filter @klicker-uzh/graphql generate`, `pnpm --filter @klicker-uzh/graphql check`, targeted service tests. |
| Manage UI change | `pnpm --filter @klicker-uzh/frontend-manage check`, i18n pair check, agent-browser screenshots. |
| PWA result/chart change | `pnpm --filter @klicker-uzh/frontend-pwa check`, chart transformation tests, i18n pair check, accessibility/text fallback, desktop/mobile agent-browser screenshots, participant payload inspection. |
| Privacy/cohort change | Full `n = 0..15` value/complement/missingness matrix, fixed-release polling/differencing tests, and lecturer payload inspection. |
| Authorization/publication change | Complete owner/linked/revoked/unrelated matrix plus barrier-controlled concurrent revocation/publication test. |
| Attempt/lifecycle transaction change | PostgreSQL barrier tests for start/delete/unpublish/disable and transaction-retry assertions. |
| Migration/constraint change | Clean full replay, populated upgrade fixture, constraint audit/validation, analytics sync, staging-sized rehearsal, and restore/forward-fix evidence. |
| Cohort/query/performance change | Production-shaped fixture, query-count assertion, `EXPLAIN (ANALYZE, BUFFERS)`, p95/p99/RSS evidence, and concurrent idempotency test. |
| Accessibility/navigation change | Keyboard flow, accessible-name/role inspection, supported viewport overflow assertions, and focused Playwright/agent-browser evidence in `de` and `en`. |
| Cross-layer feature slice | `pnpm run check:all`, relevant package tests, targeted Playwright E2E, browser evidence. |

Do not rely on a root-wide blind `pnpm run test:run` unless the environment is already known healthy and the runtime budget is acceptable. Prefer targeted tests first, then broader checks before PR.

## Seed And Fixture Plan

- [x] Seed one reusable tree linked to two test courses to exercise reuse permissions.
- [x] Include one depth-5 branch and at least two root competences so hierarchy and weighted aggregation are exercised.
- [x] Seed supported element assignments across at least three levels, multiple leaves, and all five supported element types.
- Do not seed old standalone adaptive assessments except as explicitly marked legacy data.
- Ensure seeded adaptive quizzes are safe by default:
  - Not published unless the pool passes readiness.
  - No solution leakage.
  - No `showSolutions` equivalent for adaptive completion unless separately designed.
- [x] Add Playwright fixtures for lecturer, course, tree, adaptive quiz, and participant attempts.
- [x] Add deterministic completed-attempt fixtures for a near-boundary result, an insufficient-data node, and a trajectory whose final point can be asserted against the final level.
- [x] Add privacy fixtures for value/complement/missingness cells at 4/5/6/9/10 participants, retakes, participant erasure, and immutable cohort-release snapshots.
- [x] Add permission fixtures where a tree owner receives then loses direct/derived element access while a linked-course manager configures a quiz.
- [x] Add a populated migration fixture for stranded in-progress attempts, missing pool/snapshot identities, terminal lifecycle states, and every formerly `NOT VALID` runtime constraint.
- [x] Add opt-in production-shaped scale fixtures for 500 nodes/10,000 pool items and 10,000 participants/500,000 responses without adding those volumes to the default seed.

## Data And Migration Plan

- Treat old `AdaptiveAssessment*` tables as legacy until a data decision is made.
- Before cleanup migration, check production/staging for real old adaptive data.
- If no real data exists, drop old tables and relations in a cleanup migration.
- If real data exists, define archival or migration semantics before dropping.
- Structurally lock competence trees referenced by published adaptive quizzes. V1 uses duplication for changes rather than an implicit live update or full revision graph.
- [x] Add `PracticeQuizAdaptivePoolItem` and migrate the next-item/response runtime to immutable published pool items.
- [x] Add same-tree foreign keys for competence-tree parents, coverage rows, and assignments; add a partial unique index/check constraint for coherent overall estimates (`20260710152000_adaptive_tree_integrity`).
- [x] Add equivalent same-tree constraints for quiz node/element overrides with the Phase 2 config write path (`20260710190000_adaptive_practice_quiz_configuration`).
- [x] Add composite config/quiz, config/pool, and response pool-identity constraints before Phase 3 writes attempts (`20260710190000_adaptive_practice_quiz_configuration`).
- [x] Add participant/participation/course identity constraints and enforce pool references for new responses without invalidating historical nullable rows.
- [x] Store source element id and version for audit, but serve and grade from the snapshotted element data and effective item parameters.
- For user deletion, prefer soft-delete/reassign or clear hard-block behavior over cascading away used trees.
- [x] Migrate response trajectory columns to explicitly named nullable overall reporting fields.
- [x] Remove `thetaHistory` and `standardErrorHistory`; ordered response rows are the canonical trajectory.
- [x] Run `pnpm run prisma:sync` so the analytics schema receives the final adaptive attempt/estimate shape.
- [x] Add actionable migration preflights for legacy cross-tree final levels, estimate nodes, and estimate levels; verify each against a populated 181-migration fixture.
- [x] Append a forward repair migration for invalid `IN_PROGRESS` rows and validate every active adaptive runtime constraint.
- [x] Remove `standardErrorThreshold` and `showLiveEstimate` through a forward cleanup migration and regenerate all clients/analytics schema.
- [x] Change used-tree/attempt lifecycle foreign keys from destructive cascades to the Phase 10 restrict/retention policy while preserving participant erasure cascades.
- [x] Add the typed, versioned privacy-safe cohort snapshot model and required release/aggregation indexes.
- [ ] Rehearse all forward migrations against a production-sized clone with backup, restore, lock-budget, and forward-fix evidence.
- [ ] Execute and sign the staging/production legacy audit before creating any old-schema drop migration.

## Required External Decisions

These decisions do not block Phase 8, but they block the named phase and therefore broad production:

1. **Anonymous snapshot retention after participant erasure (Phase 13):** privacy/data owner approves retaining versioned `k >= 5` aggregate snapshots with no identifiers/raw responses, or requires invalidation and re-suppression.
2. **Production migration execution (Phase 10):** operations names the executor/job, backup/restore owner, lock budgets, abort criteria, and forward-fix owner.
3. **Pilot purpose and strata (Phase 14):** teaching/privacy owners approve whether the first pilot is Diagnostic or Placement, independent labels, analyzable groups, and exclusions before data collection.
4. **Legacy data disposition (Phase 14):** product/data owner signs migrate/archive/delete per environment after the read-only audit.
5. **Consequential placement (after Phase 14):** separate institutional approval is required before a level band controls access, grading, or enrollment. Passing the engineering/pilot plan alone does not authorize high-stakes use.

Evolution defaults remain fixed and do not block v1: `k = 5`, independent tree duplication without revision lineage, `a = 1.2` outside reviewed calibration, immediate-only publication, and no automated recommendation.

## Progress Log

- 2026-08-01: Closed the three final P1 code boundaries: initial element assignment is atomic, estimator selection returns one correlated typed transition consumed by one persistence pipeline, and all enabled-root weights use one strict normalization policy. Follow-up review findings also closed mismatched runtime/decision selection, incorrect root error paths, opaque assignment failures, floating-point underflow, oversized schema/test/seed files, mutable CI actions, and the unnamed first-save switch. Focused package, database, migration, simulation, Playwright, browser, repository, and static-analysis gates pass; IRT v2 Diagnostic remains fail-closed because no promotion threshold passed.
- 2026-08-01: Closed the final independent-review follow-up: first-save request identity is stored durably on the element and survives later unmapping; scale links reject reused source/target calibrations and duplicate logical items; and export enqueue failures transition terminally without overwriting or misreporting a worker-won race. The database enforces complete request-id/fingerprint pairs. The 198-test adaptive package suite, 43 focused calibration/export tests, database-backed create-unmap-retry regression, clean 196-migration replay, full repository checks, targeted production bundles, and focused OpenGrep scan pass. The independent rereview found no remaining blocker; production-clone rehearsal and controlled pilot approval remain rollout gates.

- 2026-07-30: Completed the independent final-review remediation. Student results now preserve and explain `MASTERY`/`NEAREST`; ambiguous restart commits recover from authoritative state; unknown elapsed time is never rendered as zero; used-course deletion returns a stable archive-oriented retention error in the service and Manage modal; and the competence-tree assignment matrix is a semantic responsive table. Thirteen Chromium journeys, the focused package/service suites, all workspace checks, repository lint, generated contracts, and the 22-target production build pass. External deployment, retention-owner, psychometric-pilot, and named-approval gates remain open.

- 2026-07-14: Completed the locally implementable Phase 12/13 hardening. Full-form depth-5 tree commands, durable element-mapping recovery, shared navigation guards, accessible/responsive Manage and PWA states, split acyclic service facades, chunked estimate persistence, bounded catalogs/cohorts, fixed aggregate releases, privacy-safe telemetry, operations thresholds, and opt-in production-scale fixtures are in place. A clean 189-migration replay, populated Phase 10 rehearsal, and five-scenario production-built Chromium workflow pass. Production-clone SLO/EXPLAIN evidence, the invalidated-snapshot retention decision, staging/production legacy audit, controlled pilot, and named approvals remain open by design.

- 2026-07-13: Reopened production readiness after the final full-working-tree review. Added R1-R16 traceability and Phases 8-14 for reproducibility, privacy/publication authorization, lifecycle/migration/retention, meaningful measurement gates, recoverable accessible UX, bounded database/service architecture, observability, and controlled rollout. No real-course pilot may start until Phases 8-13 pass.
- 2026-07-09: Completed Phase 0 documentation/CI work and added the Phase 1 competence-tree validation skeleton with targeted tests.
- 2026-07-10: Reviewed the supplied standalone HTML and chose the Klicker-native split: reusable tree library, adaptive branch in the existing four-step PracticeQuiz wizard, existing participant/evaluation routes, and no standalone adaptive activity.
- 2026-07-10: Locked the student result design to one weighted overall trajectory with a standard-error interval plus an expandable depth-5 final competence profile.
- 2026-07-10: Completed the Phase 1 transactional competence-tree API, permissions, structural lock, generated operations, numerical normalization edge case, and focused unit/integration verification.
- 2026-07-10: Completed and independently reviewed Phase 2. The remediation passes added participant hiding before Phase 3, immediate-only publication, shared-cap/common-theta and classification-band readiness with per-leaf minimum reservation, deleted-source rejection, all-false KPRIM support, batched pools, bounded tree sizes, preserved Research migration semantics, new-response pool enforcement, and composite participant/course/quiz/config/pool/response constraints.
- 2026-07-10: Deferred only runtime-owned concerns to Phase 3: first-attempt serialization against pool replacement, participant serializers/submission authorization, and removal of nullable live-assignment compatibility fields. A durable scheduling outbox remains required before adaptive scheduling can be enabled.
- 2026-07-10: Completed Phase 3. The runtime now serializes pool publication against first attempt, serves and grades immutable snapshots, retries serializable conflicts, rejects tampering/replay/cross-participant access, routes deterministically across the depth-5 hierarchy, persists canonical estimates/trajectory, returns participant-safe level bands, and suppresses lecturer cohorts at the serializer boundary. Generic participant listings remain closed until Phase 6, and adaptive scheduling still requires an outbox/reconciler.
- 2026-07-10: Closed the independent Phase 3 review findings: enforced first-completed retakes, added three populated migration preflights, split routing/reporting/delivery projections, converted retry exhaustion to a stable API error, and added GraphQL-level cohort permission coverage. Mixed-pool simulation and the 10,000-item benchmark remain Phase 4 gates.
- 2026-07-12: Completed Phase 4. Deterministic package simulations now call the production runtime and gate recovery, bias, form length, fallback, item mixes, pool sizes, and item-label noise; hierarchy/trajectory invariants, controlled free-text and numerical boundaries, and the 500-node/10,000-item benchmark pass. The independent review found and verified fixes for non-contiguous MC/KPRIM choice IDs and empty MC responses conflicting with the non-empty guessing space. Monorepo typecheck, Prettier, Syncpack, targeted builds/tests, database lifecycle tests, frontend checks, and focused OpenGrep pass; root lint remains blocked only by the unrelated existing `apps/chat` missing `eslint-plugin-react-hooks` setup.
- 2026-07-12: Started Phase 5 with a contract-first Manage implementation. The audit confirmed that authoring must add real tree archive/restore and usage metadata, narrow element-assignment mutations, an unsaved server-authoritative setup preview, an executor-safe publication preview, round-trippable override/effective states, and richer hierarchical cohort summaries before the UI is wired.
- 2026-07-12: Completed Phase 5 Manage authoring and reporting. The reusable tree library/editor, five-type element mapping, four-step adaptive PracticeQuiz branch, permission-checked course linking, unsaved and publication-time readiness previews, immediate-only adaptive publication, and anonymous depth-5 cohort dashboard are wired through generated operations. A clean deterministic seed provides a cross-course depth-5 tree and 15 balanced completed attempts; browser evidence covers desktop and 390 px feature content. The existing desktop Manage navigation remains wider than 390 px and is recorded as inherited global responsive debt.
- 2026-07-12: Closed the independent Phase 5 review with no P0 remaining. Cohort results now require quiz `ADMIN`, adaptive evaluation actions require manager access, mode-switch warnings cover the complete adaptive config, course-link actions respect course write access, dense switches/targets have explicit accessible names, and the tree editor protects unsaved work. The draft-time structural lock remains the intentional Phase 2 v1 contract. Structured localization of backend issue parameters and Playwright automation remain Phase 7 rollout gates.
- 2026-07-13: Completed Phase 6 in the existing student PracticeQuiz route. The PWA now provides intro, zero-answer resume, atomic start over, policy-authorized retakes, permission-derived lecturer preview, all five accessible answer controls, server-served submissions, honest upper-bound progress, durable completion, one normalized uncertainty trajectory, level bands, an expandable depth-5 profile, localized text, and a race-free embed-ready handshake. Production-build browser QA covers desktop/mobile English and German, every supported item type, resume/restart, insufficient and classified results, depth 5, payload privacy, and `currentStep = 5` / `totalSteps = 12` embed completion. Independent review also closed stale-query overwrite, sparse endpoint, focus/scroll, result-evidence consistency, and unsupported confidence-based recommendation findings; Phase 7 Playwright automation remains the next gate.
- 2026-07-13: Completed the Phase 7 engineering controls and independent production review remediation. Adaptive discovery/bootstrap now requires enrollment or derived quiz permission; cohort analytics use fixed five-distinct-participant releases that retakes cannot advance, with no live lifecycle counts; unpublish/republish preserves the exact post-attempt pool; the runtime migration backfills meaningful terminal stop reasons; missing/implausible timing is handled explicitly and `showTimer` reaches the student route; and the retry-safe Playwright journey proves a four-item result headline against persisted state plus five-person anonymous release. Clean and populated PostgreSQL 17 migration checks, service tests, and real Manage/PWA screenshots pass. Real-course psychometric evidence, teaching/privacy/operations signoff, and staging/production legacy-audit decisions remain open by design.
