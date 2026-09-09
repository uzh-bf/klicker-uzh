# Reduce redundant CI queue work

## Approval summary

Reduce Klicker CI waiting time by preventing unnecessary review bootstrap jobs,
stopping obsolete validation reporters, combining Playwright reporting and queue
telemetry, reusing proven equivalent PR validation, and cleaning up verified
obsolete PR runs. Keep the existing runner budget and test coverage.

The user authorized mapping and executing these improvements in one PR, then
confirmed “proceed”. This permits local changes, focused checks, reviews,
commits, ordinary branch publication, a draft PR against `v3`, and bounded
cancellation of freshly verified obsolete validation runs. It excludes merge,
deployment, runner or repository settings, and image or review-status writers.

Cancellation and deduplication can hide useful evidence if applied too broadly.
Missing or ambiguous equivalence evidence therefore runs normal validation.
Cleanup starts with a dry run and revalidates each exact run before mutation.
Source checks prove policy correctness; live queue improvement requires the
trusted workflow changes to merge and execute.

## Execution details

Baseline: `59162306987dafe816f007fe3750f4f3c06d9c66` on `origin/v3`.
Branch: `rs/ci-queue-efficiency`; worktree: `trees/rs/ci-queue-efficiency`.
The primary checkout contains unrelated changes and remains untouched.
Use one integrated implementation slice and one PR as explicitly requested.

| Improvement | Owner | Acceptance |
| --- | --- | --- |
| Filter unrelated final-review comments before runner allocation | executor | Preserve all PR lifecycle events and both exact review commands; preserve status locks |
| Stop superseded GraphQL and Playwright reporters | executor | Exclude workflow cancellation and canceled dependencies; still report real failures and path skips |
| Combine Playwright telemetry with its reporter | executor | One hosted job, read-only token, best-effort telemetry and cancellation-aware uploads |
| Reuse equivalent PR validation for non-default push runs | main | Exact source, base, workflow, latest attempt, executed coverage and environment proof; uncertainty runs normally |
| Bounded obsolete-run cleanup | main | Dry-run default, explicit IDs, PR-only allowlist, fresh identity and replacement proof, terminal readback |

The executor owns the review workflow gate, GraphQL and Playwright caller
reporting, and their policy tests. The main session owns the shared equivalence
helper, unit and trusted reusable workflow wiring, cleanup utility, documentation,
and integration. Only the main session performs forge mutations. Keep one writer
per file; wire caller permissions after the executor returns.

### Equivalence contract

Only a non-`v3` push can reuse validation. Require one current, open, ready,
same-repository PR at the exact head and branch. Its latest same-workflow PR run
and latest attempt must have succeeded, with the recorded base matching the live
PR base and the tested merge tree matching the push tree. A small artifact records the
actual checkout tree, event head/base, run ID and attempt; old runs without this
receipt remain ineligible. Reject ambiguous PRs,
forks, drafts, manual runs, skipped tests, failed or canceled replacements, API
errors and incomplete evidence. Revalidate immediately before accepting reuse.

Playwright additionally requires the same trusted reusable control revision,
hosted route and full eight-shard coverage. Compare the previous canonical plan
artifact with the current spec, profile and shard contract. Preserve canonical
plan metadata and expose a separate reused-run identifier. Forward read-only API
permissions only to preparation; actual builds and shards retain contents-read.
The caller remains compatible with the old trusted reusable workflow until merge.

Unit suites require actual successful test steps. Their reuse lookup runs only
on push reruns: initial pushes retain one runner allocation, avoiding a new
serial queue wait when equivalent PR validation is not yet complete. Other workflows retain push
coverage where path or build selection semantics differ. Translation checks are
already PR-only. Default-branch timing feedback and image publication continue.

### Cleanup contract

The host CLI utility defaults to read-only inventory. Application requires exact
run IDs. Allow only named validation workflows on `pull_request` events. A run
must belong to the exact repository, workflow, PR and attempt, and its PR must
be closed or have a newer head with a verified current replacement for the same
workflow. Exclude pushes, manual and review events, images, release and deployment.
Use bounded complete pagination and fail closed on ambiguity. Recheck predicates
before cancellation and any force cancellation. Stop an item when readback is
inconclusive; never infer redundancy from age alone.

### Verification and review

Use the pinned Node 24.16.0 disposable container for script tests and YAML policy
checks. No application runtime is needed. Cover event gates, dependency failure
and cancellation, exact equivalence and its rejection cases, pagination/API
failures, and cleanup identity races with synthetic fixtures. Run existing
Playwright policy and final-review suites, repository formatting, staged secret
scan and exact diff inspection. Application build/typecheck is unrelated to
these CI scripts; record focused verification separately from platform CI.

After the committed implementation, run simplifier and risk-selected slice
review, then the integrated Claude CLI final review. Verify every finding.
Push the ordinary task branch, create one draft PR, and inspect its checks.
Execute only the reviewed cleanup candidates with fresh readback. Stop at draft
source delivery; merging and activation remain separate actions.

## Progress

- Remote baseline refreshed; task branch starts at 0 ahead and 0 behind `v3`.
- Existing final-review and public Playwright policy baseline: 118 tests pass.
- Planner r1 requested stricter equivalence, latest-attempt binding, dependency
  cancellation guards, permission forwarding and exact cleanup identity.
  All findings were incorporated. Frozen r2: APPROVED, no blockers.
- Planner: native Astra medium. Complete unpublished scope stays on the trusted
  route; it was not submitted to ChatGPT Browser.
- Implementation is complete. The integrated pinned-container suite passes all
  245 tests, including equivalence, cleanup, reporting, review, cache and runtime
  planning contracts. No tests are skipped.
- All changed workflow YAML and 86 embedded shell/JavaScript scripts parse.
- Initial full suite passed 232/233; the sole failure was the old telemetry-job
  fixture during executor integration. The pinned Devrouter planner is installed
  only in the disposable test container, with no router or app runtime started.
- Read-only cleanup inventory found four active validation runs, all at their
  current PR heads. No runs were eligible and no cancellation was performed.
- YAML and embedded-script syntax, focused Biome/Prettier formatting and diff
  checks pass. Full application build/typecheck hooks are not applicable to this
  CI-only package; they are not claimed as passing.
- Ready-for-review churn: PR #5866 was marked ready at 19:13:48Z with an
  unchanged head and every PR workflow re-fired. `test-graphql` had already
  passed for real on the same SHA at 18:14Z because it has no draft gate, so
  the ready run was a pure duplicate of the heavy Postgres/Hatchet suite.
  Draft-gated workflows (unit, CodeQL, SonarCloud, staging builds) only start
  at the transition by design. Fix: `test-graphql` and `test-intl-production`
  no longer list `ready_for_review`, so their draft-era green runs stay
  authoritative; a new `ci-event-gates` policy test fails any
  `ready_for_review` trigger without a draft gate or documented lifecycle role
  (Playwright plan recompute, final review handoff) and it flagged
  `test-intl-production` immediately. Contract documented under PR gates in
  `docs/ci-and-deployment.md`.
- Simplifier, risk review, final review and draft PR remain pending.
