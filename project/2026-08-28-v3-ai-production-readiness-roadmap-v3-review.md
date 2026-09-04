# Final review: v3-ai production-readiness roadmap — v3 document

- **Date:** 2026-08-28 (evening; evidence re-verified against live repository state)
- **Subject:** the revised roadmap document ("roadmap v3") produced by a second agent from `project/2026-08-28-v3-ai-production-readiness-roadmap.md` ("roadmap v2"), plus its 31-item improvement log
- **Method:** every new factual claim checked against `origin/v3` / `origin/v3-ai`, the GitHub control plane (branch protection, rulesets, repository variables), workflow definitions, `docs/ci-and-deployment.md`, and live CI runs. Repository state treated as authoritative throughout.
- **Terminology:** "roadmap v3" always means the document under review; "branch `v3`" always means the git branch.

---

## A. Verdict

**The roadmap v3 holds up. Ready to execute after the corrections in section D.**

All five material changes in its executive ruling are directionally correct, and its new hard factual claims verified against the live repository — most importantly the RC naming constraint. Roadmap v2's `release/v3.5.0-ai` branch name would have been a hard blocker: no staging image would ever have been built for it. Roadmap v3's `v3.5.0-ai-rc` satisfies both real constraints (the `v3*` push trigger on all 15 staging image workflows and the promoter's Docker-tag-safe branch-name validation). Catching this alone justified the second pass.

The findings this round are narrower than the first review's: one documented-but-omitted runbook step (the ArgoCD side of the staging flip), one automation-interaction risk (promotion pull requests versus the new required checks), one governance deadlock (single code owner plus required review), one check that cannot pass as specified (tree-SHA equality), one schedule stress point (the parking fallback's revert cost), and a stale snapshot. None of them change the roadmap's structure, gates, or dates by more than a runbook edit and one explicit user decision.

---

## B. Verification results

### B1. Confirmed claims (accept as written)

1. **Branch `v3` head and #5634.** `origin/v3` is `0892b61dc` and includes PR #5634 "ci(final-review): fix trusted workflow SHA lookup", merged 2026-08-28T14:27Z. The roadmap's assumption that the trusted-policy repair lands independently is now fact.
2. **RC naming constraint.** All 15 `.github/workflows/v3_*-stg.yml` files trigger on `push.branches: ['v3', 'v3*']`, and `deploy-stg-promote.yml` validates the source branch against `^[A-Za-z0-9_.-]+$` because branch names become Docker image tags. `v3.5.0-ai-rc` matches both; `release/v3.5.0-ai` matches neither. Verified verbatim.
3. **Pause guard must land on branch `v3` first.** The promoter is `workflow_run`-triggered, so the definition that executes is always the one on the default branch. Correct.
4. **Manual exact-SHA promotion already exists.** The promoter has a `workflow_dispatch` trigger with a required `sha` input and a `dry_run` flag — the roadmap's "manually dispatch promotion for the exact RC SHA" needs no new build.
5. **Protection is process-only today.** Branch `v3` classic protection has zero required status checks and `required_approving_review_count: 0`; `v3-ai` has no protection at all (API 404). The only ACTIVE rulesets are the auto-imported tag create/delete protections; the sole branch ruleset is DISABLED. The roadmap's premise that a real ruleset must be built at G0 is exact.
6. **`STG_SOURCE_BRANCH` is currently `v3-ai`**, and it falls back to `v3` when unset. Confirmed via repository variables and `docs/ci-and-deployment.md`.
7. **PR dispositions are real.** Spot checks: #5474 and #5498 (response-example domain) and #5383 and #5398 (element-generation domain) all exist, are merged, and match the roadmap's described scope.
8. **`ChatUsageCredits` is the real model name** in `packages/prisma/src/prisma/schema/chat.prisma` — decision D8 (keep chat credits separate from the neutral usage ledger) references an existing domain, not a hypothetical one.

### B2. Overtaken by events (refresh, not errors)

1. **The snapshot in §1 is already stale.** `origin/v3-ai` is now `edae58628`, standing **88 ahead / 0 behind** `origin/v3` — the merge of current branch `v3` (including #5634) into `v3-ai` has already happened. The G0 item "merge v3 into v3-ai" is done.
2. **Final-AI-review verification is already in flight.** Two fast failures on `v3-ai` this morning (7s and 12s — the pre-fix trusted-lookup failures) and one post-fix `pull_request_target` run started 14:54 UTC, still pending at review time (run 33182538041). The G0 item reduces to: confirm this run completes green.

### B3. Genuine gaps

1. **The staging flip is two-sided; §10.3 lists only one side.** §10.3 says "Set `STG_SOURCE_BRANCH=v3.5.0-ai-rc`". But `docs/ci-and-deployment.md` documents that the promoter writes `deploy/env-uzh-stg/values.yaml` on the source branch precisely because **ArgoCD reads that branch** — and that changing ArgoCD `targetRevision` is a separate, documented operation performed outside this repository (the `app-klicker` Application manifest lives outside the repo). The doc even prescribes the preflight: render the staging chart from the branch ArgoCD will track, verify every workload image tag uses that branch, then require both `Synced` and `Healthy` after the sync (a successful sync alone can still leave `ImagePullBackOff`). The cutover runbook must add the `targetRevision` repoint (RC at cut, back to the successor branch at RC retirement), name who has ArgoCD access to do it, and carry the doc's preflight and acceptance checks. It should also carry the doc's warning that hook-only changes never trigger a sync.
2. **Promotion pull requests versus the new RC ruleset.** Promote PRs are opened by the `STG_PROMOTE_TOKEN` identity with `[skip ci]` in the title — deliberately, so the squash commit does not rebuild every image and re-fire the promoter — and auto-merge waits on exactly one status: `Verified generated staging promotion`. If the RC ruleset requires the aggregate CI check, promote PRs will stall: their diffs are deploy-values-only and their workflows are suppressed or not designed to report. Resolution belongs at G0: either make the promoter identity a named bypass actor on the RC ruleset, or scope required checks so that `Verified generated staging promotion` is the only requirement that applies to promote PRs. Then prove it with **one real promote PR** on the RC branch before qualification depends on staging — the existing `dry_run` dispatch proves the image-completeness gate but not the auto-merge path.
3. **Single code owner deadlocks required review.** `.github/CODEOWNERS` assigns every path to `@rschlaefli` alone. GitHub forbids approving one's own PR, so any ruleset requiring ≥1 approval or code-owner review blocks every PR the sole maintainer authors — which is most of them. The empirical proof that today's flags gate nothing: promote PRs auto-merge on branch `v3` with zero approvals despite `require_code_owner_reviews: true`. The G0 ruleset must keep required approvals at 0 and lean entirely on required checks (recording why), unless a second human owner is added for schema and deploy paths. Do not enable code-owner review as decoration.
4. **Active tag rulesets may constrain release tagging.** The ACTIVE rulesets are tag create/delete protections (auto-imported 2024). Verify at G0 that the release captain or release automation can create `v3.5.0*` tags, or add the necessary bypass before the qualification window.

---

## C. Judgment findings on the five material changes

1. **RC branch naming (`v3.5.0-ai-rc`)** — correct and repository-verified (B1.2). Accept.
2. **Early staging-promotion pause** — correct mechanism and timing: the guard variable lands on branch `v3` first (B1.3). One clarification worth adding: pausing promotion does not stop staging image builds (push-triggered) — that is fine and desirable, since the image-completeness gate needs them when promotion resumes for the RC.
3. **Branch `v3` merge hold instead of repeated absorption** — directionally reasonable, but it is in tension with the standing constraint that there is no full feature freeze, and with the observed cadence: branch `v3` currently ships alphas every few days, with release and production-roll commits landing on it. A 5–6 working-day hold on the production mainline is an institutional decision, not a mechanical one. Put it to the user as an explicit numbered decision, with roadmap v2's delta-board absorption audit as the fallback if the hold proves unworkable.
4. **Ship-clean-or-park schema rule** — right principle, honest fallbacks, but the schedule cost of the Park fallback is unpriced. Under D2/D3's conservative defaults the likely outcome is parking both response examples (#5474/#5498) and element generation (#5383–#5398 span). Parking means reviewed reverts of merged, entangled domains — element generation links to knowledge-graph builds, and the graph domain is a Keep — inside the same zero-slack Sep 2–10 window that must land the N1–N5 normalization stack. Before the Park verdict is final at G1, spend up to one day per candidate domain estimating the revert blast radius; where revert cost approaches normalize cost, normalize instead. The parking-mechanics section exists but does not make this trade explicit.
5. **Sep 15 go/no-go with the 72-hour stability clock** — sound, and the arithmetic is conservative in the right direction: a clock started at RC promotion on Sep 11 could complete Sep 14, so the "earliest dark deploy Sep 17–18" figure implicitly assumes at least one material fix resetting the clock, which is realistic. The internal difference between §12.2 and the executive ruling is acceptable as an estimate-versus-bound distinction; label it as such rather than reconciling the dates.

Two further mechanism-level findings:

6. **The tree-equality check cannot pass as specified.** "RC tree SHA == merged branch-`v3` tree SHA" fails under the roadmap's own rules: any P0 fix shipped to production during the hold produces version-bump, release, and deploy-values commits on branch `v3` that are not in the RC — so the check fails precisely when the hold's escape hatch is used, and also for any routine `chore(deploy)` commit. Replace it with the only form that can pass: `git diff <RC> <merged v3> -- apps packages` must be empty, plus a short audited residue list covering `deploy/`, `.github/`, and version manifests. This keeps the tripwire without the false alarm.
7. **Staging-freeze blast radius is acceptable — verified.** Staging already tracks `v3-ai`, so freezing it for G2/G3 does not regress the branch-`v3` alpha line: alphas already ship without staging qualification today. No change needed; state it so the freeze is not re-litigated later.

---

## D. Recommended corrections to the roadmap v3 document

| # | Section | Correction |
| --- | --- | --- |
| 1 | §1, §16 (G0) | Refresh the snapshot: `v3-ai` head `edae58628`, 88 ahead / 0 behind. Mark the v3→v3-ai merge done; the G0 verification item becomes "run 33182538041 (post-#5634 Final AI review on `v3-ai`) completes green." |
| 2 | §10.3 | Add the ArgoCD side of the flip: repoint `targetRevision` of the staging Application to `v3.5.0-ai-rc` at cut and to the successor branch at RC retirement; name the owner with ArgoCD access; include the chart-render preflight and the `Synced` **and** `Healthy` acceptance from `docs/ci-and-deployment.md`; note that hook-only changes never trigger a sync. |
| 3 | §5.1, §10 | Resolve the promote-PR/ruleset interaction: promoter identity as a named bypass actor, or required checks scoped so `Verified generated staging promotion` is the only one applying to promote PRs. Prove with one real promote PR on the RC before staging-dependent qualification starts. |
| 4 | §5.1 | Keep required approvals at 0 and record why (single code owner, self-approval forbidden); rely on required checks. Enable code-owner review only if a second owner is added for schema/deploy paths. |
| 5 | §11, §12 | Replace tree-SHA equality with the path-scoped check: empty `git diff -- apps packages` plus an audited residue list for `deploy/`, `.github/`, and version manifests. |
| 6 | §4, §7 (G1) | Add a bounded park-cost spike (≤1 day per candidate domain) before any Park verdict is final; where revert cost ≈ normalize cost, normalize. |
| 7 | §11 | Elevate the branch-`v3` merge hold to an explicit user decision (add to the D-list) with the delta-board audit as named fallback. |
| 8 | §16 (G0) | Add: verify the active tag rulesets allow the release captain/automation to create `v3.5.0*` tags. |

---

## E. Residual checks before execution starts

1. Confirm run 33182538041 (Final AI review, post-fix, `v3-ai`) finishes green; if it fails, the trusted-policy assumption reopens and G0 gains a real work item.
2. Confirm who holds ArgoCD access for the staging Application `targetRevision` change — it lives outside this repository and is on the critical path of the cutover.
3. Immediately after the RC cut: one `workflow_dispatch` promoter run with `dry_run` against the RC SHA (proves image gate + branch validation), then one real promote PR (proves the auto-merge path under the new ruleset).
4. Verify the `STG_PROMOTE_TOKEN` identity can merge into the RC branch under the new ruleset before promotion is unpaused.

---

*Review artifacts: first-round review in `project/2026-08-28-v3-ai-production-readiness-roadmap-review.md`; the revised baseline in `project/2026-08-28-v3-ai-production-readiness-roadmap.md`. Evidence sources: workflow definitions and `docs/ci-and-deployment.md` at `origin/v3`; GitHub branch-protection, ruleset, and variables APIs; live run listing for `check-ocr-final-review.yml` on `v3-ai`; PR metadata for #5634, #5474, #5498, #5383, #5398.*
