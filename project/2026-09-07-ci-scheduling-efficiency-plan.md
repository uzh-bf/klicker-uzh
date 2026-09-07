# Reduce obsolete Playwright work and qualify selective drafts

## Approval summary

Free CI capacity when a pull request closes, without cancelling post-merge
verification or reducing ready-for-review test coverage. Add a checkout-free
hosted close-event job to the existing Playwright caller. It joins the exact
PR execution concurrency group and replaces the obsolete invocation. It has
no API permissions, runs no candidate code, and never targets the ARM64 pool.

Qualify the existing smart-draft selector before enabling one exact canary.
Keep the documented ten representative comparisons with no unexplained misses.
Ready PRs and pushes retain full execution. Global rollout, runner allocation,
cache policy, and shard concurrency remain unchanged. Compare queue time with
execution time before proposing another scheduling change.

The user approved this package and a goal on 2026-09-07. Approval covers local
source edits, focused verification, independent reviews, and local commits.
Canary activation is a conditional follow-on after qualification and reporting
the exact target. Push, PR publication, merge, forced events, retroactive run
cancellation, and runner changes remain withheld. The immediate terminal is
reviewed local source plus a qualified or not-qualified canary receipt.

The main risk is cancelling the wrong invocation; exact concurrency keys and
event guards are binding contracts. GitHub cancellation is asynchronous and
does not prove instant capacity recovery. A source-level test cannot prove the
live close event. Natural lifecycle proof follows separately approved delivery.

## Execution details

Branch: `rs/ci-scheduling-efficiency`, based on `origin/v3` at
`1fb8b852684c4155f5d375f7c211c5d0be1f923d`, initially zero ahead and behind.
Worktree: `trees/rs/ci-scheduling-efficiency`. Artifacts root: `project/`.
Boundary owner: self. No existing active package owns these edits.

### Evidence and research

[The disposable-database PR run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34096284270)
waited 31m27s for its ARM64 build, which executed in 2m23s. Its PR had merged
before eight shards occupied the pool. Another
[hosted codebase check](https://github.com/uzh-bf/klicker-uzh/actions/runs/34096283973)
waited 7m09s and ran for 1m45s. These are snapshots, not normalized savings.

[GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
states that jobs sharing a group can cancel prior work. Context7 confirmed
the closed-PR trigger and shared-group semantics on 2026-09-07. Preserve the
workflow name and existing group expression so a merged close event still
uses PR identity rather than the changed merge ref. GitHub does not guarantee
concurrency ordering; rapid close/reopen transitions need natural-event proof.

### Contracts and slices

| Slice                         | Owner                                | Acceptance                                                                          |
| ----------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Cancel obsolete PR execution  | Main                                 | Job-scoped YAML validation, negative mutations, unchanged push keys and permissions |
| Qualify one selective draft   | Main, with read-only mapping support | Provenance-bound shadow/full comparisons; explicit qualified/not-qualified receipt  |
| Record pool fairness evidence | Main                                 | Separate queue/runtime/duplicate load; no concurrency mutation or savings claim     |

Main retains cancellation design and settings decisions because of critical-path
coupling. Existing scoped API evidence covers the third slice; another collector
would duplicate work. A read-only explorer maps selector contracts; its provider
failed before work, so one trusted Luna continuity child supplies that result.

The close job and execution invocation use exactly
`${{ github.workflow }}-playwright-${{ github.event.pull_request.number || github.ref }}`
with `cancel-in-progress: true`. Only a closed `pull_request` runs the close job;
execution excludes that event. Status and queue telemetry keep `always()` and
exclude closed events. The close job has `permissions: {}`, a five-minute
timeout, a hosted runner, no dependencies, and one literal no-op. No checkout,
API call, workflow-level concurrency, or called-workflow concurrency is added.

Extend the existing validator using the declared YAML dependency. Protect each
job's structure, not a global count alone. Replace the affected textual test
with structural cases. Test wrong keys, misplaced concurrency, missing guards,
elevated permissions, candidate checkout, and self-hosted execution through
synthetic workflow mutations. Keep all unrelated policy assertions unchanged.

For canary qualification, record PR/head/base/merge-base, trusted control SHA,
run and attempt, selected specs, profile union, and full-run failures. Missing
provenance, unexplained misses, and full-fallback-only observations are not
proof of selective coverage. Preserve hard rejection versus full fallback.
Only `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_CANARY_PR` may be proposed for activation;
the global flag stays absent. Removing that canary restores full execution;
forcing hosted execution alone does not disable selection.

### Verification and delivery

Use the pinned Node 24.16.0 Docker toolchain and existing dependencies. Install
Git only inside the disposable test container for selector fixtures. Run the
existing Playwright CI contract suite, YAML policy validation, scoped formatting,
diff inspection, and secret scan. No application runtime or browser is needed.
Keep existing route/selector tests; add only consequential close-event contracts.

Commit this plan, then the cohesive implementation and documentation. Run the
independent simplifier and risk-selected slice review on the committed change,
resolve findings, then final review of the complete local package. No new ADR
or skill change is needed: this is reversible CI lifecycle wiring using existing
controls, not a new infrastructure or trust boundary. Update the CI guide's
lifecycle description and record exact canary evidence here.

Pause for an unqualified canary, missing live proof, unexplained test omissions,
material trust/cost changes, or an unapproved external action. Do not silently
relax qualification to finish the goal.

## Progress

Planner approved revision 2 after four accepted contract/verification corrections.
The main session verified the ten-comparison requirement in the current CI guide.
Baseline: 25 route, selector, and workflow tests pass in Node 24.16.0. Initial
container attempts lacked a writable nested mount point, then Git; the corrected
read-only source/dependency mounts and container-only Git install passed.

The first candidate, the
[course-overview draft](https://github.com/uzh-bf/klicker-uzh/pull/5798), is not
qualified: run `34031639568` at head
`577db334cf3da9c2f2130c49b638fb61aab3eb68` produced `history-unavailable`, no
merge-base, and eight-shard full fallback. No variable has been changed.
Implementation and independent reviews remain pending. Publication is withheld.
