# Runner recovery and memory telemetry

## Approval summary

Make runner services recover from failed exits without creating a restart loop,
and collect the container-memory evidence needed for a later capacity decision.
The managed service template currently omits automatic recovery. Existing
resource samples describe the system visible through procfs, which cannot
attribute memory use to the job container or distinguish anonymous memory from
file cache.

Add a bounded restart policy to provisioning and to the existing host
reconciliation path. Reconciliation must recognize only the known legacy and
updated managed units, preserve stopped or disabled services, and retain its
idle-host and registration checks. Extend the existing resource sampler with
read-only cgroup v2 memory counters. Missing counters remain unavailable rather
than becoming zero; telemetry cannot change the wrapped command's result.

The user approved this source package on October 17, 2026 and requested a plan
update before starting a native goal. Approval is an executable batch through a
verified ordinary draft pull request targeting `v3`, including local commits,
ordinary task-branch pushes, exact-head CI and actionable-feedback handling.
Actual host configuration, further runner activation, upgrades, reboots,
cleanup, settings changes, merge and readiness remain separately authorized.

The subsequent user instruction, "review and simplify, then merge, deploy, and
verify", authorizes readiness, squash merge after required checks and reviews,
and application of this recovery policy to the existing runner pool. Pause new
pool dispatch for the idle maintenance window and restore the prior routing
value afterwards. Preserve held services and verify policy readback and later
jobs; additional capacity, package upgrades and reboots remain outside this
rollout. This extends delivery authority without reopening the completed
source-only native goal.

No container cap or higher concurrency is selected here. A shard sample cannot
qualify a cold build, and a runner-service limit does not constrain separate
Docker scopes. The bootstrap archive pin and integrity checks remain unchanged;
existing-host recovery uses reconciliation instead of reprovisioning.

## Execution details

### Identity and ownership

- Repository: `uzh-bf/klicker-uzh`; target: `v3`.
- Baseline: `0f222786e86c625c7bfbff594a952de770d15ac5`.
- Branch: `rs/runner-recovery-telemetry`.
- Worktree: `trees/rs/runner-recovery-telemetry`.
- Artifacts root: `project/`; this plan's path remains stable.
- Historical plan: [ARM64 runner operations](2026-08-29-arm64-runner-operations-plan.md).
  Preserve the earlier delivery as history rather than reopening its settings
  or skill-publication scope.
- Owner and boundary owner: main session. The explicit no-subagents instruction
  overrides automatic delegation and specialist dispatch. Main-session
  simplification and final review are self-review, not independent evidence.
- Ceremony: full path because the package changes host administration code and
  a service-lifecycle contract. Delivery topology: one cohesive ordinary draft
  pull request; no stack is needed. Draft:
  [bounded runner recovery and memory evidence](https://github.com/uzh-bf/klicker-uzh/pull/6581).
- Approval mode: executable batch, already approved. No second generic approval
  is needed for implementation, verification or draft delivery.

### Binding contracts and research

The source-owned unit is the authoritative configuration. The provisioner
compares complete unit contents and rejects unmanaged drop-ins. The standalone
host payload must therefore validate and update that complete known unit,
without weakening registration, filesystem-ownership or archive checks.
Keep the bootstrap and reconciliation renderings equivalent and test them at
the rendered-unit boundary. Do not introduce an external alerting service or a
second configuration owner.
Apply the new recovery policy only to the public-PR profile; preserve the
trusted profile's existing rendered unit.

Use `Restart=on-failure`, a 60-second delay, a three-start limit within ten
minutes, and explicit `OOMPolicy=stop`. Intentional administrative stops retain
systemd's normal stop semantics. Recovery after an OOM is based on the service
result, which can be failed even when its wrapper exits successfully.

Reconciliation may update registered services that are active, inactive or
failed, and enabled or disabled. It preserves their activation and enablement
states. Refuse transitional or unexpected unit state, unknown unit content,
unmanaged drop-ins, changed service identity, or an active worker before any
dependent mutation. Reloading unit definitions must not start inactive units.
Only already-active services whose hook environment changed need a restart.
The two-host controller continues to use a checksum-verified immutable payload;
pin it to the committed new payload before draft delivery.

Cgroup samples describe the wrapper's current unified cgroup and descendants,
not the runner service or all service containers. Resolve membership through
`/proc/self/cgroup` and the matching cgroup v2 mount. Read only current and peak
bytes, anonymous/file/kernel bytes, and selected memory-event counters. Do not
emit cgroup paths, process details, environment values or workload contents.
Do not reset kernel counters. Report unsupported, inaccessible or malformed
data as null. Keep the existing sample cadence, row bound and signal/exit
propagation.

Documentation reviewed through `rs-find-docs` and primary sources:

- [systemd service lifecycle](https://github.com/systemd/systemd/blob/v259.5/man/systemd.service.xml)
  and [start-rate limits](https://github.com/systemd/systemd/blob/v259.5/man/systemd.unit.xml).
- [Kernel cgroup v2 interface](https://docs.kernel.org/admin-guide/cgroup-v2.html):
  memory usage includes descendants; peak includes file cache; event counters
  are cumulative. Mount roots and cgroup namespaces affect path resolution.

The preceding Claude consultation was checked against source. Its unmanaged
drop-in proposal was rejected because it conflicts with unit validation. No
live measurements, host identifiers or environment-derived findings belong in
the public plan, code, commit messages or pull-request body.

### Test portfolio

| Consequential behavior | Existing protection | Obligation and primary seam | Slice |
| --- | --- | --- | --- |
| Failed services have bounded recovery under the managed owner | Managed unit renderer and exact comparison | Extend fixture tests to parse rendered policy and compare bootstrap/reconciler units | Recovery |
| Reconciliation preserves held capacity and fails before unsafe writes | Existing idle check and hook fixtures | Extend command fixtures for inactive/disabled preservation, active-worker refusal, unknown-unit rejection and idempotence | Recovery |
| The controller delivers the reviewed payload | Immutable revision and checksum | Verify the pinned Git blob and digest after the payload commit | Recovery |
| Memory evidence identifies the current cgroup without inventing measurements | Sampler numeric, unavailable and subprocess tests | Extend synthetic procfs/cgroup fixtures for namespace roots, nested membership, malformed data and counters | Telemetry |
| Diagnostics cannot change job results or cancellation | Existing exit, bounded-output and signal tests | Retain and run the existing subprocess contract tests | Telemetry |

### Slices and commit boundaries

1. **Recovery:** update `util/provision-hetzner-arm64-runner.sh`,
   `util/reconcile-hetzner-arm64-runner-host.sh`, and its existing `.test.sh`.
   Add a source guard to the provisioner only so its renderer can be exercised
   without invoking provisioning. Keep the standalone SSH payload self-contained.
   Verify syntax, ShellCheck, rendered service contracts and fixture behavior.
   Commit the implementation, then update the immutable payload revision,
   SHA-256 and matching help text in `util/reconcile-public-pr-arm64-pool.sh`
   in a dependent commit.
2. **Telemetry:** extend `.github/scripts/playwright-resource-sampler.cjs` and
   its existing `.test.cjs`; use synthetic test-owned procfs and cgroup data.
   Verify complete numeric/null contracts and existing subprocess behavior.
   No app, database or browser runtime is required.
3. **Finish:** update the existing runner-operations and in-job-sampling sections
   of `docs/ci-and-deployment.md`, with generic rollout prerequisites and metric
   limitations. Add no second runbook. Inspect the complete diff for
   simplification, correctness, maintainability, security and scope compliance.
   Run focused checks and formatting, inspect staged content for secrets and
   real-environment data, then publish the ordinary draft pull request and
   handle exact-head checks and actionable feedback under `rs-babysit-pr`.

No other new source file is planned. A new file or delivery boundary needs a
concrete second caller or a recorded scope decision. No product primitive,
schema, browser behavior or new architecture is introduced, so no ADR or
screenshot gallery is required. Reopen that decision if trust or ownership
boundaries change.

### Acceptance and later live qualification

Authority: source edits, focused verification, commits, ordinary push to this
task branch, one draft pull request to `v3`, and its authorized CI/review cycle.

Terminal: the plan and implementation are committed, focused checks pass,
the draft pull request exists with exact-head CI and actionable feedback
settled, and pending live qualification is stated accurately. Merge and live
rollout are not acceptance claims of this source package.

Pause: a material trust/ownership change, a need for non-public data in shared
artifacts, an incompatible existing unit requiring a migration decision, or an
unavailable required capability after safe alternatives are exhausted. A slow
CI queue is running work, not a blocker or permission to skip evidence.

After separate live authority, qualify recovery on exact named services while
preserving the selected activation states, observe successful queued jobs, and
check for new OOM events. Collect a cold-build cohort before selecting memory
limits or additional slots. A planned reboot must account for enabled services
that would otherwise start automatically. Kernel/package maintenance, disk
cleanup, alert destinations and offline-registration expiry remain separate
operator decisions. Rollback is an ordinary source revert plus an explicitly
approved restoration of the prior unit policy; preserve runner data.

## Progress

- Recovery, Telemetry and Finish source slices are implemented.
  The plan was the first commit (`dd061ac149`), before source implementation.
  The package changes eight paths, with 522 added/deleted lines
  excluding this plan; it adds no dependency, generated file or configuration owner.
- Focused verification passes: both reconciliation shell suites, syntax,
  ShellCheck, eight sampler tests in a network-isolated Node 24.21.0 container,
  changed-file Biome, documentation formatting and staged secret scans. Four
  sampler tests were retained (one extended), and four memory cases were added.
  A broader contract attempt passed 77 cases; three lacked `yaml` or host
  Devrouter in the minimal image. Dependency-equipped CI remains authoritative.
- The controller pins payload `0b7ccd398c6ae45e7ee5613bc9692874e6421e07`, with
  SHA-256 `ae6dbbd3c1eae60f20a801be24c259efec4d52069a79a76fc612078afda6072d`.
  Its existing checksum test and GitHub payload readback agree.
  Archive integrity validation is unchanged.
- Main-session simplification and final self-review cover all eight paths
  against the recorded baseline, including the review corrections. Correctness,
  plan compliance, maintainability and focused security apply; architecture and
  browser lenses do not. The first draft review's two inline threads are resolved.
  Operator state reporting, renderer cross-references and numeric volume paths
  are covered. Decoding raw cgroup membership was rejected against kernel source;
  synthetic space and literal-backslash fixtures protect that distinction.
- The next draft review's sole finding was reproduced at the drift-check seam:
  a failed mount read was masked inside process substitution. The existing
  explicit error guard now applies there too; focused shell checks and a
  synthetic before/after probe pass. No new permanent test is needed for this
  direct propagation guard.
- Delivery evidence is maintained in the [PR](https://github.com/uzh-bf/klicker-uzh/pull/6581)
  and its [verification note](https://github.com/uzh-bf/klicker-uzh/pull/6581#issuecomment-6235423117).
  Read current-head CI and review state there rather than treating historical
  results as current. The source-only goal reached its verified-draft terminal
  condition before the later merge/deployment instruction. No host configuration
  has been applied yet.
- The PR is now ready under the later merge/deployment instruction. The first
  final AI review passed. A later review identified inherited mounts rooted
  above the cgroup namespace; the existing unavailable-counter fixture
  reproduced ancestor-memory attribution. Rejecting parent components in the
  mount root corrects it with one guard. Current-head CI and final review must
  finish before merge and the idle, state-preserving rollout.

The main session owns the published-head watch under `rs-babysit-pr`. Continue
the authorized merge and rollout after current-head CI, actionable feedback and
final review settle. Record private live readback outside repository artifacts.
Cold-build capacity qualification remains a separate decision.
