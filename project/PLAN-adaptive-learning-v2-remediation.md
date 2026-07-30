# Adaptive Learning v2 Remediation Plan

Date: 2026-07-07

This plan supersedes the implementation order in
`project/PLAN-adaptive-learning-v2.md` where the reviews exposed unresolved
blockers. It is based on:

- `project/REVIEW-adaptive-learning-pr5113.md`
- `project/2026-07-07-adaptive-learning-pr5113-review.md`
- `project/2026-07-07-adaptive-learning-consolidated-review.md`
- `project/2026-07-07-adaptive-learning-v2-review.md`

The key conclusion from the reviews is that the competence-tree/practice-quiz
direction is correct, but the old standalone adaptive surface is still live and
contains most of the critical security, integrity, data-loss, and UX defects.
New adaptive practice-quiz work should not continue on top of that surface.

## Non-Negotiable Decisions

1. Adaptive learning is implemented as a mode of practice quizzes, not as a
   standalone activity.
2. Competence trees are reusable across courses and are linked to courses by
   access/usage records, not owned by a single course.
3. Competence trees are built from competences and recursive subcompetences up
   to `MAX_COMPETENCE_TREE_DEPTH = 5`.
4. Valid element types for competence-tree coverage are Numerical, SC, MC,
   KPRIM, and Free Text. Case studies, content, and selection elements are out
   of scope for the first production version.
5. Item parameter `b` is selected at the element based on the assigned level.
   Item parameter `c` is inferred from element type. Item parameter `a` uses the
   calibrated value when available and otherwise a reviewed default by element
   type.
6. Old standalone adaptive-learning pages, GraphQL operations, and resolver
   entry points are removed before new runtime work proceeds.
7. Result views never expose answer keys, live theta values, or identifiable
   per-student adaptive results. Student-facing completion uses level bands.
   Lecturer-facing aggregate results are anonymous and suppress small buckets.
8. Node 24 runtime changes are split from the adaptive-learning remediation, or
   completed consistently across package engines, Dockerfiles, workflows, and CI
   in a separate PR. The adaptive branch should not carry a partial Node bump.

## Phase 0: Stop Shipping The Old Standalone Surface

This is the highest-priority fix. The old standalone surface contains the
reviewed critical issues: solution leakage, missing participation checks,
non-atomic destructive edits, arbitrary/repeated submissions, weak ownership
checks, and UX that contradicts the new direction.

### 0.1 Split Or Finish The Node Runtime Change

Default action: remove the Node 24 bump from the adaptive-learning branch and
track it in a separate runtime PR.

If the team decides to keep Node 24 in this branch, complete it before any
adaptive work:

- Root Volta pin.
- All app/package `engines.node`.
- All Docker base images.
- All GitHub Actions `node-version` values.
- Any local test runner assumptions.

Acceptance:

- No mixed Node 20/24 pins remain in the same branch.
- CI setup jobs use the same Node major as package engines.
- Runtime bump has its own verification record.

### 0.2 Remove Standalone Adaptive Routes And Operations

Remove the old activity-style adaptive learning entry points instead of trying
to harden a surface that is no longer the product direction.

Backend removals:

- Remove old adaptive-learning query fields from
  `packages/graphql/src/schema/query.ts`.
- Remove old adaptive-learning mutation fields from
  `packages/graphql/src/schema/mutation.ts`.
- Remove old standalone GraphQL operation files under
  `packages/graphql/src/graphql/ops/` that target `AdaptiveAssessment`.
- Regenerate GraphQL artifacts after operation/schema removal.
- Keep old Prisma models only temporarily if needed for migration continuity;
  do not expose them through GraphQL.

Frontend removals:

- Remove `apps/frontend-manage/src/pages/courses/[id]/adaptive-learning.tsx`.
- Remove `apps/frontend-pwa/src/pages/course/[courseId]/adaptive-learning.tsx`.
- Remove navigation links, generated hooks, and local helpers that only support
  the standalone activity.

Seed/data removals:

- Remove or disable old adaptive assessments from `seedTEST.ts`, especially any
  published assessment with `showSolutions: true`.

Acceptance:

- The old standalone adaptive-learning pages are unreachable.
- The public GraphQL schema no longer exposes old standalone adaptive
  assessment operations.
- No participant operation can fetch full answer keys or solution text through
  the adaptive activity path.
- No generated frontend hook references old standalone adaptive operations.

### 0.3 If Temporary Retention Is Forced

This is not the preferred path. If the old surface must survive for one release,
apply the original Phase 0 hardening before enabling any pilot:

- Redact `choices.correct`, `solutions`, and sample solutions from participant
  payloads until after the relevant answer is finalized and visibility permits
  disclosure.
- Require participation and quiz visibility for all participant reads.
- Require served-item ownership for answer submission.
- Reject repeated submissions unless the response is explicitly idempotent.
- Wrap save/update operations in one transaction.
- Stop deleting attempts/responses/configs on edit.
- Replace raw owner checks with the shared permission system.
- Remove `showSolutions` debug behavior from adaptive participant flows.

## Phase 1: Fix The New Foundation Before Service Work

The new adaptive package and schema are a good foundation, but several reviewed
defects must be fixed before they become runtime contracts.

### 1.1 Fix Mastery Level Geometry

Problem:

- Current MASTERY mapping creates a degenerate top band because the top band
  starts at `thetaMax`. A classification stop can never prove the top level
  under finite standard error.

Decision:

- Keep NEAREST as midpoint-based placement.
- Change MASTERY to shifted lower-bound anchors:
  `lower_k = thetaMin + k * (thetaMax - thetaMin) / levelCount`.
- Band `k` is `[lower_k, lower_{k + 1})`, with the top band ending at
  positive infinity.
- Keep this mapping in the adaptive package and consume it from frontend and
  backend code. Do not duplicate band math.

Tests:

- Top-band classification stop can fire.
- A perfect high-ability simulated scorer can end in the top level.
- Boundary behavior is deterministic and documented.
- NEAREST behavior remains unchanged.

### 1.2 Fix Numeric Normalization

Problem:

- `1,200` currently normalizes to `1.2`, which is unsafe for mixed locale input.

Decision:

- Reject a single comma followed by exactly three digits as ambiguous unless a
  later locale-specific parser is introduced.
- Accept unambiguous decimal comma inputs such as `1,2`.
- Accept standard decimal point input.
- Keep percent handling outside the global practice-quiz adaptive config.

Tests:

- `1,2` parses as `1.2`.
- `1.20` parses as `1.2`.
- `1,200` is rejected as ambiguous.
- Percent normalization is covered at the element or assignment layer.

### 1.3 Move Percent Input To The Right Layer

Problem:

- `enablePercentInput` on `PracticeQuizAdaptiveConfig` is too broad. Percent
  interpretation depends on the specific numerical item or assignment context.

Decision:

- Remove `enablePercentInput` from the practice-quiz adaptive config.
- Add percent-input configuration at the numerical element assignment layer, or
  on the element-level adaptive metadata if that matches existing element edit
  ownership better.
- Keep normalization deterministic in the adaptive package.

Acceptance:

- Different numerical elements in the same adaptive quiz can use different
  percent settings.
- Backend and frontend previews show the effective setting per element.

### 1.4 Fix Schema Integrity

Required schema fixes:

- Add explicit FK relations for adaptive attempt `nextAssignmentId` and
  `finalLevelId`, with `onDelete: SetNull`.
- Add explicit `map:` names for long indexes and constraints so PostgreSQL
  identifiers stay below 63 characters.
- Add `linkedById` and a user relation to course/tree link records.
- Preserve response and estimate history when users, trees, or quizzes are
  archived or deleted.
- Add a documented account-deletion policy for users who created trees with
  responses: soft-delete, reassign to a system user, or block deletion with a
  clear remediation workflow.

Acceptance:

- `prisma validate` passes.
- Generated SQL has no truncated, colliding, or unreadable index names.
- Deleting or anonymizing a lecturer account cannot hard-fail because of
  adaptive response/config references.

### 1.5 Validate Tree Shape And Weights

Rules:

- Maximum depth is `MAX_COMPETENCE_TREE_DEPTH = 5`.
- A competence tree must have at least one top-level competence.
- A competence must have at least one leaf subcompetence before publication.
- Published adaptive trees require at least two levels; three or more levels are
  recommended and should be warned for if missing.
- Weights can be authored on nodes for future use, but v2 quiz scoring uses
  normalized top-level competence weights for overall aggregation.
- Leaf and intermediate weights must either be validated for their documented
  scope or ignored with an explicit comment and UI copy.

Acceptance:

- Draft trees can be incomplete.
- Publishing blocks invalid depth, missing leaves, zero/negative effective
  weights, and too few levels.
- The service has a single normalization helper for weights.

### 1.6 Define Permission Semantics Before Resolvers

Tree permissions:

- Tree CRUD uses the existing permission system, not raw owner-id checks.
- Course-tree linking requires manage/admin permission on the course and access
  to the tree.
- Trees can be reused across courses through link records.

Element assignment permissions:

- Assigning an element to a tree leaf requires permission to edit the element
  and access to the target tree.
- Assignment to a leaf from an unrelated or inaccessible tree is rejected.

Participant permissions:

- Starting or continuing an adaptive practice quiz requires course
  participation, quiz visibility, and access to the specific attempt.
- Submitting an answer requires ownership of the attempt and a currently served
  assignment.

Results permissions:

- Lecturer aggregate results require quiz/course management permission.
- Results are anonymous.
- Leaf-level buckets with fewer than five participants are suppressed.

### 1.7 Define Effective Override Precedence

Use one backend helper and share its output with previews and runtime.

Enabled status:

```text
effectiveEnabled =
  assignment.enabled
  AND coverage.enabled
  AND nodeOverride.enabled
  AND elementOverride.enabled
```

Default missing overrides to enabled unless the relevant parent object is
disabled.

Discrimination `a`:

```text
calibrated item a
  > element adaptive override
  > quiz assignment override
  > quiz adaptive config default
  > competence tree default
  > package fallback by element type
```

Difficulty `b`:

```text
selected level coverage b
  > tree level b
  > package mapping fallback
```

Guessing `c`:

```text
inferred from element type and answer structure
```

Examples:

- SC with four options uses `c = 0.25`.
- MC uses a low pseudo-guessing fallback unless calibrated later.
- KPRIM uses its reviewed fallback.
- Free Text and Numerical use `c = 0`.

## Phase 2: Build The New Backend Product Surface

Only start this phase after Phase 0 and Phase 1 blockers are resolved.

### 2.1 Competence Tree CRUD

Implement services and GraphQL operations for:

- Create, update, archive, duplicate, and list reusable competence trees.
- Manage tree levels and level coverage values.
- Manage competences and recursive subcompetences up to depth 5.
- Assign and normalize weights.
- Link/unlink trees to courses.
- Validate publish readiness.
- Preview coverage by leaf, level, element type, and effective enablement.

Acceptance:

- A tree can be reused across multiple courses without duplicating the tree.
- Course-specific access is represented by link records.
- Invalid trees stay draft-only.

### 2.2 Element Assignment To Competence Leaves

Implement assignment from valid element types to competence-tree leaves.

Supported first-release types:

- Numerical
- SC
- MC
- KPRIM
- Free Text

Assignment fields:

- Tree id.
- Leaf node id.
- Level id or level value.
- Optional element-specific overrides.
- Effective `a`, `b`, `c` preview.
- Enabled/disabled flag.

Acceptance:

- An element cannot be assigned to a non-leaf node.
- An element cannot be assigned to a tree the editor cannot access.
- A level must be selected for every assignment.
- The preview displays normalized numeric settings and inferred guessing.

### 2.3 Practice Quiz Adaptive Mode

Add adaptive mode to practice quizzes instead of a separate activity.

Authoring flow:

- Select adaptive mode while creating/editing a practice quiz.
- Select a reusable competence tree.
- Preview tree competences and subcompetences.
- Enable/disable competences and leaves for this quiz.
- Adjust quiz-specific top-level weights.
- Preview all mapped elements in the selected tree.
- Enable/disable mapped elements for this quiz.
- Block publish when enabled leaf-level coverage has zero items.
- Warn when pool size is below target or SE thresholds are unreachable.

Runtime config:

- Mapping rule, default `MASTERY` for placement/mastery.
- Question cap.
- Classification confidence.
- Randomesque top-K.
- Exposure penalty.
- Strong prior for routing.
- Weak final prior or WLE for final reporting.

Acceptance:

- Adaptive mode lives on the practice quiz model/API/UI.
- Non-adaptive practice quizzes keep their current behavior.
- Publish validation catches empty enabled leaf/level cells.

### 2.4 Adaptive Attempt Runtime

Implement attempt runtime under practice-quiz participation.

Rules:

- Start creates or resumes an in-progress attempt according to quiz retake
  policy.
- Runtime persists the currently served assignment.
- Submission must match the served assignment.
- Repeated submissions are idempotent only for the same answer payload before
  advancement; otherwise reject.
- Response grading, estimate update, next-item selection, and attempt state
  update happen in one transaction.
- Attempts can be completed, abandoned, or superseded without deleting history.

Estimator and stopping:

- Use MAP or equivalent prior-stabilized estimate during routing.
- Use classification-aware stopping: stop when the confidence interval is fully
  inside one level band.
- Aggregate subcompetence estimates into competence estimates, then aggregate
  competence estimates into overall estimates using normalized top-level
  weights.
- Store response-level theta snapshots and final level ids.

Acceptance:

- Participants cannot answer arbitrary enabled items.
- Participants cannot submit against another participant's attempt.
- Attempt history survives quiz edits.
- Completion returns level-band results, not raw theta.

### 2.5 Aggregate Results

Lecturer result overview:

- Anonymous distribution of overall categorized levels.
- Anonymous distribution by top-level competence.
- Anonymous distribution by subcompetence/leaf.
- Suppress buckets with fewer than five participants.
- Report insufficient-data and abandoned attempts separately.
- Paginate or aggregate in the database; do not recompute unbounded result sets
  in application memory.

Student completion view:

- Overall level band.
- Competence-level bands.
- Subcompetence-level bands when enough evidence exists.
- Clear mastery-specific language, especially when MASTERY mapping is used.
- No live ability display during the quiz.
- No answer key leakage through result payloads.

Acceptance:

- Lecturer results remain anonymous.
- Student result payloads contain only the student's own categorized outcome.
- Small leaf cohorts cannot be reverse engineered.

## Phase 3: Simulation, Calibration, And Measurement Gates

### 3.1 Port The Simulation Sweep Harness

The old simulation does not validate the product runtime. Port a production
shaped harness into the adaptive package and service tests.

The harness must exercise:

- Production mapping rules.
- Production item selection.
- Randomesque top-K selection.
- Exposure penalty.
- Classification-aware stopping.
- Strong prior routing.
- Weak final estimate.
- Element-type guessing values.
- Competence and subcompetence aggregation.

Acceptance thresholds for the initial gate:

- Exact level classification at least 70 percent in the reference pool.
- Adjacent-or-exact classification at least 95 percent.
- Median length within the configured question budget.
- Top-band MASTERY classification reachable.
- No SE threshold preset that is mathematically unreachable for the item pool.

### 3.2 Add Pool Reachability Validation

Use item information to validate whether stop settings are reachable.

Rules:

- Compute the minimum reachable standard error from the enabled pool and
  guessing parameters.
- Block publish for enabled leaf/level cells with zero items.
- Warn for pools below target item count.
- Warn or block standard-error thresholds that cannot be reached before the
  question cap.
- Prefer classification-interval stopping over raw SE-only stopping.

### 3.3 Pilot Calibration Workflow

Before broad rollout:

- Use at least two independent levelers for initial item level assignment.
- Reconcile item level disagreements before publication.
- Track empirical item difficulty and discrimination after pilot usage.
- Flag misfitting items.
- Keep calibrated parameters separate from author defaults.

## Phase 4: Frontend And UX Implementation

Frontend work starts after backend contracts and generated operations are
stable. Any frontend change requires local browser verification with
`npx agent-browser`.

### 4.1 Competence Tree Editor

Build a reusable tree editor for lecturers.

Capabilities:

- Create/edit tree metadata.
- Add, reorder, and archive competences/subcompetences.
- Enforce maximum depth 5.
- Manage levels and coverage values.
- Assign weights.
- Show publish readiness.
- Show course links.
- Preview mapped elements by leaf and level.

UX rules:

- Use existing design-system patterns.
- Keep dense operational screens utilitarian.
- Do not use card-in-card layouts.
- Do not expose psychometric internals unless needed for expert authoring.

### 4.2 Element Editor Integration

Add competence-tree assignment controls to valid element editors.

Controls:

- Tree selector.
- Leaf selector.
- Level selector.
- Element-specific numeric normalization settings where relevant.
- Effective `a`, `b`, `c` preview.

Do not add this to case studies, content, or selection elements in v2.

### 4.3 Practice Quiz Adaptive Mode UI

Add adaptive mode to practice quiz create/edit.

Screens:

- Mode selector.
- Competence tree selector.
- Tree preview.
- Competence/leaf enablement controls.
- Quiz-specific weight overrides.
- Element pool preview with enable/disable controls.
- Publish validation summary.

Acceptance:

- Empty enabled leaf/level coverage blocks publish.
- Low coverage and unreachable stop settings warn clearly.
- Owners can see why an element is or is not part of the quiz.

### 4.4 Student Runtime And Completion UI

Student runtime:

- Start/resume screen.
- No live theta or misleading precision.
- Stable rendering for SC, MC, KPRIM, Free Text, and Numerical using shared
  components where possible.
- Completion view with level bands.

Completion view:

- Overall band.
- Competence bands.
- Subcompetence bands where evidence supports them.
- Mastery-specific explanation when using MASTERY mapping.
- No answer keys unless normal practice-quiz solution visibility explicitly
  allows them after completion.

### 4.5 Internationalization, Accessibility, And Test Hooks

Required:

- All visible text in i18n files.
- Keyboard-accessible tree editing and quiz controls.
- Useful empty, loading, error, and archived states.
- `data-cy` hooks for key flows.
- Agent-browser before/after screenshots for manage and PWA flows.

## Phase 5: Verification And Rollout

### 5.1 Automated Tests

Required test coverage:

- Adaptive package unit tests for mapping, normalization, guessing, information,
  stopping, and simulation gates.
- GraphQL service tests for permissions, tree CRUD, course linking, element
  assignment, quiz adaptive config, attempt submission, idempotency, and result
  suppression.
- Prisma validation/generation.
- Frontend component tests where local state or rendering logic is non-trivial.
- E2E or browser-driven happy path:
  create tree -> assign elements -> create adaptive practice quiz -> publish ->
  student completes -> lecturer sees anonymous aggregate.

### 5.2 Required Commands

Run the narrowest reliable checks after each phase, then broader checks before
merge:

```bash
pnpm --filter @klicker-uzh/adaptive-learning test
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-pwa check
pnpm run format:check
```

When schema changes are ready:

```bash
pnpm run prisma:migrate
pnpm run prisma:sync
pnpm --filter @klicker-uzh/prisma generate
```

Do not rely on `pnpm run test:run` alone in local development because the repo
notes document DB/Cypress prerequisites.

### 5.3 Rollout Gates

Before pilot:

- Old standalone adaptive surface removed or fully inaccessible.
- No answer-key leakage in participant payloads.
- Tree/quiz authoring permissions tested.
- Attempt submission integrity tested.
- Simulation gates passing.
- Publish validation blocks empty coverage.
- Student completion bands verified in browser.
- Lecturer aggregate result suppression verified.
- Account deletion/anonymization behavior decided and tested.

Before production:

- Pilot data reviewed for item misfit and level disagreement.
- Calibrated item parameters stored separately from author defaults.
- Documentation updated for lecturers.
- Monitoring covers abandoned attempts, insufficient evidence, item exposure,
  average length, and classification distribution.

## Review Finding Coverage

This table maps the reviewed findings to the remediation phases. A finding is
not considered fixed until the acceptance criteria in the target phase pass.

| Finding area | Review references | Remediation |
| --- | --- | --- |
| Old standalone adaptive surface remains live | v2 A1, U1; PR5113 Phase 0; second review F6-F12, F28-F30 | Phase 0.2 removes pages, ops, schema fields, and resolver entry points. |
| Solution and answer-key leakage | PR5113 critical; second review F12, F28 | Phase 0 removes old surface; Phase 2.4 and 2.5 prohibit key leakage in new payloads. |
| Missing participation and visibility checks | PR5113 critical; second review F8, F11, F29 | Phase 1.6 defines permissions; Phase 2.4 implements attempt ownership and served-item checks. |
| Destructive/non-atomic edits | PR5113 critical; second review F6, F7, F10, F30 | Phase 0 removes old mutators; Phase 2.4 uses transactional updates and history preservation. |
| Arbitrary or repeated submissions | PR5113 critical; second review F8, F9 | Phase 2.4 persists served assignments and defines idempotency. |
| Raw owner checks instead of permission system | v2 A2; second review F11 | Phase 1.6 requires shared permission semantics before resolvers. |
| Account deletion hard-fails or destroys history | v2 A3; second review F10 | Phase 1.4 requires deletion/anonymization policy and schema support. |
| MASTERY top band cannot be reached | v2 P1 | Phase 1.1 changes MASTERY geometry and adds top-band tests. |
| Numeric comma ambiguity | v2 P2 | Phase 1.2 rejects ambiguous thousands-style comma input. |
| Percent input at wrong layer | v2 P3 | Phase 1.3 moves percent handling to assignment/element metadata. |
| One-level scale allowed | v2 P4 | Phase 1.5 validates level count for publish. |
| Simulation validates wrong system | v2 P5; PR5113 measurement; second review F13-F18, F34 | Phase 3 ports production-shaped simulation gates. |
| Dead new helpers not wired to services | v2 C1 | Phase 2 runtime consumes package helpers for mapping, stopping, and normalization. |
| Legacy defaults linger | v2 C2; PR5113 defaults | Phase 2.3 defines reviewed adaptive practice-quiz defaults. |
| Frontend band mismatch | v2 C3; PR5113 measurement; second review F15 | Phase 1.1 centralizes band math; Phase 4 consumes generated/shared helper output. |
| Long Prisma index names | v2 Q2 | Phase 1.4 adds explicit short `map:` names. |
| Bare FK ids for next assignment/final level | v2 Q3 | Phase 1.4 adds relations with `onDelete: SetNull`. |
| Override precedence undefined | v2 Q4 | Phase 1.7 defines one effective-config helper. |
| Node 24 partial bump | v2 Q1; second review F1-F5 | Phase 0.1 splits or completes runtime change consistently. |
| Coverage matrix and publish readiness missing | v2 U3; second review F21, F32 | Phase 2.3 and 3.2 block empty coverage and warn on unreachable settings. |
| Anonymous aggregate result requirements | user request; v2 A2; second review F31 | Phase 2.5 defines anonymous distributions and bucket suppression. |
| Student completion result bands | user request; v2 U2 | Phase 2.5 and 4.4 return and render level bands. |
| KPRIM/shared rendering/i18n/accessibility gaps | PR5113 UX; second review F19-F27 | Phase 4 uses shared components, i18n, a11y, and browser verification. |
| Element type scope | user request | Phase 2.2 limits v2 to Numerical, SC, MC, KPRIM, and Free Text. |
| Cross-course reusable trees | user request | Phase 1.4 and 2.1 use reusable trees plus course link records. |

## Immediate Implementation Order

1. Decide Node branch hygiene and execute it before more adaptive changes.
2. Remove the old standalone adaptive-learning public surface.
3. Fix adaptive package MASTERY and numeric normalization tests.
4. Fix Prisma schema integrity issues in the new competence-tree models.
5. Implement permission and effective-config helpers with tests.
6. Implement competence tree CRUD and course links.
7. Implement element-to-leaf assignment.
8. Add adaptive mode to practice quiz authoring.
9. Implement adaptive practice-quiz attempt runtime.
10. Implement anonymous aggregate and student banded results.
11. Port the production-shaped simulation harness.
12. Build and verify the frontend flows with `npx agent-browser`.
