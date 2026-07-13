---
type: Feature Architecture
title: Adaptive Learning
description: Competence-tree based adaptive practice quiz mode, item parameters, validation gates, result semantics, and rollout boundaries.
timestamp: '2026-07-13'
tags:
  - adaptive-learning
  - practice-quiz
  - psychometrics
  - graphql
  - prisma
---

# Adaptive Learning

**The adaptive feature is a practice quiz mode, not a standalone activity.** The durable domain object is the reusable competence tree. A `PracticeQuiz` opts into adaptive delivery through `PracticeQuiz.mode = ADAPTIVE` and `PracticeQuizAdaptiveConfig`; the old `AdaptiveAssessment*` schema is legacy only.

## Current Architecture

The active foundation lives in three layers:

- Prisma competence-tree and adaptive-practice models: `packages/prisma/src/prisma/schema/competence.prisma:CompetenceTree`, `packages/prisma/src/prisma/schema/competence.prisma:PracticeQuizAdaptiveConfig`, `packages/prisma/src/prisma/schema/competence.prisma:AdaptivePracticeQuizAttempt`.
- Practice quiz mode flag: `packages/prisma/src/prisma/schema/quiz.prisma:PracticeQuiz`.
- Default-off course rollout flag and transactional gate: `packages/prisma/src/prisma/schema/course.prisma:Course`, `packages/graphql/src/services/adaptiveLearningRollout.ts:lockAdaptiveLearningCourseEnabled`.
- Pure adaptive math and normalization helpers: `packages/adaptive-learning/src/core.ts:mapThetaToLevel`, `packages/adaptive-learning/src/core.ts:deriveGuessingParameter`, `packages/adaptive-learning/src/core.ts:minimumReachableStandardError`.
- Package-neutral production runtime: `packages/adaptive-learning/src/runtime.ts:prepareAdaptiveRuntime`, `packages/adaptive-learning/src/runtime.ts:advanceAdaptiveRuntime`, `packages/adaptive-learning/src/runtime.ts:computeAdaptiveRuntimeEstimates`.
- Competence-tree input/persistence and ownership services: `packages/graphql/src/services/competenceTreeInput.ts:prepareTreeInput`, `packages/graphql/src/services/competenceTreeManagement.ts:createCompetenceTree`.
- Adaptive quiz configuration, readiness, and publication snapshots: `packages/graphql/src/services/adaptivePracticeQuizConfig.ts:replaceAdaptivePracticeQuizConfig`, `packages/graphql/src/services/adaptivePracticeQuizReadiness.ts:validateAdaptiveQuizReadiness`, `packages/graphql/src/services/adaptivePracticeQuizPublication.ts:materializeAdaptivePracticeQuizPool`.
- Server-authoritative participant service and grading/serialization adapter: `packages/graphql/src/services/adaptivePracticeQuizzes.ts:startAdaptivePracticeQuizAttempt`, `packages/graphql/src/services/adaptivePracticeQuizRuntime.ts:selectAdaptiveNextPoolItem`.
- Dedicated participant-safe GraphQL contract: `packages/graphql/src/schema/adaptivePracticeQuizRuntime.ts:AdaptivePracticeQuizAttemptState`.
- Pothos contract and generated client operations: `packages/graphql/src/schema/competenceTree.ts:CompetenceTree`, `packages/graphql/src/graphql/ops/FCompetenceTreeData.graphql`.

The old standalone adaptive tables remain in `packages/prisma/src/prisma/schema/adaptive.prisma:AdaptiveAssessment` for migration/cleanup only. Do not add new GraphQL fields, pages, or seeds that expose them.

## Competence Trees

A `CompetenceTree` can be reused across courses through `CompetenceTreeCourse`. Each tree contains ordered levels and a hierarchy of nodes:

- Root nodes are competences.
- Child nodes are subcompetences.
- Maximum depth is capped by `MAX_COMPETENCE_TREE_DEPTH = 5`.
- Elements are assignable only to leaf subcompetences.
- Leaf-level coverage rows define which levels should be covered for each leaf and how many items are targeted.

The database cannot enforce all semantic rules. Service validation must enforce:

- At least two levels are required; at least three are recommended for useful classification.
- Node depth is `1..min(tree.maxDepth, 5)`.
- Roots are `COMPETENCE`; non-roots are `SUBCOMPETENCE`.
- Every root competence contains at least one subcompetence; coverage and assignments terminate on subcompetence leaves.
- Level order and sibling order are unique, zero-based, and contiguous; parent cycles are rejected.
- Every enabled root competence has at least one enabled leaf.
- Every enabled leaf has at least one enabled coverage level.
- Assignments point to an actual leaf and a level in the same tree.
- Root weights are non-negative and normalized per adaptive quiz config.
- Non-root weights are either ignored explicitly or supported consistently; do not let UI imply they affect aggregation when they do not.

The pure validator is `packages/graphql/src/services/competenceTrees.ts:validateCompetenceTreeShape`. The API derives depth from parent keys and persists a complete validated snapshot in one transaction, so no partially valid hierarchy is observable.

## Backend API Contract

`packages/graphql/src/services/competenceTreeManagement.ts` implements the first production backend slice:

- Owners can create, atomically replace, rename, duplicate, link, unlink, and delete trees through generated GraphQL operations.
- Mutations require `FULL_ACCESS`; read-only logins can query but cannot mutate.
- A tree is readable by its owner or through an explicitly linked course with derived course access. Non-owners only receive course-link metadata for courses they can read.
- Linking and unlinking require tree ownership and `WRITE` access to the course. A course link cannot be removed while an active adaptive practice quiz in that course uses the tree.
- Assignments require element `READ` access. Duplicating a shared tree rechecks every assigned element and creates an independent tree owned by the caller without copying course links.
- Linked-course readers intentionally receive assignment metadata needed for quiz setup (element id/name/type/version and effective item parameters), but never element content, options, solutions, or grading data. This metadata grant comes from the tree owner's explicit course link; it does not grant generic element access.
- Any `PracticeQuizAdaptiveConfig` reference locks structure, coverage, and assignments. This is intentionally stricter than waiting for publication: metadata remains editable and duplication is the supported change path.
- Deleting an unreferenced tree is a hard delete. Linked or quiz-referenced trees are soft-deleted so active references remain intact.
- Replacement, metadata edits, linking, and deletion take a PostgreSQL row lock on the tree so configuration/link creation cannot race the structural-lock or deletion decision.

Input uses client-local keys for levels and nodes. Database ids are created only after full validation, and replacement is all-or-nothing rather than a sequence of reorder/reparent mutations.

To keep validation resource-bounded, one snapshot accepts at most 20 levels, 500 nodes, 10,000 coverage cells, and 10,000 assignments. Depth and cycle walks are iterative and stop at the depth-5 boundary.

Tree validation is deliberately **structural**, so a draft tree may have no assignments or fewer assignments than its coverage target. Publication readiness is a separate Phase 2 gate that compares enabled pool counts with targets and blocks empty enabled cells. Do not treat `CompetenceTreeValidationResult.valid` as permission to publish.

The `20260710152000_adaptive_tree_integrity` migration adds same-tree foreign keys for parents, coverage, and assignments plus a node-kind/null check for estimates. Together with the original partial unique index, this permits exactly one coherent overall estimate per attempt. Quiz override same-tree constraints are completed with the Phase 2 adaptive-config contract.

## Adaptive Practice Quiz Configuration

The existing `createPracticeQuiz` and `editPracticeQuiz` mutations accept optional `mode` and `adaptiveConfig` arguments. Omitting both preserves the standard practice-quiz path. Adaptive mode requires empty standard stacks, a competence tree linked to the selected course, course `WRITE` access, and `Course.isAdaptiveLearningEnabled = true`. Saving the quiz and replacing its complete adaptive configuration are one transaction.

`AdaptivePracticeQuizConfig` persists the selected preset, attempt-selection policy, total/per-leaf caps, minimum evidence, classification z, optional standard-error threshold, timer/result visibility, and effective research settings. Node and assignment overrides are complete snapshots scoped to one tree. Root weights are normalized across enabled roots; all-zero enabled weights are rejected. Configuration is editable only before an attempt exists.

Effective item enablement is one conjunction used by preview, readiness, and publication: the tree assignment, its leaf-level coverage cell, every ancestor node, and the quiz element override must all be enabled. A disabled coverage cell cannot leak its assignments into reachability counts or the published pool. A selected assignment whose source element has since been deleted remains visible in the owner preview as unavailable, blocks publication, and is never copied into a new pool.

The owner-facing `adaptivePracticeQuizPreview` query requires practice-quiz `WRITE` permission and returns:

- Effective nested nodes, enablement, normalized root weights, and node caps.
- Effective assignments and inferred `a`, `b`, and `c` values without element content or solutions.
- Preset and attempt policy, pool publication state, and explicit `awardsPoints = false` / `awardsExperiencePoints = false` flags.
- Blocking readiness errors, non-blocking warnings, coverage counts, root precision reachability, expected question count, and conservative duration.

Adaptive quizzes force `pointsMultiplier = 0`, `isGamificationEnabled = false`, and `isAssessmentEnabled = false`. Course-wide gamification/assessment propagation and generic practice-quiz batch operations skip adaptive quizzes.

## Item Parameters

Adaptive v1 supports these element types only:

- `NUMERICAL`
- `SC`
- `MC`
- `KPRIM`
- `FREE_TEXT`

Controlled-answer validation follows the canonical graders: SC requires exactly one true choice, MC requires at least one, and KPRIM requires exactly four boolean choices but may validly contain zero through four true choices. In particular, an all-false KPRIM item is scorable. Every configured free-text solution must be non-empty text after canonical normalization; malformed or partly invalid solution arrays are rejected when the tree is saved and guarded again at runtime.

Content, case studies, selection, and flashcards are excluded from adaptive classification. The service layer must reject unsupported assignments even if a UI omits them.

Item parameters follow this contract:

- `b` is assigned from the selected competence-tree level anchor.
- `a` is fixed to the conservative package value `DEFAULT_DISCRIMINATION = 1.2` for Placement and Diagnostic. Tree/assignment defaults and quiz overrides affect Research mode only.
- `c` is inferred from element type through `deriveGuessingParameter`.
- `FREE_TEXT` means controlled-answer items only, using existing answer collections/solutions. It does not mean open language production grading.

Theta anchors are bounded to `[-10, 10]`, and discrimination is bounded to `(0, 10]`, preventing non-finite GraphQL/math outputs while leaving ample headroom beyond normal educational calibration ranges. Weight normalization scales before summing so large finite curricular weights cannot overflow.

For numerical responses, `normalizeNumericalResponse` accepts decimal comma, fractions, scientific notation, grouping, and optional percent input. Ambiguous grouping such as `1,200` is rejected, while unambiguous leading-zero decimals such as `0,500` are accepted. Percent input is opt-in per numerical assignment and rejected for every other element type.

## Mapping Rules And Presets

The package supports two level mapping rules:

- `NEAREST`: descriptive self-assessment semantics.
- `MASTERY`: placement/mastery semantics where the level means the highest level demonstrably cleared.

The API persists product presets instead of inferring semantics from UI copy:

- Placement/mastery: `MASTERY`, first completed attempt, final result on, live estimate off.
- Diagnostic/self-assessment: `NEAREST`, latest completed attempt, final result on, live estimate off.
- Research/calibration: explicit mapping rule, attempt policy, discrimination/information settings, and optional live estimate.

`FIRST_COMPLETED` is enforced at attempt start: an abandoned attempt may be replaced, but a completed Placement attempt blocks retakes with `ADAPTIVE_RETAKE_FORBIDDEN` until an owner-reset workflow is added. `LATEST_COMPLETED` continues to permit new Diagnostic/Research attempts while preserving earlier attempts for audit. Attempt state exposes a server-authored `canStartNewAttempt` capability, so the PWA offers Practice again only when the configured policy allows it.

Students should see level bands and confidence wording, not raw theta values by default.

## Readiness And Reachability

Publishing an adaptive practice quiz runs the pool-aware readiness validator. It blocks publication when any enabled leaf-level cell has zero enabled, available, scorable assignments with valid item parameters. Uncontrolled answers and invalid parameters produce their own errors and do not inflate coverage or reachability. It warns when:

- Item count is below target coverage.
- Coverage targets cannot all fit within the shared or nested caps.
- The configured standard-error threshold is unreachable for the available item information.
- Minimum evidence cannot fit within a leaf, nested-node, or global cap.
- One or more level bands cannot fit the configured `classificationZ` interval under the allocated root budget.
- Expected question count exceeds the product time budget.

Expected duration uses the conservative planning assumption of 60 seconds per item and warns above 30 minutes. Its question count is bounded by coverage targets, the unique enabled pool, the global/per-leaf caps, and every node cap in the nested hierarchy. The shared total cap is allocated across roots using normalized weights while prioritizing minimum evidence. Within each root, the feasible subset reserves minimum evidence from every enabled leaf before information-based fill, subject to ancestor caps. Root precision sums item information at common theta grid points; it does not add each item's separate peak as though those peaks occurred at one ability value. Classification feasibility evaluates representative points inside each level band with the configured `classificationZ`. Warnings do not block publication. Readiness output is part of the owner preview, not transient UI-only text. Every issue carries a stable code and structured numeric/name parameters; Manage maps the allow-listed codes to English/German messages and uses backend prose only as a compatibility fallback.

Initial production input guardrails are 20 levels, 500 nodes, 10,000 coverage rows, and 10,000 assignments per tree. These limits protect GraphQL workers and must be revisited with pilot measurements rather than raised speculatively.

## Publication Snapshot

Immediate publication materializes `PracticeQuizAdaptivePoolItem` rows transactionally before changing quiz status. Each row stores the source assignment id, element id/version/name/type, grading-relevant element data, leaf and ancestor paths, level snapshot, effective `a`/`b`/`c`, and numerical percent-input setting. Source element rows are locked while the snapshot is read, and pool inserts are batched.

Adaptive scheduled publication remains deliberately unavailable (`ADAPTIVE_SCHEDULING_UNAVAILABLE`). The current Hatchet API cannot atomically commit a database pool and external scheduled task; allowing it would leave a crash window with a permanently scheduled quiz and no task. Add a transactional outbox plus reconciler before enabling this path. Republishing immediately may replace the snapshot while no attempts exist. Once any attempt exists, config changes and pool replacement fail with `ADAPTIVE_CONFIG_LOCKED` or `ADAPTIVE_POOL_LOCKED`. Unpublishing deliberately retains the exact pool and publication timestamp; republishing reuses that immutable pool instead of silently changing the items behind historical attempts.

Source element edits do not mutate existing pool rows. Participant delivery and grading read `PracticeQuizAdaptivePoolItem` only. Publication replacement/clearing takes an exclusive config-row lock while attempt creation takes a compatible key-share lock. Starts can run concurrently, but an attempt cannot start against a pool while that pool is being replaced.

The Phase 2 migration treats any pre-existing `PracticeQuizAdaptiveConfig` as intent to use adaptive mode and backfills its quiz accordingly. Existing normal settings become Placement or Diagnostic; custom discrimination/information/live-estimate settings become Research and are preserved. The retired self-assessment warm-up flag is reset to false for every preset. Invalid experimental values or inconsistent attempt identities stop with an actionable migration error instead of being rewritten. Legacy scheduled adaptive rows return to Draft. If transitional data still contains standard stacks, readiness reports `ADAPTIVE_STACKS_FORBIDDEN`, publication is blocked, public practice-quiz queries hide those stacks, and the standard response service rejects them. An owner must remove the stacks through an adaptive edit before publication.

Published adaptive quizzes are included in the generic practice-quiz listings only for enrolled participants or permitted lecturers while the course rollout gate is enabled. Anonymous callers, unrelated participants, and lecturers without derived quiz permission cannot enumerate adaptive quiz metadata or use its direct bootstrap URL. The bootstrap query returns `mode`, the configured maximum-question cap, and no standard stacks for adaptive mode. It also returns a permission-derived `isPreview` capability for owners and shared lecturers; preview mode never enters participant runtime. This is enough for the existing route to choose the participant-safe adaptive operations without exposing the publication pool or algorithm settings.

## Runtime Integrity

The participant runtime is server-authoritative. The pure algorithm is owned by `@klicker-uzh/adaptive-learning`; GraphQL maps immutable database rows into that package contract and owns grading, persistence, permissions, and participant serialization. The simulation suite calls the same prepared runtime rather than reproducing its routing or stopping logic.

- The server chooses and persists the next immutable pool item on `AdaptivePracticeQuizAttempt.nextPoolItemId`.
- Start and submission use serializable transactions with bounded Prisma/PostgreSQL conflict retry. The attempt row is locked before accepting a response, concurrent starts converge on the one in-progress attempt, and exhausted retries return `ADAPTIVE_ATTEMPT_CONFLICT` instead of a database error.
- The client submits only the currently served pool item. The service rejects arbitrary items, replayed submissions, foreign-tree/config items, and cross-participant attempts.
- A completed student result is serialized only when the stored overall estimate response count equals the canonical response-row count. Contradictory evidence fails with `ADAPTIVE_ATTEMPT_DATA_INVALID` instead of showing a confident level beside an incompatible answered count.
- First selection warms up every enabled root. Later selection prioritizes leaf breadth and coverage targets, then chooses deterministically within the configured top-information band while respecting leaf, ancestor, root, and total caps.
- Terminal state records an explicit reason: classification, all roots classified, total/node cap, pool exhausted, insufficient data, or abandonment.
- Composite foreign keys require an attempt's quiz to own its config, require quiz and participation to agree on course/participant identity, require its next pool item to belong to that config, and bind each pool-backed response's config, pool item, source assignment, and element id to one immutable pool row.
- Grading uses only the immutable `elementData` snapshot. Responses persist normalized response, partial score, all-or-nothing psychometric correctness, response order, and overall trajectory fields.
- Runtime algorithm queries fetch only routing parameters from the published pool. Full immutable `elementData` is fetched only through the currently served pool item; resume/result/cohort paths do not load every element snapshot.
- The dedicated participant serializer allow-lists question fields for SC, MC, KPRIM, numerical, and controlled-answer free text. It never emits solutions, item parameters, raw element JSON, theta, or standard error.
- Adaptive responses do not create standard `QuestionResponse` records and do not write points, XP, leaderboard, or timeline events.
- Start, restart, and submit acquire the default-off course rollout gate under transaction lock. Disabling a course blocks participant discovery/bootstrap, state/resume, start/restart, submit, and participant results while retaining attempts and allowing abandon, lecturer cohort history, unpublish, and delete. Conversion to `STANDARD` is allowed only before the first attempt; afterwards create or duplicate a standard quiz so historical adaptive semantics remain intact.

Access to the student runtime requires a `Participation` row for the course. Do not use `Participation.isActive` as the generic access gate; that field is leaderboard state (see [Domain Model](./domain-model.md)).

The `20260710210000_adaptive_practice_quiz_runtime` migration makes the immutable pool reference and tree/config identities required for active runtime rows, removes the duplicate live-assignment pointer and attempt-level trajectory arrays, and adds migration-only state, score, snapshot, and estimate-consistency checks. Before making terminal stop reasons required, it backfills completed rows from their existing overall estimate reason, final level, or an explicit insufficient-data fallback, and maps abandoned rows to `ABANDONED`. Several checks are `NOT VALID`: they protect every new write while preserving legacy rows until the cleanup decision.

## Student PWA Runtime And Results

The existing `/course/[courseId]/practiceQuizzes/[id]` page branches on `PracticeQuiz.mode`. Standard mode keeps the existing stack runner and local-storage progress unchanged. Adaptive mode uses focused components under the same route:

- The intro explains the quiz purpose, maximum question count, no-backtracking rule, resumability, result use, and anonymous cohort reporting. The retired warm-start setting remains off and is not represented in the participant contract.
- A durable in-progress attempt is recovered by quiz id, including an attempt that was left before the first response. Resume uses the owned attempt id; Start over calls one atomic restart mutation that abandons the current attempt and creates its replacement in the same serializable transaction.
- SC, MC, and KPRIM reuse the shared participant answer controls with explicit choice ids and selected-state semantics. KPRIM icon actions and numerical/free-text inputs have explicit accessible names. Numerical input accepts the canonical decimal, decimal-comma, fraction, scientific-notation, and optional percent forms. Controlled-answer free text reuses the shared text response control.
- The client submits only `servedItem.poolItemId` and exactly one typed response field. It receives no correctness, score, feedback, solution, or item parameters after submission.
- Progress is phrased as `Question N, at most M` with building/refining language. The PWA does not show a fake convergence percentage, live level, theta, or standard error. Embedded quizzes preserve the origin-checked init and `klicker:quiz-state` protocol, announce `klicker:quiz-ready` after hydration so the parent cannot lose its init to a load race, and use the configured cap as `totalSteps` until the protocol can express an upper bound.
- When `showTimer` is enabled, the current question shows a localized elapsed timer seeded from the server-authored attempt duration and reset when the served pool item changes. The client reports whole elapsed seconds per submitted question; values outside `0..86400` are rejected. Timing is an operational diagnostic, not trusted assessment evidence: if any response omits timing, the attempt duration remains unknown instead of treating the missing value as zero.
- Completed state is recovered durably by the same state query. Mutation-authored state cannot be overwritten by a late initial-query response. The result page shows the server-authored overall band or an explicit incomplete state, confidence and stop wording, one normalized overall trajectory with a normalized uncertainty ribbon, and an expandable depth-5 competence profile whose leaves tolerate GraphQL's omitted child selection. The chart helper places the server headline point at the authoritative answered-question order and derives summary length from that endpoint, so sparse trajectory rows cannot make the endpoint, headline, answered count, overall profile row, or textual summary diverge.
- Moving to a newly served question resets the route's scroll container and focuses its progress heading. Completed `LATEST_COMPLETED` attempts expose a localized Practice again action; `FIRST_COMPLETED` attempts do not. The result does not infer a recommended competence from estimate confidence, because low confidence means weak evidence rather than low competence; recommendations remain absent until a didactically valid server-authored rule exists.
- Chart tooltips, legends, a visible summary, screen-reader point descriptions, profile response counts, and accessible band-track labels avoid color-only interpretation. The UI never formats normalized positions as psychometric values.

Participant lifecycle errors remain structured GraphQL codes. The PWA localizes safe action-level messages and refetches state after an ambiguous submission failure so replay/conflict recovery does not invent client-owned attempt state.

## Manage Authoring And Evaluation

Phase 5 exposes the existing backend contract through KlickerUZH Manage without adding another activity type:

- `/resources/competenceTrees` is the reusable tree library. It supports owned/linked filters, search, course filtering, create, duplicate, course-link management, archive/restore, usage counts, and read-only linked trees.
- `/resources/competenceTrees/new` and `/resources/competenceTrees/[id]` use the same editor for metadata, level anchors/bands, a collapsible depth-5 hierarchy, root weights, leaf-by-level coverage, element assignments, and server validation. Structural locks leave metadata editable and make duplication the explicit continuation path.
- The editor tracks unsaved snapshots, warns before returning to the library or unloading the page, and disables duplication while local edits would otherwise be discarded. Coverage, assignment, archive, and course-link controls have explicit accessible names independent of the design system's visible labels.
- The existing element editor adds an Adaptive mapping section for `NUMERICAL`, `SC`, `MC`, `KPRIM`, and controlled-answer `FREE_TEXT`. It persists one narrow assignment mutation after the element save has returned an element id, and shows breadcrumb-labelled leaves, level-derived `b`, fixed/default `a`, inferred `c`, and numerical percent-input behavior. Unsupported element types receive an explanation without assignment controls.
- The existing four-step PracticeQuiz wizard adds a `STANDARD` / `ADAPTIVE` mode selector. Standard mode retains stacks. Adaptive mode selects a linked reusable tree, can permission-check and link an owned tree to the course, edits direct node/assignment overrides, and requests an unsaved server-authoritative setup preview for effective state and readiness.
- Disabling a hierarchy node requires confirmation and reports affected descendants and assignments. Root weight inputs show normalized percentages; assignment and coverage tables remain dense and filterable.
- The course publication dialog requests a fresh executor-authorized preview. Adaptive quizzes expose immediate publication only and show named root reachability; standard quizzes retain immediate and scheduled publication. The modal never trusts stale wizard readiness.
- `/practiceQuiz/[id]/evaluation` keeps the existing PracticeQuiz evaluation route. Adaptive mode requires practice-quiz `ADMIN` permission and renders anonymous released-result/stop/quality summaries, overall level bands, expandable depth-5 competence distributions, form-length/timing metrics, and privacy-suppressed item exposure/fit diagnostics. READ collaborators cannot query or open adaptive cohort results. Live in-progress and abandoned counts are never exposed.

The Manage UI consumes generated GraphQL operations and displays effective/derived values returned by the service. It does not implement a second readiness validator or psychometric model in React. Internal validation codes and database ids stay in `data-cy` hooks or transport data rather than lecturer-facing copy.

The deterministic development seed creates a reusable depth-5 tree linked to Testkurs and Testkurs 2, one assignment for each supported item type, a draft adaptive PracticeQuiz, and 15 completed attempts. Testkurs is the only seed course enabled for adaptive rollout; the other courses stay default-off. The historical seed attempts reproduce anonymous level/stop distributions but intentionally have no canonical response rows, so they surface the response-count integrity warning rather than pretending to provide item calibration evidence.

Browser verification covers the tree library/editor, depth-5 reparent validation, supported and unsupported element mapping, standard/adaptive wizard branches, authoritative setup readiness, adaptive and standard publication dialogs, the hierarchical cohort dashboard, unsaved-change protection, and accessible names for dense tree controls. Student verification uses a hydrated production build and covers intro, zero-answer resume, atomic restart, SC/MC/KPRIM/numerical/free-text delivery, participant-safe payloads, classified and insufficient results, the depth-5 profile, English/German localization, and embed completion. Student content and the result chart fit a 390 px viewport without horizontal scrolling; the Manage application's existing desktop navigation still sets the overall document width to 678 px at that viewport and is tracked as global responsive debt rather than an adaptive-component overflow.

## Results And Privacy

Adaptive summaries are attempt-level estimates under the quiz's configured competence weights. They are not population ability estimates. Reporting uses bounded maximum-likelihood estimates; MAP is limited to routing so the prior does not create student evidence.

Each node estimate pools every descendant response exactly once. Intermediate hierarchy nodes therefore do not change root or overall results. The overall estimate uses normalized root weights only, is undefined until every enabled root has evidence, and propagates uncertainty as `sqrt(sum(w_i^2 * SE_i^2))` over the disjoint root response sets. Node levels are suppressed below four scorable responses.

The participant result serializer returns level bands, confidence/near-boundary wording, a normalized single overall trajectory, and a nested depth-5 profile. Lecturer cohort analytics use a fixed release watermark: completed attempts become visible only when the number of distinct completed participants reaches a multiple of five. Retakes and the sixth through ninth new participants wait for the next release, so polling cannot reveal one completion at a time. The configured first/latest-completed-attempt policy is applied only inside that released set. Before the first release, cohort size and attempt counts are `null`; active and abandoned lifecycle counts remain `null` at every size.

The production privacy contract requires every released categorical, binary, missingness, anomaly, and percentile field to satisfy k=5 for both the reported value and its complement. The fixed release watermark and level-distribution suppression are implemented; field-level complementary suppression for all duration/integrity flags and insufficient-data summaries remains a Phase 9 release blocker. Adaptive learning therefore stays disabled outside explicitly controlled test data.

Pilot metrics count canonical response rows per released selected attempt and currently compute median/P95 question count, known elapsed time, and response/estimate integrity signals. Item diagnostics replay each root's pre-response routing estimate, compare observed correctness with immutable-snapshot 3PL expected correctness, and report exposure. Exposure and accuracy use k=5 plus complementary-cell suppression; residual/misfit remains hidden below 30 responses. Phase 9 must suppress or withhold every pilot-metric field whose value, complement, or known/missing partition is below k=5 before these metrics are production-visible. These are review signals for lecturer-assigned item levels, not automatic calibration and not a basis for rewriting student results. Operational interpretation and real-course gates are in [Adaptive Learning Operations](./adaptive-learning-operations.md).

Students see:

- Overall level band.
- Competence-level bands.
- Subcompetence/leaf bands.
- One normalized overall trajectory whose final point equals the final overall estimate.
- Confidence and near-boundary language.
- Gentle insufficient-pool wording when applicable.

## Phase 4 Measurement Gates

`packages/adaptive-learning/test/simulationHarness.ts` runs the production `prepareAdaptiveRuntime` / `advanceAdaptiveRuntime` engine with fixed, independent pool, ability, routing, and response seeds. The deterministic matrix covers:

- Placement (`MASTERY`) and Diagnostic (`NEAREST`) product presets.
- Short-form and long-form cap/pool overlays; these are test profiles, not additional persisted preset enum values.
- SC-only, SC/MC/KPRIM, numerical/free-text, and mixed item pools.
- Sparse (one), target (five), and rich (ten) items per leaf-level cell.
- Clean, 10%, and 20% adjacent-level item-label noise.
- Exact and adjacent accuracy, mean absolute level error, mean/P95 length, stop reasons, per-level accuracy, signed per-level bias, and top-level reachability.

The clean-profile regression evidence from 300 stratified simulated learners per profile is:

| Profile            | Exact | Adjacent |  MAE | Mean / P95 items | Classified / capped | Pool/node/insufficient fallback |
| ------------------ | ----: | -------: | ---: | ---------------: | ------------------: | ------------------------------: |
| Placement/mastery  |  0.80 |     1.00 | 0.20 |       56.85 / 60 |            38 / 262 |                               0 |
| Diagnostic/nearest |  0.80 |     1.00 | 0.20 |       49.95 / 50 |            20 / 280 |                               0 |
| Short-form overlay |  0.70 |     1.00 | 0.30 |       36.00 / 36 |             0 / 300 |                               0 |
| Long-form overlay  |  0.82 |     1.00 | 0.18 |       78.07 / 90 |           126 / 174 |                               0 |

The current executable regression checks require profile-specific exact accuracy (0.65-0.72 minimum), adjacent accuracy (0.90-0.95), bounded MAE, minimum per-level exact recovery, bounded signed per-level bias and mean/P95 length, top-level reachability, and zero unexpected pool/node/insufficient fallback in clean target/rich profiles. Sparse pools intentionally exhaust. These checks protect deterministic runtime behavior; they are not production shipping gates.

These are engineering regression checks over a synthetic 3PL model, not evidence that the levels are valid for a real course or population. They do not replace item calibration, teacher comparison, fairness analysis, or pilot acceptance. Most Placement/Diagnostic attempts reach the configured cap rather than satisfying every root classification interval, far above the Phase 11 production threshold. The shipped presets must be tuned and pass the production measurement gates before any real-course pilot or rollout.

The guardrail benchmark uses 250 roots, 250 leaves, 20 levels, and two items per leaf-level cell: 500 nodes and 10,000 items. On the 2026-07-12 development run, preparation took 2.7 ms, the first decision 4.7 ms, and a decision with 999 responses 8.2 ms. Normal tests enforce only coarse multi-second regression ceilings; calibrated P95 performance gates require a pinned CI runner.

The obsolete project sweep script and the unused `packages/shared-components/src/adaptive/` components were deleted. Future Manage/PWA components must consume generated GraphQL bands and normalized positions or call canonical package helpers; they must not restore private mapping, theta normalization, or item-curve formulas.

The final independent review found two response-space inconsistencies. Shared MC/KPRIM grading had assumed zero-based contiguous choice indices even though stored choices carry explicit IDs, and adaptive MC accepted an empty response while its guessing parameter models only non-empty subsets. Grading now compares explicit choice IDs, adaptive MC requires at least one selection, all-false KPRIM remains valid, and both fixes have regression coverage. The remediation spot-check reported no remaining P0-P2 finding in those edits.

## Ownership And Deletion Policy

Competence trees are reusable content objects. Once a tree is linked to an adaptive quiz with attempts, account deletion must not silently delete the tree and invalidate historical meaning. The v1 service policy is:

- Unused trees can be hard-deleted with their owner.
- Used or linked trees are soft-deleted or reassigned to a system/course owner during account deletion.
- Direct tree deletion follows this policy now. Account deletion still needs an explicit ownership-transfer or retention path before attempts can be enabled in production because the Prisma owner relation currently cascades.

The manual ownership-transfer script now includes `competenceTrees` (`packages/graphql/src/scripts/transferUserContent.ts:run`). Account closure remains an explicit operational process: used trees, courses, and quizzes must be transferred to an approved successor and verified before the old owner is deleted. See [Adaptive Learning Operations](./adaptive-learning-operations.md).

## Legacy Cleanup

The old standalone adaptive models and old CEFR seed helpers are retained only as transitional data. Before broad rollout:

1. Run the aggregate-only, repeatable-read audit `packages/prisma/src/prisma/audits/adaptive-learning-legacy.sql` with a read-only staging/production role.
2. If none exists, drop old standalone adaptive tables and relations in a cleanup migration.
3. If data exists, define archival or migration semantics first.

New work should target competence trees and adaptive practice quizzes only.

The audit and cleanup decision matrix are documented in [Adaptive Learning Operations](./adaptive-learning-operations.md). A local empty/seed result is not evidence about staging or production.

## Commands

The checks below are local engineering verification only. They do not establish production readiness or authorize a pilot or rollout. Real-course psychometric evidence, teaching/privacy/operations signoff, and staging/production migration and deployment evidence remain required.

- `pnpm --filter @klicker-uzh/adaptive-learning check` - **verified 2026-07-13**.
- `pnpm --filter @klicker-uzh/adaptive-learning test` - **verified 2026-07-13**; 32 core, runtime, numerical-normalization, hierarchy, and result-presentation tests pass.
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`, `test:simulation:report`, and `test:performance` - **verified 2026-07-13**; 19 deterministic runtime scenarios pass, the reproducible metric report matches the evidence above, and the 500-node/20-level/10,000-item guardrail covers preparation, first selection, and a 999-response decision.
- `pnpm --filter @klicker-uzh/graphql generate`, `check`, and `build` - **verified 2026-07-13**. Rollup still reports the repository's existing Pothos plugin typing warnings, while the stricter `tsc --noEmit` check passes.
- The nine focused adaptive/competence-tree GraphQL files - **verified 2026-07-13** with 79 passing tests against disposable PostgreSQL 17 where required. They cover readiness, tree validation/permissions/management, publication/configuration, runtime/schema contracts, access non-enumeration, fixed cohort releases, timing integrity, immutable rollback, and retry/concurrency behavior. Expected Redis warnings in management tests do not affect these service paths.
- `20260710190000_adaptive_practice_quiz_configuration` - **verified 2026-07-10** both through a clean 181-migration replay and a populated 180-to-181 upgrade fixture; normal settings became Diagnostic while custom discrimination/information/live settings remained Research.
- `20260710210000_adaptive_practice_quiz_runtime` and the complete migration chain - **verified 2026-07-13** on PostgreSQL 17 through a clean 184-migration replay and a populated 181-to-182 upgrade. The populated fixture proves readable `TOTAL_QUESTION_CAP`, `CLASSIFIED`, `INSUFFICIENT_DATA`, and `ABANDONED` terminal paths; cross-tree preflight rejection remains covered.
- `pnpm --filter @klicker-uzh/grading test` - **verified 2026-07-13**; ten tests pass, including exact zero-bound and non-finite numerical restrictions.
- `packages/graphql/test/adaptivePracticeQuizRuntimeSchema.test.ts` - **verified 2026-07-13**; the participant schema contains no solutions, item parameters, theta, or standard-error fields.
- `pnpm --filter @klicker-uzh/frontend-manage check` / `build` and `pnpm --filter @klicker-uzh/frontend-pwa check` / `build` - **verified 2026-07-13** after regenerating GraphQL operations. Standard practice quizzes retain their existing runner while adaptive mode branches inside the same PWA route; production builds report only existing repository warnings.
- `pnpm --filter @klicker-uzh/playwright exec tsc --noEmit` and `playwright/tests/Z-adaptive-learning.spec.ts` - **verified 2026-07-13**; all five Chromium tests pass. The retry-safe journey uses four distinct items, verifies the question timer, matches the student headline to the persisted final level, and completes five four-response participants to exercise the first anonymous release. Sixth-participant fixed-release behavior is service-tested; an explicit browser assertion remains a Phase 14 gate.
- `npx agent-browser` plus repository-pinned Playwright browser QA - **verified 2026-07-13** for intro, every supported question type, zero-answer resume, atomic restart, classified/insufficient completion, depth-5 expansion, 390 px English/German layouts, payload privacy, and the ready/init/state embed handshake. Evidence is in `project/screenshots/adaptive-learning-phase6/`.
- Phase 7 browser evidence - **verified 2026-07-13** for the live question timer, four-point student level-band result, and five-result released lecturer cohort. Screenshots are in `project/screenshots/adaptive-learning-phase7/`; they are development evidence, not production or accessibility signoff.
- `pnpm run check`, `pnpm run format:check`, `pnpm run check:syncpack`, and `pnpm exec turbo run build --concurrency=1` - **verified 2026-07-13**; all 22 build tasks pass. The default parallel root build exceeded the local container's memory limit, so the production-equivalent build was repeated sequentially. Host `pnpm run lint` remains blocked only in the unrelated `apps/chat` package because its existing Next.js ESLint setup cannot resolve `eslint-plugin-react-hooks`; the full container lint plus affected Manage/PWA lint pass with existing warnings only.
- `opengrep scan --config auto --no-git-ignore` - **verified 2026-07-13** over 17 changed adaptive/runtime/UI files; 210 applicable rules reported zero findings.
