# Public ARM64 Playwright performance follow-up

## Goal

Prove the merged eight-runner public Playwright route, reduce its critical path,
and leave enough timing evidence to distinguish runner capacity from test-suite
structure. Keep untrusted public PR jobs secret-free and keep their caches
restore-only.

## Execution contract

- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/playwright-runner-followup`
- Worktree: `trees/rs/playwright-runner-followup`
- Baseline: `origin/v3` at merge commit `c7bc6b5d5`
- Delivery: one focused PR targeting `v3`
- Authorized: scoped edits, checks, commits, push, PR creation and updates,
  exact-head CI monitoring, and squash merge after the non-review checks pass
- Withheld: runner-host changes, secrets, private-network access, deployment,
  unrelated branch integration, and branch or worktree deletion
- User override: implementation and verification stay in the main session;
  subagents and review passes are skipped

## Evidence

The final pre-merge run for PR #5620 used the three-shard reusable workflow then
deployed on `v3`. Its public build took 7m43s and its shards took 41m26s,
35m42s, and 36m02s. The run passed on `public-pr-arm64-07`, `-06`, and `-01`.
The build still spent about 2m52s saving caches because it used the old reusable
definition.

The JUnit artifacts show that `O-live-quiz.spec.ts` alone took 1029 seconds.
The next slowest files took 664 seconds (`P-microlearning.spec.ts`) and 600
seconds (`S-group-activity.spec.ts`). The merged workflow uses eight shards and
restore-only caches, so the first eligible PR run is the required clean
benchmark before changing test boundaries.

Run `33246023106` supplied the first eight-shard benchmark. All eight shards
started at 09:44:22 UTC on distinct runners `public-pr-arm64-01` through `-08`
with no queue delay. The restore-only build took 3m59s, down from 7m43s. Shard
jobs ranged from 14m30s to 21m24s, and the full workflow took about 25m54s.
`O-live-quiz.spec.ts` remained the largest spec at 846 seconds. Shard 4 exposed
a deterministic Slate-editor clear failure in `G-elements-mc.spec.ts`; the
other seven shards passed, so this is application-test debt rather than a
runner-capacity failure.

Run `33247245177` confirmed the editor fix was initially too broad. Five
element specs failed because the replacement helper treated Slate placeholder
text as editor content. The final implementation keeps keyboard deletion only
for the feedback validation assertions and restores the established replacement
path elsewhere. Its green live-quiz shard measured 796 seconds; splitting that
inventory produces estimated 394-second and 437-second files.

## Slices

### S0: Establish the eight-shard benchmark

Add non-invasive shard-allocation telemetry to the checked-out sharding script.
Publish the branch and record the first exact-head run using the merged reusable
workflow. Capture queue delay, build duration, runner names, setup duration,
each shard duration, artifacts, retries, and total wall time.

Acceptance: all eight shards start on `public-pr-arm64-*` runners, upload JUnit
artifacts, and feed a successful hosted `test-playwright-status` job.

### S1: Remove the live-quiz critical-path floor

Split the monolithic serial live-quiz file only at scenario boundaries that can
create and clean up their own state. Preserve every test and assertion. Do not
enable test-level parallelism or raise workers while tests still share users,
database rows, Redis keys, and Hatchet state.

Acceptance: Playwright lists the same test inventory, TypeScript and formatting
pass, and exact-head CI has no cross-file state failures. The new files spread
across more than one shard and shorten the longest shard relative to S0.

### S2: Keep only evidence-backed setup changes

Retain the hosted status gate and restore-only public caches. Add concise runner,
allocation, and phase timing summaries. Change dependency, seed, or service
setup only when S0 or S1 shows a material critical-path cost and the change
preserves disposable per-shard isolation.

Acceptance: no public PR job writes caches or receives secrets; telemetry
contains no sensitive values; workflow syntax and repository checks pass.

### S3: Publish and finish

Update the testing wiki with the measured behavior and remaining bottleneck.
Push the complete branch, monitor exact-head CI, update the PR with exact runner
and timing evidence, and squash-merge after non-review checks pass.

## Verification

- Run the sharder for all eight indices and require every active spec exactly
  once.
- Compare `playwright test --list` before and after the live-quiz split.
- Run Playwright TypeScript, Prettier/YAML, repository `check:all`, and the full
  build before publication.
- Treat GitHub Actions as the runtime acceptance gate for the complete service
  topology. Do not infer runtime success from static checks.
- Inspect exact-head JUnit artifacts for failures, retries, per-spec duration,
  and complete eight-shard coverage before merge.

## Progress

- [x] PR #5620 passed exact-head CI and merged as `c7bc6b5d5`.
- [x] Fresh branch and isolated worktree created from the merged `origin/v3`.
- [x] S0 telemetry published and first eight-shard benchmark recorded; all
      eight runners started immediately and runner capacity is proven.
- [x] S1 live-quiz critical path split into independent 39-test and 44-test
      files. Run `33248686298` proved seven shards and exposed an existing
      activity-count mismatch on shard 7; a focused service regression test
      now covers the correction before the replacement exact-head run.
- [x] S2 setup changes limited to measured bottlenecks. Restore-only caches and
      disposable per-shard databases remain; runner and route summaries were
      added instead of adding unproven setup complexity.
- [x] S3 exact-head checks passed and PR #5648 merged as
      `f0659e1301254320b2f67a0a4be752ebf6a41c0f`.
