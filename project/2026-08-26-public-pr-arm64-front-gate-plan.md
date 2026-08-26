# Public PR ARM64 front-gate plan

## Goal

Remove the GitHub-hosted scheduling bottleneck in front of eligible public PR
Playwright runs by moving their path filter and build onto the
`public-pr-arm64` runner pool. Preserve GitHub-hosted execution for pushes,
forks, drafts, bots, and disabled rollout cases.

## Execution contract

- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/public-pr-arm64-front-gate`
- Worktree: `trees/rs/public-pr-arm64-front-gate`
- Baseline: `origin/v3` at `97d20293f9263a0e3898d9675b1c3e07c2fae18a`
- Delivery: one focused PR targeting `v3`
- Authorized here: scoped edits, repository checks, local commits, branch push,
  and draft PR creation or update
- Withheld: merge, runner-group changes, rollout-variable changes, and
  post-merge canary execution
- Terminal condition: the draft PR passes its hosted fallback CI and required
  reviews. Public-route runtime proof remains delivery-pending until a
  separately authorized post-merge canary.

## Evidence and constraints

- The current canary queued at the GitHub-hosted `filter` job before it could
  request public ARM64 capacity.
- The reusable workflow remains pinned to `@v3`. A PR must not be able to
  redefine the trusted authorization workflow that handles public PR code.
- Authorization runs on the public runner before checkout. The caller's job
  predicate prevents normal fork, draft, and bot scheduling; the reusable
  workflow repeats the checks and exits before checkout if that predicate
  drifts.
- Public runners have no private repository or private-network access. Jobs use
  read-only repository permissions, receive no secrets, and run in a job
  container.
- The 8 GB ARM64 build capacity is unproved. A post-merge canary is required
  before enabling the global rollout.

## Slices

### S0: Freeze the reviewed plan

Add this plan with authority, risks, verification, progress, and stop
conditions.

Acceptance: Prettier accepts the file and the diff is plan-only.

Commit: `docs(project): add public PR ARM64 front-gate plan`

### S1: Route eligible preparation and build to ARM64

Make the trusted reusable workflow own an ARM64 containerized `prepare` job,
the shared build, and the eight Playwright shards. `prepare` authorizes before
checkout, evaluates changed paths, and exposes `should_run` as a reusable
workflow output. Scope the caller's filter, build, and shards to the exact
GitHub-hosted complement. Make the status gate select the route-specific path
decision while preserving cancellation success, path skips, and exactly one
execution route.

Acceptance: workflow YAML and formatting checks pass; the route truth table
covers public and fallback routes with relevant and irrelevant changes,
cancellation, and invalid both-or-neither cases; build artifacts remain
identical; caches include runner architecture; checkout credentials are not
persisted on public runners.

Commit: `ci(playwright): move public PR preparation to ARM64`

### S2: Align operational documentation

Update the testing wiki, CI wiki, and Playwright skill to describe the new
front-gate ownership and residual hosted status job.

Acceptance: documentation matches the workflow, repository wiki checks pass,
and the integrated result passes final review.

Commit: `docs(ci): document public PR ARM64 preparation`

### S3: Prove the merged route

After merge and separate authorization, keep the global rollout disabled and
run one exact same-repository relevant-change canary plus one path-skip canary.
Confirm preparation starts without a GitHub-hosted front gate, the relevant run
completes the ARM64 build and eight shards, the skip run starts neither build
nor shards, and both report a successful required status. Record queue time,
runtime, and memory or OOM evidence. Clear the canary on failure and retain the
hosted fallback.

## Verification portfolio

No new test framework or application tests are needed. Verify:

- public versus hosted route eligibility is exhaustive and mutually exclusive;
- relevant and irrelevant path decisions propagate through either route;
- cancelled superseded runs remain successful at the required status gate;
- both-selected and neither-selected relevant routes fail;
- artifact names and the `playwright-run-metadata` contract remain unchanged;
- workflow YAML, Prettier, `act -l`, wiki checks, diff checks, and staged secret
  scanning pass;
- the implementation PR uses the hosted fallback because `@v3` intentionally
  resolves the merged reusable workflow;
- the post-merge canary provides the only runtime proof of the new public path.

## Review routing

- Planner: completed before S0; no blocking semantic issue found.
- S1: simplifier plus one reviewer covering security, trust boundaries, GitHub
  Actions routing, and required-status behavior.
- Integrated result: final reviewer after all checks pass.

## Stop conditions

Stop and return for direction if eligibility cannot fail closed before checkout,
the hosted fallback changes behavior, the route truth table becomes ambiguous,
or implementation requires secrets, private access, runner changes, rollout
changes, merge, or post-merge execution.

## Progress

- [x] Fresh remote state and isolated worktree established.
- [x] Planner reviewed the full-path design.
- [x] S0 plan recorded.
- [x] S1 workflow routing implemented and statically verified.
- [x] S2 documentation aligned and verified.
- [ ] Slice and final reviews completed.
- [ ] Branch pushed and draft PR opened or updated.
- [ ] S3 post-merge canary authorized and executed.
