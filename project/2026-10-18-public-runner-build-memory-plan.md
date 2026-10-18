# Public runner build memory and capacity qualification

## Approval summary

Reduce simultaneous application builds within each public ARM64 Playwright job
before considering additional runner slots. Start with the smallest reversible
source change: use Turbo task concurrency two on the public route, while keeping
hosted builds at four. This is an experiment in lower memory demand, not a
memory limit or a capacity guarantee. Individual Next.js builds can still spawn
their own workers.

Keep runner activation, browser worker counts, service isolation, cache ownership,
trusted workflow selection and required checks unchanged. Do not introduce a host
scheduler, memory caps, new runner groups or a new configuration owner in this
package. The main trade-off is longer build time; paired measurements must decide
whether the reduction earns its cost.

The user approved the Astra-reviewed plan on October 18, 2026 with "agreed,
lets do that". Approval is an executable source batch: implement the bounded change, verify it,
review it, push the task branch and deliver one draft pull request targeting
`v3`. It does not authorize readiness, merge, CI reruns of other pull requests,
live experiments or activation. Those later actions need the exact conditional
approval described below.

Source delivery is done when focused checks and review pass, the draft has
exact-head CI, actionable feedback is settled, and a private qualification
protocol is ready. Runtime benefit remains unproved until the merged trusted
action executes representative jobs. Additional capacity requires a separate
budget and supervised trial; if either fails, retain the existing operating
point rather than expanding the implementation.

## Execution details

### Identity, ownership and authority

- Target: `v3`; source baseline: `27421631db7a7c39d80e494ee1c00489622685fc`.
- Branch: `rs/runner-capacity-qualification`; worktree:
  `trees/rs/runner-capacity-qualification`; artifacts root: `project/`.
- This is a new package. The [recovery plan](2026-10-17-runner-recovery-telemetry-plan.md)
  and [merged recovery PR](https://github.com/uzh-bf/klicker-uzh/pull/6581)
  are history, not unfinished source work. No new pull request exists yet.
- Boundary owner and execution owner: main session. Execution mode is standard
  because runtime model identity is not supplied. The user requests Astra for
  planning; that bounded read-only exception does not authorize other children.
  Keep implementation and external actions in the main session.
- Ceremony: full path for the performance experiment and capacity qualification.
  One cohesive ordinary PR is sufficient; no stack or plan-only PR.
- Approval mode: executable source batch, approved. Commit this plan first,
  then implement the two source slices through the verified draft boundary.

### Public source contracts and research

The reusable workflow directly owns both public jobs and the hosted fallback.
Both public build and shard jobs use the same eligible runner group and labels.
Therefore adding a generic slot can add a full build, not merely another shard.
Per-PR execution concurrency and matrix limits cannot enforce a per-host budget
across independent runs; do not treat either as admission control.

The shared build action currently runs both bounded and full application graphs
with `--concurrency=4`. Its full path builds Prisma separately. Preserve graph
selection, dependency ordering, artifact contents, Prisma sequencing, pipeline
failure propagation and resource sampling. Use the existing trusted `route`
input to select public two or hosted four; expose no repository variable or
candidate-controlled override. Apply the same choice to both application paths.
Reject an unexpected route before executing a build.

Research question: does Turbo concurrency bound memory or runnable tasks?
The [official Turbo run reference](https://turborepo.com/docs/reference/run#--concurrency-number--percentage)
defines a maximum task count; it is not a bound on subprocesses or RAM.
The repository pins Turbo `~2.10.11`; verify the installed version and its help
during implementation. Do not use `--parallel`, which overrides concurrency.
Main-session research owns this question; Astra challenges the design.

The [cgroup v2 interface](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files)
distinguishes current hierarchical usage, lifetime peak, anonymous memory,
file cache, kernel memory and cumulative events. The existing wrapper samples
its cgroup and descendants, excluding sibling service containers. Use raw
cgroup counters for capacity work; the [Docker stats display](https://docs.docker.com/reference/cli/docker/container/stats/)
subtracts cache on Linux and is not an equivalent measurement.

Keep operational measurements, host identities, credentials and receipts outside
the repository and public CI output. Public text may describe the method and
source contract, never private observations. Do not publish host-wide collection
from a PR job or mount a host Docker socket into that job.

### Alternatives and decision

| Approach | Decision | Reopen when |
| --- | --- | --- |
| Lower public build task parallelism | First experiment; smallest source-only change | Measurements show no useful reduction or unacceptable latency |
| Per-host build admission | Defer; requires a trusted host owner and cancellation-safe reservations | Reduced builds still cannot fit an arbitrary additional generic job |
| Dedicated build/shard lanes or larger hosts | Defer; changes scheduling policy or cost | A reviewed budget shows tuning cannot meet the required throughput |

No end-user product primitive changes. No ADR is required for the route-specific
task count. A host scheduler, trust-boundary change or separate lane would arm
the ADR and architecture decisions in a subsequent plan, not extend this batch.

### Test portfolio

| Consequential behavior | Existing protection | Obligation and stable seam |
| --- | --- | --- |
| Public builds receive the lower task count and unknown routes fail closed | Public workflow validator and action fixtures | Extend existing: synthetic command capture for both routes and graphs, plus unknown-route rejection |
| A build or logging failure cannot become success | Action checks every relevant pipeline result | Extend existing: exercise build and log failures in the same fixture; retain Prisma failure handling |
| Graph, artifact and trust contracts stay intact | Existing graph, cache, route, sampler and workflow suites | None: reuse and run affected suites, without new content-pinning tests |
| Memory improvement and usable artifacts are real | Existing resource sampler and Turbo telemetry | None: inspect actual producer execution and completed shards during later live qualification |

### Source slices and commit boundaries

All slices are main-owned under the explicit ownership restriction. The retained
work is tightly coupled to the route and experiment contract. Astra owns only
the read-only plan challenge. No executor or peer task is proposed.

Delegation Map:

| Workstream | Slices | Owner | Dependency, acceptance and stop boundary |
| --- | --- | --- | --- |
| Route-specific build experiment | 1 | Main | No dependency; real-shell synthetic checks pass; stop before delivery if route or failure contracts cannot be preserved |
| Verified source delivery | 2 | Main | Depends on 1; focused checks, self-review and draft CI settle; stop before readiness, merge or live work |

1. **Lower public build overlap.** Change only the relevant region of
   `.github/actions/playwright-build/action.yml` and extend
   `.github/scripts/validate-public-playwright-workflow.test.cjs`. Parse the
   actual action and execute its build shell with synthetic command stubs;
   do not test a separately copied implementation. Cover public two, hosted
   four, unknown route rejection, full/bounded/fallback graphs and exit status.
   Route: main. Acceptance: those focused tests and
   `.github/scripts/validate-public-playwright-workflow.cjs` pass in the pinned
   dependency-equipped container. Commit as one implementation slice.
2. **Document and finish.** Update only the relevant runner/build sections of
   `docs/ci-and-deployment.md` with the task-count trade-off and qualification
   boundary. Run `check:playwright-ci`, changed-file formatting, `git diff --check`
   and the staged secret/data scan. Inspect the complete diff for simplification
   and final correctness, security, maintainability and plan compliance. Reviews
   are main-session self-review under the ownership restriction; platform final
   AI review can run later under its existing rules. No browser capture applies
   because application behavior and UI do not change. No new runtime is needed
   beyond the isolated dependency-equipped test container. Commit documentation
   with its related finish work, push normally, open one draft and settle its
   exact-head CI and actionable feedback. Reuse valid tests instead of rerunning
   them for metadata-only changes.

The only new tracked file is this plan. Do not add a scheduler, telemetry service,
benchmark workflow, configurable tuning framework or new test helper module.
If existing test seams cannot exercise the real shell, report that concrete
structure issue before adding another source module.

### Later runtime experiment: separate approval

Before requesting merge and runtime qualification, prepare a private operator
record naming exact services, candidate source, control revision, eligible PRs,
maximum reruns, cache state, duration budget, stop conditions and restoration
steps. Request merge and the bounded canary sequence together. A PR-head test of
this repository cannot qualify a shared action still loaded from trusted `v3`.

Collect the concurrency-four control before merging the change. An older PR head
still loads the action from trusted `v3`, so it cannot restore that control after
merge. Reuse an existing baseline only when its dimensions below match. If three
usable controls cannot be obtained, stop before merge and report the missing
comparison rather than silently switching to an unmatched historical cohort.

At unchanged activation, choose three stable eligible candidate trees. Run one
full wave for each under concurrency four, merge only after the separately
approved checks pass, then run the same trees under concurrency two. Repeated
trees are permitted, but each comparison is a host-matched pair, and the three
pairs must cover both approved hosts. Record actual source tree, resolved
reusable-workflow and composite-action revisions, host, graph, pinned toolchain,
images, pnpm restore match, Turbo task counters and background interference.
Source, graph, toolchain, images and cache class must match within a pair; the
task-count implementation is the intended control difference. Do not change
runner labels or cancel jobs to obtain a particular host assignment.

The finite ceiling is six full workflow waves, each with one build and eight
shards, plus one selected-graph wave with at most eight shards: seven builds and
at most 56 shards, including any reused observations in the comparison count.
All automatically scheduled jobs must finish, with their required aggregates;
there is no build-only shortcut or cancellation after artifact upload. Submit
one wave at a time, within an eight-hour active observation window. At the
deadline stop new submissions and let already-running work finish. A missing
host match, cache-miss control or bounded graph leaves the result inconclusive
at this ceiling. Another run needs a concrete diagnosis and additional authority.
Do not delete shared caches or call a Turbo-cache miss a pristine-host cold start.

For pair i, define M4_i and M2_i as the maximum simultaneous
`anonymousBytes + kernelBytes` in valid application-build samples. Define T4_i
and T2_i as the elapsed application-build producer interval, excluding the
separate Prisma build; the existing combined `durationSeconds` is not that
interval. Use the sampler's initial/final timestamps and producer log boundaries
to validate the interval. Sampling must reach command completion, contain no
unexplained gaps beyond two nominal sample intervals, and remain below the
361-row cap. The one-hour sampler bound is shorter than the workflow timeout;
truncated or unavailable measurements make the comparison inconclusive.

Proposed decision policy: `max(M2_i / M4_i) <= 0.80` and
`median(T2_i / T4_i) <= 1.25`, with every individual result reported. Treat these
as engineering acceptance thresholds, not statistical confidence bounds or
proof that anonymous memory is all non-reclaimable demand. Also require usable
artifacts, all scheduled shards and aggregates passing, no new job OOM and no
unexplained memory-event deltas. A failed wave is diagnosed before any rerun.

Collect bounded, numeric host and supporting-container observations privately
through the existing administrator channel. Account for build/build,
build/shard and shard/shard overlap, timestamp skew, kernel events, memory
pressure, disk headroom and host reserve. Do not double-count parent and child
cgroups, add nested `memory.stat` fields, sum lifetime peaks as simultaneous
usage, or treat null as zero. Ten-second samples can miss brief peaks, so keep
lifetime peaks as a separate diagnostic and apply a conservative margin.

If the candidate fails its memory or duration criterion, retain current capacity
and propose a source revert or a separate admission design for approval. A
rollback reverts only this route-specific task-count change through ordinary
source review; no host changes or cache cleanup are part of it.

### Additional-slot gate: not authorized by this plan

Successful lower-memory builds do not authorize activation. First write a private
capacity budget using complete job-plus-service demand and an explicit host
reserve. Let P be physical RAM, B and S conservative per-build and per-shard
envelopes, L the complete sibling-service envelope for that mix, and H peak host
overhead outside those scopes. A proposed admissible mix must satisfy
`1.25 * (nB * B + nS * S + L + H) <= 0.80 * P`. The right side preserves a 20%
host reserve; the left side adds a 25% uncertainty margin to the entire accounted
load. These are proposed trial policies, not historical capacity conclusions.

Start with raw cgroup totals, including file-accounted and shared-memory demand,
without assuming file cache is wholly reclaimable. Do not double-count `shmem`
inside file memory, kernel subfields or ancestor cgroups. Any cache discount
needs its own reclaimability evidence; otherwise keep the conservative total.
An incomplete L or H is a failed prerequisite, not zero overhead.

A generic extra slot must budget every permitted mix: three builds, two builds
and a shard, one build and two shards, and three shards. If any mix cannot meet
that budget, do not trial an unrestricted slot; design enforceable host admission
first. Queue-level YAML limits do not satisfy that requirement.

Only then request exact, conditional authority for one additional named service
per host, trial one host at a time, and leave every other held service untouched.
The private request must name workloads, admission rules, observation interval,
numeric warning/critical thresholds, who watches and the safe drain/stop branch.
Require a controllable maintenance/admission window; if unrelated queued work
prevents bounding the trial, do not activate. At warning pressure stop new trial
submissions and follow the approved route-pause branch; already-planned jobs
cannot be rerouted by a variable change. At critical pressure the future approval
must authorize cancellation of the exact trial runs, prove their workers and
containers have exited, then stop only the newly activated service. If unrelated
jobs prevent that recovery, the trial is ineligible until an explicit emergency
branch is agreed. Draining alone is not relief for an unsafe running overlap.
Restore routing after any temporary pause. No current approval permits job
interruption, OOM injection, registration resets, upgrades, reboot or Docker
cleanup. Those are not ways to manufacture a passing result.
Capacity evidence, configured failure recovery and observed natural recovery
remain separate acceptance claims.

## Progress

- Status: source slice 1 implemented; documentation and draft delivery remain.
- Fresh source baseline and task worktree agree; no task PR exists.
- Completed: source mapping, private assessment recovery and official Turbo
  documentation lookup. Operational evidence is retained privately.
- Planning review: Astra medium approved draft 2 after one correction round.
  Native child runtime metadata confirms the selected model and effort.
  Accepted corrections establish pre-merge controls, host-matched formulas,
  complete-wave workload accounting, sampler coverage and a full capacity budget.
  The local review transcript is retained in the ignored review directory.
- The plan-first commit is `369a372126`. Slice 1 changes only the shared build
  action and its existing policy test file. The new behavioral checks reproduced
  the old public limit and unknown-route acceptance before the change, then all
  11 policy tests and the workflow validator passed in isolated Node 24.21.0.
  The installed Turbo 2.10.11 help confirms task concurrency semantics.
  Three tests were added; no existing test was removed. Changed-file Biome and
  YAML formatting pass. No DevPod, devrouter or application runtime was touched.
- Remaining source work: slice 2, broader focused checks, self-review and draft CI.
  Later merge, experiment and activation remain separately gated.
- Required delivery layer on approval: verified draft source PR.
  Achieved layer now: locally verified implementation slice. Next action:
  commit slice 1, inspect its exact diff, then document and finish the package.
