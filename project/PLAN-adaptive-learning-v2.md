# Adaptive learning v2 implementation plan

## Goal

Rework adaptive learning into a production-safe, generic level-classification mode of practice quizzes.

The target model is:

1. Competence trees are reusable learning assets that can be linked to multiple courses.
2. Elements are mapped to competence-tree leaf nodes and levels.
3. Adaptive delivery is a practice quiz mode, not a separate activity type.
4. The adaptive engine reports anonymous overall, competence-level, and subcompetence-level categorization results.
5. The implementation keeps the good parts of PR #5113: the pure `@klicker-uzh/adaptive-learning` package, 3PL math, GraphQL service layering, simulation harness, and per-response audit trail.

Source reviews considered:

- `project/REVIEW-adaptive-learning-pr5113.md`
- `project/2026-07-07-adaptive-learning-pr5113-review.md`
- `project/2026-07-07-adaptive-learning-consolidated-review.md`

## Product decisions

### Competence tree is the base object

Add a reusable competence tree editor. A tree consists of:

- A tree is not owned by exactly one course. It is owned/shared like a reusable learning asset and can be linked into multiple courses.
- One or more top-level competences.
- Each competence has one or more subcompetence descendants.
- Subcompetences can be nested, with a maximum depth of `MAX_COMPETENCE_TREE_DEPTH = 5`.
- Only leaf nodes can receive element assignments.
- Weights exist on top-level competences for overall scoring. Optional weights on lower nodes are for display and future diagnostics, not for the overall score in v1.
- The tree owns the ordered level scale for the domain. Examples: A1-C2, Novice-Expert, Low-Medium-High.
- The tree editor shows a coverage matrix: leaf node x level, including current assigned item count and target minimum.

### Item parameters

Use the review-backed parameter policy:

- Valid adaptive pool element types in v1 are `NUMERICAL`, `SC`, `MC`, `KPRIM`, and `FREE_TEXT`.
- `b` is selected at element assignment time by choosing a tree level. Runtime maps that level to the level anchor on the fixed theta range.
- `c` is inferred from element type and choice count:
  - SC: `1 / choices`
  - MC: `1 / (2^choices - 1)`
  - KPRIM: `1 / 2^choices`
  - NUMERICAL and FREE_TEXT: `0.01`
- Ignore CASE_STUDY, CONTENT, SELECTION, and any self-graded or ungraded type for v1 adaptive pools.
- `a` defaults conservatively to `1.2` for uncalibrated items.
- A vetted-pool preset may use `1.5`, but the UI must not encourage lecturers to overstate item discrimination.
- Per-element `a` should be stored as nullable. Runtime effective `a` is:
  1. calibrated item `a`, once enough empirical data exists,
  2. per-assignment override, if an expert explicitly sets one,
  3. quiz preset default, normally `1.2`.
- Long term, calibrate per-element `b` and `a` from accumulated response data and compare them against the lecturer-assigned level.

### Response normalization for adaptive grading

Adaptive grading stays all-or-nothing for IRT, but submitted values should be normalized before grading.

Numerical normalization v1:

- Accept numeric input as either a number from the existing PWA component or a string from future clients.
- Trim whitespace and normalize Unicode minus to `-`.
- Remove spaces and apostrophes used as thousands separators.
- Treat a single decimal comma as decimal point when no decimal dot is present.
- Reject ambiguous mixed separators such as `1,234.56` vs `1.234,56` unless the existing numerical element component already produced a number.
- Accept scientific notation supported by JavaScript number parsing, for example `1e-3`.
- Accept simple fractions of the form `a/b` when both sides are finite numbers and `b != 0`.
- Optionally accept a trailing percent sign by dividing by 100 only when the element has an explicit `allowPercentInput` option; otherwise reject it to avoid silent unit errors.
- Apply the existing numerical solution-range and exact-solution grading to the normalized number.
- Store both the raw response and normalized value in adaptive response metadata for auditability.

Free-text normalization v1:

- Trim, lowercase, collapse internal whitespace, NFD-normalize, and strip combining marks before exact solution matching.
- Keep FREE_TEXT as an advanced/reviewed item type because synonyms and units remain hard to grade reliably.

### Adaptive quiz is a practice quiz mode

Add a practice quiz mode:

- `STANDARD`: existing stack/spaced-repetition behavior.
- `ADAPTIVE`: server-selected items from a selected competence tree.

In adaptive mode:

- The practice quiz selects exactly one accessible competence tree, even if that tree is also used by other courses.
- The owner sees a preview of the full tree.
- The owner can enable or disable competences and leaf subcompetences for this quiz.
- The owner can adjust quiz-specific top-level competence weights without changing the reusable tree.
- The owner sees all mapped elements from the selected tree and can enable or disable them for this quiz.
- The owner can override the quiz preset and stop settings only in an advanced section.
- The student accesses the quiz through the existing practice quiz route, for example `/course/[courseId]/practiceQuizzes/[id]`.
- There is no separate participant-facing adaptive-learning route in the final design.

### Result semantics

For lecturers, adaptive practice quiz results must default to anonymous distributions:

- Overall level distribution.
- Per-competence level distribution.
- Per-leaf subcompetence level distribution.
- Counts for insufficient-data / abandoned attempts.
- Optional confidence-band summaries and stop-reason summaries.

Do not default to per-student rows. If individual inspection is later needed, it should be a separate permissioned view with explicit privacy review.

## Target data model

### New enums

```prisma
enum PracticeQuizMode {
  STANDARD
  ADAPTIVE
}

enum AdaptiveLevelMappingRule {
  NEAREST
  MASTERY
}

enum AdaptiveAttemptStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

enum AdaptiveNodeKind {
  COMPETENCE
  SUBCOMPETENCE
}

enum AdaptiveEstimateNodeKind {
  OVERALL
  COMPETENCE
  SUBCOMPETENCE
}
```

### Competence tree models

Add a new Prisma schema file, for example `packages/prisma/src/prisma/schema/competence.prisma`.

```prisma
model CompetenceTree {
  id String @id @default(uuid()) @db.Uuid

  name        String
  displayName String
  description String?
  isDeleted   Boolean @default(false)

  maxDepth Int @default(5)
  thetaMin Float @default(-3)
  thetaMax Float @default(3)

  defaultDiscrimination Float @default(1.2)
  levelMappingRule AdaptiveLevelMappingRule @default(NEAREST)

  owner   User @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  ownerId String @db.Uuid

  courseLinks CompetenceTreeCourse[]
  levels CompetenceTreeLevel[]
  nodes  CompetenceTreeNode[]
  levelCoverages CompetenceTreeLeafLevelCoverage[]
  elementAssignments CompetenceTreeElementAssignment[]
  adaptivePracticeQuizConfigs PracticeQuizAdaptiveConfig[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}

model CompetenceTreeCourse {
  id Int @id @default(autoincrement())

  tree CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  treeId String @db.Uuid

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  courseId String @db.Uuid

  createdAt DateTime @default(now())

  @@unique([treeId, courseId])
  @@index([courseId])
}

model CompetenceTreeLevel {
  id Int @id @default(autoincrement())

  label String
  order Int

  tree   CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  treeId String @db.Uuid

  elementAssignments CompetenceTreeElementAssignment[]
  levelCoverages CompetenceTreeLeafLevelCoverage[]
  estimates AdaptivePracticeQuizEstimate[]

  @@unique([treeId, label])
  @@unique([treeId, order])
}

model CompetenceTreeNode {
  id Int @id @default(autoincrement())

  kind AdaptiveNodeKind
  name String
  description String?
  order Int
  depth Int
  weight Float @default(1)

  tree   CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  treeId String @db.Uuid

  parent   CompetenceTreeNode? @relation("CompetenceTreeNodeChildren", fields: [parentId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  parentId Int?
  children CompetenceTreeNode[] @relation("CompetenceTreeNodeChildren")

  elementAssignments CompetenceTreeElementAssignment[]
  levelCoverages CompetenceTreeLeafLevelCoverage[]
  quizNodeOverrides PracticeQuizAdaptiveNodeOverride[]
  estimates AdaptivePracticeQuizEstimate[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([treeId, parentId])
  @@unique([treeId, parentId, order])
}

model CompetenceTreeLeafLevelCoverage {
  id Int @id @default(autoincrement())

  targetItemCount Int @default(5)
  enabled Boolean @default(true)

  tree   CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  treeId String @db.Uuid

  leafNode CompetenceTreeNode @relation(fields: [leafNodeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  leafNodeId Int

  level CompetenceTreeLevel @relation(fields: [levelId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  levelId Int

  @@unique([treeId, leafNodeId, levelId])
}
```

Notes:

- The `depth` field is denormalized for validation and fast display.
- The service must enforce `depth <= MAX_COMPETENCE_TREE_DEPTH`.
- Top-level nodes must have `kind = COMPETENCE`.
- Descendant nodes must have `kind = SUBCOMPETENCE`.
- Element assignments are allowed only on leaf nodes.

### Element assignment model

```prisma
model CompetenceTreeElementAssignment {
  id Int @id @default(autoincrement())

  enabled Boolean @default(true)
  discrimination Float?

  tree   CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  treeId String @db.Uuid

  element   Element @relation(fields: [elementId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  elementId Int

  leafNode CompetenceTreeNode @relation(fields: [leafNodeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  leafNodeId Int

  level CompetenceTreeLevel @relation(fields: [levelId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  levelId Int

  quizElementOverrides PracticeQuizAdaptiveElementOverride[]
  responses AdaptivePracticeQuizResponse[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([treeId, elementId])
  @@index([elementId])
  @@index([treeId, leafNodeId, enabled])
}
```

Notes:

- `@@unique([treeId, elementId])` keeps one canonical assignment per tree. If multi-leaf assignment becomes necessary, relax this to `@@unique([treeId, elementId, leafNodeId])`.
- Use `Restrict`, not `Cascade`, for element and level FKs so completed attempt history is not silently corrupted.
- When hard deletion is unavoidable, snapshot enough element metadata onto `AdaptivePracticeQuizResponse` first.

### Practice quiz adaptive config

Add `mode PracticeQuizMode @default(STANDARD)` to `PracticeQuiz`.

```prisma
model PracticeQuizAdaptiveConfig {
  id String @id @default(uuid()) @db.Uuid

  practiceQuiz   PracticeQuiz @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  practiceQuizId String @unique @db.Uuid

  competenceTree   CompetenceTree @relation(fields: [competenceTreeId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  competenceTreeId String @db.Uuid

  totalQuestionCap Int @default(50)
  perLeafQuestionCap Int?
  minQuestionsPerLeaf Int @default(2)
  classificationZ Float @default(1.28)
  standardErrorThreshold Float?
  topInformationRatio Float @default(0.8)
  defaultDiscrimination Float @default(1.2)
  levelMappingRule AdaptiveLevelMappingRule @default(NEAREST)

  showTimer Boolean @default(true)
  showFinalResult Boolean @default(true)
  showLiveEstimate Boolean @default(false)
  enableSelfAssessmentWarmup Boolean @default(false)

  nodeOverrides PracticeQuizAdaptiveNodeOverride[]
  elementOverrides PracticeQuizAdaptiveElementOverride[]
  attempts AdaptivePracticeQuizAttempt[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PracticeQuizAdaptiveNodeOverride {
  id Int @id @default(autoincrement())

  enabled Boolean @default(true)
  weight Float?
  questionCap Int?

  config PracticeQuizAdaptiveConfig @relation(fields: [configId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  configId String @db.Uuid

  node CompetenceTreeNode @relation(fields: [nodeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  nodeId Int

  @@unique([configId, nodeId])
}

model PracticeQuizAdaptiveElementOverride {
  id Int @id @default(autoincrement())

  enabled Boolean @default(true)
  discrimination Float?

  config PracticeQuizAdaptiveConfig @relation(fields: [configId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  configId String @db.Uuid

  assignment CompetenceTreeElementAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  assignmentId Int

  @@unique([configId, assignmentId])
}
```

### Adaptive attempt, response, and estimates

Use dedicated adaptive attempt tables linked to `PracticeQuiz`, rather than forcing server-selected adaptive attempts into the existing spaced-repetition response shape.

```prisma
model AdaptivePracticeQuizAttempt {
  id String @id @default(uuid()) @db.Uuid

  status AdaptiveAttemptStatus @default(IN_PROGRESS)
  currentTheta Float @default(0)
  currentStandardError Float?
  finalTheta Float?
  finalStandardError Float?
  finalLevelId Int?
  elapsedSeconds Int?
  nextAssignmentId Int?
  thetaHistory Json?
  standardErrorHistory Json?

  config PracticeQuizAdaptiveConfig @relation(fields: [configId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  configId String @db.Uuid

  practiceQuiz PracticeQuiz @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  practiceQuizId String @db.Uuid

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participantId String @db.Uuid

  participation Participation @relation(fields: [participationId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participationId Int

  responses AdaptivePracticeQuizResponse[]
  estimates AdaptivePracticeQuizEstimate[]

  startedAt DateTime @default(now())
  completedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([practiceQuizId, participantId, status])
  @@index([participationId, practiceQuizId])
}

model AdaptivePracticeQuizResponse {
  id Int @id @default(autoincrement())

  order Int
  response Json
  correct Boolean
  thetaBefore Float
  thetaAfter Float
  standardErrorAfter Float
  elapsedSeconds Int?

  attempt AdaptivePracticeQuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  attemptId String @db.Uuid

  assignment CompetenceTreeElementAssignment @relation(fields: [assignmentId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  assignmentId Int

  elementId Int
  elementSnapshot Json?

  createdAt DateTime @default(now())

  @@unique([attemptId, order])
  @@unique([attemptId, assignmentId])
  @@index([assignmentId])
}

model AdaptivePracticeQuizEstimate {
  id Int @id @default(autoincrement())

  nodeKind AdaptiveEstimateNodeKind
  theta Float
  standardError Float?
  responseCount Int
  stopReason String?

  attempt AdaptivePracticeQuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  attemptId String @db.Uuid

  node CompetenceTreeNode? @relation(fields: [nodeId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  nodeId Int?

  level CompetenceTreeLevel? @relation(fields: [levelId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  levelId Int?

  createdAt DateTime @default(now())

  @@unique([attemptId, nodeKind, nodeId])
  @@index([nodeKind, levelId])
}
```

Add a partial unique index in a migration for one in-progress adaptive attempt per participant and quiz:

```sql
CREATE UNIQUE INDEX "AdaptivePracticeQuizAttempt_one_in_progress"
ON "AdaptivePracticeQuizAttempt"("practiceQuizId", "participantId")
WHERE "status" = 'IN_PROGRESS';
```

## GraphQL and service architecture

### Keep and extend the pure adaptive package

Modify `packages/adaptive-learning/src/index.ts`:

- Set `DEFAULT_DISCRIMINATION = 1.2`.
- Keep `DEFAULT_THETA_RANGE = { min: -3, max: 3 }`.
- Add `MAX_COMPETENCE_TREE_DEPTH = 5`.
- Add `AdaptiveLevelMappingRule` support in `mapThetaToLevel`.
- Export a single function for level boundaries so backend and shared components use identical bands.
- Add posterior standard error support when `usePrior` is true.
- Extend `selectNextItem` to implement randomesque top-k or top-ratio selection using `topInformationRatio`.
- Add classification-stop helpers:
  - `classificationIntervalWithinLevelBand({ theta, standardError, z, levels, mappingRule })`
  - `isNearLevelBoundary(...)`
  - `minimumReachableStandardError({ itemTypeMix, cap, discrimination })` for validation.

### New services

Add these service modules rather than growing `services/adaptiveLearning.ts` further:

- `packages/graphql/src/services/competenceTrees.ts`
- `packages/graphql/src/services/adaptivePracticeQuizzes.ts`
- Keep `packages/graphql/src/services/adaptiveLearning.ts` only as temporary compatibility code during migration, then delete it.

`competenceTrees.ts` responsibilities:

- CRUD for trees, levels, nodes, coverage targets, and element assignments.
- Linking and unlinking trees to multiple courses where the user has sufficient course permission.
- Permission checks using the existing object/course permission patterns, not only `ownerId`. A user can use a tree in a course only if they can access the tree and manage the target course.
- Tree validation:
  - at least one competence,
  - every competence has at least one leaf descendant,
  - max depth 5,
  - weights non-negative and normalized for display,
  - every leaf assignment references a valid leaf and level,
  - supported element types only: `NUMERICAL`, `SC`, `MC`, `KPRIM`, `FREE_TEXT`,
  - no cross-owner element attachment without permission.
- Coverage preview and publish-readiness checks.

`adaptivePracticeQuizzes.ts` responsibilities:

- Create/edit adaptive configs for practice quizzes.
- Start/resume/finalize attempts.
- Persist the served assignment id and require submit to match it.
- Grade responses server-side.
- Re-estimate routing state with MAP, but final reporting with weak-prior or MLE.
- Persist overall, competence, and leaf estimates at finalization.
- Return participant-safe payloads that never expose `correct`, `solutions`, hidden config internals, or unused pool elements.
- Return lecturer anonymous distributions.

### GraphQL surface

Add or update operations under `packages/graphql/src/graphql/ops/`:

- `QCompetenceTrees`
- `QCompetenceTree`
- `MCreateCompetenceTree`
- `MUpdateCompetenceTree`
- `MDeleteCompetenceTree`
- `MUpsertCompetenceTreeElementAssignment`
- `QCompetenceTreeElementPoolPreview`
- `MCreatePracticeQuiz` and `MEditPracticeQuiz` extended with `mode` and optional `adaptiveConfig`.
- `MStartAdaptivePracticeQuizAttempt`
- `MSubmitAdaptivePracticeQuizAnswer`
- `QAdaptivePracticeQuizAttemptState`
- `QAdaptivePracticeQuizResults`

Delete or deprecate after migration:

- `QPublishedAdaptiveAssessments`
- `QAdaptiveAssessments`
- `MUpsertAdaptiveAssessment`
- `MPublishAdaptiveAssessment`
- `MArchiveAdaptiveAssessment`
- separate participant adaptive assessment listing.

Acceptance checks:

- A participant cannot query answer keys through any adaptive practice quiz payload.
- Unauthenticated callers cannot enumerate adaptive quiz metadata.
- Course participation is required for all participant adaptive quiz queries.
- A lecturer cannot attach another lecturer's private element to a tree.
- Duplicate submit and arbitrary-item submit both fail or return the current state idempotently.

## Measurement design

### Estimation

Use split estimators:

- Routing and stopping: MAP with strong prior.
  - Competence prior mean: warm-start theta or 0.
  - Subcompetence prior mean: current competence estimate.
  - Prior SD: 1.
- Final reported estimates: weak prior with SD 2 or plain MLE, chosen by simulation.
- Use posterior SE when a prior is active.

Rationale from reviews:

- Unprimed MLE slams to theta boundaries after all-correct/all-wrong early patterns.
- Strong prior is good for routing but hurts final classification if used as the final estimator.
- Do not average subcompetence estimates into competence estimates. Pool responses directly at the competence level.
- Overall score remains weighted mean of top-level competence estimates, with weights expressing curricular importance.

### Level mapping

Make level mapping explicit:

- `NEAREST`: best for descriptive proficiency or self-assessment.
- `MASTERY`: best for placement where rounding up is riskier than rounding down.

Every place must use the same mapping rule:

- backend final level,
- frontend bands,
- result-message intervals,
- simulation ground truth,
- lecturer result distributions.

### Stop conditions

Do not rely on per-leaf standard error as the main stop condition. The reviews show it is often unreachable with realistic caps.

Use:

- Total test cap on the practice quiz adaptive config.
- Per-leaf cap derived from `totalQuestionCap / enabledLeafCount`.
- Minimum 2-3 items per enabled leaf before a competence can stop.
- Coverage exhaustion as a mechanical guard.
- Competence-level classification stop:
  - stop a competence when `theta +/- z * SE` sits inside one level band,
  - start with `z = 1.28`,
  - tune with production-shaped simulation.
- Optional per-leaf SE fast-exit at about `0.65`, treated as a bonus, not the primary stop.

Save-time validation must warn when a chosen threshold is mathematically unreachable:

```text
SE_min = 1 / sqrt(cap * item_information_at_anchor)
item_information_at_anchor = a^2 * (1 - c) / (4 * (1 + c))
```

### Defaults and presets

Ship presets instead of exposing raw psychometric knobs first:

- Language placement, 6 levels:
  - mapping `MASTERY`
  - `a = 1.5` only if the item pool is vetted; otherwise `1.2`
  - target total cap 45-60
  - strong recommendation: `competences * leafCountPerCompetence <= 9`
- Generic mastery, 4 levels:
  - mapping `MASTERY`
  - `a = 1.2`
  - target total cap 30-45
- Diagnostic self-assessment:
  - mapping `NEAREST`
  - `a = 1.2`
  - live estimates still off by default.

Advanced fields stay available for internal users and future calibration.

## Frontend plan

### Competence tree editor

New manage UI surface, likely under the course page:

- A reusable competence-tree library under the manage UI.
- A course-level tab or picker that links existing trees to a course and can create a new linked tree in-place.

Editor features:

- Tree CRUD.
- Ordered level editor.
- Tree node editor with drag/drop or explicit add-child controls.
- Max-depth guard at 5.
- Top-level competence weights with automatic normalization.
- Leaf-level coverage matrix.
- Element assignment panel:
  - search/select existing elements,
  - allow `NUMERICAL`, `SC`, `MC`, `KPRIM`, and `FREE_TEXT`,
  - filter unsupported element types,
  - select leaf node,
  - select level,
  - show inferred `b` and `c`,
  - show effective `a` as default/calibrated/override,
  - show item coverage gaps.
- Pre-publish/readiness checklist:
  - every enabled leaf has at least one item,
  - every enabled leaf has enough level coverage,
  - warn on levels without items,
  - warn on high level count and expected test length,
  - warn on unreachable SE thresholds.

Use design-system controls and `next-intl` from the start. Add `data-cy` on all important controls.

### Element creation and editing

Extend element editing with an "Adaptive mapping" section:

- Show accessible competence trees for the selected course or owner context.
- Allow selecting trees already linked to the course and trees the user owns/can reuse in another course.
- Allow adding or updating the element's tree assignment.
- Require a leaf subcompetence and level.
- Show inferred parameters:
  - `b`: selected level anchor,
  - `c`: derived from element type and choice count,
  - `a`: effective default or calibrated value.
- For Numerical elements, show the normalization policy and warn when solution ranges/exact solutions are missing or ambiguous.
- Block unsupported types for v1: CASE_STUDY, CONTENT, SELECTION, FLASHCARD, and ungraded variants.
- Reuse permission filters from live quiz and catalog object patterns so cross-owner private elements cannot be assigned.

This is the canonical place to maintain element-to-tree metadata. The tree editor can provide the same assignment controls in a tree-centric layout.

### Practice quiz wizard

Modify:

- `apps/frontend-manage/src/components/activities/creation/practiceQuiz/PracticeQuizWizard.tsx`
- `PracticeQuizInformationStep.tsx`
- `PracticeQuizSettingsStep.tsx`
- `StackCreationStep.tsx`
- `submitPracticeQuizForm.ts`

Wizard changes:

- Add a mode selector: standard or adaptive.
- Standard mode keeps the existing stack workflow.
- Adaptive mode replaces the stack step with:
  - competence tree selection,
  - ability to link a reusable tree into the target course if the lecturer has permission,
  - tree preview,
  - enabled node toggles,
  - quiz-specific top-level weight overrides,
  - element preview from the selected tree,
  - element enabled/disabled toggles,
  - advanced adaptive preset/settings section.
- Validation differs by mode:
  - `STANDARD` requires stacks and elements as today.
  - `ADAPTIVE` requires a competence tree and at least one enabled leaf with enabled elements.
- Publishing an adaptive quiz runs the readiness checklist.

### Student PWA

Modify:

- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
- `apps/frontend-pwa/src/components/practiceQuiz/*`
- Remove or redirect the standalone adaptive route once migrated:
  - `apps/frontend-pwa/src/pages/course/[courseId]/adaptive-learning.tsx`

Adaptive mode behavior:

- Same practice quiz URL.
- Intro screen before starting:
  - purpose,
  - expected length,
  - retake/resume policy,
  - optional self-assessment warmup if enabled.
- Start/resume label is explicit.
- No blocking browser-back trap. Attempts are resumable.
- Use shared student element renderers so KPRIM behaves correctly.
- Hide live theta and level by default.
- Show honest progress: "Question N, at most M".
- Final result shows the student's overview as level bands:
  - overall level band with the final estimate marker and confidence interval,
  - one band per enabled top-level competence,
  - optional leaf subcompetence bands when configured,
  - "insufficient data" instead of a level band for nodes with too few responses.
- Level bands must use the shared backend boundary helper so the marker, badge, and assigned level cannot disagree.
- No answer keys are sent before completion. Post-answer feedback is a separate future option and must be phase-aware.

### Lecturer results

Modify:

- `apps/frontend-manage/src/pages/practiceQuiz/[id]/evaluation.tsx`
- or add adaptive-specific result panels under the existing practice quiz evaluation route.

Results panels:

- Overall anonymous level distribution.
- Competence anonymous level distributions.
- Leaf subcompetence anonymous level distributions.
- Insufficient-data and abandoned counts.
- Stop reasons: classification, cap, coverage, abandoned.
- Item analytics:
  - exposure,
  - observed accuracy,
  - expected accuracy at cohort mean theta,
  - misfit flag when enough responses exist.

Privacy:

- Suppress or aggregate buckets with very small counts if required by product policy.
- Default to aggregate anonymous results. Do not default to BEST attempt; use latest completed attempt for classification summaries.

## Migration strategy

### Branch and CI first

Before large changes:

- Rebase onto `v3`.
- Fix adaptive package build order in CI.
- Add package tests to CI.
- Ensure seeds are additive and do not break existing Cypress specs.

### Data migration from standalone adaptive assessments

If existing PR data must be preserved:

1. For each `AdaptiveAssessment`, create one `CompetenceTree`.
2. Convert levels to `CompetenceTreeLevel`.
3. Convert competences and subcompetences to `CompetenceTreeNode`.
4. Convert `AdaptiveAssessmentElement` to `CompetenceTreeElementAssignment`.
5. Create a `PracticeQuiz` with `mode = ADAPTIVE` and a matching `PracticeQuizAdaptiveConfig`.
6. Convert attempts/responses to adaptive practice quiz attempts/responses.
7. Convert final estimates to `AdaptivePracticeQuizEstimate`.
8. Archive or delete old adaptive assessment tables only after validation.

If no real data exists yet, prefer a clean migration:

- Create new models.
- Update seed data to use competence trees and adaptive practice quizzes.
- Delete standalone adaptive assessment models and routes before merge.

### Cross-course tree reuse

Tree reuse is a first-class requirement:

- Creating a tree does not bind it to exactly one course.
- Linking a tree to a course creates a `CompetenceTreeCourse` row.
- A practice quiz can select any tree linked to its course, plus any reusable tree the user has permission to link.
- Quiz-specific enabled nodes, weights, and element toggles stay in `PracticeQuizAdaptiveConfig` and never mutate the reusable tree.
- Element assignments belong to the reusable tree. If a course needs a different item pool for the same structure, the lecturer should duplicate the tree or create a tree variant.

### Remove standalone activity surface

After adaptive mode works inside practice quizzes:

- Remove manage page `apps/frontend-manage/src/pages/courses/[id]/adaptive-learning.tsx`.
- Remove PWA page `apps/frontend-pwa/src/pages/course/[courseId]/adaptive-learning.tsx`.
- Remove standalone adaptive GraphQL ops.
- Remove standalone adaptive queries/mutations from schema.
- Keep shared adaptive components only if they are used by practice quiz editor/results.

## Implementation phases

### Phase 0: Safety and baseline

Purpose: make the current branch safe enough to evolve.

Tasks:

- Delete unused participant `publishedAdaptiveAssessments` query or make it participant-safe immediately.
- Ensure participant attempt state never exposes raw assessment elements, correct flags, solutions, discrimination, or level mappings for unseen items.
- Add course-participation checks to participant-facing listings.
- Gate or remove pre-answer `showSolutions`; seed with `showSolutions = false`.
- Add served-item integrity:
  - persist next served assignment/element,
  - submit must match it,
  - unique response per attempt and assignment,
  - single transaction for grade, response insert, estimate, and attempt update.
- Add element ownership permission checks.
- Add service tests for the security and integrity blockers.

Acceptance checks:

- Handcrafted participant GraphQL query cannot fetch answer keys.
- Duplicate submit returns current state or a controlled error.
- Submitting an unserved item is rejected.
- Foreign private element assignment is rejected.

### Phase 1: Core data model

Purpose: introduce reusable competence trees and adaptive practice quiz config.

Tasks:

- Add Prisma enums and models.
- Add `PracticeQuiz.mode`.
- Add migrations, including partial unique index for in-progress attempts.
- Add relation fields to `Course`, `User`, `Element`, `PracticeQuiz`, `Participant`, and `Participation` as needed.
- Generate Prisma client.
- Add seed data for a small adaptive practice quiz using a competence tree.

Acceptance checks:

- `pnpm --filter @klicker-uzh/prisma generate` succeeds.
- Migration applies to a clean database.
- Seed creates at least one competence tree with levels, nested leaves, assignments, course links, and adaptive practice quizzes in more than one course or a documented reuse fixture.

### Phase 2: Adaptive package and measurement engine

Purpose: make the psychometrics consistent and testable before UI work.

Tasks:

- Update defaults and mapping helpers in `packages/adaptive-learning`.
- Add mapping rule support.
- Add classification-stop helpers.
- Add posterior SE with prior.
- Add randomesque item selection.
- Add threshold reachability utilities.
- Port `project/adaptive-learning-sweep-harness.mjs` into package tests.
- Re-baseline accuracy and mean length for presets.

Acceptance checks:

- One correct answer no longer maps to theta range max under MAP routing.
- Frontend band helpers and backend level mapping use the same boundary function.
- Simulation exercises production-shaped selection and stopping.
- CI fails if exact/adjacent accuracy or length budget regresses beyond agreed tolerance.

### Phase 3: GraphQL services

Purpose: expose competence trees and adaptive practice quiz mode safely.

Tasks:

- Implement `competenceTrees.ts`.
- Implement `adaptivePracticeQuizzes.ts`.
- Add Pothos schema types and inputs.
- Add GraphQL operation files and run codegen.
- Extend create/edit practice quiz mutations to accept adaptive mode.
- Add participant-safe attempt state and submit mutations.
- Add anonymous adaptive results query.
- Keep compatibility wrappers only if migration requires them.

Acceptance checks:

- All participant payloads are sanitized.
- All lecturer mutations enforce course/object permissions.
- Service tests cover create tree, assign element, create adaptive quiz, start, submit, finish, resume, abandon, and results.

### Phase 4: Manage UI

Purpose: make authoring ergonomic and reduce misconfiguration.

Tasks:

- Build competence tree list/editor.
- Add adaptive mapping controls to element editing.
- Update practice quiz wizard with mode-specific steps.
- Add tree preview, node toggles, weight overrides, and element toggles.
- Add readiness checklist and warnings.
- Add i18n in `packages/i18n` for EN and DE.
- Add `data-cy`.

Acceptance checks:

- Lecturer can create a tree with nested leaves up to depth 5.
- Lecturer cannot exceed depth 5.
- Lecturer can map an element to a tree leaf and level.
- Lecturer can create an adaptive practice quiz from the tree.
- Publish is blocked or warned when coverage is insufficient.
- `npx agent-browser` screenshots verify the creation flow.

### Phase 5: Student PWA runner

Purpose: deliver adaptive practice through the existing practice quiz URL.

Tasks:

- Route practice quiz detail page by `mode`.
- Build adaptive intro/resume/runner/completed states.
- Reuse shared student element rendering.
- Implement KPRIM explicit true/false handling through shared components.
- Hide live estimate by default.
- Show honest progress.
- Add optional self-assessment warmup if enabled.
- Add i18n.

Acceptance checks:

- Student opens a published adaptive practice quiz from the normal practice quiz list.
- Student sees intro, starts, answers, resumes after reload, and completes.
- No answer key appears in network payload before completion.
- `npx agent-browser` screenshots verify before/after answering and completion.

### Phase 6: Results, analytics, and calibration signals

Purpose: make lecturer overview useful without exposing student identities by default.

Tasks:

- Persist final estimates at overall, competence, and leaf level.
- Add anonymous distribution panels.
- Add stop-reason panel.
- Add item exposure and misfit table.
- Default to latest completed attempt.
- Mark stale in-progress attempts as abandoned lazily or via scheduled task.
- Store per-question elapsed deltas, not cumulative wall clock only.
- Memoize or persist result aggregates to avoid recomputing IRT on every dashboard load.

Acceptance checks:

- Results load from persisted estimates, not by recomputing every response on each request.
- Lecturer sees anonymous level distributions for overall, competences, and leaves.
- Abandoned and insufficient-data attempts are visible as categories.
- Item misfit flags appear only when enough responses exist.

### Phase 7: Cleanup and rollout

Purpose: remove duplicate surfaces and prepare for real pilots.

Tasks:

- Remove standalone adaptive assessment routes, ops, and pages.
- Delete old standalone models if no migration compatibility is needed.
- Squash or consolidate migrations before merge if the branch has not deployed.
- Add docs in `apps/docs`:
  - competence tree concepts,
  - item pool sizing,
  - why levels affect test length,
  - what weights mean,
  - why estimates are nominal until calibrated,
  - recommended item types.
- Add Playwright or Cypress happy path:
  - lecturer creates tree,
  - maps elements,
  - creates adaptive practice quiz,
  - publishes,
  - student completes,
  - lecturer sees anonymous results.
- Run browser verification with `npx agent-browser` for all changed frontend flows.

Acceptance checks:

- No participant route or GraphQL op references standalone adaptive assessments.
- Docs explain the product in lecturer language.
- `pnpm --filter @klicker-uzh/adaptive-learning test` passes.
- Targeted GraphQL and frontend checks pass.
- Frontend work has before/after screenshots reviewed.

## Testing strategy

### Unit tests

- `packages/adaptive-learning/test/index.test.ts`
  - mapping rules,
  - boundary equality,
  - posterior SE,
  - MAP first-answer behavior,
  - randomesque selection,
  - classification stop.
- Numerical normalization helper tests:
  - decimal comma,
  - Unicode minus,
  - spaces/apostrophes as thousands separators,
  - scientific notation,
  - simple fractions,
  - ambiguous mixed separators rejected,
  - percent accepted only when explicitly enabled.
- `packages/adaptive-learning/test/simulation.test.ts`
  - preset accuracy,
  - adjacent accuracy,
  - mean length,
  - misspecification stress tests.

### Service tests

Use the existing `packages/graphql/test` pattern.

Required cases:

- Competence tree max-depth validation.
- Tree must have at least one competence and one leaf per competence.
- Element assignment requires permission and supported type.
- Reusable competence tree can be linked to multiple courses and selected by adaptive practice quizzes in each linked course.
- Numerical adaptive responses are normalized before grading and keep raw response metadata.
- Adaptive practice quiz requires selected tree and enabled elements.
- Start returns existing in-progress attempt.
- Submit rejects unserved assignment.
- Submit idempotency on retry.
- Completion persists estimates.
- Participant payload is sanitized.
- Anonymous results group by overall, competence, and leaf levels.

### Frontend verification

Any frontend work must use `npx agent-browser`.

Minimum screenshots:

- Competence tree editor before and after creating a nested tree.
- Element adaptive mapping panel.
- Practice quiz wizard adaptive mode tree preview and item preview.
- Student intro.
- Student active question.
- Student completion with overall and competence level bands.
- Lecturer anonymous results.

## Rollout plan

1. Merge core package and model work behind an internal feature flag.
2. Enable tree editor for internal test courses only.
3. Enable adaptive practice quiz creation for internal users.
4. Run seeded local and staging flow with test participants.
5. Run known-level dry run for the first real use case.
6. Go live only when:
   - exact classification >= 0.70 against teacher judgment,
   - adjacent classification >= 0.95,
   - median completion time <= 25 minutes for the target course,
   - no item exposure exceeds 40 percent of completed attempts,
   - no answer-key leak is possible through participant payloads.

## Open decisions

1. Should reusable competence trees use the full catalog/object sharing system immediately, or start with a simpler owner/team plus course-link model?
2. Should result distributions suppress small buckets by policy, and what minimum count should be used?
3. Should `MASTERY` or `NEAREST` be the default for non-language adaptive practice quizzes?
4. Should self-assessment warmup be part of v1 or a follow-up after core adaptive mode is stable?
