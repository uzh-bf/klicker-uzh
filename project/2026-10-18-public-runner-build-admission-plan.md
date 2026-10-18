# Public runner build admission

## Approval summary

Keep public Playwright builds at Turbo task concurrency four and control how
many build jobs can reach each host. Recommend a fixed scheduling lane first:
one already-active runner per host accepts builds and shards; the other approved
active runners accept shards only. This uses GitHub's existing scheduler instead of a
new host daemon, admission socket, lease store or container engine integration.
Waiting builds remain queued until a build-capable runner is available.

This limits simultaneous builds per host; it does not impose a memory cap or
prove another runner slot safe. A shard may occupy the dual-role runner while a
build waits. Preserve the active service count, browser workers, job isolation,
cache ownership, required status and GitHub-hosted fallback. Collect complete
job-plus-service memory observations before considering any additional capacity.

The user approved the source-only executable batch on 2026-10-18: implement the
named changes, verify and self-review them, commit, push the task branch, and
deliver one draft PR targeting `v3` with exact-head CI and feedback disposition.
The earlier read-only observation remains separately authorized. Source CI may
run for this draft; no additional comparison or canary rerun is authorized.

Merge and scheduling-label rollout require
a later exact operator packet. The live packet must prove existing runner-group
restrictions without expanding credentials and name both hosts' complete role
assignment, drain procedure, prior route value and rollback. If existing access
cannot establish that evidence, source planning can finish but live rollout waits.

## Execution details

### Identity, evidence and ownership

- Plan: `project/2026-10-18-public-runner-build-admission-plan.md`.
- Target and source baseline: `v3`, `92fabf9f6226dcc53cc27e37f0101fde6527cb7b`.
- Branch/worktree: `rs/public-runner-build-admission`,
  `trees/rs/public-runner-build-admission`; artifacts root: `project/`.
- History: [build-memory plan](2026-10-18-public-runner-build-memory-plan.md),
  [recovery PR](https://github.com/uzh-bf/klicker-uzh/pull/6581),
  [task-concurrency experiment](https://github.com/uzh-bf/klicker-uzh/pull/6592),
  and [source rollback](https://github.com/uzh-bf/klicker-uzh/pull/6597).
  Historical plans do not grant this package implementation or live authority.
- Boundary owner and all workstream owners: main session. Standard execution
  mode retained; the explicit no-subagent restriction overrides planner and
  specialist dispatch. Planning review here is main-session self-review only,
  not independent review. No separate task or provider review is requested.
- Full-path plan because scheduling policy and cross-system rollout change.
  One cohesive implementation PR; no plan-only PR. Current implementation PR:
  none. Commit this approved plan before implementation.

The rollback merge has the exact tree of verified head
`8143fe7d0023d97c1903b1d3b8672ea593905a99`. Its trusted build action selects
four for both routes and rejects unknown routes. The reusable workflow directly
defines the public build and shard jobs. Both currently request the same group
and generic labels, so any matching runner may receive either job type.

The current host reconciler owns recovery and fail-open telemetry hooks. It is
not an admission controller. Runner-service memory settings do not account for
Docker job and service containers in independent scopes. Keep live observations,
runner-to-host mappings, access details and numeric receipts task-private.

### Primitive impact and ADR disposition

No product primitive changes. This is internal CI scheduling with the same
application, authorization and user-facing contracts.

Fixed runner roles use existing scheduler semantics, introduce no persistent
controller and are reversible through labels and source. The ADR gate is not
met for this proposal. A dynamic host controller, new privilege or socket,
container-hook replacement, or resource ownership hierarchy reopens architecture
review and the ADR gate before implementation; none is a quiet extension here.

### Research and alternatives

Main session owns research and verifies source, rather than treating prose or
telemetry shape as execution proof.

| Option | Decision | Material trade-off |
| --- | --- | --- |
| One build-capable runner per host; all active runners accept shards | Recommend first | Simple scheduler enforcement; builds can wait behind shards |
| Separate build-only and shard-only runners | Defer | Better build availability but loses shard capacity while builds are idle |
| Host-side dynamic memory reservations | Defer | Requires protected state, trusted identity, cancellation and orphan cleanup |
| Workflow concurrency or a lock inside the build step | Reject as host admission | Neither identifies a physical-host budget before job/service allocation |

GitHub's [runner routing documentation](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/use-in-a-workflow)
requires every requested label and the specified group. That supports an exact
role intersection without new runner groups. Labels are scheduling metadata,
not a security boundary; the existing group/workflow restriction remains required.

The [pre/post-job hook documentation](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts)
describes synchronous hooks running as the runner service account. Nonzero pre-job
exit fails the job, and there is no built-in hook timeout. A root-owned script
alone does not protect a runner-user-writable reservation store from other jobs.
The [container customization interface](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/customize-containers)
is public preview and would take responsibility for the whole container lifecycle.
Neither mechanism is needed for the recommended fixed roles.

Inspection of [runner JobExtension](https://github.com/actions/runner/blob/9abfe11d2abd9de09d3a8d933d7ed701ea0518a3/src/Runner.Worker/JobExtension.cs)
places the started hook before container initialization, but after action
preparation. This is upstream evidence, not proof of the installed host version.
No custom hook implementation or installed-version compatibility claim is made.

### Proposed scheduling contract

Use custom labels `playwright-build` and `playwright-shard` in addition to all
existing architecture, container and public-pool labels. Keep the same runner
group and exact qualified reusable workflow allowlist.

For each approved host, the complete private mapping names exactly one
already-active build-capable runner. It receives both role labels. Every other
approved active runner receives only the shard label. Held services receive
neither role label. The public build job must require `playwright-build`; the
public shard job must require `playwright-shard`. Account for every job that can
target the pool; an unknown pool job or role fails policy validation. There is no public fallback
to the old generic label set. Hosted routing and images remain unchanged.

This gives a maximum of one scheduled build per host while allowing the
build-capable runner to serve shards. It is not a reservation for build priority
and does not promise FIFO, starvation freedom or lower queue latency. A runner
failure reduces availability; preserve ordinary required-status failure behavior.

Role correctness requires a readback of the complete runner-to-host map and
complete custom label sets, not a successful label-write response. The plan
must reject duplicate build roles, missing active shard roles, role labels on
held services, unexpected runners, or an unverified runner-group policy.
Capture complete prior custom-label sets and re-read them before each write.
Unexpected concurrent edits stop the batch rather than being overwritten;
sequential API calls are not an atomic multi-host transaction. The live packet
must establish one operator owner for the maintenance window.

### Test portfolio and proposed source batch

| Consequential contract | Existing seam | Test obligation |
| --- | --- | --- |
| Build and shard jobs cannot use a generic public lane | Workflow validator and YAML mutation fixtures | Extend: require the corresponding role and reject role omissions or swapped roles |
| Per-host role map has one build role and covers active shards only | Existing group-policy CLI fixtures | Extend: duplicate, missing, foreign and held-role cases; preserve unrelated labels |
| A failed label operation cannot report verified state | Existing fake `gh` policy tests | Extend: partial write/readback failure, exact target checks and recovery result |
| Trust, graph, caches, artifacts and required status are preserved | Existing Playwright contract suites | None: reuse and run affected suites |
| Scheduling restriction actually runs at current capacity | Actual producer logs, assignments and private host receipts | Later live gate; source tests do not replace it |

All slices are main-owned under the existing no-subagent instruction. The user
approved this executable source batch; its internal checks need no new approval.

1. Extend `util/reconcile-public-pr-arm64-runner-group.sh` and its existing test
   file/CLI fixture with an explicit role-map check and separately confirmed
   label-apply mode. Keep normal group-policy behavior and existing complete-set
   checks. Use host `gh` only; permit no registration, group membership, service,
   credential, or access-policy changes in role mode. Tests use synthetic runner
   maps. Real maps and receipts stay private. Commit the role-policy contract.
2. Update only public `runs-on.labels` in
   `.github/workflows/public-pr-playwright-shards.yml` and extend
   `.github/scripts/validate-public-playwright-workflow.cjs` plus its existing
   tests. Wire the existing shell-policy suite into `.github/workflows/check.yml`
   so CI enforces the operator contract. Preserve job names, dependencies, eligible routes, hosted fallback,
   eight-shard full plans and reporting. Commit source routing with its tests.
3. Update the runner section of `docs/ci-and-deployment.md` and this plan's
   Progress. No new host service, workflow, dependency or agent skill is needed.
   Run shell syntax/policy fixtures, `check:playwright-ci`, workflow validator,
   changed-file formatting, whitespace and staged secret/data checks. Inspect
   the complete diff for simplification and final correctness, trust, rollout
   and maintainability under main-session self-review. Publish one draft PR.

Expected changed paths are the existing policy script, its test and fake `gh`,
reusable workflow, check workflow, validator, validator test, operations guide
and this plan. The check-workflow command was added during execution because the
existing CI did not invoke the shell-policy suite; it adds no new workflow.
If those seams cannot support complete scoped label operations, report the
specific gap before introducing a new operator module. No application runtime
or browser capture is required for source verification.

### Later rollout and rollback: separate approval

Prepare one exact packet after source CI settles. Name the reviewed source head,
both approved private hosts, every active/held runner and complete role labels,
qualified workflow, token capability, route key/prior value, and expected target
revision. An org API denial is a blocker to the dependent live action, not
permission to expand credentials or infer policy from repository YAML.

The packet must authorize this conditional sequence explicitly: record and pause
new public dispatch; let all already-planned, queued and running generic-pool
work finish; prove idle state and current service activation/enablement; apply
and read back only role labels; merge the verified source normally; verify the
merged workflow and role map; restore the recorded routing value and read it
back. Variable changes cannot reroute already-planned jobs. No job is canceled.
No service is started, stopped or restarted, and held capacity stays held.

If label application fails before source merge, restore the captured exact label
sets, verify old routing compatibility, then restore the recorded route value.
If state is uncertain, retain the recorded pause and request operator recovery;
never silently resume into an unverified policy. After source merge, rollback
requires another approved ordinary source revert and a drain before labels are
restored. Keep labels compatible with queued role-specific work until it ends.
Neither removing a label nor pausing routing stops an already assigned job.

Verify a naturally scheduled public full build, all eight consuming shards and
aggregate with actual role assignments. Observe both hosts before claiming
both-host rollout proof. No additional trial or rerun is implicit; a missing
natural workload remains a monitored evidence gap.

### Complete-load qualification before extra capacity

Record raw same-time totals for each job container and its sibling services,
plus host overhead outside those non-overlapping scopes. Cover full cache-miss
builds and complete shard lifecycles, including setup and cleanup. Keep
anonymous-plus-kernel, current total and lifetime peak distinct. Never add an
ancestor and its descendants, double-count `shmem` inside file memory, sum
independent lifetime peaks as simultaneous demand, or replace null with zero.
Use the [kernel memory interface](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files)
definitions. An unexplained sampling gap, unknown owner or missing service scope
prevents a capacity conclusion.

For a future proposed mix, retain the earlier conservative policy
`1.25 * (nB * B + nS * S + L + H) <= 0.80 * P`, with a complete private derivation
of every term. Fixed roles exclude multiple scheduled build jobs on one host;
they do not cap growth inside the admitted job. Assess every mix actually
permitted by the proposed active-role map, and collect more than one successful
example before presenting a capacity trial packet. No additional runner is
authorized by this plan or by passing this inequality alone.

### Progress and acceptance boundaries

Current approval mode: executable batch, source-only, approved 2026-10-18.
Plan preparation and main-session self-review are complete; observation remains
separate. Slice 1 implemented: role-policy CLI and synthetic failure fixtures.
The CLI checks exact runner identity and complete prior custom labels, preserves
unrelated labels, writes a private append-only receipt, and stops on drift or
partial failure. Recovery remains an explicit operator action, never an unsafe
automatic rollback over concurrent edits. Shell syntax, ShellCheck and the
extended policy fixture suite pass. Test delta: extended the existing CLI suite;
no new test file. Main-session slice review and simplification inspect the
committed slice before workflow selectors are changed. Slice 1 self-review
confirmed the role path cannot fall through to group-policy writes, including
an empty map path. No independent review is claimed. The retained label helpers
serve preflight, per-write and final readback; no additional module was needed.
Slice 2 implemented: public role selectors and structural workflow validation.
All 93 `check:playwright-ci` tests and the workflow validator pass in isolated
Node 24.21.0 with the existing dependency versions. Test delta: one table-driven
role-policy test added at the existing validator seam. The shell-policy suite
also passes after the empty-path regression check. Committed-slice review
confirmed the two role-specific
selectors and hosted fallback, with no job, dependency, image, permission or
cache changes. The structural validator replaces the old regex count and rejects
unknown pool selectors. Slice 3 documentation is complete; publish the draft
after final committed-state inspection.

Integrated simplification retained the existing CLI and validator seams; no
new module, service, dependency or runtime is needed. Final correctness review
found an existing-path receipt edge case: Bash noclobber alone accepts a symlink
to a device. A synthetic red/green regression now requires explicit rejection
before any label write. This is an in-scope source correction. The operations
guide carries the durable complete-map, drain and recovery contract; no separate
solution document or ADR is warranted.
Package size: 552 substantive added/deleted lines excluding this project plan;
one cohesive role-admission capability, using existing seams and one draft PR.
Final review lenses: correctness, plan compliance, maintainability, executable
security and the scheduler/API seam. Product/domain and UI lenses do not apply.
The hardest choice was a dual-role build lane: it preserves shard eligibility
but can delay builds. Dynamic reservation and dedicated build-only capacity
were rejected for additional lifecycle ownership or idle capacity cost.
Least-confident boundary remains the physical-host/held-service assertion: the
source tool cannot prove it, and the later approved operator packet must.
Local verification includes shell syntax, ShellCheck, policy fixture failures,
93 Playwright contract tests, workflow validator, YAML parsing, changed-file
Biome/Prettier, diff whitespace and staged gitleaks. One unchanged Biome warning
flags the pre-existing GitHub expression string. Full app checks/build were not
run because this source package changes no application behavior; Git hooks have
no full dependency install and CI remains required. No application runtime was
started. All private environment observations are excluded from the source.
Source is published as [draft PR #6602](https://github.com/uzh-bf/klicker-uzh/pull/6602).
All live mutations remain unstarted. Source baseline and fresh `origin/v3` are
aligned at `92fabf9f6226`. The final committed source review covered
`92fabf9f6226..bff2319aef6e` and found no remaining source blocker after the
receipt correction. The two executable files also passed scoped Opengrep
(`--config auto`), with zero findings. Required hosted CI is now running; no
complete exact-head source acceptance or ready/merge claim is made yet.
The rollback merge/source tree is verified; exact-merge push CI and a normal
post-merge public build remain separate observation obligations.

Self-review covered label intersection across all pool jobs, dual-role queue
blocking, held-service labels, permission denial, complete prior-state capture,
drain, partial failure, rollback and complete-load accounting. Fixed roles add
no host controller or state store. No independent planner verdict is claimed.
An advisory public-document citation batch supported two hook claims and
deferred the routing claim. Direct inspection resolved that claim against the
official cumulative-label and combined group/label requirements; no automatic
support verdict is substituted for that source check. No private observation
was submitted to the advisory service.

Planning terminal reached: the source/rollout proposal was delivered, reviewed
by the main session and approved for the source batch. Retain one quiet
continuation for unfinished natural-workload/CI evidence.

Source-batch terminal after approval: locally verified, self-reviewed draft PR
with exact-head CI and feedback disposition. No ready, merge or live authority.
Runtime terminal after a separate rollout approval: exact installed role policy,
successful producer/shard/aggregate evidence and bounded host readback at the
unchanged service count. Natural failure recovery and extra-slot safety remain
separate, unproved qualifications.
