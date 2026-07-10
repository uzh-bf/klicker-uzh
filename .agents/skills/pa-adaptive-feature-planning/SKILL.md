---
name: pa-adaptive-feature-planning
description: Turn adaptive-learning reviews, reference prototypes, and partial implementations into evidence-backed, implementation-ready production plans. Use when planning or replanning competence-tree-based adaptive quizzes or assessments, reconciling multiple reviews, adapting an external UX concept to an existing product, defining hierarchical psychometric aggregation and uncertainty, or sequencing adaptive-learning work across data, API, permissions, UI, testing, pilot, and rollout.
---

# Adaptive Feature Planning

Create one canonical plan that reconciles product intent, current code, didactics, psychometrics, security, UX, and production constraints. Treat prototypes as inspiration and repository behavior as evidence.

## Workflow

### 1. Establish Scope And Evidence

1. Locate every review, plan, architecture note, reference prototype, relevant schema, service, UI route, test, migration, and recent commit.
2. Read the active engineering wiki pages and the repository's feature-design instructions before proposing changes.
3. Inspect visual references in a browser when layout or interaction matters. Inventory their useful concepts separately from their styling and domain assumptions.
4. Build an evidence matrix with four columns: requirement/finding, implemented state, evidence, and required plan action.
5. Distinguish `implemented`, `partial`, `planned`, `legacy`, and `contradicted`. Do not mark a review item fixed because a model or helper merely exists.

Use [planning-checklist.md](references/planning-checklist.md) for a full production audit. For a narrow planning task, load only the relevant checklist sections.

### 2. Lock Domain And Product Decisions

State these decisions before writing implementation slices:

- Existing activity type or genuinely new activity.
- Author/owner actor versus participant/student actor.
- Reusable authoring object versus activity-specific configuration.
- Mutable source item versus immutable published/delivered snapshot.
- Hierarchy semantics, assignable nodes, maximum depth, and weight scope.
- Supported and excluded item types.
- Item parameter source and calibration policy.
- Presets, attempt policy, stopping policy, feedback, gamification, and result language.
- Cross-course reuse, edit locks/versioning, account deletion, and historical audit policy.

Preserve explicit user decisions. For unresolved choices with materially different outcomes, present two or three approaches with trade-offs and recommend one before finalizing the plan.

### 3. Design Measurement Before Screens

Define the complete data flow from an answer to a reported result:

1. Specify routing and stopping estimators separately from reporting estimators.
2. Specify how responses roll up through nested nodes.
3. Prevent double counting: estimate each parent from pooled descendant responses; aggregate only independent top-level constructs into the overall result.
4. Define weight normalization and standard-error propagation, including the assumptions that make the formula valid.
5. Map continuous estimates to level bands once per reporting node. Never average level labels.
6. Define minimum evidence, boundary, capped, exhausted-pool, and insufficient-data behavior.
7. Define what the student receives versus lecturer-only calibration data.
8. Require simulations and invariants that match the production hierarchy, item mix, pool sparsity, and stopping rules.

When the result uses one trajectory chart, make its semantic x-axis explicit. Prefer an overall estimate over response order with an uncertainty ribbon. Keep nested node results in a separate profile; do not connect unrelated hierarchy nodes into a misleading line.

### 4. Adapt UX To The Host Product

Map each reference concept to an existing product surface. Do not copy the reference's activity model, navigation shell, styling, copy, or component density blindly.

Apply the host product's approved domain decisions:

- Keep adaptive delivery as a mode of the existing learning activity when that is the approved model.
- Put reusable competence-tree authoring in the product's resource-management surface.
- Put activity-specific tree selection, enablement, weights, pool overrides, and readiness in the existing activity wizard.
- Put participant runtime/results and cohort evaluation under their existing routes.
- Require the host design system, layout patterns, supported locales, stable test hooks, and real browser verification.

For depth-limited trees, define add, reorder, reparent, cycle rejection, breadcrumb, coverage-matrix, mobile, keyboard, and maximum-depth behavior. Prefer explicit accessible controls before introducing drag-and-drop dependencies.

### 5. Design Production Integrity

Cover all of these boundaries in the plan:

- Service-authoritative validation and readiness.
- Object and course permissions, including negative tests.
- Immutable publication snapshots for mutable source elements and parameters.
- Server-selected next item and replay/foreign-item rejection.
- Transaction boundaries for submit, grade, estimate, next-item selection, and completion.
- Participant payload redaction and anonymous/small-bucket cohort serialization.
- Tree/quiz edit locks after publication or attempts.
- Account deletion, legacy data, migrations, analytics schema sync, seeds, and fixtures.
- Async workers, gamification, embed/API compatibility, feature flags, observability, pilot gates, and rollback.

### 6. Write One Canonical Plan

Update the active plan when the new work is a refinement of the same feature. Create a second plan only for an independently deliverable subsystem; cross-link both plans and name their dependency.

Use [plan-template.md](references/plan-template.md). Scale its detail to the task, but always include:

- Goal and non-goals.
- Review/requirement coverage.
- Domain decisions and layer footprint.
- Permissions, privacy, measurement, UX, and lifecycle contracts.
- Ordered implementation slices with exact ownership boundaries.
- Acceptance criteria and verification for every slice.
- Seed/migration/rollout plan.
- Explicit open decisions that do not block the first slice.
- Current-state progress log and the next recommended slice.

Prefer vertical slices that end in a testable contract. Keep UI behind a stable, permission-tested API. Do not label future work complete.

### 7. Self-Review And Validate

Before handoff:

1. Scan for placeholders, vague verbs, duplicated requirements, contradictions, and stale paths.
2. Verify every source finding maps to a plan action, deliberate deferral, or evidence-backed rejection.
3. Verify every approved user requirement appears in domain, UX, acceptance, and test sections where applicable.
4. Check that chart endpoint, final result, level mapping, and stored estimate use one canonical computation.
5. Check that reusable definitions cannot mutate published historical meaning.
6. Check that participant payloads cannot expose solutions, item parameters, or raw internal estimates unintentionally.
7. Format the plan and report what was verified. Do not run application tests for documentation-only edits unless needed to validate a factual claim.

Read [example.md](references/example.md) when planning nested competence aggregation or a student result trajectory.
