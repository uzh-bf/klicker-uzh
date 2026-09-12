# PR #5587: Reliable public ARM64 Playwright routing

## Goal

Make current pull-request Playwright work reach the public ARM64 pool promptly,
even when an older required status job is still queued on GitHub-hosted
capacity, and make the mounted checkout usable inside every ARM64 job
container.

## Non-goals

- Do not change runner provisioning, runner groups, labels, secrets, shard
  count, path selection, test behavior, or branch protection.
- Do not enable the global rollout, merge this package, rebase another branch,
  or modify the active chatbot worktree.

## Evidence

- Exact-head run `33004484863` remained pending with zero jobs for about 45
  minutes while stale run `33001732699` retained the workflow-wide concurrency
  group through its queued `test-playwright-status` job.
- When the lock eventually cleared, `test-playwright-public-pr / prepare` ran
  on `public-pr-arm64-01` and failed because Git rejected the host-mounted
  workspace as having dubious ownership inside the Playwright container.
- GitHub's current Actions documentation supports job-level concurrency on
  ordinary jobs and reusable-workflow calling jobs. Matching cancellation
  groups in a caller and called workflow can cancel the caller, so the public
  route must have one caller-owned group.

## Decision

- Remove workflow-level concurrency from `test-playwright.yml`.
- Give the hosted filter, build, and individual shard jobs distinct
  cancel-in-progress groups scoped to the workflow and pull request or ref.
- Give `test-playwright-public-pr` one caller-level cancel-in-progress group so
  a replacement cancels the complete older reusable invocation immediately.
- Leave `test-playwright-status` unconstrained, GitHub-hosted, always-running,
  and cancellation-aware. A stale reporter may wait, but it cannot block
  current routing.
- Keep the called workflow free of concurrency keys. After each checkout in
  its container jobs, add the exact mounted workspace to that container's Git
  safe-directory configuration.

## Execution contract

- Authority: local in-scope edits, repository-native checks, conventional
  commits, read-only review, branch push, and one focused pull request against
  `v3` are authorized by the urgent fix request.
- Withheld: merge, upstream integration, runner-setting changes, runner
  reprovisioning, global rollout, branch/worktree deletion, and unrelated PR
  changes.
- Boundary owner: `self`.
- Terminal: focused pull request opened from an exact `origin/v3` baseline with
  fresh static workflow, formatting, documentation, diff, and secret-scan
  evidence.
- Pause: only for a contradictory workflow contract, a required check that
  cannot run, or a new failure outside scheduling and mounted-workspace trust.

## Plan identity

- Path: `project/2026-08-26-pr-5587-playwright-job-concurrency-plan.md`
- Branch: `rs/playwright-job-concurrency`
- Target: `v3`
- Pull request: [#5587](https://github.com/uzh-bf/klicker-uzh/pull/5587)

## Planning review

GPT-5.6 Sol returned `DONE_WITH_CONCERNS`. It accepted job-level cancellation
and required one correction: public-route concurrency belongs on the reusable
workflow calling job, not inside the called workflow. The later exact job log
then supplied evidence for the narrowly related safe-directory repair.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S1 — current work bypasses stale reporters and uses the mounted checkout | main | reviewed plan committed first | Workflow structure assertions, YAML parsing, formatting, documentation checks, diff inspection, and staged secret scan pass |

Execution stays in the main session because cancellation, reusable-workflow
routing, required-status behavior, and the new container failure are one
urgent coupled seam.

## Test portfolio

| Risk | Existing evidence | Obligation | Primary seam | Distinct failure caught |
| --- | --- | --- | --- | --- |
| Stale reporter blocks current work | Exact runs `33001732699` and `33004484863` | Extend static workflow assertions | Parsed workflow jobs | Workflow-level or status-job concurrency returns |
| Replacement does not cancel expensive predecessor | Current workflow topology | Extend static workflow assertions | Parsed concurrency groups | Missing, shared, or shard-insensitive groups |
| ARM64 container cannot use checkout | Failed prepare job `98308213141` | Extend static workflow assertions | Called workflow steps | Missing exact-workspace trust after a checkout |
| Required check semantics change | Existing route-aware status script | No new test; exact diff assertion | Unchanged status job | Reporter moves runner, loses `always()`, or receives concurrency |

## Slice S1

- Do: change only the two Playwright workflows and their CI/testing guidance.
- Check: parse both workflows; assert exact concurrency placement and unique
  groups; assert all public checkouts receive exact-workspace trust; retain all
  route, runner, artifact, and status invariants; run Prettier, repository docs
  checks, `git diff --check`, and a staged Gitleaks scan.
- Commit: `ci(playwright): prevent stale runs blocking ARM64 jobs`.

## ADR gate

No ADR is needed. This repairs a CI scheduling and container-ownership defect
without changing product behavior, data flow, runner trust boundaries, or a
long-lived architecture decision.

## Progress

- 2026-08-26: Fresh `origin/v3` baseline `ff9e9fae3b58c5955ff80ec58559ecd655c071d8`
  is isolated in `trees/playwright-job-concurrency`; no upstream integration
  was performed.
- 2026-08-26: Planning review completed. S1 is active; implementation,
  verification, committed review, push, and pull request remain.
- 2026-08-26: S1 implementation is complete. Parsed workflow assertions cover
  concurrency placement, status isolation, all three exact-workspace trust
  steps, runner safety, shard count, and run-specific volumes. Prettier,
  engineering-wiki checks, removed-doc checks, and diff hygiene pass; committed
  review, push, and pull request remain.
- 2026-08-26: The user directed the package to skip subagent review after the
  configured intermediate routes failed before producing work. The main
  session inspected the exact diff and reran all focused checks. The branch is
  published in draft PR #5587; plan metadata, final push, ready state, and host
  read-back remain.
