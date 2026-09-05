# Faster KlickerUZH pull-request validation

## Approval summary

Reduce time from a pull-request update to useful feedback and a trustworthy
merge decision within the existing runner budget. The current fleet remains
two public ARM64 hosts with four runner processes each. GitHub-hosted runners
continue to handle other workflows and the existing Playwright fallback.

The work first makes the existing cache and draft-selection mechanisms usable,
repairs timing feedback, and diagnoses recurring test failures. Later packages
remove duplicate validation, reuse hosted dependency and Docker build work, and
improve shard placement and selective builds. Ready-for-review PRs retain full
Playwright coverage. Public jobs remain secret-free, restore-only cache readers
inside the existing Klicker-only runner-group boundary.

The user authorized this roadmap and execution through a goal on 2026-09-05.
Local implementation, focused verification, reviews, and conventional commits
are in scope. Live variable changes, workflow dispatches, branch protection,
runner changes, publication, and merge are recorded as separate delivery actions.
Prepare their exact commands and evidence before requesting any missing authority.
There is no new VM, paid runner, cache server, external data provider, or host
reconfiguration in this roadmap.

Success requires unchanged test coverage, correct cached and uncached outputs,
and representative measurements of queue time, execution time, failures, and
occupied runner minutes. Passing source checks is source readiness; live speedup
is a separate result. Keep unmeasured work explicitly pending.

## Execution details

### Working context and ownership

- Repository: `uzh-bf/klicker-uzh`; target: `v3`.
- Baseline: `fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`.
- Worktree: `trees/rs/ci-throughput-roadmap`.
- Branch: `rs/ci-throughput-roadmap`, initially tracking `origin/v3` at 0/0.
- Boundary owner and execution owner: this task's main session.

The primary checkout has unrelated edits and is excluded. Earlier CI worktrees
are retained. This roadmap follows the historical
[smart-routing plan](2026-08-31-playwright-smart-routing-and-trusted-cache-plan.md)
without rewriting its historical progress. Use sequential coherent packages;
this is not an approved native stack. The trusted reusable workflow executes
from `v3`, so branch CI cannot prove an unmerged orchestration change is active.

Keep host operations with [the existing runner PR](https://github.com/uzh-bf/klicker-uzh/pull/5655).
Keep staging release changes with [the controller PR](https://github.com/uzh-bf/klicker-uzh/pull/5781)
and [the release-ref PR](https://github.com/uzh-bf/klicker-uzh/pull/5782).
Do not edit their deployment or promotion seams here.

### Evidence collected on 2026-09-05

| Observation | Evidence | Consequence |
| --- | --- | --- |
| Draft selection is inactive | [Hosted draft run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33966559877) reports `smart-draft-disabled`, full mode, eight shards | The intended fast draft path is not live |
| PR caches are inactive | That hosted build reports 21 tasks, zero cached; [ARM64 run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33964843484) reports 24 tasks, zero cached; both report `cacheEnabled=false` | Activate only after compatible trusted seeds and canary validation |
| Pool queue pressure persists | ARM64 run takes about 58 minutes; build queue 3m25s, shard queues about 15–26 minutes | Reduce work entering the queue before buying capacity |
| Hosted queue is short in the sample | Hosted draft completes in about 23 minutes, with 2–3-second shard queues | Other hosted jobs are not demonstrated to be the bottleneck |
| Same tests fail across routes | ARM64 run and [hosted failure](https://github.com/uzh-bf/klicker-uzh/actions/runs/33966579799) fail feature-access and responsive wizard cases | Investigate tests and candidate source before blaming hardware |
| Trusted seed exists but is ARM64-only | [Seed run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33961433762) succeeds with a 147-second build and zero task hits | Hosted x64 needs its own compatible seed |
| Cache storage is substantial | Actions API reports 10,387,692,835 bytes and 29 entries | Avoid dependency-store copies per commit; no automatic deletion |
| Docker reuse is disabled widely | 28 workflow declarations of `no-cache: true` | Pilot scoped BuildKit reuse before broad source rollout |
| Timing feedback is broken | [Timing run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33962438607) rejects `junit.xml contains non-zero skipped` | Token validation passed; fix aggregation, not token setup |
| Merge policy differs from documentation | Branch protection returns empty contexts with strict enabled; branch rules endpoint returns an empty list | Reconcile desired policy before changing any gate |

These samples have different source changes, architectures, and workloads. They
are diagnostic examples, not a controlled speed comparison or a flake-rate
estimate. The sampled hosted code check finishes in roughly two minutes, with
32 seconds installing dependencies; its incremental build has little work.

### Binding contracts

The only public self-hosted group remains `public-pr-arm64`, selected for
`uzh-bf/klicker-uzh` and
`uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`.
Preserve the caller's `@v3` syntax, trusted control checkout, candidate-as-data
planning, read-only permissions, and non-persisted checkout credentials.

Ready PRs run every active candidate spec exactly once across the full matrix.
Draft selection remains conservative: unknown or shared changes use full mode.
Retain the existing ten-representative-shadow-comparison gate before global
smart selection. Forks, bots, pushes, and other existing ineligible cases retain
their documented hosted route. Preserve cancellation and always-reporting status.

Caches are optional acceleration. Public PRs cannot write trusted caches or
receive cache credentials. CPU architecture, package-manager compatibility, and
build environment remain separated. A cache-service failure permits an ordinary
install/build; an actual compilation or test failure must remain a failure.

### Packages and delegation map

| Slice | Owner | Dependency and acceptance |
| --- | --- | --- |
| Separate dependency and build cache contracts | main | Existing cache fixtures protect independent invalidation and trust boundaries |
| Wire dual-architecture seeds and compact telemetry retention | main | After cache contract; wiring is a short mechanically coupled change, checked by workflow policy and YAML parsing |
| Repair skipped-test timing aggregation | executor | Synthetic mixed/skipped-only/failure/count/coverage fixtures; preserve prior unmeasured timings |
| Establish candidate browser failure ownership | main | Exact candidate/v3 comparison and reproduction evidence |
| Repair a proven v3 browser defect | executor | Only after ownership proof; targeted host browser verification without weakened assertions |
| Suppress equivalent duplicate validation | main | Event and API-error fixtures; preserve v3 and standalone coverage |
| Reconcile desired required checks | main | After event gate; each context maps to a surviving producer, proposal only |
| Reuse hosted dependency builds | executor | After cache contract; equivalent generated-output ordering and cold/warm correctness |
| Measure runner occupancy and critical path | main | Complete comparable run records; source and evidence interpretation are coupled |
| Improve service-aware shards and selected build union | main | After timing repair and metrics; exact coverage, deterministic assignment and complete artifact contract |
| Pilot scoped Docker BuildKit caching | separate task (proposed) | After release owners settle; separate authorization, Dockerfile inspection, fresh equivalent image proof |
| Prepare rollout commands and evaluate canaries | main | After source delivery; explicit mutation authority, exact readback and representative cohort evidence |

Within these packages, use the following commit boundaries: separate cache
contracts; wire dual-architecture seed consumers; repair skipped-test timing
aggregation; record candidate failure ownership; fix a reproduced v3 browser
defect only if established; suppress equivalent duplicate validation with the
required-context proposal; reuse hosted dependency builds; measure occupancy;
then implement an evidence-supported shard/build change. The main session owns
the coupled cache, event, and profile contracts. Timing aggregation and hosted
dependency changes are assigned to executor slices.

Main-session retention is due to critical-path coupling or unresolved cache,
coverage, and scheduling decisions. Delegate only disjoint mechanical subsets
with settled acceptance. Required planner, slice review, simplification, and
final review follow `rs-sliced-development-workflow` and `rs-model-routing`.

### Cache readiness and timing feedback

Separate a pnpm dependency-store fingerprint from the existing conservative
Turbo build fingerprint. Include the lockfile, workspace/package-manager
configuration, Node/pnpm compatibility, and any package manifests or patches
that influence installation. Workflow telemetry or profile changes should not
discard an otherwise compatible dependency store. Keep OS/architecture in keys.
Use a stable immutable dependency key rather than a source-SHA copy per commit;
retain source-specific Turbo snapshots and compatible fallback prefixes.

Seed both ARM64 and x64 using the existing pinned image and synthetic build
environment on hosted runners. Matrix artifact names must be unique. The
trusted `v3` seed remains the only writer; public consumers remain restore-only.
The additional hosted seed consumes CI capacity, so report its runtime and
storage cost and avoid duplicate saves on exact hits.

Retain compact route, plan, build, and queue telemetry for seven days. Keep large
build archives and failure screenshots at their existing short retention. Record
whether cache restoration was enabled, whether a compatible key matched, and
how many Turbo tasks actually hit; these are different measurements.

Repair timing aggregation to handle explicitly skipped testcases from successful
runs. Validate root/suite counts and testcase outcomes. Reject missing shards,
duplicate or unknown specs, failures/errors, malformed input, and invalid measured
durations. Preserve prior timings for skipped-only specs rather than inventing
zero durations. A fully skipped run must not publish fresh measured evidence.
An entirely skipped new spec without a valid prior timing fails closed. Project
x64 storage growth from the current ARM64 store sizes before activation; retain
cleanup as a separately authorized operation. Seven-day compact retention covers
one weekly comparison window; longer retention remains an optional measured need.

Prepare exact canary, rollback, and readback commands for the existing cache and
smart-draft variables. Do not silently change the default-off controls in code.
Commit cache changes and timing repair as separate verified slices.

### Recurring browser failures

Map each failing test to its exact candidate commit and compare with `v3`.
The account-usage-hidden case exists on `v3`; the sampled analytics-profile-error
case is absent there. Do not import branch-only tests or application behavior
into this CI package. The responsive wizard case also requires exact-source
comparison and reproduction before a fix.

Use traces and request/locator evidence to distinguish fixture setup, stale
generated outputs, product defects, and timing races. Repair only a proven
cause. Preserve assertions about user-visible behavior. Increasing timeout or
retry counts, removing coverage, and relabeling failures as flakes are not fixes.
Browser verification uses the repository's host Playwright path against only
the relevant managed app/profile. Record source-specific handoff evidence for
work owned by other branches; do not duplicate an active fix.

### Duplicate validation

Inspect push/PR overlap for `v3*` branches. Preserve full validation after pushes
to `v3`, standalone branches without PRs, and PR lifecycle transitions. Limit
changes to validation workflows; Docker publication and promotion remain outside
this package. An API error or ambiguous PR match must retain validation.

Do not equate same head SHA with the same test subject: a PR merge ref may differ
from the branch push tree. Suppression needs an equivalent surviving test subject
and a guaranteed trigger. If that cannot be demonstrated, retain both and report
the residual cost. Do not add a global concurrency lock or automatic retries.
Any suppression requires exactly one open same-repository PR with the same
head SHA and a base accepted by the workflow's PR trigger. Those predicates are
necessary but not sufficient where the PR merge tree changes the test subject.
Fold the desired required-check table into this package's documentation.

### Hosted build reuse

Add pnpm-store restoration to GraphQL tests. Replace manually sequenced package
builds with the existing Turbo dependency graph only after checking generated
Prisma/GraphQL output ordering. Use current caching mechanisms; do not inject
new secrets into public PR jobs. Keep database integration tests uncached unless
their independent deterministic contract is explicitly established.

Pilot Docker caching on one representative image. Scope cache by image,
architecture, and environment. Retain upstream freshness through the appropriate
pull and invalidation policy, with an ordinary uncached escape hatch. Inspect
Dockerfile inputs and outputs before removing `no-cache`. Preserve runtime image,
build arguments, tags, publication permissions, and deployment semantics. Expand
only after the pilot's source checks and exact-image comparison succeed.
Docker caching is a later separate work package, outside the current source
package. Begin only after the staging release owners' overlapping changes settle
and Dockerfile stages can be inspected. No separate task is created implicitly.

### Shard and selective-build efficiency

Collect complete successful runs with warmed caches before selecting thresholds.
Measure prepare, build queue, build work, shard queue, setup, test execution,
artifact transfer, and final status independently. Compare like event, mode,
architecture, source workload, cache state, and run attempt. Keep failing and
cancelled runs in throughput accounting but separate from runtime benchmarks.

Evaluate deterministic service-aware placement against current timing-balanced
placement. Every assigned spec must retain its required profile union; readiness
and background worker requirements are not optional. Compare longest shard time
and total app/service occupancy. Keep the current algorithm if no material gain
is demonstrated. Do not assume fewer started processes means faster completion.

For selected draft builds, derive the transitive application/package union from
the canonical trusted plan. Update the artifact contract to preserve every
runtime dependency. Retain full builds for unknown unions or unsupported cases.
The fixed job-level service containers are a separate limitation; do not mount
the host Docker socket to make dynamic services easier.

Do not initially cap ready PRs at four concurrent shards: that improves fairness
but can double the number of execution waves. Consider a cap or hosted overflow
only after measuring remaining contention and evaluating hosted headroom. No
new scheduler, cache service, or fleet capacity is part of the first iteration.

### Merge policy and rollout

Produce an exact desired-versus-observed table of required contexts and their
workflow producers. Evaluate check, secret scan, GraphQL, Playwright, and image
validation contracts; do not restore historical names blindly. Path-filtered
checks need reliable aggregate reporting. A merge queue is a later decision:
required workflows need supported `merge_group` events and equivalent trust
handling before it can be enabled.

Activate cache restoration for one exact PR only after trusted seeds exist.
Compare cached and uncached results at the same candidate where feasible. A
successful matched cache must show expected task reuse and identical required
outputs. Preserve an immediate rollback by clearing the exact canary variable.
Global cache activation follows demonstrated compatible reuse.

For smart drafts, inspect at least ten representative shadow plans, including
spec-only, feature, shared, documentation, new/deleted spec, and unknown changes.
Disposition every missed failure or unexplained omission. Then prove draft to
ready to draft behavior on one exact PR before global activation. Report full
ready coverage separately from draft speed. Verify the runner-group restriction
before activation; unavailable organization permissions remain a named blocker.

### Test portfolio and verification

| Consequential behavior | Evidence |
| --- | --- |
| Dependency reuse without build-cache incompatibility | Extend existing cache-contract fixtures with independent invalidation cases |
| Public reader and trusted writer separation | Existing workflow policy validator plus exact diff review |
| Valid skipped tests do not disable timing feedback | Synthetic JUnit regression tests; malformed/count/coverage/failure rejection |
| Draft selection and ready completeness | Existing route/selector/sharder fixtures and later shadow/lifecycle canaries |
| Duplicate suppression retains validation | Synthetic event/PR API cases including ambiguous and failed queries |
| Build and artifact equivalence | Repository-native generated-output checks and cold/warm build evidence |
| Browser regression repaired | Original relevant browser reproduction and post-fix behavior |

Pure Node source-contract checks can run without an application runtime; record
the host toolchain version. Container-dependent installs/builds/tests use the
repository-supported container. Start a runtime only for behavior that requires
it, then stop and verify the exact runtime. Source checks are not browser proof.
Use existing formatters and checks; no new dependency or prose-pinning tests.

### Research and maintenance

Current GitHub documentation confirms that `max-parallel` caps matrix execution
and merge queues require `merge_group` triggers. Consult current official Docker
and Turbo documentation before changing their cache configuration. A custom
Turbo cache API is possible but not needed for this roadmap's first packages.

Update `docs/ci-and-deployment.md` where changed behavior invalidates its cache,
timing, or rollout guidance. Update the repository Playwright skill only when
its actionable workflow changes. No shared skill or agent configuration changes
are included. Existing cache/profile architecture is refined reversibly; an ADR
is required before adopting a cache server, new scheduling service, or changed
runner trust model.

### Delivery and stopping conditions

Authority: approved local roadmap execution and scoped diagnostics.
Terminal: reviewed, verified source packages and concrete operator actions;
live effectiveness remains pending until separately authorized rollout evidence.
Pause only for material coverage/cost/trust decisions, missing runtime or review
capability, competing ownership that cannot be worked around, or a new external
action lacking authority. Finish unaffected source work before returning at a
delivery boundary. Never mark the whole roadmap complete from one passing slice.

Rollback source changes through ordinary reverts. For live canaries, restore the
recorded prior variable state and read it back once authorized. Do not delete
caches, stop runners, modify runner groups, or change branch protection as a
substitute for source rollback.

## Progress

- Goal active; local execution requested by the user.
- Created clean worktree from fetched `v3`; old worktrees remain untouched.
- Baseline: 19 cache, route, and workflow-policy tests pass on host Node 26.8.1.
  Repository-pinned Node 24 verification remains to be established.
- Planning review: three rounds returned REVISE. All substantive findings were
  incorporated. The last round found only a contradictory ownership sentence;
  it was corrected and checked by the main session. There is no terminal planner
  APPROVED verdict. Further source work retains the user's execution authority;
  integrated review must assess this complete corrected plan and implementation.
- Exact timing failure established; no token repair is indicated.
- Active package: cache readiness and timing feedback. Dependency fingerprint
  regression fixtures pass on the repository-pinned Node 24.17.0 runtime.
- Remaining packages and rollout obligations are listed above. No source
  optimization, commit, publication, settings mutation, or live speedup yet.
