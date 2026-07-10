# Adaptive Learning Production-Readiness Plan

Created: 2026-07-09

Updated: 2026-07-10

Review corpus:

- `project/REVIEW-adaptive-learning-pr5113.md`
- `project/2026-07-07-adaptive-learning-pr5113-review.md`
- `project/2026-07-07-adaptive-learning-consolidated-review.md`
- `project/2026-07-07-adaptive-learning-v2-review.md`
- `project/2026-07-08-adaptive-learning-v2-remediation-review.md`
- `project/2026-07-09-adaptive-learning-production-review.md`

Reference concept: `/Users/paldov/Downloads/Adaptive Assessment (standalone).html`

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

Production readiness means lecturers can author valid competence trees, assign elements to leaf-level cells, configure an adaptive practice quiz against a tree, publish only when the pool is reachable and safe, students can complete an adaptive practice quiz through the existing practice quiz route, and owners can inspect anonymous level-band distributions.

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

## Review Finding Coverage

| Finding | Plan coverage |
| --- | --- |
| F1: Adaptive practice quiz exists only in Prisma | Phases 1, 2, 3, 5, 6 add GraphQL contracts, services, Manage authoring, PWA runtime, and results. |
| F2: Permissions missing | Permission contract section plus Phase 1 and Phase 2 service tests. |
| F3: Served-item integrity | Phase 3 makes the server choose and persist the served assignment and rejects arbitrary submissions. |
| F4: Tree validation missing | Phase 1 moves full shape validation into the competence-tree service. |
| F5: Mapping semantics need presets | Product decisions and Phase 2 introduce presets over raw mapping-rule knobs. |
| F6: Stop conditions need reachability validation | Phase 2 blocks publish on zero cells and warns on unreachable SE or excessive expected length. |
| F7: Simulation not production-shaped | Phase 4 ports the sweep harness into package tests with mixed pools and explicit gates. |
| F8: Numeric/free-text boundaries | Phase 4 fixes `0,xxx` comma decimals and enforces controlled-answer free text. |
| F9: Dead adaptive shared components | Phase 4 deletes or refactors `packages/shared-components/src/adaptive/` before UI reuse. |
| F10: Old adaptive tables/seeds remain | Phase 0 marks legacy clearly; Phase 7 removes after no-data or migration decision. |
| F11: Account deletion/tree lifecycle | Phase 0 decides and tests the lifecycle policy before real attempts exist. |
| F12: Aggregation must not be oversold | Product decisions and Phase 3 use weighted estimates for quiz summaries and careful labels. |
| F13: CI mismatch | Phase 0 adds CI-native scripts/workflows and dependency build order. |
| F14: Docs missing | Phase 0 adds `docs/adaptive-learning.md` and links it from `docs/index.md`. |
| F15: Future behavior implicit | Service helper section centralizes runtime contracts in GraphQL services. |

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
- Research/calibration: advanced settings visible, explicitly marked for internal or pilot use.

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
| Assign element to tree leaf | Lecturer/user | Tree write plus element permission according to the existing sharing policy. |
| Create/edit adaptive practice quiz | Lecturer/user | Course/practice quiz write plus tree access; tree must already be linked to the target course or linked transactionally with audit. Structural/config edits are blocked after attempts exist; duplicate the quiz instead. |
| Publish adaptive practice quiz | Lecturer/user | Publish permission plus successful readiness validation. |
| Start/resume attempt | Participant | Participation row for the quiz course. Do not use `Participation.isActive` as the access gate. |
| Submit response | Participant | Own in-progress attempt and currently served assignment only. |
| View own result | Participant | Own completed attempt; participant serializer exposes level bands and normalized chart positions, not raw theta/SE. |
| View class results | Lecturer/user | Practice quiz owner/admin; anonymous buckets only. |

Small-bucket suppression belongs in the result serialization service. Recommended default until an institutional threshold is chosen:

- Suppress leaf-level level buckets below `n < 5`.
- Suppress all adaptive result distributions when the cohort is below the course analytics threshold.

## Canonical Service Helpers

Create a small service/helper layer that all GraphQL resolvers and UI-facing serializers use. Avoid reimplementing math or band mapping in React components.

- `deriveAdaptiveItemParameters`
- `getEffectiveTree`
- `getEffectiveQuizPool`
- `materializeAdaptiveQuizPool`
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
- [x] Decide account deletion/tree lifecycle policy: soft delete, reassign to system/course owner, or clear admin-facing hard-block.
- [ ] Add a service-level deletion test once the policy is implemented.
- [x] Mark old `packages/prisma/src/prisma/schema/adaptive.prisma` models and old seed helpers as legacy, or remove them if no data migration is required.
- [ ] Ensure no production-visible flag exposes unfinished adaptive mode.

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

- [ ] Add `packages/graphql/src/services/adaptivePracticeQuizzes.ts`.
- [ ] Add participant mutations:
  - [ ] Start adaptive practice quiz attempt.
  - [ ] Resume in-progress attempt.
  - [ ] Submit response to currently served assignment.
  - [ ] Abandon attempt.
- [ ] Add participant queries for current adaptive state and completion result.
- [ ] Server-select and persist the next immutable published pool item rather than a live tree assignment.
- [ ] Add a coverage warm-up phase that serves scorable evidence from every enabled root before unrestricted information-based selection; this guarantees the overall trajectory can become defined.
- [ ] Stop individual root competences with the canonical classification-interval-within-band rule after minimum evidence.
- [ ] Finish when all enabled roots are classified; use total cap, pool exhaustion, and insufficient data as explicit fallback stop reasons.
- [ ] Keep per-leaf caps and coverage targets for breadth, not as independent claims that every leaf estimate is precise.
- [ ] Return participant-safe element payloads without solutions or hidden grading data.
- [ ] Snapshot delivered element data/options into `elementSnapshot` at delivery or before grading.
- [ ] Submit mutation must reject arbitrary assignment ids, foreign assignments, disabled assignments, repeated answers, and cross-participant attempts.
- [ ] Verify the served pool item belongs to the quiz's published snapshot and supported type.
- [ ] Grade supported element types:
  - [ ] `SC`
  - [ ] `MC`
  - [ ] `KPRIM`
  - [ ] `NUMERICAL`
  - [ ] controlled-answer `FREE_TEXT`
- [ ] Persist normalized response, correctness, score, order, estimates, stop reason, final level, and completion time.
- [ ] For each accepted response, recompute the affected leaf and every ancestor from pooled descendant responses.
- [ ] Compute final estimates for overall, all enabled root competences, and every enabled subcompetence node, including non-leaf intermediate nodes.
- [ ] Use only normalized root competence weights for the overall estimate; never aggregate subcompetence estimates into it.
- [ ] Propagate overall standard error as `sqrt(sum(w_i^2 * SE_i^2))` over disjoint root response sets.
- [ ] Store a nullable overall trajectory point on the response once every enabled root has scorable evidence.
- [ ] Make ordered response rows the sole trajectory history and stop writing duplicate attempt-level theta/SE arrays.
- [ ] Serialize student results as level bands, normalized trajectory coordinates, confidence and near-boundary language, and a nested node profile.
- [ ] Suppress a node level and return `INSUFFICIENT_DATA` when it has fewer than four scorable responses.
- [ ] Serialize lecturer results as anonymous buckets with small-bucket suppression.

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

- [ ] Port `project/adaptive-learning-sweep-harness.mjs` into `packages/adaptive-learning/test`.
- [ ] Add preset simulations:
  - [ ] Placement/mastery.
  - [ ] Diagnostic/nearest.
  - [ ] Short-form.
  - [ ] Long-form.
- [ ] Add item mix simulations:
  - [ ] SC-only.
  - [ ] SC/MC/KPRIM.
  - [ ] Numerical/free-text.
  - [ ] Mixed pool.
- [ ] Add pool-size scenarios: sparse, target, rich.
- [ ] Add mislabel-noise scenarios with shifted item levels.
- [ ] Track exact accuracy, adjacent accuracy, mean absolute level error, mean and 95th percentile question count, stop reasons, and per-level bias.
- [ ] Define shipping gates for each preset.
- [ ] Add reachability tests for SC, MC, KPRIM, numerical, and free-text pools.
- [ ] Add hierarchy invariants for tree depths 1 through 5:
  - [ ] Node estimates pool all descendant responses exactly once.
  - [ ] Reordering or inserting an intermediate subcompetence does not change root/overall estimates.
  - [ ] Disabled roots and their descendants do not contribute.
  - [ ] Root weight normalization is stable and rejects an all-zero configuration.
- [ ] Add trajectory tests:
  - [ ] No point is emitted before every enabled root has evidence.
  - [ ] Every point has finite bounded coordinates and an ordered interval.
  - [ ] Standard-error intervals may widen or narrow; tests do not assert false monotonicity.
  - [ ] Final point, final estimate, level badge, and canonical mapping helper agree.
  - [ ] Participant chart normalization never exposes raw theta or standard error.
- [ ] Relax decimal-comma parsing for `0,xxx` and add tests for `0,5`, `0,500`, `1,200`, and `12,000`.
- [ ] Enforce free-text controlled-answer boundaries in service validation.
- [ ] Delete or refactor `packages/shared-components/src/adaptive/` before any UI reuse.
- [ ] Add tests proving frontend band assignment matches package `mapThetaToLevel` for `NEAREST` and `MASTERY` if shared components remain.

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

- [ ] Add `pages/resources/competenceTrees.tsx` and a resource-list entry using existing Manage navigation and page chrome.
- [ ] Build the competence-tree library:
  - [ ] Owned and linked/read-only filters.
  - [ ] Search, create, duplicate, archive, and course-link actions.
  - [ ] Usage status showing linked courses and draft/published quiz references.
- [ ] Build the tree editor using the interaction contract above:
  - [ ] Ordered level editor with canonical band preview.
  - [ ] Collapsible depth-5 outline with selected-node details.
  - [ ] Add child, reorder, reparent, duplicate branch, and delete controls.
  - [ ] Root competence default weights with automatic normalization preview.
  - [ ] Leaf-by-level coverage matrix with filters and sticky headers.
  - [ ] Validation summary that separates blocking errors from warnings and links each issue to its editor location.
  - [ ] Structural-lock message and `Duplicate tree` action when a published quiz references the tree.
- [ ] Add element editor integration as a focused `Adaptive mapping` section:
  - [ ] Show all accessible tree assignments for the element.
  - [ ] Select or link a competence tree, then select a breadcrumb-labelled leaf and level `b`.
  - [ ] Show inferred `c`, read-only default `a`, and numerical percent-input behavior.
  - [ ] Hide assignment controls for unsupported element types and explain the supported set.
  - [ ] Validate controlled-answer `FREE_TEXT` before assignment.
- [ ] Extend the existing four-step PracticeQuiz wizard rather than adding a seven-step flow:
  - [ ] Information step: segmented `STANDARD` / `ADAPTIVE` mode selector while the activity remains labelled Practice quiz.
  - [ ] Description step: unchanged apart from adaptive-context copy when needed.
  - [ ] Settings step: course, preset, attempt policy summary, timer/result display options, and collapsed expert settings for research mode.
  - [ ] Questions step: keep `StackCreationStep` for standard mode; render a new adaptive setup step for adaptive mode.
- [ ] Build the adaptive setup step:
  - [ ] Select an accessible tree already linked to the chosen course.
  - [ ] Offer a permission-checked transactional link for an owned tree that is not linked yet.
  - [ ] Preview the complete nested hierarchy with quiz-specific enable/disable toggles.
  - [ ] Cascading disable confirmation explains which descendants and elements leave the effective pool.
  - [ ] Adjust quiz-specific root weights and show normalized percentages.
  - [ ] Preview assignments in a dense filterable table with enable/disable overrides.
  - [ ] Show the coverage matrix, expected length, reachability warnings, and authoritative publish readiness response.
- [ ] Add adaptive panels under the existing PracticeQuiz evaluation route:
  - [ ] Anonymous overall level distribution.
  - [ ] Root competence distributions.
  - [ ] Expandable nested subcompetence distributions.
  - [ ] Completed, in-progress, abandoned, capped, and insufficient-data counts.
  - [ ] Stop-reason and near-boundary summaries.
  - [ ] Small-bucket suppression messaging from server-provided states.
  - [ ] Item exposure/fit tab hidden until pilot calibration data reaches its minimum sample threshold.
- [ ] Add `de` and `en` i18n entries.
- [ ] Add `data-cy` hooks for key workflows.

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

- [ ] Update the existing practice quiz page to branch on `PracticeQuiz.mode`.
- [ ] Render standard quizzes with the current stack runner.
- [ ] Render adaptive quizzes with focused components under the same route, for example `AdaptivePracticeQuiz`, `AdaptivePracticeQuizIntro`, `AdaptivePracticeQuizQuestion`, `AdaptivePracticeQuizResult`, `AdaptiveResultTrajectoryChart`, and `AdaptiveCompetenceProfile`.
- [ ] Add intro screen:
  - [ ] Purpose.
  - [ ] Expected length or cap.
  - [ ] No backtracking if that is the selected runtime rule.
  - [ ] Resume behavior.
  - [ ] Result use and privacy note.
  - [ ] Optional self-assessment warm start when enabled by the preset.
- [ ] Reuse existing participant question renderers for `SC`, `MC`, `KPRIM`, `NUMERICAL`, and controlled-answer `FREE_TEXT`.
- [ ] Show honest progress as `Question N, at most M` plus plain-language status such as building/refining the estimate.
- [ ] Do not copy the reference's numeric "estimate settling" percentage; it implies precision and a fixed convergence path the runtime cannot guarantee.
- [ ] Hide live theta and live level by default.
- [ ] Support resume state.
- [ ] Support an explicit start-over action that atomically abandons the current attempt before creating another one.
- [ ] Submit only through the served-assignment mutation.
- [ ] Preserve the existing PracticeQuiz embed completion signal. For adaptive mode, use the configured question cap as the upper-bound `totalSteps` until the embed protocol can carry an explicit upper-bound flag.
- [ ] Add completion screen:
  - [ ] Headline overall level band or explicit incomplete-result state.
  - [ ] One line chart showing the weighted overall estimate over answered questions.
  - [ ] Server-provided level-band backgrounds and central/interval positions.
  - [ ] Confidence ribbon derived from standard errors without exposing raw theta/SE.
  - [ ] Endpoint marker that matches the headline result exactly.
  - [ ] Expandable depth-5 competence profile with root and nested subcompetence bands.
  - [ ] Response counts and `INSUFFICIENT_DATA` states for under-measured nodes.
  - [ ] Confidence and near-boundary wording.
  - [ ] Gentle insufficient-pool or early-stop wording.
  - [ ] Recommended next practice if available.
  - [ ] Textual chart/profile summary for screen-reader and nonvisual access.
- [ ] Add `de` and `en` i18n entries.
- [ ] Add `data-cy` hooks for student workflow.

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

- [ ] Feature-flag adaptive practice quiz mode to selected courses.
- [ ] Pilot with at least one tree that passes coverage and readiness gates.
- [ ] Monitor stop reasons, question counts, near-boundary rates, item exposure, observed/expected correctness, item misfit, and support tickets.
- [ ] Review result distributions with teaching staff before using for placement.
- [ ] Add calibration dashboard data collection if pilot requires it.
- [ ] Decide whether old adaptive tables have real data that needs migration.
- [ ] Remove old standalone adaptive schema, old seed helpers, and old relations from `Course`, `Element`, `Participant`, and `User` if no migration is needed.
- [ ] Add Playwright E2E coverage for adaptive creation, publication, student runtime, and lecturer results.
- [ ] Write support playbook and operational documentation.

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

## Next Implementation Slice Recommendation

Phases 0 through 2 are complete at the backend-contract level. The next slice should implement the server-authoritative participant attempt runtime against `PracticeQuizAdaptivePoolItem`; the Manage editor can consume the stable Phase 1/2 contracts in parallel once runtime payloads are fixed.

Recommended scope:

1. Start/resume an attempt only from a published immutable pool and persist the currently served `nextPoolItemId`.
2. Grade only the served pool item, reject replay/tampering/cross-participant submissions, and write ordered response snapshots.
3. Add hierarchical routing, stopping, final estimates, and participant-safe level-band/trajectory serializers.
4. Keep adaptive responses outside standard PracticeQuiz points, XP, and leaderboard writes.
5. Add participant service tests before the PWA consumes the runtime contract.

Do not include the tree editor UI in this slice. It should consume a stable, permission-tested API in the following vertical slice.

## Verification Matrix

| Change type | Required verification |
| --- | --- |
| Adaptive package helper change | `pnpm --filter @klicker-uzh/adaptive-learning check`, `pnpm --filter @klicker-uzh/adaptive-learning test:run`, simulation tests when math changes. |
| Prisma schema change | `pnpm run prisma:migrate`, `pnpm run prisma:sync`, generated client, targeted service tests. |
| GraphQL schema/op change | `pnpm --filter @klicker-uzh/graphql generate`, `pnpm --filter @klicker-uzh/graphql check`, targeted service tests. |
| Manage UI change | `pnpm --filter @klicker-uzh/frontend-manage check`, i18n pair check, agent-browser screenshots. |
| PWA result/chart change | `pnpm --filter @klicker-uzh/frontend-pwa check`, chart transformation tests, i18n pair check, accessibility/text fallback, desktop/mobile agent-browser screenshots, participant payload inspection. |
| Cross-layer feature slice | `pnpm run check:all`, relevant package tests, targeted Playwright E2E, browser evidence. |

Do not rely on a root-wide blind `pnpm run test:run` unless the environment is already known healthy and the runtime budget is acceptable. Prefer targeted tests first, then broader checks before PR.

## Seed And Fixture Plan

- Add a small v2 competence tree seed only after service validation exists.
- Seed one reusable tree linked to two test courses to exercise reuse permissions.
- Include one depth-5 branch and at least two root competences so hierarchy and weighted aggregation are exercised.
- Seed supported element assignments across at least three levels, multiple leaves, and all five supported element types.
- Do not seed old standalone adaptive assessments except as explicitly marked legacy data.
- Ensure seeded adaptive quizzes are safe by default:
  - Not published unless the pool passes readiness.
  - No solution leakage.
  - No `showSolutions` equivalent for adaptive completion unless separately designed.
- Add Playwright fixtures for lecturer, course, tree, adaptive quiz, and participant attempts.
- Add deterministic completed-attempt fixtures for a near-boundary result, an insufficient-data node, and a trajectory whose final point can be asserted against the final level.

## Data And Migration Plan

- Treat old `AdaptiveAssessment*` tables as legacy until a data decision is made.
- Before cleanup migration, check production/staging for real old adaptive data.
- If no real data exists, drop old tables and relations in a cleanup migration.
- If real data exists, define archival or migration semantics before dropping.
- Structurally lock competence trees referenced by published adaptive quizzes. V1 uses duplication for changes rather than an implicit live update or full revision graph.
- Add `PracticeQuizAdaptivePoolItem` (or an equivalently named model) and migrate `nextAssignmentId` / response assignment references to the immutable published pool item.
- [x] Add same-tree foreign keys for competence-tree parents, coverage rows, and assignments; add a partial unique index/check constraint for coherent overall estimates (`20260710152000_adaptive_tree_integrity`).
- [x] Add equivalent same-tree constraints for quiz node/element overrides with the Phase 2 config write path (`20260710190000_adaptive_practice_quiz_configuration`).
- [x] Add composite config/quiz, config/pool, and response pool-identity constraints before Phase 3 writes attempts (`20260710190000_adaptive_practice_quiz_configuration`).
- [x] Add participant/participation/course identity constraints and enforce pool references for new responses without invalidating historical nullable rows.
- Store source element id and version for audit, but serve and grade from the snapshotted element data and effective item parameters.
- For user deletion, prefer soft-delete/reassign or clear hard-block behavior over cascading away used trees.
- Before attempt runtime work, migrate `AdaptivePracticeQuizResponse.thetaAfter` / `standardErrorAfter` to explicitly named nullable overall reporting fields or document the existing names with those exact semantics.
- Stop storing `thetaHistory` and `standardErrorHistory` JSON after ordered response rows become canonical; remove the columns in the same migration if no deployed data depends on them, otherwise deprecate and backfill first.
- Run `pnpm run prisma:sync` so the analytics schema receives the final adaptive attempt/estimate shape.

## Open Decisions

1. What is the institutional small-bucket suppression threshold for adaptive result distributions?
2. After the pilot, should structural tree duplication gain explicit revision lineage, or is independent duplication sufficient?
3. After calibration, which evidence threshold permits item-specific `a` overrides outside research/calibration mode?

These are rollout/evolution decisions. They do not block implementation of the first production slice: use `n < 5`, independent duplication, and fixed `a = 1.2` outside research mode until they are resolved.

## Progress Log

- 2026-07-09: Completed Phase 0 documentation/CI work and added the Phase 1 competence-tree validation skeleton with targeted tests.
- 2026-07-10: Reviewed the supplied standalone HTML and chose the Klicker-native split: reusable tree library, adaptive branch in the existing four-step PracticeQuiz wizard, existing participant/evaluation routes, and no standalone adaptive activity.
- 2026-07-10: Locked the student result design to one weighted overall trajectory with a standard-error interval plus an expandable depth-5 final competence profile.
- 2026-07-10: Completed the Phase 1 transactional competence-tree API, permissions, structural lock, generated operations, numerical normalization edge case, and focused unit/integration verification.
- 2026-07-10: Completed and independently reviewed Phase 2. The remediation passes added participant hiding before Phase 3, immediate-only publication, shared-cap/common-theta and classification-band readiness with per-leaf minimum reservation, deleted-source rejection, all-false KPRIM support, batched pools, bounded tree sizes, preserved Research migration semantics, new-response pool enforcement, and composite participant/course/quiz/config/pool/response constraints.
- 2026-07-10: Deferred only runtime-owned concerns to Phase 3: first-attempt serialization against pool replacement, participant serializers/submission authorization, and removal of nullable live-assignment compatibility fields. A durable scheduling outbox remains required before adaptive scheduling can be enabled.
