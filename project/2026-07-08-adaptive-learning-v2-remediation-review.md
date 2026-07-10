# Review — Adaptive Learning v2 remediation commit (`a642f30d6`) + v3 merge (`2480cda80`)

**Reviewed state:** `origin/adaptive-learning` @ `2480cda80` (= remediation commit `a642f30d6` "chore: apply changes suggested by reviews" merged with current `v3`), checked out and verified in this worktree on 2026-07-08.
**Prior reviews:** the three PR-#5113 reviews plus `project/2026-07-07-adaptive-learning-v2-review.md` (below: **v2-review**). Scope per request: didactics/psychometrics, computations, UX, code quality, path to production, permissions — plus an explicit check of whether the previous reviews were considered.

**Verified in this worktree:** `@klicker-uzh/adaptive-learning` 22/22 unit tests + simulation pass · `pnpm --filter @klicker-uzh/graphql generate` leaves no diff (committed codegen artifacts are consistent with the pruned schema) · `graphql`, `frontend-pwa`, and `frontend-manage` all typecheck clean after the page/schema deletions · all migrations replay cleanly on a fresh PostgreSQL 15 (throwaway container) and the replayed DB matches the schema — the new competence-tree tables have no drift (short `map:` names work); only the *old* adaptive tables keep the pre-existing truncated-index-name noise · MASTERY geometry and numeric normalization re-verified empirically against the built package (details below).

---

## 1. Were the previous reviews considered?

**Yes — systematically, not selectively.** The commit adds `project/PLAN-adaptive-learning-v2-remediation.md`, which (a) cites all four review documents, (b) contains a finding-coverage table mapping **every** open finding to a remediation phase with acceptance criteria, and (c) defines an explicit implementation order. The commit itself executes the first four steps of that order, and each one checks out:

| Prior finding | Status in this commit | Evidence |
| --- | --- | --- |
| **v2 A1 / consolidated 🔴 set** — old standalone surface live (answer-key leak, unauth listing, destructive upsert, unrestricted submit, foreign-element attachment) | ✅ **Resolved by deletion** | Both pages removed (−4,680 lines), all 15 standalone ops removed, `schema/adaptiveLearning.ts` + `services/adaptiveLearning.ts` deleted, `query.ts`/`mutation.ts` entries removed, codegen artifacts regenerated (schema.graphql −324 lines, persisted-query IDs pruned); grep finds zero `Adaptive` references in the GraphQL schema layer and zero adaptive imports in either frontend |
| **N2 / seed** — seeded published assessment with `showSolutions: true` | ✅ Resolved | seed calls removed from `seedTEST.ts`; retained (now-uncalled) seed helpers flipped to `DRAFT` + `showSolutions: false` as defense in depth |
| **v2 Q1** — partial Node 24 bump with CI drift | ✅ Resolved (completed, not reverted) | all four `node-version` pins in workflows now 24; `engines "=24"`, Volta `24.16.0`, all Dockerfiles `24.16.0-alpine`; consistent with `v3`'s own Node/pnpm alignment (#5150), so the "split it out" concern is moot |
| **v2 P1** — MASTERY top band degenerate at the theta clamp | ✅ Resolved, verified | MASTERY now uses the shifted grid `lower_k = min + k·span/K`: bands for 6 levels are A1(−∞,−2) … C2[2,∞). Verified: perfect scorer (24/24) reaches C2 under MLE (θ=3), weak prior (θ=3), **and** strong prior (θ=2.28 ≥ 2); `classificationIntervalWithinLevelBand(θ=2.5, SE=0.3, MASTERY)` → true, so the top band can now satisfy the classification stop; NEAREST anchors unchanged (−3,−1.8,…,3) |
| **v2 P2** — `'1,200'` parsed as 1.2 | ✅ Resolved, verified | `hasAmbiguousSingleComma` rejects single-comma-plus-3-digits; `'1,200'` → error, `'1,2'` → 1.2, `'1.20'` → 1.2, fractions/Unicode-minus/grouping still work |
| **v2 P3** — percent input at quiz-config level | ✅ Resolved | `enablePercentInput` moved to `CompetenceTreeElementAssignment` (per-assignment) |
| **v2 Q2** — >63-char index names | ✅ Resolved for all new tables | explicit `map:` names throughout `competence.prisma`; replay-vs-schema diff clean for new tables |
| **v2 Q3** — bare `nextAssignmentId`/`finalLevelId` | ✅ Resolved | proper relations with `onDelete: SetNull` + covering indexes |
| **v2 A2 (partial)** — link auditability | ✅ `linkedBy`/`linkedById` (SetNull) added to `CompetenceTreeCourse` |

**Still open — correctly acknowledged as later phases in the remediation plan** (not silently dropped): permission semantics implementation (plan §1.6; no services exist yet), effective-override precedence helper (§1.7), ≥2/3-levels publish validation (§1.5), production-shaped simulation port (§3.1), account-deletion policy (§1.4 — see O1, the one item I'd pull forward), and everything from Phase 2 onward (runtime, results, frontend, i18n, E2E).

---

## 2. Open items that should not wait for their assigned phase

**O1 🟠 Account-deletion hard-block (v2 A3) — decide and fix now, while the schema is cheap to change.**
`CompetenceTree.owner` is still `onDelete: Cascade` from `User`, and the cascade chain still dead-ends in `Restrict` FKs (`AdaptivePracticeQuizResponse.assignment`, `PracticeQuizAdaptiveConfig.competenceTree`): once any student response exists, deleting the owning lecturer fails at the database. Remediation §1.4 lists the policy ("soft-delete, reassign to a system user, or block with a remediation workflow") but this commit — which touched exactly these models — didn't include it. Every schema iteration after real data exists gets more expensive; add the decided policy (recommend: service-level guard that soft-deletes/reassigns trees during account deletion, keeping the DB `Restrict` as backstop) plus a test in the same phase as tree CRUD, at the latest.

**O2 🟠 The package's tests still run nowhere in CI.**
There is still no `test-adaptive-learning.yml` (the `test-grading.yml` pattern), so the 22 unit tests and the simulation — now the only executable spec of the engine — are dead weight in CI, exactly as flagged in R2-F4 and both later reviews. This is a ~15-minute task and it should land **before** more engine changes, not with the Phase-3 harness port. (Note the scripts are still `test`/`test:simulation`, not the repo's `test:run` convention.)

**O3 🟡 The simulation now disagrees with *both* canonical mapping rules.**
`simulation.test.ts` still uses its private `mapMasteryThetaToLevel` with the **old** anchor grid (`span/(K−1)` spacing), while the lib's MASTERY moved to the `span/K` grid. Before this commit there were two mapping variants; now there are three, and the only one used by the quality gate is the one that no production code path will ever use. Fine to leave until the §3.1 harness port — but delete the private mapping *in* that port, and re-baseline accuracy separately per mapping rule with rule-consistent ground truth (the consolidated review's harness shows how).

**O4 🟡 Remediation §1.1's own acceptance tests are only partially present.**
The mastery-bounds unit test was updated to the new geometry and one MASTERY assertion exists in the classification-band test, but the two promised regression tests — "a perfect high-ability scorer ends in the top level (under the shipped final estimator)" and "the top-band classification stop can fire" — are not in `index.test.ts` as such. I verified both manually; pin them in tests so the geometry can't regress when someone next touches `mapLevelsToTheta`.

---

## 3. Didactics & psychometrics

**D1 🟡 The MASTERY grid shift changes what a level assignment *means* for item difficulty — document it and guard rule switches.**
Under MASTERY, level anchors (= item `b` values) are now −3,−2,−1,0,1,2 for six levels; under NEAREST they are −3,−1.8,…,3. Two consequences: (a) **switching `levelMappingRule` on an existing tree silently re-parameterizes every item's difficulty** and shifts all band boundaries — once attempts exist, that's a breaking change to the measurement model, so the service should warn or version the tree when the rule changes (same class of protection as the old "structural edit with attempts" rule); (b) any future empirical calibration is rule-specific — store calibrated parameters with the rule they were estimated under. The semantics themselves are right (items sit at the mastery threshold they test, which is where the decision is made) — this is a documentation-and-guardrails point, not a math defect.

**D2 🟡 Display note for Phase 4: under MASTERY the anchor is the band's lower edge.** A level marker placed at the anchor will render at the left edge of its band; band visualizations should place level labels/markers at band midpoints and reserve the anchor for the threshold line. Cheap to get right now that band math is centralized in the lib — and remember the student-facing sentence for MASTERY results ("X is the highest level you demonstrably cleared", v2-review U2 / remediation §2.5).

**D3 🟡 `deriveGuessingParameter` now returns 0 (was 0.01) for FREE_TEXT/NUMERICAL** — matches remediation §1.7, formulas are well-behaved at c=0, and information rises slightly (~2%) for those types; intentional and fine. Worth one line in the parameter docs so nobody "fixes" it back.

**D4 🟡 Numeric normalization: one false positive worth relaxing.** `'0,500'` is rejected as ambiguous, but a bare-zero integer part can never be a thousands grouping — `0,500` is unambiguously 0.5. Relax `hasAmbiguousSingleComma` for a leading `0,` (and add `'0,5'`/`'0,500'` cases). Everything else checked out: `'1,200'` rejected, `'−1 200'` → −1200, `'2,5/5'` → 0.5, percent correctly refused without the per-element flag.

---

## 4. Computations

Everything re-verified this round is correct: the shifted MASTERY grid, unchanged NEAREST behavior, posterior SE under `usePrior`, the reachability helpers, randomesque selection fallbacks, and the normalizers (§1, §3). The codegen artifacts match the pruned schema exactly (regenerating produces no diff), which was the failure mode I most expected from a 13k-line deletion — clean.

Remaining computation-side debt is unchanged from the v2 review and correctly parked in the remediation plan: the new engine features are still **dead code** until `adaptivePracticeQuizzes.ts` exists (no runtime currently ships at all — which is a safe state), and the legacy exports `DEFAULT_STANDARD_ERROR_THRESHOLD = 0.4` / `DEFAULT_QUESTION_THRESHOLD = 50` linger for deletion with the old models (v2 C2).

---

## 5. UX

Nothing user-facing ships on this branch anymore — the deletion removed the old UX defects (back-trap, instant start, live-theta whipsaw, English-only pages) along with the pages, and the practice-quiz surface is untouched. Two forward-looking flags:

- **U1 🟡 `packages/shared-components/src/adaptive/` is now fully dead code** (zero importers) and still contains the two known display bugs: `mapLevelsToBands`'s equal-slice band math (now *doubly* wrong — it matches neither NEAREST nor MASTERY) and `getLevelColor`'s English-keyed palette that renders all CEFR badges alike. If Phase 4 revives these components, the bugs come back silently. Either fix them against the lib's `mapLevelsToTheta` now, or delete the directory and rebuild in Phase 4 — don't leave them as a trap. The same applies to the uncalled adaptive seed helpers in `seedTEST.ts` and the old Prisma models/migrations (tables still get created in every fresh DB): all deliberate per the plan, but they need a tracked Phase-7 cleanup ticket so "temporarily" has an end date.
- **U2 🟡 Progress/results UX contracts from the remediation plan (§2.5, §4.4) are the next place prior-review findings can regress** — honest progress, no live theta, level-band results, insufficient-data states. Nothing to review yet; keep the plan's acceptance checks as the Phase-4/5 definition of done, including `npx agent-browser` screenshots.

---

## 6. Code quality & process

- ✅ Green across the board in this worktree: package tests, simulation, graphql codegen/typecheck, both frontend typechecks, migration replay (throwaway PG15). The merge with `v3` is clean from the adaptive perspective.
- **Q1 🟡 The `20260707120000` migration was edited in place** (same folder, new content) since its first version. Correct while the branch is unshared — but the moment anyone applies it to a persistent environment, in-place edits must stop (checksum mismatch). Worth stating in the PR description.
- **Q2 🟡 The v3 merge dropped the adaptive knowledge from AGENTS.md.** `v3` slimmed AGENTS.md into an overview + engineering wiki (`docs/index.md`, #5122/#5145), and the merge resolution kept the slim version — so the two adaptive entries (the SE-reachability formula and the v2-direction pointer) no longer exist anywhere discoverable, and no `docs/` wiki page mentions adaptive learning at all. Per the new convention ("facts, gotchas, and architectural decisions live in the engineering wiki"), add a short `docs/adaptive-learning.md` (direction, plan pointers, the reachability formula, the mapping-rule/b-semantics note from D1) and link it from `docs/index.md` — otherwise the next agent/developer rediscovers all of this from scratch.
- **Q3 🟡 Commit hygiene:** `a642f30d6` bundles the surface deletion, lib fixes, schema fixes, Node completion, and two plan documents into one "chore" commit. It's coherent as a remediation batch, but the PR description should enumerate what reviewers of PR #5113 will find deleted vs. deferred (the remediation plan's coverage table is the right content for that).

---

## 7. Permissions

The **attack surface is now closed**: with the standalone ops/pages/service gone, there is no participant-reachable adaptive endpoint at all, hence no answer-key path, no unauthenticated listing, no submit surface — confirmed by grepping the schema layer and regenerating codegen. The old Prisma models remain but are not exposed through GraphQL (plan-sanctioned temporary retention).

What remains is **specification, not code** (nothing to enforce yet): remediation §1.6 correctly requires the shared `withPermission` system for tree CRUD, course-manage + tree-access for linking, element-edit permission for assignments, participation + attempt ownership + quiz visibility for participants, and anonymous results with small-bucket suppression (< 5). Three things to hold Phase 2 to, from the earlier reviews:

1. Write the permission checks as **failing service tests first** (foreign private element by guessed id; cross-participant attempt access; unlinked-course tree selection; unauthenticated quiz listing) — the old surface shipped precisely because none existed.
2. The **tree-linking information flow** (v2 A2): linking exposes all mapped element stems/choices to the linked course's participants. v1 (linker = tree owner) is safe; the `linkedById` audit column landed ✓ — keep the "tree-owner-consented" rule when sharing arrives.
3. **O1** (account deletion) is a permissions-adjacent data-lifecycle gap — GDPR-relevant, cheapest now.

---

## 8. Path to production

The remediation plan's order stands; steps 1–4 of 12 are done and verified. Adjusted next actions:

1. **Now (small, before more engine work):** CI workflow for the adaptive package incl. simulation (O2, rename scripts to `test:run` convention); the two §1.1 regression tests (O4); `'0,500'` normalization relaxation (D4); account-deletion policy + schema/service decision (O1); `docs/adaptive-learning.md` wiki page (Q2).
2. **Step 5 (permission + precedence helpers)** as specified in §1.6/§1.7 — tests first; include the mapping-rule-switch guard from D1.
3. **Steps 6–10 (services, quiz mode, runtime, results)** per plan — the acceptance lists are right; nothing to add beyond holding to them.
4. **Step 11 (harness port)** — delete the sim's stale private mastery mapping (O3), baseline per mapping rule, and gate CI on exact ≥ 0.70 / adjacent ≥ 0.95 / median length within budget / top-band-reachable, as the plan already states.
5. **Step 12 (frontend)** — fix-or-delete the dead shared components before reuse (U1); MASTERY marker placement + result wording (D2); agent-browser verification throughout.

**Bottom line:** the previous reviews were not just considered — they were turned into a tracked remediation program, and the first tranche is implemented correctly and verifiably. Every previously-critical finding is now closed (by deletion) or structurally prevented (by schema). The branch is, for the first time, in a state where nothing unsafe is reachable by any user. The remaining risk is program risk, not code risk: ~two-thirds of the remediation (services, runtime, results, frontend, simulation gates) is still ahead, and the four pull-forward items above (CI gate, deletion policy, regression tests, wiki page) are the cheap insurance that keeps the next tranche honest.
