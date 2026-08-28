# W-Item Contract — Fix Final AI review trusted_policy failure

- Item ID: `fix-final-review-trusted-policy`
- Contract source commit: `86e8ac2e13c77e90a9bcd45d0f6b5f03fff18eed` (origin/v3 tip; worktree base)
- Worktree (sole writer: delegated task): `trees/rs/fix-final-review-trusted-policy`, branch `rs/fix-final-review-trusted-policy`
- Base/target: base `origin/v3` @ `86e8ac2e`; eventual PR target `v3` (push/PR withheld — separate authority)
- Repository root: `/Users/rschlae/Git/klicker/klicker-uzh`

## Plain-language outcome

Make the `trusted_policy` job of `.github/workflows/check-ocr-final-review.yml` ("Final AI review") pass for every event type on any PR/push, so the `final-ai-review` commit status (description "Verified generated staging promotion") is posted reliably and `deploy-stg-promote.yml` auto-merge can proceed. Restoring this gate restores repository-wide PR final-review and the staging promotion pipeline.

## Observable failure facts (for diagnosis, not a settled root cause)

- `trusted_policy` job fails with "Workflow definition commit could not be verified" on many branches/events, still failing at 2026-08-28 12:26Z.
- Failing workflow SHA (`github.workflow_sha`) equals the current v3 tip `86e8ac2e13c77e90a9bcd45d0f6b5f03fff18eed`; `git rev-parse origin/v3` matches it, so the commit exists on origin/v3.
- Example failing runs (verify fresh evidence yourself): 33171088228 (pull_request_target, rs/chatbot-publication-ui), 33170611418 (pull_request_target, v3-ai), 33170608972 (pull_request_target, chore/promote-stg-09da961233ce), 33170356487 / 33169971011 (issue_comment, v3).
- Job logic: `actions/github-script@3a2844b7...` calls `repos.getCommit({ commit_sha: github.workflow_sha })` and fails unless `response.data?.sha === workflowSha`. The REST call returns a commit object whose top-level `sha` must equal the requested 40-hex SHA.
- Consequence chain: `deploy-stg-promote.yml` waits for status context `final-ai-review` success ("Verified generated staging promotion") before enabling auto-merge; promoter run 33162508086 failed after 6×20s polls.
- Helper scripts live under `.github/scripts/` (`final-ai-review.js`, `final-ai-stack-review.js`, tests exist).

## Child task: diagnose fresh

Do not accept a settled root cause from the contract. Verify the failing run logs yourself via host `gh` (use `env XDG_CACHE_HOME=/private/tmp/gh-cache-<suffix>` for log/view cache issues). Diagnose why `getCommit(commit_sha=github.workflow_sha)` returns `data.sha !== workflowSha` for a commit that exists on origin/v3, across both `pull_request_target` and `issue_comment` events. Consider: API identity vs action context, API response shape for the exact pinned action version, field name/content of `github.workflow_sha` on these events, and the comparison's failure mode. Then fix minimally within owned paths.

## Owned paths (all changes stay inside these)

- `.github/workflows/check-ocr-final-review.yml`
- `.github/scripts/final-ai-review.js` and related helper(s) under `.github/scripts/` only if the fix requires it
- This contract file only to append a **Progress** section (no other edits)

## Acceptance checks

1. Root-cause statement with fresh run-log evidence (run IDs, timestamps, exact error text).
2. Minimal fix in owned paths; workflow YAML parses; node syntax check on touched helpers.
3. Logic-level proof the trusted-SHA resolution succeeds for both `pull_request_target` and `issue_comment` events at the current pinned action versions (simulate the API response handling against captured logs or a node check with a mocked response).
4. `git diff origin/v3` shows only owned paths; no unrelated hunks; comments preserved.
5. Focused checks pass in the worktree; full monorepo checks are NOT required for this workflow-only change.

## Finish boundary, withheld actions, non-goals

- Finish boundary: verified local commits on `rs/fix-final-review-trusted-policy`.
- Withheld: push, PR creation/update, merge, deploy, cluster changes, workflow reruns, branch/worktree deletion, any other work item.
- Non-goals: changing the review policy semantics, other workflows, or the promotion pipeline beyond restoring the gate.
- Stop conditions: return NEEDS_CONTEXT on any new product/security/data-integrity/cross-system decision or if the diagnosis requires infra-level (GitHub Actions/runner-side) information beyond run logs.

## Data hygiene

No secrets or personal data in this contract. Run-log quotes must contain no tokens.

## Progress

- Status: Implementation and post-slice gates complete; integrated final review pending.
- Active slice: None. The single trusted-SHA resolution slice is complete.
- Completed commits: plan `e87b62aa9`; implementation `8866380d5`; accepted simplifier adjustment `7deb6f6d5`.
- Fresh evidence: `node --check .github/scripts/final-ai-review.test.js` passed; `node --test .github/scripts/final-ai-review.test.js` passed 33/33; Ruby parsed the workflow YAML; `git diff --check` passed.
- Test delta: Changed the existing trusted-policy test to execute the embedded resolver for `pull_request_target` and `issue_comment`; no test file added or removed.
- Slice review: done — `project/_local/reviews/2026-08-28-final-review-trusted-policy-slice-review.md`.
- Simplifier: done — `project/_local/reviews/2026-08-28-final-review-trusted-policy-simplifier.md`; one behavior-preserving net reduction accepted.
- Required delivery layer: Verified local commits. Achieved layer: committed implementation awaiting integrated final review.
- Runtime: No devcontainer, dev server, or application runtime was started; none applies to this workflow-only package.
- Withheld actions remain withheld: no push, PR, workflow rerun, merge, deploy, cleanup, or upstream integration.
- Next action: Run the integrated final review over the complete committed package, disposition findings, then refresh final verification and this status.
