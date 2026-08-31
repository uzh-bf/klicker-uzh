# Playwright CI post-merge regression fixes

## Goal

Restore the merged Playwright CI path so the reusable workflow starts jobs and
the trusted ARM64 cache seed can verify and fingerprint its checkout.

## Evidence

- The merged commit is `c9683ca1bbda0ad937c899fe1002668e1fd60501`.
- [The merged Playwright run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33433298292)
  failed immediately with zero jobs and GitHub reported a workflow-file issue.
- The failed run's metadata had no referenced reusable workflow. A known
  successful run records the called workflow as
  `public-pr-playwright-shards.yml@v3`, normalized by GitHub to
  `refs/heads/v3`.
- [The merged cache seed](https://github.com/uzh-bf/klicker-uzh/actions/runs/33433297984)
  reached the container but failed before installation because Git rejected
  `/__w/klicker-uzh/klicker-uzh` as a dubious repository owned by another user.
- The primary checkout contains unrelated dirty work and remains untouched.

## Decision

- Use the short reusable-workflow branch reference `@v3` in the caller. GitHub
  resolves it to `refs/heads/v3` for workflow provenance and runner-group
  policy, while the full `refs/heads/v3` spelling caused the zero-job failure.
- Keep full `@refs/heads/v3` references for the trusted composite actions and
  keep the organization runner-group policy unchanged.
- Mark the exact cache-seed workspace safe for the container user before any
  later `git` command. The exception is exact-path, job-local, and contains no
  wildcard or broader filesystem path.

## Non-goals

- Do not change runner hosts, runner groups, repository variables, cache
  storage, Playwright selection, shard count, tests, or application code.
- Do not modify the unrelated primary checkout.
- Do not push, open, merge, or deploy a follow-up PR without explicit delivery
  approval after local verification.

## Execution contract

- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/playwright-ci-postmerge-fixes`
- Worktree: `trees/rs/playwright-ci-postmerge-fixes`
- Base: merged `origin/v3`
- Owner: main session
- Granted: isolated local edits, repository-native checks, plan updates, and
  local conventional commits.
- Withheld: push, PR publication, merge, runner or variable changes, and live
  canary activation.
- Terminal: clean local branch with focused workflow-policy tests, syntax and
  formatting checks, exact diff review, and a recorded follow-up status.
- Pause: stop if the fix requires changing the runner-group policy or broadens
  the public execution trust boundary.

## Test portfolio

| Risk | Test obligation | Stable seam | Failure caught | Slice |
| --- | --- | --- | --- | --- |
| Caller resolves the trusted reusable workflow | Extend existing | Workflow-policy validator and source test | GitHub creates a zero-job workflow run | 1 |
| Cache seed can use Git inside its container | Extend existing | Workflow source contract | Checkout verification or cache fingerprint fails on container ownership | 2 |
| Existing public trust boundary remains intact | Extend existing | Full focused CI contract suite | Caller or seed fix broadens permissions, refs, or public cache writes | 1, 2 |

## Slices

### Slice 1 — Restore reusable-workflow resolution

- Route: main
- Do: change the caller reference to `@v3`, update the validator and focused
  source assertions, and document the normalized policy distinction.
- Check: focused workflow-policy tests, YAML parsing, and exact diff review.
- Commit: one conventional CI fix commit.

### Slice 2 — Restore cache-seed checkout verification

- Route: main
- Do: add the exact workspace safe-directory setup before verification and
  cache-contract computation, with a source assertion for the boundary.
- Check: focused workflow-policy tests, shell/YAML validation, and exact diff
  review. The hosted cache run remains the external acceptance proof.
- Commit: one conventional CI fix commit.

## Review and delivery

- The user explicitly requested no subagents, so specialist execution and
  review dispatches are not used. Main-session review covers correctness,
  trust-boundary scope, and maintainability before any publication.
- The external delivery layer remains pending. A later explicit push approval
  must trigger fresh exact-head CI; the merged-run evidence cannot be reused as
  success evidence for this follow-up.

## Progress

- [x] Refreshed `origin/v3` to the merged commit and created the isolated
  follow-up worktree.
- [x] Confirmed the zero-job workflow-resolution failure and the cache-seed
  container ownership failure from exact GitHub logs.
- [x] Baseline workflow-policy tests pass: 19 tests.
- [x] Slice 1 caller-reference fix and verification: the caller now uses
  `@v3`, while trusted composite action and runner-group policy references keep
  their full normalized form.
- [x] Slice 2 cache-seed safe-directory fix and verification: the container
  trusts only `$GITHUB_WORKSPACE` before checkout verification and cache
  fingerprinting.
- [x] Local final diff review and conventional commit `abb96c810`.
- [x] Focused CI suite passes: 57 tests; Biome, Prettier, YAML parsing, and the
  workflow policy validator also pass.
- [ ] External PR delivery and exact-head CI, pending explicit approval.

## Next Steps

- If delivery is approved later, push `abb96c810`, open a follow-up PR, and
  require exact-head CI to prove that the reusable workflow creates jobs and
  the cache seed reaches install and build.
