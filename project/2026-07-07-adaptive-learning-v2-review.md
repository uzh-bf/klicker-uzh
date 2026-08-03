# Review — Adaptive Learning v2 (competence trees + adaptive practice-quiz mode), first implementation slice

**Reviewed state:** uncommitted working tree on `d57550482` in this worktree (49 changed/new files: `project/PLAN-adaptive-learning-v2.md`, `packages/prisma/src/prisma/schema/competence.prisma` + migration `20260707120000`, back-relations in 5 schema files, `packages/adaptive-learning` extensions + tests, AGENTS.md, and a repo-wide Node 20→24 bump).
**Prior context:** the three PR-#5113 reviews in `project/`; this review covers the delta and re-checks their findings against this tree. Scope per request: didactics/psychometrics, computations, UX, code quality, path to production, **permissions**.

**Verified in this worktree:** `@klicker-uzh/adaptive-learning` 22/22 unit tests + simulation pass; `@klicker-uzh/graphql` typechecks against the changed lib (old service is source-compatible); `prisma generate` succeeds; the new migration **replays cleanly** on a scratch database and the replayed DB matches the schema except cosmetic index-name truncations (see Q2). The MASTERY-mapping findings below were confirmed empirically against the built package.

---

## 1. Verdict

**The direction is right and the plan is excellent.** `PLAN-adaptive-learning-v2.md` faithfully absorbs all three reviews — split estimators, explicit mapping rule, competence-level classification stops, reachability validation, a = 1.2 default, served-item integrity, participant-safe payloads, anonymous-by-default results, presets over knobs, i18n/data-cy from the start. Reusable competence trees + an `ADAPTIVE` practice-quiz mode is a better product shape than the standalone activity: it reuses the delivery surface students already know, makes the taxonomy a first-class reusable asset, and kills an entire duplicated UI.

**The implemented slice (data model + lib) is good quality** — the schema bakes in the integrity fixes the old design lacked (`@@unique([attemptId, assignmentId])`, partial unique IN_PROGRESS index, `Restrict` on element/level FKs, `nextAssignmentId`, response snapshots, persisted estimates with stop reasons), and the lib extensions are correct where I could verify them mathematically and by test.

**Three things need attention before continuing:**

1. **Phase 0 was skipped.** The plan's own first phase is "make the current branch safe enough to evolve" — but every 🔴 security finding from the consolidated review is still live in this tree: the answer-key leak paths, the missing participation checks, the attempt-destroying upsert, the unrestricted submit, the foreign-element attachment, and the seed publishing with `showSolutions: true`. Nothing in `packages/graphql/src/services/adaptiveLearning.ts`, the two pages, or `seedTEST.ts` changed. See §5 (A1) for the recommended shortcut.
2. **The MASTERY mapping has a top-band geometry defect** (P1): the top level's band starts exactly at the theta clamp, so the classification stop can never fire for top-level candidates, and a strong-prior final estimate denies the top level even to a perfect scorer (verified: 24/24 correct → C1, not C2). Fix the geometry before building Phase 3 on it.
3. **The Node 20→24 bump is unrelated scope bundled into this tree** and is internally inconsistent — CI workflows still pin Node 20 while `engines`/Volta/Dockerfiles say 24 (Q1). Split it out.

---

## 2. Didactics & psychometrics

**P1 🟠 MASTERY top band is degenerate — top level unreachable by classification stop, fragile at finalization.**
`mapLevelsToTheta(…, 'MASTERY')` defines band k as `[anchor_k, anchor_{k+1})` ([index.ts](../packages/adaptive-learning/src/index.ts), mastery branch). With 6 levels on [−3, 3] that puts C2 = **[3.0, ∞)** — a band whose only reachable point is the clamp itself, since estimates are clamped to `thetaMax = 3`. Verified against the built package:

- `classificationIntervalWithinLevelBand({theta: 3.0, standardError: 0.05, mappingRule: 'MASTERY'})` → **false** (the CI's lower edge is always < 3), so the competence-level classification stop **never fires** for a top-level candidate; they always run to the cap. Symmetrically fine at the bottom (band is open-ended downward).
- A perfect scorer (24/24 correct, items across all levels): MLE and weak-prior(SD 2) finals hit the clamp → θ = 3.0 → **C2** ✓; a strong-prior(SD 1) final lands at θ = 2.84 → **C1** — the top level is denied to a flawless performance. A near-perfect scorer (one slip) generally lands just below 3 → C1 as well.

The estimator split (routing strong / final weak-or-MLE) is therefore *load-bearing correctness* for MASTERY, not just an accuracy optimization — and even with it, C2 effectively requires an all-correct pattern at the top level.
*Fix (pick one, before Phase 3 consumes the mapping):* (a) **shifted anchor grid for MASTERY** — place anchors at `min + k·span/K` (k = 0…K−1) so every band, including the top one, has interior width `span/K`; keep item difficulty `b` = anchor (items then sit at band lower edges, which is exactly where mastery decisions are made); or (b) keep the grid and special-case the extreme bands in `classificationIntervalWithinLevelBand` (treat `θ̂ − z·SE ≥ lastAnchor − ε` as inside the top band) and document that top-level assignment requires the clamp. Option (a) is cleaner and testable; either way add unit tests for "perfect scorer reaches top level under MASTERY with the shipped final estimator" and "classification stop can fire in the top band".

**P2 🟡 Decimal-comma normalization misreads anglo-format thousands.**
`normalizeNumericalResponse('1,200')` → **1.2** (single comma treated as decimal separator, per the plan). For a generic instrument with numeric answers > 999 this misgrades correct answers typed in the en-US convention. The typed-number path from the existing PWA component avoids it, so the string path is the risk (future clients, copy-paste). *Fix:* treat "single comma followed by exactly three digits and no other separator" as ambiguous → reject with a format hint, or gate string parsing behind a per-element locale option. Add these cases to the (otherwise good) normalization tests.

**P3 🟡 `enablePercentInput` landed at quiz-config level, plan specified per-element.**
`PracticeQuizAdaptiveConfig.enablePercentInput` ([competence.prisma:185](../packages/prisma/src/prisma/schema/competence.prisma)) toggles percent parsing for *every* numerical item in the quiz; the plan's rationale ("avoid silent unit errors") only holds if it's opt-in on the specific element/assignment where % is meaningful. *Fix:* move to `CompetenceTreeElementAssignment` (or element options) before the service consumes it.

**P4 🟡 A 1-level scale is now representable and maps everything to one level.**
The lib newly handles `levels.length === 1` (midpoint anchor). The old service's "at least two levels" validation lives in code slated for deletion. Carry a ≥ 2-levels (recommend ≥ 3 for classification) rule into `competenceTrees.ts` validation, alongside the planned depth/leaf checks.

**P5 🟡 Simulation debt: the quality gate still tests the old system.**
`test/simulation.test.ts` is unchanged — private mastery mapping (now redundant with the lib's MASTERY rule), old defaults, FREE_TEXT-only pool, round-robin sequencing. The Phase-2 acceptance criterion "simulation exercises production-shaped selection and stopping" is unmet, and the sweep harness (`project/adaptive-learning-sweep-harness.mjs`) is not yet ported. This matters now because P1 shows exactly the kind of defect only a production-shaped simulation catches. Port the harness before Phase 3, parameterized by preset (mapping rule × level count × structure), and pin exact/adjacent accuracy and mean length per preset.

What is **right** didactically in this slice: a = 1.2 conservative default everywhere (lib, tree, config); `CompetenceTreeLeafLevelCoverage.targetItemCount` makes pool-sizing guidance enforceable; `AdaptivePracticeQuizEstimate.stopReason` makes stopping auditable; `showLiveEstimate` defaults **false**; `minQuestionsPerLeaf`, `classificationZ`, `totalQuestionCap` model the recommended stop architecture faithfully.

---

## 3. Computations

Verified correct:

- **Posterior SE** (`standardError(theta, items, priorSD)`, wired through `updateTheta` when `usePrior`) — fixes consolidated-review N4; test pins the 1-response posterior behavior (|θ| < 1.5, SE < 1). ✓
- **`informationAtDifficulty` / `minimumReachableStandardError`** match the closed form a²(1−c)/(4(1+c)); tests pin 0.3375 and 0.6086 for the canonical SC case. ✓ (These are the save-time reachability validators the plan requires — remember to actually call them in `adaptivePracticeQuizzes.ts`.)
- **Mapping rules**: NEAREST unchanged (midpoint bounds); MASTERY bounds are internally consistent with `mapThetaToLevel`'s half-open convention (modulo P1's geometry choice). Old callers are unaffected (defaults preserved; old service typechecks and the old simulation passes). ✓
- **Randomesque selection**: ratio band (`information ≥ max·ratio`) with optional `topK` and exposure penalty; falls back to exact-tie behavior when `ratio = 1` or when penalties push max information ≤ 0 (tested). ✓ Two notes for the service layer: the ratio is *multiplicative*, so when the max information is tiny (theta far from all items) nearly everything qualifies — combined with `topK` (recommend `topK: 3–5` in presets) this is fine, alone it can over-randomize; and `exposurePenalty` is in raw information units per exposure count, so it needs normalization (e.g., penalty × exposure/maxExposure) or a documented magnitude (~0.01) before lecturers can touch it — recommend keeping it internal.

**C1 🟡 The new engine features are currently dead code.** `normalizeNumericalResponse`, `normalizeFreeTextResponse`, `classificationIntervalWithinLevelBand`, `isNearLevelBoundary`, `minimumReachableStandardError`, mapping rules, randomesque parameters — nothing calls them yet (services and `@klicker-uzh/grading` unchanged). Expected at this phase, but it means **production behavior is still exactly what the consolidated review measured** (unprimed MLE, argmax selection, unreachable SE stops, exact-match free-text grading). Don't mistake green lib tests for shipped fixes.

**C2 🟡 Legacy defaults linger.** `DEFAULT_STANDARD_ERROR_THRESHOLD = 0.4` and `DEFAULT_QUESTION_THRESHOLD = 50` still exported and consumed by the old service. Delete with the standalone surface (Phase 7), or they'll leak into new presets by habit.

**C3 🟡 Frontend band mismatch still open.** `shared-components/src/adaptive/utils.ts` `mapLevelsToBands` still slices the range into equal Nths; the lib now owns the canonical boundary function with mapping-rule support, but no frontend consumes it yet. Make the Phase-5 acceptance check explicit: badge, band, and assigned level derive from `mapLevelsToTheta` — delete `mapLevelsToBands`.

---

## 4. Schema & migration (code quality)

The data model is a substantial upgrade — it structurally prevents most of the old integrity findings:

| Old finding | New-model answer |
|---|---|
| Duplicate/arbitrary submits (S4) | `@@unique([attemptId, assignmentId])` + `nextAssignmentId` on the attempt ✓ |
| Duplicate IN_PROGRESS attempts (S7) | partial unique index `…_one_in_progress` ✓ |
| History destroyed by cascades (S8) | `Restrict` on response→assignment and assignment→element/level + `elementSnapshot` ✓ |
| Results recomputed per dashboard load (R2-F31) | persisted `AdaptivePracticeQuizEstimate` with `stopReason` ✓ |
| `ABANDONED` never set (C4) | first-class enum status ✓ |
| Missing timestamps (R2-F33b) | `createdAt`/`updatedAt` on all mutable models ✓ |

Also nice: the partial unique `CompetenceTreeNode_treeId_root_order_key … WHERE parentId IS NULL` correctly closes the NULLs-are-distinct hole that `@@unique([treeId, parentId, order])` alone would leave for root nodes; same technique for the OVERALL estimate row.

**Q1 🟠 Node 20→24 bump: unrelated scope, internally inconsistent.**
Root Volta pin 24.16.0, `engines.node "=24"` across ~20 packages, all app Dockerfiles on `node:24.16.0-alpine` — but `.github/workflows/cypress-testing.yml:126,339` and `playwright-testing.yml:107` still pin `node-version: 20`. So E2E CI would test on a different major runtime than the containers ship, and any workflow reading the Volta pin will diverge from the ones that hardcode 20. A major-runtime bump also deserves its own verification pass (Prisma engines and Next 15 on musl Node 24, `pnpm run build` of every app in CI). *Fix:* revert the bump out of this branch into its own PR that also updates the workflow pins; keep this branch on Node 20.

**Q2 🟡 Index names exceed Postgres's 63-char limit and get truncated.**
Replaying all migrations and diffing against the schema leaves only "renamed index" drift (e.g. `AdaptivePracticeQuizAttempt_practiceQuizId_participantId_status` → `…_st_idx`, plus two pre-existing old-adaptive ones). Harmless at runtime but every future `prisma migrate dev` will nag. *Fix:* add explicit `map:` names ≤ 63 chars for the long composite indexes in `competence.prisma`.

**Q3 🟡 `nextAssignmentId` and `finalLevelId` are bare `Int?` columns without FK relations.**
A deleted assignment (tree edit) or level leaves dangling ids on attempts. `Restrict` protects *responses* but not these pointers. *Fix:* make them proper relations with `onDelete: SetNull` (`nextAssignmentId` → `CompetenceTreeElementAssignment`, `finalLevelId` → `CompetenceTreeLevel`), or document that the service must null them when editing trees.

**Q4 🟡 Two overlapping enable/override layers need a precedence contract.**
Enabled-ness can come from `CompetenceTreeElementAssignment.enabled`, `CompetenceTreeLeafLevelCoverage.enabled`, `PracticeQuizAdaptiveNodeOverride.enabled`, and `PracticeQuizAdaptiveElementOverride.enabled`; discrimination from element calibration, assignment override, config default, tree default. The plan defines the `a` precedence; write the enabled-ness precedence down too (suggest: effective = tree assignment ∧ coverage ∧ node override ∧ element override, missing override rows default to enabled) and encode it in one service helper with unit tests — this is exactly the kind of logic that otherwise gets re-derived inconsistently in selection, stopping, preview, and results.

**Q5 🟡 `CompetenceTreeNode.weight` exists at every depth but only top-level weights count (per plan).** Fine — but add the constraint to service validation (ignore/normalize non-root weights) and a schema comment, or lecturers will set leaf weights expecting effect.

---

## 5. Permissions

**A1 🔴 The old, vulnerable surface is still fully live — and still reachable by students.**
Unchanged in this tree: `publishedAdaptiveAssessments` returning raw elements with `correct`/`solutions` to any participant of any course; unauthenticated `publishedAdaptiveAssessmentInfos`; the delete-everything upsert; submit accepting any pool item repeatedly; no element-ownership filter; the seeded published assessment with `showSolutions: true`; `requireCourseOwner` bypassing the `withPermission` system (R2-F11). The plan's Phase 0 exists precisely for this, and it hasn't started.
*Recommendation:* given the plan already prefers the clean-migration path ("if no real data exists yet … delete standalone adaptive assessment models and routes before merge"), the cheapest Phase 0 is **deletion now, not patching**: remove the two pages, the standalone ops/queries/mutations, and the service entry points (keep the Prisma models until the final cleanup migration if convenient). That closes every 🔴 in one stroke, shrinks CI surface (the 8 broken Cypress specs came from this seed), and avoids spending effort hardening code scheduled for the bin. If any standalone surface must survive short-term, do the original Phase-0 list instead — but pick one now; don't build Phases 3–5 with the leak still deployed-able.

**A2 🟠 The new model's authorization semantics are not yet pinned down — define them before `competenceTrees.ts` exists.**
The schema gives `CompetenceTree` only `ownerId` plus `CompetenceTreeCourse` links, which is the right v1 scope (plan's open decision 1 — agree: start owner+links, not the full catalog sharing system). But the service contract needs explicit answers, and the plan only partially states them:

- **Tree CRUD:** owner-only is fine for v1, but implement it through the repo's `withPermission`/`PermissionLevel` pattern rather than raw `ownerId ===` checks, so delegated staff and future team sharing don't require a rewrite (this is R2-F11's lesson).
- **Linking a tree to a course:** require *both* manage-permission on the target course *and* access to the tree. Note the information flow this action creates: linking implicitly exposes **all mapped elements' content** (not solutions, but stems/choices) to that course's participants through adaptive delivery. For v1 (linker = tree owner) that's fine; the moment trees are shareable, linking must be a tree-owner-consented action, not something a course owner can do to any visible tree. Add `linkedById` to `CompetenceTreeCourse` now — one column, cheap audit trail.
- **Element assignment:** the plan correctly requires the `liveQuizzes.ts`-style permission filter (`OWNER`/`ADMIN` on the element). Make the acceptance test explicit: assigning a foreign private element must fail *even when the element id is guessed*.
- **Participant surface:** participation in a linked course + attempt ownership on every attempt-scoped query; quiz visibility must also check the quiz's own `status`/availability window, not just the course link.
- **Results:** anonymous distributions by default is right; resolve open decision 2 now — recommend suppressing buckets with **n < 5** at leaf level (leaves × levels produces small cells fast) while leaving overall/competence distributions unsuppressed unless the cohort itself is < 5.

**A3 🟠 User deletion will hard-fail at the database once adaptive attempts exist.**
Chain: `User` → `CompetenceTree` (`Cascade`) → `CompetenceTreeElementAssignment` (`Cascade`) → `AdaptivePracticeQuizResponse.assignment` (**`Restrict`**) — and `PracticeQuizAdaptiveConfig.competenceTree` (**`Restrict`**) blocks the same cascade. So deleting a lecturer who owns a tree with any recorded student responses throws at the FK level. That's arguably the safe default (better than silently erasing student history), but the account-deletion flow must handle it explicitly: reassign or soft-delete trees (`isDeleted` exists) before user deletion, or the deletion request breaks — GDPR-relevant. Participant deletion is correctly unaffected (attempt `Cascade` removes responses). Add a service test for "delete user who owns a tree with responses".

---

## 6. UX

No new UI ships in this slice, so this is a plan-level check — the plan's frontend sections are strong and directly encode the prior reviews' UX findings (intro/resume screens, no back-trap, shared element renderers for KPRIM, live estimate hidden by default, honest "Question N, at most M" progress, level bands from the shared boundary helper, insufficient-data states, anonymous lecturer results, i18n + `data-cy` from the start). Three additions:

- **U1 🟡 The old UX ships until Phase 7.** Same argument as A1: the misleading back-trap, instant-start, live-theta whipsaw, and English-only pages remain user-visible as long as the standalone pages exist. Deleting them now is also the fastest UX fix.
- **U2 🟡 Plan the MASTERY communication.** Under MASTERY, "you are B1" means "B1 is the highest level you demonstrably cleared" — students who see a band chart will read the marker sitting near the top of the B1 band as "almost B2". The result screen should say the sentence explicitly (i18n key per mapping rule); this also covers P1's near-miss-at-the-top case.
- **U3 🟡 The coverage matrix is the killer authoring feature — make it blocking.** `CompetenceTreeLeafLevelCoverage.targetItemCount` gives the readiness checklist real teeth: publish of an adaptive quiz should hard-block on "some enabled leaf × level has zero items" and soft-warn below target counts and on unreachable SE thresholds (via `minimumReachableStandardError`, using the pool's dominant item type). The plan lists this; wire the numbers, not just booleans.

---

## 7. Path to production

The plan's phasing is sound; concrete adjustments from this review:

1. **Re-order:** execute A1 (delete standalone surface — or full Phase 0 if it must survive) **before** any Phase 3 service work. Also split out the Node bump (Q1) immediately — it will otherwise contaminate every CI signal on this branch.
2. **Phase 2 exit criteria are not yet met:** P1 (MASTERY geometry) is a blocker inside Phase 2; port the sweep harness into `test/` (P5) and re-baseline per preset; then delete the old simulation's private mapping. Add the two P1 regression tests.
3. **Phase 1 leftovers before calling it done:** FK relations for `nextAssignmentId`/`finalLevelId` (Q3), explicit `map:` index names (Q2), `linkedById` on course links (A2), percent-input to assignment level (P3), seed data for a competence tree + adaptive quiz (plan's own acceptance check — not present yet; keep `showSolutions`-style debug flags out of it).
4. **Phase 3 must open with the permission contract** (A2) and the enabled-ness/discrimination precedence helper (Q4), each with service tests, before endpoints; the acceptance list in the plan (sanitized payloads, unserved-item rejection, idempotent duplicate submit) is right — implement it as failing tests first.
5. **Decide the open decisions now** (they block Phase 3/6 design): (1) owner+course-links for v1 — yes; (2) small-bucket suppression n < 5 at leaf level; (3) MASTERY as default for placement/mastery presets, NEAREST for self-assessment — i.e. per preset, no global default; (4) self-assessment warmup as follow-up — yes, but keep the `enableSelfAssessmentWarmup` flag dormant rather than deleting it.
6. **Account-deletion handling for trees (A3)** belongs in Phase 3's service work, not as a post-launch surprise.
7. Everything else in the plan (docs, Playwright happy path, agent-browser verification, rollout gates incl. ≥ 0.70 exact / ≥ 0.95 adjacent / ≤ 25 min median / ≤ 40 % exposure) matches the prior reviews — keep as written.

**Bottom line:** the redesign is the right call and the first slice is well built — schema-level integrity is now ahead of most of the old findings. The gap is sequencing: the security debt of the old surface is untouched while new construction proceeds, one geometric defect (P1) sits in the new engine's most didactically sensitive path, and an unrelated runtime bump is entangled with the branch. Clear those three and Phases 3–5 have a solid foundation.
