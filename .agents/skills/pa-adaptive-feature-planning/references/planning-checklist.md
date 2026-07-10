# Adaptive Feature Production Checklist

Use this checklist to audit a full adaptive-learning feature. Mark every item as implemented, planned, intentionally deferred, or not applicable, with evidence.

## Contents

- [Evidence Corpus](#evidence-corpus)
- [Domain And Didactics](#domain-and-didactics)
- [Measurement And Computation](#measurement-and-computation)
- [Data And Lifecycle](#data-and-lifecycle)
- [Permissions, Security, And Privacy](#permissions-security-and-privacy)
- [UX And Accessibility](#ux-and-accessibility)
- [Engineering And Production](#engineering-and-production)

## Evidence Corpus

- [ ] Enumerate all review and plan files, including superseded versions.
- [ ] Inspect the current branch, status, recent commits, and migrations.
- [ ] Trace active schema, service, GraphQL, generated operations, UI routes, tests, seeds, and docs.
- [ ] Inspect supplied HTML, screenshots, or prototypes visually and structurally.
- [ ] Separate prototype concepts from visual styling and incorrect domain assumptions.
- [ ] Record legacy models/routes/components that must not be revived.
- [ ] Reconcile contradictions by preferring explicit current user decisions, then current code, then the newest validated review.

## Domain And Didactics

- [ ] Name the existing activity type and confirm whether adaptive behavior is a mode.
- [ ] Define the reusable authoring object and its cross-course lifecycle.
- [ ] Define root competences, nested subcompetences, leaves, maximum depth, and assignable nodes.
- [ ] Define level semantics: descriptive nearest-band versus mastery threshold.
- [ ] Define supported and excluded item types and grading boundaries.
- [ ] Define item `a`, `b`, and `c` sources, override policy, and calibration lifecycle.
- [ ] Define blueprint ownership and required leaf-by-level coverage.
- [ ] Define feedback, result use, retakes, attempt selection, and learning recommendations.
- [ ] Prevent high-stakes claims before subject-specific pilot evidence exists.
- [ ] Define whether points, XP, leaderboards, or achievements apply.

## Measurement And Computation

### Estimation

- [ ] Separate routing/stopping estimates from final reporting estimates.
- [ ] State prior/MLE/MAP choices and avoid repeated priors that create artificial aggregate precision.
- [ ] Pool descendant responses directly for every reporting node.
- [ ] Never average child levels or small-sample child estimates to estimate a parent.
- [ ] Aggregate only independent root competence estimates into the overall result.
- [ ] Normalize effective root weights after quiz-level enablement/overrides.
- [ ] Propagate aggregate variance with explicit assumptions.
- [ ] Map theta to a level once per node through one canonical helper.

### Selection And Stopping

- [ ] Guarantee initial evidence across every enabled root and required coverage cell.
- [ ] Define eligible-pool filtering before information-based selection.
- [ ] Define randomesque selection and exposure controls in normalized terms.
- [ ] Use competence-level classification stopping when subcompetence estimates are too sparse.
- [ ] Define total cap, pool exhaustion, timeout, capped, and insufficient-data stop reasons.
- [ ] Validate stop thresholds against reachable information before publication.

### Uncertainty And Results

- [ ] Define minimum responses before assigning a node level.
- [ ] Define boundary-crossing and near-boundary wording.
- [ ] Distinguish an attempt-level uncertainty summary from a calibrated population confidence interval.
- [ ] Guarantee chart endpoint, headline result, stored final estimate, and textual summary agree.
- [ ] Decide whether early trajectory points are omitted, regularized, or displayed with wide uncertainty.
- [ ] Avoid claiming uncertainty decreases after every response.

### Simulation

- [ ] Cover all presets and mapping rules.
- [ ] Cover supported item-type mixes and guessing parameters.
- [ ] Cover sparse, target, and rich pools.
- [ ] Cover mislabelled difficulty, boundary abilities, and heterogeneous competences.
- [ ] Track exact/adjacent accuracy, bias, question count, stop reasons, exposure, and insufficient-data rates.
- [ ] Add hierarchy invariants for depth, reordering, intermediate-node insertion, disablement, and no double counting.
- [ ] Define numerical shipping gates per preset before pilot.

## Data And Lifecycle

- [ ] Link reusable trees to courses without transferring ownership implicitly.
- [ ] Define read-only access for linked-course managers and edit access for owners.
- [ ] Validate cycle-free reparenting and recalculate complete subtree depth atomically.
- [ ] Restrict structural changes after publication or provide explicit versioning/duplication.
- [ ] Snapshot effective item data, source version, leaf/level, and item parameters at publication.
- [ ] Select and grade from the immutable published pool, not mutable source elements.
- [ ] Persist delivered-item/audit data needed to reconstruct an attempt.
- [ ] Define account deletion, tree reassignment/soft deletion, and historical retention.
- [ ] Decide migration or removal for legacy adaptive models and seed data.
- [ ] Sync mirrored analytics schemas after Prisma changes.

## Permissions, Security, And Privacy

- [ ] Authenticate and authorize every tree, course-link, quiz, attempt, result, and export operation.
- [ ] Test owner, linked-course manager, unrelated lecturer, participant, and foreign participant cases.
- [ ] Require course participation for participant runtime without conflating leaderboard state.
- [ ] Persist the server-selected next item and reject arbitrary, replayed, disabled, foreign-tree, and foreign-course submissions.
- [ ] Perform grade, response write, estimate update, next selection, and completion in one transaction.
- [ ] Redact solutions, grading metadata, difficulty, guessing, discrimination, and raw internal state from participant payloads.
- [ ] Serialize anonymous cohort results and enforce small-bucket suppression server-side.
- [ ] Define CSV/export privacy separately from on-screen rendering.

## UX And Accessibility

### Authoring

- [ ] Keep the host application's navigation, wizard, typography, spacing, controls, and design system.
- [ ] Separate reusable tree authoring from quiz-specific configuration.
- [ ] Support depth-limited outline add/reorder/reparent/delete with keyboard-accessible controls.
- [ ] Show ancestry through indentation and breadcrumbs.
- [ ] Flatten leaves to breadcrumb rows in the coverage matrix.
- [ ] Distinguish blocking errors from warnings and link issues back to controls.
- [ ] Show effective weights, enabled scope, pool coverage, expected length, and publish readiness.
- [ ] Integrate adaptive mapping into element editing and a tree-centric assignment view.

### Participant

- [ ] Use the existing activity route and page chrome.
- [ ] Explain expected length/cap, resume, backtracking, result use, and privacy before start.
- [ ] Reuse existing item renderers for every supported type.
- [ ] Show honest progress without a fake fixed denominator or pseudo-precise convergence percentage.
- [ ] Provide atomic resume/start-over behavior.
- [ ] Show an overall level band, estimated-range trajectory, and nested node profile after completion.
- [ ] Render insufficient data instead of a noisy level for under-measured nodes.
- [ ] Provide a textual equivalent to charts and do not rely on color alone.
- [ ] Verify desktop/mobile layout, localization, keyboard flow, screen-reader labels, and reduced motion.

### Lecturer Results

- [ ] Show aggregate overall, root, and nested-node level distributions.
- [ ] Show completion, abandonment, cap, pool exhaustion, and insufficient-data counts.
- [ ] Suppress small cohorts before data reaches the UI.
- [ ] Gate item exposure/misfit analysis by minimum sample size.
- [ ] Label estimates under quiz weights; avoid population-ability claims.

## Engineering And Production

- [ ] List every schema, package, GraphQL, frontend, i18n, worker, docs, and generated-artifact touchpoint.
- [ ] Keep schema logic in services and GraphQL resolvers thin.
- [ ] Regenerate schema, operations, persisted queries, and clients with API changes.
- [ ] Add deterministic seeds for reuse, depth, supported item types, boundary results, and insufficient data.
- [ ] Add unit, service, contract, component, browser, and end-to-end evidence proportional to risk.
- [ ] Inspect participant GraphQL payloads in a real browser session.
- [ ] Define feature flags, selected-course pilot, observability, support, rollback, and broad-rollout gates.
- [ ] Monitor stop reasons, question counts, near-boundary rates, exposure, fit, errors, and support reports.
- [ ] Remove legacy surfaces only after checking real production/staging data.
