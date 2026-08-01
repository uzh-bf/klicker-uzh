---
type: Feature Architecture
title: Adaptive Learning
description: Competence-tree based adaptive practice quiz mode, item parameters, validation gates, result semantics, and rollout boundaries.
timestamp: '2026-08-01'
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

- Prisma competence-tree, scale-governance, and adaptive-practice models: `packages/prisma/src/prisma/schema/competence.prisma:CompetenceTree`, `packages/prisma/src/prisma/schema/competenceScale.prisma:CompetenceTreeScaleVersion`, `packages/prisma/src/prisma/schema/adaptivePracticeQuiz.prisma:PracticeQuizAdaptiveConfig`, and `packages/prisma/src/prisma/schema/adaptivePracticeQuiz.prisma:AdaptivePracticeQuizAttempt`.
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
- Enabled root weights are finite and strictly positive. Disabled roots are excluded and may retain zero. Enabled roots are normalized to sum to one per adaptive quiz config.
- Non-root weights are either ignored explicitly or supported consistently; do not let UI imply they affect aggregation when they do not.

The pure validator is `packages/graphql/src/services/competenceTrees.ts:validateCompetenceTreeShape`. The API derives depth from parent keys and persists a complete validated snapshot in one transaction, so no partially valid hierarchy is observable.

## Backend API Contract

`packages/graphql/src/services/competenceTreeManagement.ts` implements the first production backend slice:

- Owners can create, atomically replace, rename, duplicate, link, unlink, and delete trees through generated GraphQL operations.
- Mutations require `FULL_ACCESS`; read-only logins can query but cannot mutate.
- A tree is readable by its owner or through an explicitly linked course with derived course access. Non-owners only receive course-link metadata for courses they can read.
- Linking and unlinking require tree ownership and `WRITE` access to the course. A course link cannot be removed while an active adaptive practice quiz in that course uses the tree.
- Assignments require element `READ` access. Duplicating a shared tree rechecks every assigned element and creates an independent tree owned by the caller without copying course links.
- Supported element creation accepts an optional initial tree/leaf/level assignment. Element creation and assignment reuse the same transaction-level assignment command and commit atomically; any permission, structure, coverage, type, or answer-control failure rolls back the element and its related writes. Initial assignment is create-only, while the narrow assignment mutation remains the edit/removal path for saved elements. A UUID persisted with the assignment makes a lost-response retry return the one committed element; reusing that UUID with a different owner, tree, mapping, or element body fails with a stable conflict.
- Manage persists the creation UUID with the autosaved draft before submission, keeps the form open after a rejected atomic mutation, and maps stable adaptive error codes to localized, actionable assignment feedback. A post-commit element-list refresh is best effort and cannot turn a committed save into a visible failure. No recovery protocol or second assignment write is required after first save.
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

`AdaptivePracticeQuizConfig` persists the selected preset, attempt-selection policy, total/per-leaf caps, minimum evidence, classification z, top-information ratio, effective discrimination/mapping settings, and timer visibility. Node and assignment overrides are complete snapshots scoped to one tree. One package-owned helper validates and normalizes enabled root weights across tree validation, quiz preparation, runtime, reachability, and Manage previews. Every enabled root must have a finite strictly positive weight; disabled roots are excluded, and an empty enabled set is rejected. The helper scales before summing and rejects any finite input whose scaled or normalized representation underflows to zero, so no caller can silently revive an invalid root weight. Configuration is editable only before an attempt exists. Final level-band results are mandatory behavior rather than a stored switch; live estimates, a separate standard-error stop, and the retired self-assessment warm-up are not part of the production contract.

Effective item enablement is one conjunction used by preview, readiness, and publication: the tree assignment, its leaf-level coverage cell, every ancestor node, and the quiz element override must all be enabled. A disabled coverage cell cannot leak its assignments into reachability counts or the published pool. A selected assignment whose source element has since been deleted, or which the competence-tree owner can no longer read, remains visible in the preview as unavailable with a structured readiness code, blocks publication, and is never copied into a new pool.

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

`packages/adaptive-learning/src/presets.ts:ADAPTIVE_PRESET_DEFAULTS` is the canonical preset source consumed by GraphQL configuration, Manage defaults, readiness, runtime fixtures, seeds, and simulations. Shared defaults are a 50-question total cap, no per-leaf cap, two minimum questions per enabled leaf, `classificationZ = 1.28`, top-information ratio `0.8`, default discrimination `1.2`, and timer enabled. The preset-specific semantics are:

- Placement/mastery: `MASTERY` and first completed attempt.
- Diagnostic/self-assessment: `NEAREST` and latest completed attempt.
- Research/calibration: `NEAREST` and latest completed attempt by default, with explicit mapping-rule, attempt-policy, discrimination, and information-ratio overrides available for controlled research use.

`FIRST_COMPLETED` is enforced at attempt start: an abandoned attempt may be replaced, but a completed Placement attempt blocks retakes with `ADAPTIVE_RETAKE_FORBIDDEN` until an owner-reset workflow is added. `LATEST_COMPLETED` continues to permit new Diagnostic/Research attempts while preserving earlier attempts for audit. Attempt state exposes a server-authored `canStartNewAttempt` capability, so the PWA offers Practice again only when the configured policy allows it.

Students should see level bands and confidence wording, not raw theta values by default.

## Readiness And Reachability

Publishing an adaptive practice quiz runs the pool-aware readiness validator. Placement and Diagnostic require at least five independent enabled, available, scorable assignments with valid item parameters in every enabled leaf-level cell; an empty cell blocks every preset. Uncontrolled answers and invalid parameters produce their own errors and do not inflate coverage or reachability. Readiness reports warnings when:

- Item count is below target coverage.
- Minimum evidence cannot fit within a leaf, nested-node, or global cap.
- One or more level bands cannot fit the configured `classificationZ` interval under the allocated root budget.
- Expected question count exceeds the product time budget.

Expected duration uses the conservative planning assumption of 60 seconds per item and warns above 30 minutes. Its question count is bounded by the unique enabled pool, the global/per-leaf caps, and every node cap in the nested hierarchy. Coverage targets remain authoring/planning metadata; they do not force the runtime to drain every level cell. The shared total cap is allocated across roots using normalized weights while prioritizing minimum evidence. Within each root, the feasible subset reserves minimum evidence from every enabled leaf before information-based fill, subject to ancestor caps. Root precision sums item information at common theta grid points; it does not add each item's separate peak as though those peaks occurred at one ability value. `minimumReachableStandardError` is an internal reachability diagnostic only. Classification feasibility evaluates representative points inside each level band with the configured `classificationZ`.

Ordinary warnings such as coverage below an authoring target or the conservative time budget do not block publication. Three structural Research diagnostics do: unreachable leaf minimum evidence, minimum evidence blocked by a node cap, and minimum evidence blocked by the global cap. They remain warnings so Research authors can inspect and edit the configuration, but `readiness.ready` stays false and the real-course publication transaction rejects the quiz until they are resolved. Classification-band reachability remains visible but is advisory for Research because Research never releases a proficiency classification. IRT v2 Research additionally requires the course calibration-collection gate and an exposure-safe per-leaf bank: three calibrated anchors in every active scale band, three field-test items, and one additional calibrated scoring item. The distinct minima are derived from `ceil(one required response / 0.40 exposure ceiling)`, recorded in the immutable publication policy, and rechecked by the runtime. These conditions are publication errors, so an invalid pool cannot materialize and fail later at attempt start. Readiness output is part of the owner preview, not transient UI-only text. Every issue carries a stable code and structured numeric/name parameters; Manage maps the allow-listed codes to English/German messages and uses backend prose only as a compatibility fallback.

Initial production input guardrails are 20 levels, 500 nodes, 10,000 coverage rows, and 10,000 assignments per tree. These limits protect GraphQL workers and must be revisited with pilot measurements rather than raised speculatively.

## Publication Snapshot

Immediate publication materializes `PracticeQuizAdaptivePoolItem` rows transactionally before changing quiz status. Each row stores the source assignment id, element id/version/name/type, grading-relevant element data, leaf and ancestor paths, level snapshot, effective `a`/`b`/`c`, and numerical percent-input setting. Publication locks source element rows and the competence-tree owner's matching derived permission rows in stable order, then rechecks that the tree is active, still linked to the quiz course, and that its owner can still read every selected source element. A quiz manager may publish a valid linked tree without receiving element access. Direct and group-based revocation serialize against these locks, so the outcome is either an authorized immutable snapshot or a failed publication with no pool/status change. Pool inserts are batched.

Adaptive scheduled publication remains deliberately unavailable (`ADAPTIVE_SCHEDULING_UNAVAILABLE`). The current Hatchet API cannot atomically commit a database pool and external scheduled task; allowing it would leave a crash window with a permanently scheduled quiz and no task. Add a transactional outbox plus reconciler before enabling this path. Republishing immediately may replace the snapshot while no attempts exist. Once any attempt exists, config changes and pool replacement fail with `ADAPTIVE_CONFIG_LOCKED` or `ADAPTIVE_POOL_LOCKED`. Unpublishing deliberately retains the exact pool and publication timestamp; republishing reuses that immutable pool instead of silently changing the items behind historical attempts.

Source element edits or later access revocation do not mutate existing pool rows. Participant delivery and grading read `PracticeQuizAdaptivePoolItem` only. Publication replacement/clearing takes an exclusive config-row lock while attempt creation takes a compatible key-share lock. Starts can run concurrently, but an attempt cannot start against a pool while that pool is being replaced. Unpublishing is the quiz-level operational takedown: it blocks start, state/resume, restart, and submit with `ADAPTIVE_QUIZ_UNAVAILABLE` while retaining an attempted pool and historical grading; abandon remains available. Republishing resumes an unsubmitted active attempt on the same immutable item. The course rollout switch remains the broader emergency stop.

The Phase 2 migration treats any pre-existing `PracticeQuizAdaptiveConfig` as intent to use adaptive mode and backfills its quiz accordingly. Existing normal settings become Placement or Diagnostic; rows with genuinely variable discrimination/information semantics become Research. Invalid experimental values or inconsistent attempt identities stop with an actionable migration error instead of being rewritten. Legacy scheduled adaptive rows return to Draft. The forward cleanup migration `20260713220000_adaptive_remove_inert_settings` then removes `standardErrorThreshold`, `showFinalResult`, `showLiveEstimate`, and `enableSelfAssessmentWarmup`; none had a supported variable participant behavior in production v1. If transitional data still contains standard stacks, readiness reports `ADAPTIVE_STACKS_FORBIDDEN`, publication is blocked, public practice-quiz queries hide those stacks, and the standard response service rejects them. An owner must remove the stacks through an adaptive edit before publication.

Published adaptive quizzes are included in the generic practice-quiz listings only for enrolled participants or permitted lecturers while the course rollout gate is enabled. Anonymous callers, unrelated participants, and lecturers without derived quiz permission cannot enumerate adaptive quiz metadata or use its direct bootstrap URL. The bootstrap query returns `mode`, the configured maximum-question cap, and no standard stacks for adaptive mode. It also returns a permission-derived `isPreview` capability for owners and shared lecturers; preview mode never enters participant runtime. This is enough for the existing route to choose the participant-safe adaptive operations without exposing the publication pool or algorithm settings.

## Runtime Integrity

The participant runtime is server-authoritative. The pure algorithm is owned by `@klicker-uzh/adaptive-learning`; GraphQL maps immutable database rows into that package contract and owns grading, persistence, permissions, and participant serialization. The simulation suite calls the same prepared runtime rather than reproducing its routing or stopping logic.

- The server chooses and persists the next immutable pool item on `AdaptivePracticeQuizAttempt.nextPoolItemId`.
- Start and submission use serializable transactions with bounded Prisma/PostgreSQL conflict retry and capped exponential backoff. The attempt row is locked before accepting a response, concurrent starts converge on the one in-progress attempt, and exhausted retries return `ADAPTIVE_ATTEMPT_CONFLICT` instead of a database error.
- Submission requests one typed response transition after grading. The estimator dispatcher owns the single IRT-version branch and returns a discriminated, correlated runtime-and-decision pair; the transition planner therefore cannot combine a V1 runtime with a V2 decision. The resulting transition contains response audit fields, estimate writes, attempt state, exposure contributions, and optional shadow telemetry. The transaction command then executes one common write order for both estimator versions and emits shadow telemetry only after commit.
- The client submits only the currently served pool item. The service rejects arbitrary items, replayed submissions, foreign-tree/config items, and cross-participant attempts.
- A completed student result is serialized only when the stored overall estimate response count equals the canonical response-row count. Contradictory evidence fails with `ADAPTIVE_ATTEMPT_DATA_INVALID` instead of showing a confident level beside an incompatible answered count.
- First selection warms up every enabled root. Later selection prioritizes leaf breadth and normalized root-weight allocation, then chooses deterministically within the configured top-information band while respecting leaf, ancestor, root, and total caps. An avalanched stable hash spreads equivalent sequential pool-item ids across attempts without introducing mutable cohort state.
- Terminal state records an explicit reason: classification, all roots classified, total/node cap, pool exhausted, insufficient data, or abandonment.
- Composite foreign keys require an attempt's quiz to own its config, require quiz and participation to agree on course/participant identity, require its next pool item to belong to that config, and bind each pool-backed response's config, pool item, source assignment, and element id to one immutable pool row.
- Grading uses only the immutable `elementData` snapshot. Responses persist normalized response, partial score, all-or-nothing psychometric correctness, response order, and overall trajectory fields.
- Runtime algorithm queries fetch only routing parameters from the published pool. Full immutable `elementData` is fetched only through the currently served pool item; resume/result/cohort paths do not load every element snapshot.
- The dedicated participant serializer allow-lists question fields for SC, MC, KPRIM, numerical, and controlled-answer free text. It never emits solutions, item parameters, raw element JSON, theta, or standard error.
- Adaptive responses do not create standard `QuestionResponse` records and do not write points, XP, leaderboard, or timeline events.
- Start, restart, and submit acquire the default-off course rollout gate under transaction lock. Disabling a course blocks participant discovery/bootstrap, state/resume, start/restart, submit, and participant results while retaining attempts and allowing abandon, lecturer cohort history, unpublish, and delete. Conversion to `STANDARD` is allowed only before the first attempt; afterwards create or duplicate a standard quiz so historical adaptive semantics remain intact.

Lifecycle operations use one row-lock order: Course -> `PracticeQuiz` -> `PracticeQuizAdaptiveConfig` -> attempt. Administrative rollout prepends the persisted User row, and quiz deletion locks direct Permission rows before checking the persisted DerivedPermission row. The lock helpers live in `adaptivePracticeQuizRepository.ts`; publication, start/restart, unpublish, delete, and course disable do not invent local orders. Quiz deletion performs lookup, persisted authorization, quiz/config lock, attempt recount, and hard-delete/retention decision in one bounded operational transaction. Therefore start versus delete/unpublish, restart versus disable, double start, and permission revocation versus delete have only valid serial outcomes; transient deadlock/serialization failures are retried and timeout/exhaustion becomes a stable GraphQL conflict rather than a raw database error.

Access to the student runtime requires a `Participation` row for the course. Do not use `Participation.isActive` as the generic access gate; that field is leaderboard state (see [Domain Model](./domain-model.md)).

The `20260710210000_adaptive_practice_quiz_runtime` migration makes the immutable pool reference and tree/config identities required for active runtime rows, removes the duplicate live-assignment pointer and attempt-level trajectory arrays, and adds migration-only state, score, snapshot, and estimate-consistency checks. Before making terminal stop reasons required, it backfills completed rows from their existing overall estimate reason, final level, or an explicit insufficient-data fallback, and maps abandoned rows to `ABANDONED`. Those six checks were initially `NOT VALID`. The forward-only `20260713210000_adaptive_runtime_constraint_validation` migration now aborts on ambiguous numeric, response-order, or pool-identity corruption; restores missing pool/snapshot references only from immutable identity; converts an unresumable null-next in-progress row to canonical abandonment; canonicalizes resumable and terminal lifecycle fields; and validates every check under a 5-second lock and 15-minute statement budget. Its populated rehearsal covers null/non-null next pointers, zero/answered attempts, malformed snapshots, and every terminal state.

## Student PWA Runtime And Results

The existing `/course/[courseId]/practiceQuizzes/[id]` page branches on `PracticeQuiz.mode`. Standard mode keeps the existing stack runner and local-storage progress unchanged. Adaptive mode uses focused components under the same route:

- The intro explains the quiz purpose, maximum question count, no-backtracking rule, resumability, result use, and anonymous cohort reporting. The retired warm-start setting remains off and is not represented in the participant contract.
- A durable in-progress attempt is recovered by quiz id, including an attempt that was left before the first response. Resume uses the owned attempt id; Start over calls one atomic restart mutation that abandons the current attempt and creates its replacement in the same serializable transaction. If the mutation commits but its response is lost, the PWA refetches authoritative state and adopts the replacement attempt instead of leaving the participant on the abandoned id.
- SC, MC, and KPRIM reuse the shared participant answer controls with explicit choice ids and selected-state semantics. KPRIM icon actions and numerical/free-text inputs have explicit accessible names. Numerical input accepts the canonical decimal, decimal-comma, fraction, scientific-notation, and optional percent forms. Controlled-answer free text reuses the shared text response control.
- The client submits only `servedItem.poolItemId` and exactly one typed response field. It receives no correctness, score, feedback, solution, or item parameters after submission.
- Progress is phrased as `Question N, at most M` with building/refining language. The PWA does not show a fake convergence percentage, live level, theta, or standard error. Embedded quizzes preserve the origin-checked init and `klicker:quiz-state` protocol, announce `klicker:quiz-ready` after hydration so the parent cannot lose its init to a load race, and use the configured cap as `totalSteps` until the protocol can express an upper bound.
- When `showTimer` is enabled, the current question shows a localized elapsed timer seeded from the server-authored attempt duration and reset when the served pool item changes. The client reports whole elapsed seconds per submitted question; values outside `0..86400` are rejected. Timing is an operational diagnostic, not trusted assessment evidence: if any response omits timing, the attempt duration remains unknown instead of treating the missing value as zero. A resumed question with unknown historical timing omits the timer rather than starting it at zero; a genuinely new first question may start at zero.
- Completed state is recovered durably by the same state query. Mutation-authored state cannot be overwritten by a late initial-query response. The result page shows the server-authored overall band or an explicit incomplete state, confidence and stop wording, and localized interpretation text that distinguishes conservative `MASTERY` placement from descriptive `NEAREST` classification. It includes one normalized overall trajectory with a normalized uncertainty ribbon and an expandable depth-5 competence profile whose leaves tolerate GraphQL's omitted child selection. The chart helper places the server headline point at the authoritative answered-question order and derives summary length from that endpoint, so sparse trajectory rows cannot make the endpoint, headline, answered count, overall profile row, or textual summary diverge.
- Moving to a newly served question resets the route's scroll container and focuses its progress heading. Completed `LATEST_COMPLETED` attempts expose a localized Practice again action; `FIRST_COMPLETED` attempts do not. The result does not infer a recommended competence from estimate confidence, because low confidence means weak evidence rather than low competence; recommendations remain absent until a didactically valid server-authored rule exists.
- Chart tooltips, legends, a visible summary, screen-reader point descriptions, profile response counts, and accessible band-track labels avoid color-only interpretation. The UI never formats normalized positions as psychometric values.

Participant lifecycle errors remain structured GraphQL codes. The PWA localizes safe action-level messages and refetches state after an ambiguous submission failure so replay/conflict recovery does not invent client-owned attempt state.

## Manage Authoring And Evaluation

Phase 5 exposes the existing backend contract through KlickerUZH Manage without adding another activity type:

- `/resources/competenceTrees` is the reusable tree library. It supports owned/linked filters, search, course filtering, create, duplicate, course-link management, archive/restore, usage counts, and read-only linked trees.
- `/resources/competenceTrees/new` and `/resources/competenceTrees/[id]` use the same editor for metadata, level anchors/bands, a collapsible depth-5 hierarchy, root weights, leaf-by-level coverage, element assignments, and server validation. The hierarchy exposes separate labelled actions for adding a root competence and adding a subcompetence to the selected node; both select the new node and move focus to its name. Duplicate remains an explicit copy operation. Structural locks leave metadata editable and make duplication the explicit continuation path.
- The editor tracks unsaved snapshots, warns before returning to the library or unloading the page, and disables duplication while local edits would otherwise be discarded. Coverage, assignment, archive, and course-link controls have explicit accessible names independent of the design system's visible labels. The assignment matrix uses a real table with a caption, column and row headers, named switches, and horizontal overflow containment for narrow viewports. Its empty state links to the existing element creation flow and explains that assignments are authored on elements.
- The existing element editor adds an optional Adaptive mapping section for `NUMERICAL`, `SC`, `MC`, `KPRIM`, and controlled-answer `FREE_TEXT`, including before the element's first save. Authors enable the section and choose one tree, leaf, and level; the primary action then states that it will create and assign the element. One idempotent GraphQL mutation persists both records atomically, so failure leaves the form and pending mapping available for correction without creating an unmapped element, while a lost response can be retried without duplication. The request identity remains bound to the created element even if its assignment is later removed, so replay returns the original element without recreating either record. Editing a saved element supports additional tree mappings through the narrow assignment mutation. The UI shows breadcrumb-labelled leaves, level-derived `b`, fixed/default `a`, inferred `c`, and numerical percent-input behavior. Unsupported element types receive an explanation without assignment controls.
- The existing four-step PracticeQuiz wizard adds a `STANDARD` / `ADAPTIVE` mode selector. Standard mode retains stacks. Adaptive mode selects a linked reusable tree, can permission-check and link an owned tree to the course, edits direct node/assignment overrides, and requests an unsaved server-authoritative setup preview for effective state and readiness.
- Disabling a hierarchy node requires confirmation and reports affected descendants and assignments. Root weight inputs show normalized percentages; assignment and coverage tables remain dense and filterable.
- The course publication dialog requests a fresh executor-authorized preview. Adaptive quizzes expose immediate publication only and show named root reachability; standard quizzes retain immediate and scheduled publication. The modal never trusts stale wizard readiness.
- `/practiceQuiz/[id]/evaluation` keeps the existing PracticeQuiz evaluation route. Adaptive mode requires practice-quiz `ADMIN` permission and renders anonymous released-result/stop/quality summaries, overall level bands, expandable depth-5 competence distributions, form-length/timing metrics, and privacy-suppressed item exposure/fit diagnostics. READ collaborators cannot query or open adaptive cohort results. Live in-progress and abandoned counts are never exposed.

The Manage UI consumes generated GraphQL operations and displays effective/derived values returned by the service. It does not implement a second readiness validator or psychometric model in React. Internal validation codes and database ids stay in `data-cy` hooks or transport data rather than lecturer-facing copy.

The deterministic development seed creates a reusable depth-5 tree linked to Testkurs and Testkurs 2, and a published adaptive PracticeQuiz with an immutable 60-item pool. Every combination of its two enabled leaves and three levels contains ten independent, scorable elements: two Numerical, SC, MC, KPRIM, and controlled-answer Free Text items. This makes all three seeded classification bands reachable under the Diagnostic configuration. The pool is materialized before the seed creates 15 completed attempts, so historical evaluation data and fresh participant runs coexist in a valid runtime state. Testkurs is the only seed course enabled for adaptive rollout; the other courses stay default-off. The historical seed attempts reproduce anonymous level/stop distributions but intentionally have no canonical response rows, so they surface the response-count integrity warning rather than pretending to provide item calibration evidence. The participant quiz route waits until a URL-provided participant token is installed before requesting protected adaptive metadata and refreshes availability from the API so a previously cached unavailable result cannot survive publication or reseeding.

Thirteen focused Chromium journeys cover the tree library/editor, depth-5 reparent validation, supported and unsupported element mapping, standard/adaptive wizard branches, authoritative setup readiness, adaptive and standard publication dialogs, the hierarchical cohort dashboard, unsaved-change protection, and semantic dense tree controls. Student verification uses a hydrated production build and covers intro, zero-answer resume, atomic restart including a lost mutation response, unknown elapsed-time resume, SC/MC/KPRIM/numerical/free-text delivery, participant-safe payloads, `MASTERY`/`NEAREST` classified and insufficient results, the depth-5 profile, English/German localization, and embed completion. Course-management verification covers the retained-history archive contract. Student content and the result chart fit a 390 px viewport without horizontal scrolling; the Manage application's existing desktop navigation still sets the overall document width to 678 px at that viewport and is tracked as global responsive debt rather than an adaptive-component overflow.

## Versioned Measurement Records

IRT v2 separates mutable authoring from immutable measurement history. A `CompetenceTreeScaleVersion` owns explicit level cuts and item-difficulty priors for one tree. Exact `AdaptiveItemCalibration` rows bind a scale, assignment, element id, element version, calibration version, model, and parameter snapshot. A `PracticeQuizAdaptivePublication` then freezes the scale, estimator, policies, cuts, weights, evidence minima, question caps, retake policy, and empirical-validation identity used by one materialized pool. Attempts and responses copy that publication identity; operational item-exposure counters remain separate and contain no participant identity.

The initial migration deliberately preserves legacy behavior. Every existing tree receives a deterministic `DRAFT` scale. One-level trees use the range midpoint; multi-level `NEAREST` and `MASTERY` trees use the same formulas as the legacy runtime. Existing author priors become `PROVISIONAL` calibrations with zero empirical counts and an explicit warning, so they cannot be mistaken for approved IRT v2 evidence. Every legacy pool, attempt, and response remains `IRT_V1` and resolves through an immutable version-1 publication.

Database constraints reject non-finite parameters, invalid probabilities, cross-tree/version references, field-test items that contribute to reported estimates, and mutable publication/pool snapshots. Every pool row has an exact composite foreign key to its calibration's tree, scale, assignment, element, and element version. Publication lifecycle timestamps and calibration status changes are monotonic. Empirical-validation evidence is unique through the exact criterion checksum, and database lifecycle guards prevent terminal evidence from being rewritten or superseded while an attached publication is active. The canonical and analytics Prisma relations mirror these migration constraints, so migration and `db push` environments enforce the same identities. Scale, link, calibration, and empirical-validation review records enforce creator/reviewer separation in both service authorization and database triggers. Activating a superseding scale requires an approved exact-anchor scale link. A Diagnostic IRT v2 publication requires matching approved holdout validation; internal simulation reports are engineering evidence only and are never user-visible database records.

Empirical holdout quality is server-owned, but no production validation protocol is approved yet. The current internal accumulator does not reconstruct the exact hierarchy, weights, leaf allocation, selection sequence, or stopping state and therefore cannot certify Diagnostic behavior. `ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion` remains `null`; validation submission and worker execution fail before private artifacts are opened. A future versioned protocol must fix the complete projection/replay contract, then reauthorize export and criterion identities before and after processing, bind evidence uniqueness to export/protocol/threshold/bank/configuration fingerprints, delete criterion artifacts after persistence or expiry, and still require a different persisted administrator's approval. Runtime enablement is a later, separate release decision.

Calibration imports are limited to 100 items per synchronous transaction and require a matching ready, unexpired server export for the same tree, scale, dataset version, and checksum. Database transactions retry bounded serialization/deadlock conflicts and otherwise return a stable conflict error. This makes imported calibration provenance server-verifiable instead of trusting artifact metadata alone.

Calibration-export workers use a persisted UUID lease for every run. Stale requests can be reclaimed after 30 minutes, but every ready, failed, or run-local expiry transition matches the current lease and clears it; a displaced worker cannot publish terminal state. An enqueue failure moves the audit record directly from `REQUESTED` to terminal `FAILED` with a safe failure code. Artifacts are written below a run-specific tree/request/lease prefix, so cleanup by an old worker cannot delete a replacement worker's files. Scale-link artifacts accept at most 1,000 exact item-pair anchors. Their calibration rows are loaded in batches of 500 and validated in memory, avoiding two sequential database reads per anchor while retaining exact tree, scale, assignment, element, version, and calibrated-status checks. Each source calibration, target calibration, and logical assignment/element/version identity can occur only once in a link.

Run `DATABASE_URL=<administrative-local-postgres-url> pnpm --filter @klicker-uzh/prisma run verify:adaptive-irt-v2-migration` to rehearse both a clean replay and a populated upgrade across the complete migration chain. The populated path verifies one-level `NEAREST`, three-level `MASTERY`, legacy pool/attempt/response identity, provisional calibration status, finite-number guards, independent review, immutable pool rows, and restrictive historical retention.

## Results And Privacy

Adaptive summaries are attempt-level estimates under the quiz's configured competence weights. They are not population ability estimates. Reporting uses bounded maximum-likelihood estimates; MAP is limited to routing so the prior does not create student evidence.

Each node estimate pools every descendant response exactly once. Intermediate hierarchy nodes therefore do not change root or overall results. The overall estimate uses normalized root weights only, is undefined until every enabled root has evidence, and propagates uncertainty as `sqrt(sum(w_i^2 * SE_i^2))` over the disjoint root response sets. Node levels are suppressed below four scorable responses.

The participant result serializer returns level bands, confidence/near-boundary wording, a normalized single overall trajectory, and a nested depth-5 profile. Lecturer cohort analytics use a fixed release watermark: completed attempts become visible only when the number of distinct completed participants reaches a multiple of five. Retakes and the sixth through ninth new participants wait for the next release, so polling cannot reveal one completion at a time. The configured first/latest-completed-attempt policy is applied only inside that released set. Before the first release, cohort size is `null`. In-progress and abandoned lifecycle counts are not part of the public cohort API.

The production privacy contract requires every released categorical, binary, missingness, anomaly, and percentile field to satisfy k=5 for both the reported value and its complement. `packages/graphql/src/services/adaptivePracticeQuizPrivacy.ts` implements the field/value, complement, known/missing, and minimum-response policy, and every withheld field is `null` with a typed reason. The first authorized lecturer read at a complete five-participant boundary lazily persists one typed `AdaptivePracticeQuizCohortSnapshot` for the config, release watermark, attempt policy, and policy version. Concurrent reads converge on the same unique row, and participant submission never performs snapshot work. Its JSON is aggregate-only and has no participant/attempt ids, usernames, raw answers, theta, level result, or person-level timing.

Canonical first/latest attempts are selected in PostgreSQL, then loaded in bounded batches for aggregation. A database trigger invalidates all config snapshots when an attempt is erased. The next read can regenerate only the currently complete lower boundary; an invalidated higher boundary remains inaccessible until the cohort again fills it. Snapshots are a disposable privacy-reviewed read model, never evidence for an individual result.

Pilot metrics count canonical response rows per released selected attempt and compute median/P95 question count, client-reported whole-attempt completion duration, and response/estimate integrity signals. Item diagnostics replay each root's pre-response routing estimate, compare observed correctness with immutable-snapshot 3PL expected correctness, and report exposure. Exposure and accuracy use k=5 plus complementary-cell suppression; residual/misfit remains hidden below 30 responses. Every pilot field whose value, complement, or known/missing partition is below k=5 is withheld independently, so one missing duration does not hide unrelated releasable metrics. These are review signals for lecturer-assigned item levels, not automatic calibration and not a basis for rewriting student results. Operational interpretation and real-course gates are in [Adaptive Learning Operations](./adaptive-learning-operations.md).

Students see:

- Overall level band.
- Competence-level bands.
- Subcompetence/leaf bands.
- One normalized overall trajectory whose final point equals the final overall estimate.
- Confidence and near-boundary language.
- Gentle insufficient-pool wording when applicable.

## Phase 11 Measurement Regression Evidence

`packages/adaptive-learning/test/simulationHarness.ts` runs the production `prepareAdaptiveRuntime` / `advanceAdaptiveRuntime` engine with fixed, independent pool, ability, routing, and response seeds. The deterministic matrix covers:

- Placement (`MASTERY`) and Diagnostic (`NEAREST`) product presets.
- Short-form and long-form cap/pool overlays; these are test profiles, not additional persisted preset enum values.
- SC-only, SC/MC/KPRIM, numerical/free-text, and mixed item pools.
- Sparse (one), target (five), and rich (ten) items per leaf-level cell.
- Clean, 10%, and 20% adjacent-level item-label noise.
- Exact and adjacent accuracy, mean absolute level error, mean/P95 length, stop reasons, per-level accuracy, signed per-level bias, classification by boundary distance, root failure reasons, and maximum/P95 item exposure.

The canonical clean-profile evidence from 300 stratified simulated learners per profile is generated locally or in CI as the ignored `packages/adaptive-learning/reports/simulation-report.json` artifact. Its concise, reviewable summary is committed in `packages/adaptive-learning/reports/simulation-summary.md`:

| Profile           | Items/cell | Exact | Adjacent | Interior classified | Total cap | Max/P95 exposure | Mean items |
| ----------------- | ---------: | ----: | -------: | ------------------: | --------: | ---------------: | ---------: |
| Placement target  |          5 | 0.837 |    1.000 |               0.157 |     0.883 |    0.867 / 0.760 |     47.743 |
| Placement rich    |         10 | 0.850 |    1.000 |               0.269 |     0.787 |    0.577 / 0.450 |     46.843 |
| Diagnostic target |          5 | 0.773 |    1.000 |               0.183 |     0.843 |    0.863 / 0.780 |     49.077 |
| Diagnostic rich   |         10 | 0.810 |    1.000 |               0.264 |     0.790 |    0.477 / 0.420 |     48.667 |

The executable engineering regressions require overall exact accuracy `>= 0.70`, overall and per-level adjacent accuracy `>= 0.95`, per-level exact accuracy `>= 0.60`, MAE `<= 0.35`, absolute per-level bias `<= 0.50`, deterministic replay, and zero unexpected clean pool/node/insufficient fallback. Profile-aware baselines additionally require target/rich interior classification `>= 0.15/0.25`, cap rate `<= 0.90/0.80`, maximum exposure `<= 0.90/0.60`, P95 exposure `<= 0.80/0.45`, and mean length `<= 0.99` of the cap. Sparse pools intentionally exhaust.

These thresholds protect code behavior; they are not production shipping gates. The formerly proposed 90% interior-classification threshold is mathematically impossible for the canonical two-root, 50-item cap. Six equal bands over `[-3, 3]` are 1.2 wide. At 25% of a band from a boundary and `z = 1.28`, classification requires `SE <= 0.234375`. Even ideal `a = 1.2`, `c = 0` items provide at most `a^2 / 4 = 0.36` information, so one root needs at least 51 responses and two roots at least 102; guessing only increases that requirement. The target bank has 120 items and uses about 48 per learner, making average exposure about 40% before adaptive concentration. Average exposure therefore cannot certify a 40% item maximum; the derived distinct-item minima and runtime exposure filter are necessary safeguards, and real-course exposure remains a release gate.

The stricter real-course gates remain unchanged: independently labelled exact/same-or-adjacent agreement, overall and interior cap analysis, maximum item exposure `<= 0.40`, timing, fairness, item diagnostics, standard setting, privacy, and named approvals. A course that misses them stays disabled and must expand/recalibrate its bank, revise the approved profile/algorithm, or repeat the pilot. Synthetic evidence does not replace item calibration, teacher comparison, fairness analysis, or pilot acceptance.

The guardrail benchmark uses 250 roots, 250 leaves, 20 levels, and two items per leaf-level cell: 500 nodes and 10,000 items. On the 2026-07-12 development run, preparation took 2.7 ms, the first decision 4.7 ms, and a decision with 999 responses 8.2 ms. Normal tests enforce only coarse multi-second regression ceilings; calibrated P95 performance gates require a pinned CI runner.

The obsolete project sweep script and the unused `packages/shared-components/src/adaptive/` components were deleted. Future Manage/PWA components must consume generated GraphQL bands and normalized positions or call canonical package helpers; they must not restore private mapping, theta normalization, or item-curve formulas.

The final independent review found two response-space inconsistencies. Shared MC/KPRIM grading had assumed zero-based contiguous choice indices even though stored choices carry explicit IDs, and adaptive MC accepted an empty response while its guessing parameter models only non-empty subsets. Grading now compares explicit choice IDs, adaptive MC requires at least one selection, all-false KPRIM remains valid, and both fixes have regression coverage. The remediation spot-check reported no remaining P0-P2 finding in those edits.

## Ownership And Deletion Policy

Competence trees are reusable content objects. Once a tree is linked to an adaptive quiz with attempts, account deletion must not silently delete the tree and invalidate historical meaning. The v1 service policy is:

- An unused, unlinked tree can be hard-deleted through the tree service before account closure.
- A linked or quiz-referenced tree is archived or transferred to an approved successor; ownership is never erased implicitly.
- `CompetenceTree.owner`, attempt/config, attempt/quiz-course, and direct attempt/course foreign keys use `RESTRICT`. Direct database deletion therefore cannot cascade an owned tree, attempted quiz, or attempted course.
- Participant and participation deletion deliberately retains the existing erasure cascade for that participant's attempts. The attempt-delete trigger invalidates every affected aggregate snapshot; a later authorized read recomputes only a complete five-person boundary. Invalidated snapshots are not returned and require an explicit retention decision before any export.

`adaptiveLearningAccountClosure.ts` provides a locked preflight and idempotent transfer, and `transferUserContent.ts:run` includes it in the controlled whole-account transaction. Each tree transfer writes one internal `COMPETENCE_TREE` ownership audit record; rerunning a successful transfer is a no-op. Account closure remains explicit: all trees and other owned content must be transferred or intentionally deleted, the preflight rerun, and historical access verified before the old owner is deleted. See [Adaptive Learning Operations](./adaptive-learning-operations.md#ownership-and-account-closure).

## Legacy Cleanup

The old standalone adaptive models and old CEFR seed helpers are retained only as transitional data. Before broad rollout:

1. Run the aggregate-only, repeatable-read audit `packages/prisma/src/prisma/audits/adaptive-learning-legacy.sql` with a read-only staging/production role.
2. If none exists, drop old standalone adaptive tables and relations in a cleanup migration.
3. If data exists, define archival or migration semantics first.

New work should target competence trees and adaptive practice quizzes only.

The audit and cleanup decision matrix are documented in [Adaptive Learning Operations](./adaptive-learning-operations.md). A local empty/seed result is not evidence about staging or production.

## Commands

The checks below are local engineering verification only. They do not establish production readiness or authorize a pilot or rollout. Real-course psychometric evidence, teaching/privacy/operations signoff, and staging/production migration and deployment evidence remain required.

- `pnpm --filter @klicker-uzh/adaptive-learning check` - **verified 2026-07-14**.
- `pnpm --filter @klicker-uzh/adaptive-learning test` - **verified 2026-07-14**; 34 core, runtime, numerical-normalization, hierarchy, and result-presentation tests pass, including deterministic distribution across sequential item ids.
- `pnpm --filter @klicker-uzh/adaptive-learning test:run`, `test:simulation:report`, and `test:performance` - **verified 2026-07-14**; 21 deterministic scenarios and 2,424 encoded learner traces pass the profile-aware regressions, and the 500-node/20-level/10,000-item guardrail covers preparation, first selection, and a 999-response decision.
- `pnpm --filter @klicker-uzh/graphql generate`, `check`, and `build` - **verified 2026-07-13**. Rollup still reports the repository's existing Pothos plugin typing warnings, while the stricter `tsc --noEmit` check passes.
- The nine focused adaptive/competence-tree GraphQL files - **verified 2026-07-13** with 79 passing tests against disposable PostgreSQL 17 where required. They cover readiness, tree validation/permissions/management, publication/configuration, runtime/schema contracts, access non-enumeration, fixed cohort releases, timing integrity, immutable rollback, and retry/concurrency behavior. Expected Redis warnings in management tests do not affect these service paths.
- `20260710190000_adaptive_practice_quiz_configuration` - **verified 2026-07-10** both through a clean 181-migration replay and a populated 180-to-181 upgrade fixture; normal settings became Diagnostic while custom discrimination/information/live settings remained Research.
- `20260710210000_adaptive_practice_quiz_runtime` and the complete migration chain - **verified 2026-07-13** on PostgreSQL 17 through a clean 184-migration replay and a populated 181-to-182 upgrade. The populated fixture proves readable `TOTAL_QUESTION_CAP`, `CLASSIFIED`, `INSUFFICIENT_DATA`, and `ABANDONED` terminal paths; cross-tree preflight rejection remains covered.
- `20260714075147_adaptive_cohort_snapshots` and the complete migration chain - **verified 2026-07-14** through a clean 189-migration PostgreSQL 17 replay. The preceding cleanup removes the four inert configuration columns; the final migration adds fixed aggregate releases, erasure invalidation, and bounded cohort indexes. The populated Phase 10 repair rehearsal also passes after 184 prior migrations.
- `pnpm --filter @klicker-uzh/grading test` - **verified 2026-07-13**; ten tests pass, including exact zero-bound and non-finite numerical restrictions.
- `packages/graphql/test/adaptivePracticeQuizRuntimeSchema.test.ts` - **verified 2026-07-13**; the participant schema contains no solutions, item parameters, theta, or standard-error fields.
- `pnpm --filter @klicker-uzh/frontend-manage check` / `build` and `pnpm --filter @klicker-uzh/frontend-pwa check` / `build` - **verified 2026-07-13** after regenerating GraphQL operations. Standard practice quizzes retain their existing runner while adaptive mode branches inside the same PWA route; production builds report only existing repository warnings.
- `pnpm --filter @klicker-uzh/playwright exec tsc --noEmit`, `playwright/tests/Z-adaptive-learning.spec.ts`, and `playwright/tests/Z-adaptive-learning-release.spec.ts` - **verified 2026-07-30**; all ten Chromium tests pass together. The release journeys cover the default-off gate, depth-5 cross-course tree reuse, real validation-failure mapping recovery, adaptive PracticeQuiz publication, transient result/submission recovery, all five valid element types, zero-answer resume/start-over, stale/concurrent duplicate rejection, metadata non-enumeration, immediate unpublication revocation, fixed five-person and ten-person anonymous releases, singleton/complementary-cell suppression, and English/German desktop/mobile level-band results.
- Phase 12/13 browser evidence - **verified 2026-07-14** for the tree library/editor, element mapping, adaptive setup/settings, anonymous evaluation, and student level-band result at desktop, tablet, and mobile widths in English and German. Root document overflow is absent at 390/768/1440 px and the wide coverage matrix remains independently scrollable. Screenshots are in `project/screenshots/adaptive-learning-final/`.
- `npx agent-browser` plus repository-pinned Playwright browser QA - **verified 2026-07-13** for intro, every supported question type, zero-answer resume, atomic restart, classified/insufficient completion, depth-5 expansion, 390 px English/German layouts, payload privacy, and the ready/init/state embed handshake. Evidence is in `project/screenshots/adaptive-learning-phase6/`.
- Phase 7 browser evidence - **verified 2026-07-13** for the live question timer, four-point student level-band result, and five-result released lecturer cohort. Screenshots are in `project/screenshots/adaptive-learning-phase7/`; they are development evidence, not production or accessibility signoff.
- `pnpm run check`, `pnpm run format:check`, `pnpm run check:syncpack`, and `pnpm exec turbo run build --concurrency=1` - **verified 2026-07-13**; all 22 build tasks pass. The default parallel root build exceeded the local container's memory limit, so the production-equivalent build was repeated sequentially. Host `pnpm run lint` remains blocked only in the unrelated `apps/chat` package because its existing Next.js ESLint setup cannot resolve `eslint-plugin-react-hooks`; the full container lint plus affected Manage/PWA lint pass with existing warnings only.
- `opengrep scan --config auto --no-git-ignore` - **verified 2026-07-13** over 17 changed adaptive/runtime/UI files; 210 applicable rules reported zero findings.
