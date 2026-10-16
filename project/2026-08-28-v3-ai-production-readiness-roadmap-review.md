# Review: `v3-ai` production-readiness roadmap

Date: 2026-08-28 · Reviewer: adversarial roadmap review per handoff · Repository state verified against `origin/v3`, `origin/v3-ai`, tag `v3.4.0-alpha.73`, GitHub branch-protection and check-run APIs, and all referenced PRs. ClickUp-side claims could not be verified in this session (ClickUp MCP unauthenticated); they are marked as unverified where relied upon.

---

## A. Verdict

**Ready with required revisions.**

The two-track architecture (normalize `v3-ai`, cut `release/v3.5.0-ai`, keep `v3-ai` as the integration line) is sound and is *validated* by repository evidence rather than contradicted by it: the repo already operates exactly this model for the mainline (`release/v3-alpha69`/`70` branches, `v3.4.0-alpha.NN` tags, tag-driven production deploys, `v*.*.*`-triggered prd workflows). Staging retargeting is a one-variable atomic operation (`STG_SOURCE_BRANCH`). The staging-only migration tail is confirmed deletable: none of the six `v3-ai`-only migrations exist in the tree of `v3.4.0-alpha.73`, the latest production tag, so no v3-cut release carries them. No finding invalidates the model or the normalize-then-cut sequence.

However, six findings are blocking in the sense that executing the roadmap as written would either fail (protection cannot be "repaired" because it does not exist; the failing CI gate is structural, not flaky) or produce an unsafe outcome (staging qualification invalidated by post-cut migrations; production regression of interim v3 alphas). The schedule's G2 is over-scoped for the window given verified team load. All are correctable without restructuring the roadmap.

A trunk-with-flags alternative (no release branch, tag directly from `v3-ai`) was considered and is correctly not what the roadmap proposes: C2 serialization and a shared staging environment demand a stable qualification target, and the existing alpha release-branch convention proves the chosen model already works in this repo.

---

## B. Blocking findings

### B1. G0 says "repair" branch protection; there is nothing to repair — protection is absent everywhere

- **Section:** G0 / branch protection.
- **Failure mode:** `v3-ai` has no protection at all (API returns 404 "Branch not protected"). `v3` *has* a protection object but it requires **zero** status checks and **zero** reviews — it blocks only force-pushes. The roadmap's schema/migration freeze, the "one C2 at a time" queue, and the final release-PR gate into `v3` are all process-only claims with no enforcement anywhere.
- **Why it matters:** the freeze is the foundation the entire migration-chain rewrite stands on. An unenforced freeze during a 13-day window with ~60 open PRs will be violated by accident, not malice.
- **Smallest viable correction:** rewrite G0 from "repair" to "create": define a required-check set and required-review count for **both** `v3` and `v3-ai` (the release PR merges into `v3`; hardening only `v3-ai` leaves the release gate soft). Add migration-touch detection to CI (path filter on `packages/prisma/src/prisma/schema/`) that requires a `schema-change` label — this is the technical enforcement of the C2 queue the roadmap asks for.
- **Resolve by:** before the schema/migration freeze begins (days 1–2). The freeze must not be declared until protection is live.

### B2. The failing CI gate is structural, not a reliability bug — and it defines the required-check set

- **Section:** G0 / CI repair.
- **Failure mode:** the failing check on every `v3-ai` push is `trusted_policy` inside `.github/workflows/check-ocr-final-review.yml` ("Final AI review"). It resolves a trusted policy commit from the **default branch** via `GITHUB_WORKFLOW_SHA`; on a non-default branch this resolution structurally cannot succeed, so `trusted_policy` fails and every downstream AI-review job (`resolve_lock`, `initialize`, `authorize`, `review`, `finalize`, and the `_stack` variants) skips. Meanwhile core CI on the `v3-ai` head is green: Check codebase, Playwright shards, gitleaks, stg Docker builds, CodeQL.
- **Why it matters:** the roadmap schedules "repair CI reliability" as debugging work. The actual work is a policy decision, and it gates B1: if `trusted_policy` lands in the required-check set as-is, nothing can ever merge to `v3-ai`.
- **Smallest viable correction:** either scope the Final-AI-review workflow to PRs targeting `v3` only, or teach the policy resolver to accept a pinned trusted commit for long-lived integration branches. Then build the B1 required-check set from the demonstrably green core jobs.
- **Resolve by:** G0, jointly with B1.

### B3. Staging cutover must be ordered around `STG_SOURCE_BRANCH` and ArgoCD PreSync auto-migration

- **Section:** G5 / staging reset and retarget.
- **Failure mode:** shared staging currently tracks `v3-ai` via the repository variable `STG_SOURCE_BRANCH=v3-ai`; `deploy-stg-promote.yml` fires on every push to the source branch and writes the commit SHA to the `rollout.klicker.uzh.ch/release` pod annotation, and migrations auto-apply via the ArgoCD PreSync hook (ADR-0003). After the release cut, the *first* C2 merge to `v3-ai` would auto-apply its migration to the shared staging database while `release/v3.5.0-ai` is qualifying there — silently diverging staging from the release chain and invalidating qualification.
- **Why it matters:** this is the exact "conflicting schemas on one environment" failure the roadmap exists to prevent, and it would be triggered by the roadmap's own rule that C2 development resumes on `v3-ai` after the cut.
- **Smallest viable correction:** a three-step cutover runbook: (1) flip `STG_SOURCE_BRANCH` to `release/v3.5.0-ai` at the moment of cut (atomic, one variable); (2) pause auto-promotion during the staging DB reset window (the PreSync hook will otherwise replay the new chain mid-reset); (3) lift the `v3-ai` migration freeze only **after** the flip is confirmed. This is good news operationally — retargeting is trivially enforceable — but only with this ordering.
- **Resolve by:** at the release cut, sequenced before any post-cut C2 merge to `v3-ai`.

### B4. No rule for v3's alpha cadence during the qualification window

- **Section:** release gates / branch topology.
- **Failure mode:** production currently ships `v3.4.0-alpha.7x` tags cut from `v3` (alpha.73 is current; production was rolled to alpha.70 days ago). The roadmap qualifies `release/v3.5.0-ai` for roughly two weeks but says nothing about `v3` continuing to ship. When `v3.5.0` deploys, it regresses every fix shipped in interim alphas unless those were absorbed.
- **Why it matters:** a production deploy that silently rolls back live fixes is the highest-severity outcome the plan can produce, and it happens by default, not by mistake.
- **Smallest viable correction:** one named rule with one named owner, chosen at cut time: either (a) freeze `v3`→production alpha promotion during qualification, or (b) merge `v3` into `release/v3.5.0-ai` before each qualification round and once more immediately before the production deploy. Option (b) preserves the roadmap's no-freeze constraint for `v3` feature work.
- **Resolve by:** before the release branch is created (the rule must exist when the branch does).

### B5. G2 is over-scoped for its window; apply an explicit blocking discriminator

- **Section:** G2 / schema constitution and migration rewrite; schedule days 4–9.
- **Failure mode:** G2 as written normalizes persistence across KB resources, graph builds, generation artifacts, and the usage ledger, rewrites the migration chain, and proves it against empty-DB and production-baseline databases — in ~6 working days, refactoring code merged three days ago (#5424, 285 files), while the same small team owns a large open non-AI portfolio competing for the identical window (Pino logging stack #5316–5320, assessment audit stack, live-quiz correlated-responses stack #5370–5376, analytics/participant-data-use stack, product-updates stack, Biome Tier 1 #5348). The schedule also places re-cutting the schema-heavy feature branches (#5481: 111 files, 10 schema/migration files; #5430: 143 files, 9 schema/migration files) inside days 4–8 — the same people, the same days.
- **Why it matters:** G2 slip drags G3–G5 past Sep 15, or normalization is rushed and the "final coherent chain" needs a second rewrite after production application — the one outcome the roadmap cannot afford.
- **Smallest viable correction:** adopt this discriminator: **a normalization is release-blocking only if it is migration-shape-critical (production will carry the shape forever) or it guards money or isolation.** Applying it: *keep* the KBResource/Revision/Operation shape, the published-graph FK constraint, and usage-ledger neutrality; *defer* artifact-row generalization (additive migration later), *defer* practice cycle/attempt to decision-only at G1 (no practice migration exists on `v3-ai`; #5481 carries its own and is not in September scope); *convert* the response-examples migration to a keep-if-acceptable decision rather than removal (removal reworks already-merged, tested code — keeping the table with the feature default-off is strictly cheaper). Move the #5481/#5430 re-cuts to after G4.
- **Resolve by:** G1 exit — the contract sign-off defines the trimmed G2 scope.

### B6. Three PR groups contradict the roadmap's branch model by targeting `v3`

- **Section:** PR disposition table; C0–C4 rules.
- **Failure mode:** (1) **#5514 (BYOK)** targets `v3` and carries 9 schema/migration files — merging it would put AI-provider credential schema onto the non-AI mainline, violating the roadmap's own C2 rules and bypassing the release train entirely. (2) **#5126 (chat engine)** targets `v3`, not `v3-ai` as the disposition table implies. (3) The **chatbot authoring stack #5593 → #5614 → #5619** targets `v3`; #5619 (publication-request UI, non-draft) already exists, contradicting the roadmap's claim that publication UI "comes later" — the roadmap only names #5593.
- **Why it matters:** the disposition table is the roadmap's contract with in-flight work; wrong base branches make "one C2 at a time on `v3-ai`" unenforceable and split the chatbot feature across two branches with different lifecycles.
- **Smallest viable correction:** disposition changes — #5514: park and retarget to `v3-ai` (or its normalized successor) post-core, never merge to `v3` as-is; #5126: correct the recorded base and retarget when the contract is extracted; #5593 stack: an explicit decision (E1), not a silent assumption — either it is deliberately flag-gated and `v3`-compatible (then document that and the back-merge path into `v3-ai`) or it is retargeted. Update the roadmap text to acknowledge #5619 exists.
- **Resolve by:** before the C2 queue opens (i.e., before the freeze lifts post-cut).

---

## C. Recommended roadmap changes

1. **G0 rewrite (from B1/B2):** "Create branch protection on `v3` and `v3-ai`" replaces "repair"; "Scope or fix the Final-AI-review `trusted_policy` gate" replaces generic CI repair; add migration-touch CI detection as the C2-queue enforcement mechanism. These three items are the roadmap's requested conversion of process rules into technical enforcement.
2. **Add a staging cutover runbook (from B3):** variable flip → promote pause → DB reset → PreSync replay of the new chain → freeze lift. Also note staging data since 2026-07-26 (assistant proposal audit and later) is lost on reset — accept explicitly or export first.
3. **Add the v3-alpha absorption rule and owner (from B4).**
4. **Trim G2 by the blocking discriminator; move #5481/#5430 re-cuts after G4 (from B5).** Include `prisma:sync` to `apps/analytics` and client regeneration in the migration-rewrite definition of done — the repo's schema workflow requires it and the roadmap omits it.
5. **Correct the PR disposition table:**
   - **#5062** (embeddings): already a 2-file RFC-shaped branch — the "convert to RFC" disposition is effectively done; close or keep as documentation, no extraction work needed.
   - **#5078** (old KB control plane): is **non-draft** and superseded by merged #5424 — close it explicitly, don't leave it as an apparently mergeable 112-file PR.
   - **#5092** (umbrella, 835 files): body is only a ClickUp triage link — the convert-to-tracking-issue-and-close disposition is confirmed correct.
   - **#5174** (KB hardening, 200 files): carries **zero** schema changes — extraction of the still-relevant runtime/UI hardening is lower-risk than the roadmap implies; stale since Jul 30, so diff against merged #5424 first.
   - **#5633, #5593:** schema-free, confirmed; land-early/extract dispositions are safe.
   - **#5514, #5126, #5593-stack:** base-branch corrections per B6.
6. **Align release mechanics with the existing convention:** `release/v3.5.0-ai` should reuse the `release/v3-alphaNN` + tag machinery (prd MCP workflows already trigger on `v*.*.*` tags) rather than introduce parallel machinery. Add a hard rule that the release branch is short-lived: merged into `v3` and deleted within ~3 weeks of the production deploy — a long-lived parallel line is where two-track models rot.
7. **Automate the release→`v3-ai` back-merge:** a bot-opened PR on every release-branch push. "Immediately back-merge" as a manual discipline fails under load.
8. **State the entitlement layer honestly:** the server-side entitlement today is a single `User.aiFeaturesEnabled` boolean (one-line migration). The roadmap's "server-enforced account entitlements and funding" exceeds what exists. Either scope the September claim to the boolean gate plus GrowthBook cohorts, or add explicit ledger-*enforcement* (reservation/deny at budget exhaustion) to the G2 keep-list — if budget enforcement must be live at Stage 1, it is a money guard and passes the B5 discriminator.
9. **Move accessibility human checks from the release-cut gate to the Stage-3 activation gate:** a cohort-gated, default-off release exposes no users at cut time; blocking the cut on them buys nothing and costs schedule.

---

## D. Revised critical path

**Serialized spine** (each step gates the next):

1. **Days 1–2 — G0':** create protection on `v3` + `v3-ai`; scope/fix `trusted_policy`; define the required-check set from the green core jobs; declare the freeze only once protection is live.
2. **Days 2–4 — G1:** contract decisions — LTI guest access; trimmed G2 scope via the discriminator; response-examples keep/drop; practice model decision-only; entitlement-enforcement scope (change 8); authoring-stack target branch (E1); v3-alpha absorption rule (B4).
3. **Days 4–9 — G2 (trimmed):** migration-shape-critical normalization + coherent chain rewrite + empty-DB proof + production-baseline proof (against a snapshot in the isolated secure environment; access-controlled, direct identifiers minimized) + `prisma:sync`/codegen.
4. **Day 9–10 — Cut:** create `release/v3.5.0-ai`; flip `STG_SOURCE_BRANCH`; pause promote; reset staging; confirm PreSync replays the new chain; lift the `v3-ai` freeze.
5. **Days 10–13 — G3/G4 on the release branch**, with fixes back-merged to `v3-ai` automatically (change 7).
6. **Qualification → release PR:** absorb `v3` per the B4 rule; verify prod `_prisma_migrations` matches the assumed baseline (E5); release PR into `v3` reviewed as an evidence manifest, not a diff.

**Parallel-safe at any time:** PR hygiene (close #5078, convert #5092, resolve #5062), schema-free extractions (#5174 hardening, #5633), C0/C1 feature work on `v3-ai` throughout, ClickUp restructuring.

**Explicitly serialized:** no C2 merge to `v3-ai` until after the staging flip (B3); #5481/#5430 re-cuts after G4 (B5); no alpha promotion decision deferred past the cut (B4).

The 13-working-day count (Aug 28 → Sep 15) is arithmetically correct but has zero slack; with B5's trim it is achievable *only if* the open non-AI portfolio is explicitly paused or reassigned for the window — that is a staffing decision the roadmap must surface, not absorb silently.

---

## E. Residual risks and open decisions

| # | Risk / decision | Owner | Latest decision point |
|---|---|---|---|
| E1 | Chatbot authoring stack (#5593/#5614/#5619) target branch: deliberate flag-gated `v3` landing vs. retarget to `v3-ai` | Roland | Before the C2 queue opens |
| E2 | Response-examples migration: keep (feature default-off) vs. drop from the chain | Schema owner | G1 exit |
| E3 | LTI guest access scope | Product | G1 (roadmap already flags it) |
| E4 | Budget/ledger *enforcement* beyond the `aiFeaturesEnabled` boolean: Stage-1-blocking or not | Product + backend | G1; if blocking, G2 keep-list grows |
| E5 | Out-of-band migration application to production cannot be ruled out from git history alone | Release engineer | At G5: read prod `_prisma_migrations` before treating the alpha-tag chain as the baseline |
| E6 | ClickUp gate-task contents (Sep 15 gate) unverified this session (MCP unauthenticated) | Roland | Before committing to the schedule externally |
| E7 | Team capacity: which open non-AI stacks pause during the window | Roland | G0 |
| E8 | Multi-replica in-memory rate/concurrency controls claim | Backend | Verify replica counts at G3 |
| E9 | Staging data loss on reset (assistant-proposal audit data since Jul 26) | Roland | At G5: accept or export first |

---

## Appendix: verified repository evidence

- Branch divergence: `origin/v3...origin/v3-ai` = 6 ahead / 87 ahead (roadmap's "5/86" trivially stale, materially accurate).
- Protection: `v3-ai` → 404; `v3` → `{"force":false, required_status_checks: [], reviews: 0}`.
- CI on `v3-ai` head: `trusted_policy` = failure; downstream AI-review jobs skipped/cancelled; Check codebase, Playwright, gitleaks, stg Docker builds = success; CodeQL = success.
- `STG_SOURCE_BRANCH` repository variable = `v3-ai`; promote-on-push + ArgoCD PreSync migration application per ADR-0003.
- Six `v3-ai`-only migrations (`packages/prisma/src/prisma/schema/migrations/`): `20260726184305_assistant_proposal_audit`, `20260822090256_response_examples_foundation`, `20260823120459_ai_features_enabled` (single `ALTER TABLE "User" ADD COLUMN "aiFeaturesEnabled" BOOLEAN NOT NULL DEFAULT false`), `20260825190000_kb_management_foundation`, `20260826140000_kb_graph_generation_bundle`, `20260826190000_element_generation_cost_accounting`. All six absent from the `v3.4.0-alpha.73` tag tree.
- Release convention: `origin/release/v3-alpha69`, `origin/release/v3-alpha70`; tags `v3.4.0-alpha.69`–`73`; production rolled to alpha.70; prd MCP workflows trigger on `v*.*.*`.
- PR states: #5633 draft→`v3-ai`, 28 files, 0 schema; #5593 open→**`v3`**, 12 files, 0 schema, stacked #5614/#5619 (#5619 non-draft); #5126 open non-draft→**`v3`**, 48 files; #5174 draft→`v3-ai`, 200 files, 0 schema, stale since 2026-07-30; #5481 open→`v3-ai`, 111 files, 10 schema/migration (+#5482/#5483 stacked); #5430 draft→`v3-ai`, 143 files, 9 schema/migration (+#5431–5433); #5514 draft→**`v3`**, 66 files, 9 schema/migration; #5062 draft, 2 files; #5074 draft, 88 files; #5078 **non-draft**, 112 files; #5092 draft→`v3`, 835 files, body = ClickUp triage link only; #5424 **merged** to `v3-ai` 2026-08-25, 285 files.
