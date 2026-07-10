---
type: Feature Architecture
title: Adaptive Learning
description: Competence-tree based adaptive practice quiz mode, item parameters, validation gates, result semantics, and rollout boundaries.
timestamp: '2026-07-10'
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
- Pure adaptive math and normalization helpers: `packages/adaptive-learning/src/index.ts:MAX_COMPETENCE_TREE_DEPTH`, `packages/adaptive-learning/src/index.ts:SUPPORTED_ADAPTIVE_ITEM_TYPES`, `packages/adaptive-learning/src/index.ts:mapThetaToLevel`, `packages/adaptive-learning/src/index.ts:deriveGuessingParameter`, `packages/adaptive-learning/src/index.ts:minimumReachableStandardError`.
- Competence-tree input/persistence and ownership services: `packages/graphql/src/services/competenceTreeInput.ts:prepareTreeInput`, `packages/graphql/src/services/competenceTreeManagement.ts:createCompetenceTree`.
- Adaptive quiz configuration, readiness, and publication snapshots: `packages/graphql/src/services/adaptivePracticeQuizConfig.ts:replaceAdaptivePracticeQuizConfig`, `packages/graphql/src/services/adaptivePracticeQuizReadiness.ts:validateAdaptiveQuizReadiness`, `packages/graphql/src/services/adaptivePracticeQuizPublication.ts:materializeAdaptivePracticeQuizPool`.
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

To keep validation resource-bounded, one snapshot accepts at most 100 levels, 5,000 nodes, 100,000 coverage cells, and 100,000 assignments. Depth and cycle walks are iterative and stop at the depth-5 boundary.

Tree validation is deliberately **structural**, so a draft tree may have no assignments or fewer assignments than its coverage target. Publication readiness is a separate Phase 2 gate that compares enabled pool counts with targets and blocks empty enabled cells. Do not treat `CompetenceTreeValidationResult.valid` as permission to publish.

The `20260710152000_adaptive_tree_integrity` migration adds same-tree foreign keys for parents, coverage, and assignments plus a node-kind/null check for estimates. Together with the original partial unique index, this permits exactly one coherent overall estimate per attempt. Quiz override same-tree constraints are completed with the Phase 2 adaptive-config contract.

## Adaptive Practice Quiz Configuration

The existing `createPracticeQuiz` and `editPracticeQuiz` mutations accept optional `mode` and `adaptiveConfig` arguments. Omitting both preserves the standard practice-quiz path. Adaptive mode requires empty standard stacks and a competence tree linked to the selected course; the caller needs course `WRITE` access. Saving the quiz and replacing its complete adaptive configuration are one transaction.

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

Controlled-answer validation follows the canonical graders: SC requires exactly one true choice, MC requires at least one, and KPRIM requires exactly four boolean choices but may validly contain zero through four true choices. In particular, an all-false KPRIM item is scorable.

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

Students should see level bands and confidence wording, not raw theta values by default.

## Readiness And Reachability

Publishing an adaptive practice quiz runs the pool-aware readiness validator. It blocks publication when any enabled leaf-level cell has zero enabled assignments. It warns when:

- Item count is below target coverage.
- Coverage targets cannot all fit within the shared or nested caps.
- The configured standard-error threshold is unreachable for the available item information.
- Minimum evidence cannot fit within a leaf, nested-node, or global cap.
- One or more level bands cannot fit the configured `classificationZ` interval under the allocated root budget.
- Expected question count exceeds the product time budget.

Expected duration uses the conservative planning assumption of 60 seconds per item and warns above 30 minutes. Its question count is bounded by coverage targets, the unique enabled pool, the global/per-leaf caps, and every node cap in the nested hierarchy. The shared total cap is allocated across roots using normalized weights while prioritizing minimum evidence. Within each root, the feasible subset reserves minimum evidence from every enabled leaf before information-based fill, subject to ancestor caps. Root precision sums item information at common theta grid points; it does not add each item's separate peak as though those peaks occurred at one ability value. Classification feasibility evaluates representative points inside each level band with the configured `classificationZ`. Warnings do not block publication. Readiness output is part of the owner preview, not transient UI-only text.

Initial production input guardrails are 20 levels, 500 nodes, 10,000 coverage rows, and 10,000 assignments per tree. These limits protect GraphQL workers and must be revisited with pilot measurements rather than raised speculatively.

## Publication Snapshot

Immediate publication materializes `PracticeQuizAdaptivePoolItem` rows transactionally before changing quiz status. Each row stores the source assignment id, element id/version/name/type, grading-relevant element data, leaf and ancestor paths, level snapshot, effective `a`/`b`/`c`, and numerical percent-input setting. Source element rows are locked while the snapshot is read, and pool inserts are batched.

Adaptive scheduled publication is deliberately unavailable in Phase 2 (`ADAPTIVE_SCHEDULING_UNAVAILABLE`). The current Hatchet API cannot atomically commit a database pool and external scheduled task; allowing it would leave a crash window with a permanently scheduled quiz and no task. Add a transactional outbox plus reconciler before enabling this path. Republishing immediately may replace the snapshot while no attempts exist. Once any attempt exists, config changes, pool clearing, and pool replacement fail with `ADAPTIVE_CONFIG_LOCKED` or `ADAPTIVE_POOL_LOCKED`.

Source element edits do not mutate existing pool rows. Phase 3 participant delivery and grading must read `PracticeQuizAdaptivePoolItem` only; the retained live-tree assignment references are transitional compatibility fields and must not be used by new runtime code.

The Phase 2 migration treats any pre-existing `PracticeQuizAdaptiveConfig` as intent to use adaptive mode and backfills its quiz accordingly. Existing normal settings become Placement or Diagnostic; custom discrimination/information/live-estimate settings become Research and are preserved. The retired self-assessment warm-up flag is reset to false for every preset. Invalid experimental values or inconsistent attempt identities stop with an actionable migration error instead of being rewritten. Legacy scheduled adaptive rows return to Draft. If transitional data still contains standard stacks, readiness reports `ADAPTIVE_STACKS_FORBIDDEN`, publication is blocked, public practice-quiz queries hide those stacks, and the standard response service rejects them. An owner must remove the stacks through an adaptive edit before publication.

Phase 2 permits owner-side publication to verify immutable pools, but adaptive quizzes are excluded from participant practice-quiz listings and direct participant data queries until Phase 3 supplies the student runtime. This is a server-side release boundary, not a UI convention.

## Runtime Integrity

The participant runtime must be server-authoritative:

- The server chooses and persists the next immutable pool item on `AdaptivePracticeQuizAttempt.nextPoolItemId`.
- The client submits only the currently served assignment.
- The service rejects arbitrary assignment ids, repeated submissions, foreign-tree assignments, disabled assignments, and cross-participant attempts.
- Composite foreign keys require an attempt's quiz to own its config, require quiz and participation to agree on course/participant identity, require its next pool item to belong to that config, and bind each pool-backed response's config, pool item, source assignment, and element id to one immutable pool row.
- `poolItemId` remains nullable in Prisma only so historical experimental responses can be read. A migration-only `NOT VALID` check rejects every newly inserted response without a pool item; Phase 3 can validate the constraint and make the Prisma field required after the legacy-data decision.
- Delivered element data and grading-relevant options are snapshotted in `AdaptivePracticeQuizResponse.elementSnapshot`.
- Participant payloads must not contain solutions or hidden grading metadata.

Access to the student runtime requires a `Participation` row for the course. Do not use `Participation.isActive` as the generic access gate; that field is leaderboard state (see [Domain Model](./domain-model.md)).

## Results And Privacy

Adaptive summaries are attempt-level estimates under the quiz's configured competence weights. They are not population ability estimates.

Use weighted aggregation for overall quiz results. Use inverse-variance aggregation only for repeated estimates of the same construct. Lecturer-facing results must be anonymous and small-bucket suppressed in the serializer, not only in React rendering. Until an institutional threshold is chosen, use the planning default of suppressing leaf-level buckets below `n < 5`.

Students see:

- Overall level band.
- Competence-level bands.
- Subcompetence/leaf bands.
- Confidence and near-boundary language.
- Gentle insufficient-pool wording when applicable.

## Ownership And Deletion Policy

Competence trees are reusable content objects. Once a tree is linked to an adaptive quiz with attempts, account deletion must not silently delete the tree and invalidate historical meaning. The v1 service policy is:

- Unused trees can be hard-deleted with their owner.
- Used or linked trees are soft-deleted or reassigned to a system/course owner during account deletion.
- Direct tree deletion follows this policy now. Account deletion still needs an explicit ownership-transfer or retention path before attempts can be enabled in production because the Prisma owner relation currently cascades.

This policy must be backed by a service test before adaptive attempts are exposed in production.

## Legacy Cleanup

The old standalone adaptive models and old CEFR seed helpers are retained only as transitional data. Before broad rollout:

1. Check staging/production for real `AdaptiveAssessment*` data.
2. If none exists, drop old standalone adaptive tables and relations in a cleanup migration.
3. If data exists, define archival or migration semantics first.

New work should target competence trees and adaptive practice quizzes only.

## Commands

- `pnpm --filter @klicker-uzh/adaptive-learning check` - **verified 2026-07-09**.
- `pnpm --filter @klicker-uzh/adaptive-learning test:run` - **verified 2026-07-10**; runs 22 core tests and the deterministic recovery simulation.
- `pnpm --filter @klicker-uzh/graphql generate` - **verified 2026-07-10**; required after GraphQL schema/op changes.
- `pnpm --filter @klicker-uzh/graphql check` - **verified 2026-07-10**.
- `pnpm --filter @klicker-uzh/graphql exec vitest run test/adaptivePracticeQuizReadiness.test.ts` - **verified 2026-07-10**; ten pure readiness/planning tests, including shared caps, per-leaf minimum reservation, common-theta information, nested caps, and the 500-node/10,000-assignment guardrail shape.
- `packages/graphql/test/adaptivePracticeQuizConfig.test.ts` - **verified 2026-07-10** against disposable PostgreSQL 15; seven integration tests cover compatibility, participant hiding, gamification isolation, presets, permissions, deleted sources, all-false KPRIM, immutable publication, scheduling rejection, and database constraints.
- `20260710190000_adaptive_practice_quiz_configuration` - **verified 2026-07-10** both through a clean 181-migration replay and a populated 180-to-181 upgrade fixture; normal settings became Diagnostic while custom discrimination/information/live settings remained Research.
- `pnpm --filter @klicker-uzh/graphql test competenceTrees.test.ts` - **verified 2026-07-10**; runs pure tree validation coverage.
- `pnpm --filter @klicker-uzh/graphql test competenceTreeSchema.test.ts` - **verified 2026-07-10**; proves read-only user logins cannot invoke tree mutations.
- `packages/graphql/test/competenceTreeManagement.test.ts` - **verified 2026-07-10** against an isolated PostgreSQL/Redis/Hatchet stack; five tests cover transactions, permissions, reuse, duplication, structural locking, deletion, and database constraints.
