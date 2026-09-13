# Faster, evidence-bound KlickerUZH CI

## Approval summary

Reduce the time between a PR update and a trustworthy merge decision within the
existing runner budget. The September 13 audit found repeated full validation
on unchanged draft-to-ready transitions, broad uncached image builds, long
hosted reporting queues, and inconsistent cache consumption. The public ARM64
pool demonstrably executes all eight shards; increasing its size is not the
first intervention.

The proposed sequence fixes execution policy and affected-image selection,
removes runner-consuming coordination, improves cache compatibility, and makes
profiles reduce the application and service footprint. Only then does it
benchmark additional public workloads on self-hosted runners. Ready PRs retain
full Playwright coverage. Candidate deployment validation, trusted publication,
private runners, and the public pool's repository/workflow restriction remain
separate contracts.

Approval mode: **direction-only**. The current request authorizes this detailed
roadmap and a takeover handoff, not activation of the proposed behavior. Existing
approvals are not revoked, but historical approvals do not automatically cover
new trust boundaries, deployment policy, or capacity experiments. Once a source
package is approved, normal commits, ordinary task-branch pushes and draft PRs
follow standing repository authority without repeated generic permission asks.
Merges, live settings, host changes, publication and deployment retain their
named gates.

Success means fewer redundant heavy jobs and occupied runner minutes, lower
representative feedback latency, and preserved correctness. Source readiness,
merged activation and measured improvement are distinct milestones. This
planning delivery ends with the roadmap and handoff; implementation belongs to
the receiving task.

## Execution details

### Identity and continuity

- Repository and target: `uzh-bf/klicker-uzh`, `v3`; `dev` is out of scope.
- Audit baseline: `927f23366f0b80867240382c40af81994b0b7fc9`.
- Roadmap worktree: `trees/ci-efficiency-roadmap`, branch
  `rs/ci-efficiency-roadmap`, based on refreshed `origin/v3`
  `062719406b254c0666ddc36c824b9fc406306e8f`.
- The intervening [PR #5942](https://github.com/uzh-bf/klicker-uzh/pull/5942)
  fixes Git identity-history scanning in `check.yml`; it does not activate the
  draft, image-cache or runner changes proposed here.
- Artifact root: existing `project/`. Boundary owner: the receiving main task.

This is the forward-looking synthesis of the
[September 5 throughput roadmap](2026-09-05-ci-throughput-roadmap-plan.md),
[queue-efficiency package](2026-09-09-ci-queue-efficiency-plan.md), and
[resource-sampling package](2026-09-12-playwright-resource-sampling-plan.md).
Those documents retain historical receipts. Their descriptions of currently
active behavior must be checked against source: later changes have deliberately
disabled or replaced parts of the earlier draft/reuse policy.

Keep this roadmap with the first coherent implementation package; do not open a
plan-only PR. Subsequent packages update its Progress with their source and live
proof. Sequential packages are proposed, not an approved native stack. Decide
stack topology explicitly before creating dependent PRs.

### Baseline evidence and limits

All observations below were collected on September 13, 2026. Run links identify
evidence, not a standing request to retry or cancel those runs.

| Observation                                | Exact evidence                                                                                                                                                                                                                                                                                                                                                                                | Interpretation                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unchanged draft-to-ready work              | PR #5922 [draft run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34727008952) and [ready run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34728658714) both record head `aa3d954dfc47dea76b375c94cdbd5a22682bbf7b`, base `f00e272adf40dd3cbe2c648935cde1d99727af59`, full mode and eight shards. Draft completed; ready rebuilt on ARM64 and was later cancelled by a new push. | Source identity was unchanged, but route and architecture changed. Same-head alone is not a reusable artifact contract.                                        |
| Pool execution succeeds                    | [ARM64 run 34747467117](https://github.com/uzh-bf/klicker-uzh/actions/runs/34747467117): actual runners `public-pr-arm64-01` through `-08`; build 297s; shard jobs 851–1270s; shard queues 3–16s.                                                                                                                                                                                             | The eight-slot pool works. These are whole-job durations, including setup.                                                                                     |
| Hosted reporting delays completion         | Same run: prepare queued 222s; final status job `103700948027` queued 987s and executed for 8s; workflow wall time approximately 47 minutes.                                                                                                                                                                                                                                                  | Roughly twenty minutes of this sample were hosted preparation/reporting queues. Not all latency is test execution.                                             |
| Other ARM64 runs finish faster end-to-end  | [Run 34731397315](https://github.com/uzh-bf/klicker-uzh/actions/runs/34731397315) completed in approximately 28 minutes with approximately 2s shard queues and 2s final-report queue.                                                                                                                                                                                                         | Queue pressure varies. Do not attribute every wall-time change to hardware.                                                                                    |
| A hosted sample executes tests faster      | Same-head PR #5938 [hosted run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34730194604) had shard jobs 657–950s; [ARM64 run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34746417112) had 889–1303s.                                                                                                                                                                           | Observational, not a controlled A/B: timing, cache state, control revision and environment may differ.                                                         |
| Heavy work can start after merge           | The latter PR #5938 run started after the PR merged. Current callers accept broad `edited` events without a uniform open-state guard.                                                                                                                                                                                                                                                         | The later run is observed; its precise triggering action was not recovered. Test the source-level lifecycle gap rather than asserting an unproven event cause. |
| Image fan-out is broad                     | Current `v3` has 13 staging image workflows and 14 active ARM64 build jobs; all active builds use `no-cache: true`. Most Node selectors include `packages/**`. Draft [PR #5930](https://github.com/uzh-bf/klicker-uzh/pull/5930), with four `packages/audit` files changed, triggered 14 staging image workflows on its integration branch.                                                   | Branches may have extra images; determine transitive dependents before calling individual images unnecessary.                                                  |
| A reporter occupies a runner while waiting | [Run 34747321389](https://github.com/uzh-bf/klicker-uzh/actions/runs/34747321389): `build-images-status` executed for 2103s. The implementation polls up to sixty times with 30s waits.                                                                                                                                                                                                       | Dependency waiting should not occupy an execution slot.                                                                                                        |
| Turbo already produces useful hits         | [Code-check run 34748939159](https://github.com/uzh-bf/klicker-uzh/actions/runs/34748939159) restored 26/26 build tasks; Turbo build time 4.275s. Type checking took approximately 140s and remains uncached.                                                                                                                                                                                 | Repair uneven consumers and invalidation instead of replacing working Turbo infrastructure.                                                                    |
| Playwright remains cold in some branches   | ARM64 run 34747467117: pnpm miss, no matched Turbo key, 0/25 tasks cached, approximately 218s application build. All eight shards also missed pnpm.                                                                                                                                                                                                                                           | Restore is enabled, but no compatible seed existed for these fingerprints.                                                                                     |
| Trusted work duplicates a build            | [v3 validation 34726388087](https://github.com/uzh-bf/klicker-uzh/actions/runs/34726388087) and [seed run 34726387958](https://github.com/uzh-bf/klicker-uzh/actions/runs/34726387958) separately built x64 for the same commit. Seed also built ARM64.                                                                                                                                       | Consider publishing cache from already-required trusted validation; retain the other architecture when genuinely needed.                                       |
| Profiles often select the broad stack      | Seven of eight plans in run 34747467117 include `full`. Every shard provisions the broad backing-service set.                                                                                                                                                                                                                                                                                 | Profile-aware packing and service selection must change together to reduce footprint.                                                                          |

Resource samples for that ARM64 run are host-wide procfs observations visible
inside job containers, not per-job reservations. Two overlapping host samples
showed approximately 54.6–56.9% CPU busy, 0.2% I/O wait, no measured steal, and
minimum available memory around 6.65–6.72 GiB. CPU pressure was nonzero. Do not
sum overlapping host samples or infer spare full-stack capacity from average
CPU utilization. The earlier workers=2 experiment regressed and exposed shared
seeded-course state; the live setting was verified as workers=1.

Actions cache usage was approximately 9.94 GiB near the default 10 GiB limit.
The inventory included large CodeQL caches and numerous QEMU entries. Eviction
was not demonstrated, and a custom allowance was not verified. The organization
reported the Free plan; its documented standard hosted concurrency is twenty
unless an override exists. A hundred promotion workflow records were mostly
skipped or cancelled; they must not be counted as a hundred occupied runners.

Audit access limitations: organization runner-group inspection returned 403;
SSH read access to the hosts failed public-key authentication. Actual runner
names and host samples came from successful GitHub job artifacts. Do not claim
a fresh live allowlist audit or host configuration reconciliation.

### Contracts that all packages preserve

1. **Coverage:** a merge-ready PR needs current full Playwright proof. Selected
   draft success is labelled as selected coverage and cannot become full proof
   merely because the PR was marked ready. Unknown impact falls back to full.
2. **Evidence:** cache restoration, build-artifact reuse and successful-test
   reuse are different decisions. Failure to find reusable evidence executes
   normal validation. It never turns a failed, cancelled, missing or skipped
   required job into success.
3. **Trust:** trusted control comes from the protected reusable workflow;
   candidate code is untrusted. Preserve the public pool's Klicker-only
   `public-pr-playwright-shards.yml@refs/heads/v3` boundary, secret-free jobs and
   read-only cache consumption. Persistent Docker-capable public hosts are not
   an isolation boundary for trusted secrets or private source.
4. **Deployment:** preserve exact candidate push qualification, complete image
   identity, publication permissions and release provenance. Keep promotion
   activation and private-runner placement outside routine CI optimization.
5. **Cost and measurement:** no additional VM, paid runner, cache subscription,
   provider or recurring collector by default. Judge changes by end-to-end
   useful feedback and occupied runner minutes, with queue and execution
   reported separately.

The current required baseline comprises `check`, `check-gitleaks`,
`test-graphql-status`, `test-playwright-status`, `test-unit-status`,
`test-olat-api-status`, `test-intl-production-status`, and `build-images-status`.
Refresh the actual rulesets before modifying names or meanings. Keep existing
contexts during source migration; changing branch protection is a separate
operation. A green historical head must not allow a ready transition to merge
before its full-coverage gate is bound and complete.

### Ownership and dependencies

The receiving main task owns design, integration, external actions and final
evidence. Route: main, following the user's existing no-subagent instruction.
No independent specialist review is claimed. Review that instruction against
any newer user direction before dispatching specialists in a successor task.

| Work package                             | Dependency                                  | Owner and acceptance boundary                                                                                         |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Baseline and coordination                | None                                        | Receiving main; current topology, measurements and acceptance cohort resolved                                         |
| Event and coverage policy                | Baseline                                    | Receiving main; correct draft/ready/base/closed behavior with fail-closed reporting                                   |
| Affected images and cached builds        | Baseline; integrate existing merge-base fix | Receiving main; correct image closure and cold/warm image equivalence                                                 |
| Workflow dependencies and terminal gates | Event policy; image contract                | Receiving main, coordinated with staging owner; no runner-consuming polling                                           |
| Cache compatibility and consumers        | Baseline; coordinate check-workflow owner   | Receiving main; measured compatible hits and unchanged outputs                                                        |
| Profile-aware execution                  | Event policy; cache/build contract          | Receiving main, coordinate Devrouter ownership only if its API changes; exact coverage with smaller runtime footprint |
| Runner placement qualification           | Previous improvements measured              | Receiving main; bounded net-benefit result and explicit disposition, no automatic expansion                           |

Initially prepare coherent sequential PRs. Event guards and full-coverage/reuse
semantics may be separate implementation slices in one package; cache work can
proceed independently only when it has distinct file ownership. Do not let
several writers edit the same caller, shared action or terminal gate.

Known adjacent work, refreshed during roadmap preparation:

- [PR #5936 — image selection from event merge base](https://github.com/uzh-bf/klicker-uzh/pull/5936):
  open draft, branch `rs/ci-build-merge-base`, head
  `d0560dee694af8e5566f58d20d172d74f724c5a1`. Reuse this fix; do not implement a
  competing selector before checking its current disposition.
- [PR #5924 — analysis, coverage and supply-chain security](https://github.com/uzh-bf/klicker-uzh/pull/5924):
  open, non-draft, branch `rs/sonarqube-workflow-roadmap`, head
  `07f41a39c9efefe0f1035e497970fe5019fdd040`. Coordinate `check.yml`, unit and
  GraphQL coverage, CodeQL/Sonar, image audits and promoter changes.
- [PR #5850](https://github.com/uzh-bf/klicker-uzh/pull/5850) is merged;
  [PR #5852](https://github.com/uzh-bf/klicker-uzh/pull/5852) is closed. Do not
  resurrect their old stack or collector based on historical handoffs.

### Baseline and coordination

**Outcome:** measure what is being optimized and avoid conflicting changes.

Refresh `v3`, the two overlapping PRs, required rules, relevant non-secret
variables, workflow inventory and candidate-push policy. Account for every
active workflow family: code checks, security/review, unit/integration tests,
Playwright, images, timing/cache maintenance, release and promotion. Separate
real jobs from reusable containers, disabled jobs and skipped run records.

Use existing telemetry and GitHub APIs. Record event/action, draft state,
base/head/tested tree, trusted control SHA, run/attempt, actual runner, requested
coverage, cache keys and hits, build/setup/test time, dependency wait, queued
time, retries, cancellation and occupied runner minutes. Do not add another
dashboard or telemetry daemon just to collect the baseline.

Use five representative cases: metadata-only, narrow frontend, leaf package,
shared dependency/lockfile, and unchanged draft-to-ready. Separate x64/ARM64,
cold/warm, selected/full and deployment-candidate cohorts. Existing runs are
preferred; synthetic dispatch or lifecycle mutation needs its own authority.

**Acceptance:** one compact measurement table in the first package's evidence,
with missing data explicit and a source-level inventory of current trigger
rules. Reconcile overlapping ownership before implementation. A proposed goal
must name a finite approved package, not an open-ended instruction to make CI
faster. The originating task has an older blocked native goal; do not replace
it or claim it active solely from this roadmap.

### Event and coverage policy

**Outcome:** only meaningful changes launch expensive work; ready state always
has trustworthy full coverage.

| Event                                | Recommended execution policy                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft opened or code synchronized    | Conservative affected-spec selection; unknown/shared/CI changes run full. Build compatible selected dependencies once.                               |
| Ready PR opened or code synchronized | Full suite covering every active candidate spec; compatible artifacts may be reused.                                                                 |
| Unchanged draft becomes ready        | Require full proof; run missing coverage. If the exact compatible full proof already exists, validate that evidence instead of rebuilding/retesting. |
| Title/body edit                      | No expensive validation; retain valid checks.                                                                                                        |
| Base retarget                        | Recompute merge input, impact and evidence. Unknown event detail uses normal validation.                                                             |
| PR closed/merged                     | Cancel only in-scope obsolete PR validation; prevent new expensive PR work.                                                                          |
| Push or release candidate            | Follow explicit branch-role and deployment evidence policy; never blindly reuse PR-head success.                                                     |

Existing seams: `.github/workflows/test-playwright.yml`,
`public-pr-playwright-shards.yml`, `check.yml`, test callers,
`.github/scripts/playwright-route.cjs`, `playwright-selector.cjs`,
`playwright-plan-metadata.cjs`, `ci-equivalent-run.cjs`,
`required-ci-status.cjs`, and `playwright/relevance-manifest.json`.

First implement and test lifecycle guards without changing coverage. Then
restore smart selection and ready-state proof as one coherent behavior change.
Current routing forces `selectorPrState=ready`; the shadow selector cannot be
activated by a variable alone. Preserve [PR #5919's required-check
enforcement](https://github.com/uzh-bf/klicker-uzh/pull/5919), while replacing the
part that equates draft execution with mandatory full coverage.

For eligible public PRs, prefer the same ARM64 build/runtime contract before
and after ready, so build artifacts can remain compatible. Forks, bots and
other ineligible cases retain their documented hosted route. This route change
needs admission/capacity measurement; do not launch both backends and race them.

Begin with reusable builds and full-proof reuse. Reusing the union of separate
partial E2E executions is deferred until an explicit isolation and coverage
contract proves it safe. A selected draft followed by a full ready run may
repeat some test cases while still avoiding an unnecessary rebuild.

Evidence binds repository, PR, event, head/base/tested tree, workflow/control
revision, run and attempt, spec/selector contract, environment/toolchain and
architecture. Check latest-attempt state and revalidate immediately before
acceptance. Treat downloaded artifacts as untrusted data; validate schemas,
identity and bounds, and never execute scripts from them in a trusted gate.
Missing, expired, inaccessible or incompatible evidence means ordinary work.

**Acceptance:** synthetic event tests cover title/body edits, retargeting,
closed-PR edits, ready with partial/full/missing proof, changed base with same
head, cancellation, concurrent synchronize and ready events, stale artifacts,
forks and API errors. An approved live transition proves no second build for
compatible inputs, no false full success, and correct required-context binding.
Qualify smart selection with representative full-versus-shadow evidence; retain
the historical ten-representative-comparison gate until explicitly revised.

**Rollback:** restore full coverage and normal execution on evidence uncertainty.
Keep safe metadata/open-state guards unless they caused the regression.

### Affected images and cached builds

**Outcome:** image validation follows actual dependencies and unchanged layers
are reusable.

Extend existing changed-path and required-build selection rather than adding a
second independent definition. Integrate the verified merge-base correction
from PR #5936. Build an image-to-workspace dependency closure including the
backend migrator, assessment variant and branch-specific extra images. Account
for renames/deletions, Dockerfiles, base-image/toolchain identity, build context,
workspace dependencies, lockfile closure, patches, build arguments and shared
Next/build configuration. Ambiguous dependency discovery selects broadly.

Do not substitute latest-commit filtering for cumulative PR coverage. Introduce
one bounded affected-image matrix only after producer and `build-images-status`
selection agree. Existing seams are `v3_*-stg.yml`, `v3_build-fallback.yml`,
`.github/actions/changed-paths`, `.github/scripts/required-build-status.cjs`,
workspace manifests and the affected Dockerfiles. A shared image-input helper
may be added only when both execution and reporting consume it.

Pilot native ARM64 BuildKit cache import/export on one representative Next
image and the backend/migrator pair. Include image, architecture, environment
and compatible input identity in cache scopes; avoid the shared default
`buildkit` scope. Remove QEMU only for jobs building their native architecture.
Validate clean and warm builds, generated outputs, startup and image platform.

Separate secret-free PR build validation from trusted image/cache publication.
The initial source optimization preserves existing publication behavior until
that separation is reviewed. Public persistent runners receive no registry
write credentials. A registry cache may avoid Actions quota competition, but
its visibility, writer permissions and retention must be settled before use.
No new cache service is required for the pilot.

For ordinary PRs, skip unaffected images with validated selection evidence.
For a deployment candidate, preserve the promoter's complete exact-SHA image
contract. Initially keep the complete candidate matrix and make it cached.
Skipping candidate publications later requires verified compatible digests and
a deliberate publication/retagging contract; an absent SHA-tagged image is not
an optimization success.

**Acceptance:** leaf changes select only proven dependents, shared/unknown
changes select all necessary images, and execution/reporting select the same
set. Warm rebuilds demonstrate cached stages and equivalent runnable outputs.
Cancelled or missing selected publishers fail the gate. Record actual saved
job minutes before propagating the pilot to remaining staging images.

**Rollback:** disable the affected cache import or restore conservative
selection. Preserve successful image identity and publication evidence.

### Workflow dependencies and terminal gates

**Outcome:** dependency waiting consumes no runner, and status reporting does
not materially extend the critical path.

Consolidate duplicated change planning and image execution into a dependency
graph with bounded matrices and short aggregators. Preserve parallel test
families rather than producing one sequential mega-job. Remove the hosted
sleep/poll loop from `v3_build-fallback.yml`; a matrix or reusable job dependency
lets GitHub wait without occupying an executor.

Retain required status names and machine-readable evidence while migrating.
Coordinate the staging controller's workflow-name/job-name expectations before
changing producer identities. Trigger promotion qualification after the
complete candidate gate, avoiding a controller wakeup for each intermediate
image/test completion. Keep promotion disabled when it is disabled; source
simplification does not authorize deployment activation.

The final gate remains trusted and checkout-free where practical. A small
public-pool job is not automatically appropriate for authoritative status
writing. A lighter hosted runner class can be benchmarked for metadata work,
but it still consumes the organization's standard hosted concurrency.

**Acceptance:** no idle polling runner; same failure/cancellation/selection
semantics; no successful gate for a missing producer; bounded API pagination;
exact candidate proof remains intact. Measure controller allocations, queue
time and gate overhead rather than counting all skipped workflow records.

**Rollback:** retain the prior compatible producer/gate pair until the new pair
is verified on merged source. Avoid requiring an unmerged workflow ref.

### Cache compatibility and consumers

**Outcome:** repeated compatible work hits cache, and cached outputs behave like
cold outputs.

Audit existing consumers before introducing storage. Use
`.github/scripts/playwright-cache-contract.cjs`, `hosted-pnpm-cache` helpers,
`.github/actions/playwright-build`, `.github/actions/playwright-shard`,
`playwright-cache-seed.yml`, `check.yml`, test workflows and `turbo.json`.

1. Separate dependency-content compatibility from build compatibility. Remove
   only proven irrelevant orchestration/telemetry inputs from build archive
   keys; retain architecture, image/libc, Node/pnpm, environment, generator,
   configuration and task-input boundaries.
2. Let compatible read-only pnpm seeds help branches with changed manifests,
   followed by frozen-lockfile installation and integrity checks. Never reuse
   arbitrary `node_modules` across incompatible environments.
3. Reuse trusted required builds for cache publication where their inputs match.
   Retain a separate architecture seed when required. Define an approved seed
   policy for diverging integration branches instead of silently granting PRs
   trusted write access.
4. Enable type-check caching after proving complete inputs, generated
   declarations and output behavior. Consider deterministic unit tasks
   separately; do not blanket-cache integration or E2E outcomes. Path-scope
   unrelated dev-runtime contract tests within `check` without weakening it.
5. Review output manifests and global environment hashing. Keep synthetic CI
   build-time values explicit. Audit retention and cache size; read-only usage
   inspection does not authorize bulk cache deletion or a paid quota change.

Follow the existing lessons in [consumer cache verification](../docs/solutions/workflow/verify-build-cache-through-consumers.md)
and [Rollup declaration outputs](../docs/solutions/build-error/rollup-incremental-cache-drops-declarations.md).
An outer archive hit, a successful seed and actual Turbo task hits are separate
measurements. A cache error falls back to execution; a build error stays failed.

Self-hosted HTTP-compatible Turbo storage is supported; Vercel is optional.
Defer a new service unless measurements show the existing backend is the
bottleneck and the user approves its operating cost and trust contract.

**Acceptance:** repeated compatible source gets measured pnpm/Turbo hits;
telemetry-only edits preserve intended cache compatibility; genuine dependency,
architecture, environment and generator changes invalidate the right outputs.
Test consumers with cached and uncached artifacts, including generated GraphQL
maps, declarations, Prisma clients and Next standalone/PWA output as relevant.
No public PR token gains trusted cache write capability.

**Rollback:** disable the faulty cache family or task cache and rebuild normally;
do not delete unrelated caches or hide build failures.

### Profile-aware execution

**Outcome:** selected tests start fewer services and applications, while full
coverage runs efficiently within the existing eight slots.

Use existing Devrouter profile resolution, relevance manifests and planning
interfaces. Do not add a competing profile resolver or modify Next internals.
Coordinate with the Devrouter owner only when its public contract actually
needs extension; local networking recovery is a different workstream.

Extend packing to consider measured test duration plus application/service
startup cost. Avoid spreading `full` requirements across almost every shard,
but preserve balanced maximum duration; putting all expensive tests into one
shard can make latency worse. Build the selected application dependency union
once, then provision only each shard's required service set with compatible
artifacts and isolated database/network identities.

Primary seams: `playwright/relevance-manifest.json`, `playwright/timings.json`,
`.github/scripts/playwright-selector.cjs`, `.github/actions/playwright-build`,
`.github/actions/playwright-shard`, `public-pr-playwright-shards.yml`,
`util/profile-resolver.sh`, and the existing CI startup scripts.

Maintain separate or explicitly normalized timing evidence for ARM64 and x64.
The current default-branch timing updater consumes hosted results; it must not
silently replace ARM-calibrated weights. Treat test-command and whole-job
durations separately. Keep Playwright workers=1 during this comparison.

Preinstallation must match the execution boundary. Pinned container toolchains,
browser images and read-only dependency layers help container jobs; installing
tools only on the host usually does not. Keep existing versions and image
digests explicit. Update host reconciliation scripts only if a measured change
requires persistent host configuration.

**Acceptance:** every full-suite spec assigned exactly once, conservative
fallback for unknown tests, correct services for live-quiz/manage/chat/PWA,
unchanged authentication/readiness behavior, and no port/state collisions.
Compare setup time, test time, maximum shard duration and host memory under
equivalent load. Reject a packing change that saves aggregate work but causes
an unacceptable critical-path regression.

**Rollback:** retain current profile union and balancing as the compatible
fallback. A missing profile dependency starts the known-good full stack rather
than claiming a passing partial execution.

### Runner placement qualification

**Outcome:** spend the fixed fleet budget on workloads that improve overall PR
latency, without compromising the public/private boundary.

| Workload                                                                                                 | Initial placement                                 | Condition for reconsideration                                                                      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Public Playwright build/shards                                                                           | Existing ARM64 pool                               | Measure after event/cache/profile fixes; retain hosted eligibility fallback                        |
| Public pure lint/typecheck/unit work                                                                     | Hosted                                            | Bounded isolated, secret-free trial must improve overall queue/latency without delaying Playwright |
| Additional Docker or full-stack integration                                                              | Hosted                                            | Demonstrate spare capacity, isolated networking, compatible caches and net benefit                 |
| Required policy/reporting, security/review with credentials, trusted cache/image publication, deployment | Fresh hosted or separately trusted infrastructure | Never migrate to the persistent public pool solely because the job is small                        |
| Private repositories                                                                                     | Separate trusted/private pool                     | Public-pool expansion is not authorized                                                            |

The baseline is two 16-vCPU/32-GB hosts with four runner services each. One
eight-shard wave fills all slots. Do not assume an idle percentage means another
full stack fits; evaluate peak available memory, pressure, runnable CPU, disk
and queue interaction. Current data does not justify resizing, adding cost or
claiming four services is an absolute hardware limit.

Before any live experiment, inspect the exact runner group with authorized
read access and provide the proposed repository/workflow allowlist diff. New
public repositories, including other Playwright consumers, need a separate
reviewed onboarding decision. The existing group is not a general-purpose
public compute pool, and labels do not create a security boundary.

Begin with one approved workload, fixed parallelism and a finite comparison
window. Existing host-port bindings must become job-isolated before moving an
integration suite. Do not add a permanent service or extra runner process as a
side effect of a routing change. Prefer admission limits over racing duplicate
hosted/self-hosted executions.

**Acceptance:** at least ten comparable completed observations per baseline and
candidate where practical, with sample counts and uncertainty stated. Compare
median and p90 full feedback, queue, execution, occupied minutes and failure
rate; do not claim stable tail percentiles from a tiny cohort. Suggested
acceptance is at least 20% lower occupied minutes for the optimized cohort,
without a material latency/reliability regression. This is a target to qualify,
not a promised gain. Preserve a useful negative result and keep hosted when it
wins. Stop on OOM, port/state collision, integrity failure or clear contention.

**Rollback:** return the one workload to its prior hosted route. A host change,
if separately approved, must use the existing dry-run/idempotent reconciler,
drain only exact affected services, preserve data and SSH, and verify readback.
No reprovisioning, broad Docker prune or filesystem cleanup is part of this
roadmap by default.

### Verification portfolio and delivery evidence

Extend existing behavioral tests instead of creating parallel policy suites.
The audit inspected the existing event, equivalence, required-status, selector
and cache fixtures. Test obligations protect distinct failures, not document
wording or incidental seed content.

| Consequential risk                                     | Existing seam                                                                                    | Obligation and owning package                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Metadata/closed events launch work; retarget is missed | `ci-event-gates.test.cjs`, `playwright-route.test.cjs`                                           | Extend synthetic event matrix; event policy                                                  |
| Partial/stale/cancelled proof permits ready merge      | `ci-equivalent-run.test.cjs`, `required-ci-status.test.cjs`, `playwright-plan-metadata.test.cjs` | Extend immutable identity, latest-attempt, coverage and race cases; event policy             |
| Missing selected image receives green status           | `required-build-status.test.cjs` and changed-path tests                                          | Extend merge-base and transitive selection fixtures, producer/gate parity; images            |
| Cache serves incompatible or incomplete build output   | `playwright-cache-contract.test.cjs`, `hosted-pnpm-cache.test.cjs`, existing consumer checks     | Extend compatibility boundaries plus cold/warm consumer proof; caches                        |
| Profile reduction misses tests or services             | `playwright-selector.test.cjs`, public-workflow validator, `util/test-profile-resolver.sh`       | Extend assignment/dependency invariants plus representative real suites; profiles            |
| Moving a job starves/corrupts its neighbors            | Existing telemetry/resource sampler and host reconciler tests                                    | No new unit test merely for a label change; real bounded resource/isolation proof; placement |

Start each implementation package with focused syntax, YAML/action validation,
script tests and existing format checks. Run container-dependent checks in the
repository's supported container path; documentation alone needs no app runtime.
Use real Playwright only for behavior that requires its stack. Preserve exact
tested SHA/control revision and run attempt in the receipt. No new tests are
required for this roadmap document.

Trusted reusable callers remain pinned to `@v3`. Branch CI proves candidate
compatibility and pool health, not activation of an unmerged reusable definition.
After an authorized merge, inspect an exact-head run that resolves the new
control revision. Verify actual runner names, planned versus executed coverage,
cache matches and task hits, artifacts, terminal statuses and required contexts.
Do not equate a closure/cancellation housekeeping success with completed tests.

Keep one watcher for each authorized long-running proof and prefer existing
runs. A recurring collector, manual dispatch, PR lifecycle mutation or live
variable change needs named authority. Do not recreate retired collectors.

### Documentation, research and decision gates

Update `docs/ci-and-deployment.md` with each changed event, coverage, cache or
publication contract, and the relevant existing CI/onboarding skill only when
its operating instructions become inaccurate. Update `docs/testing.md` if
profile/test execution changes affect developer commands. Preserve historical
plans. No product/domain primitive changes are proposed.

No ADR is needed for this direction-only document. Reuse existing architecture
decisions. A new cross-run trust attestation, trusted cache writer/storage
boundary, or candidate image-reuse/promotion contract arms a domain-modeling
decision before implementation; rationale then lives in that ADR, not a second
roadmap paragraph. Broad security scans remain separately approval-gated;
focused review of changed trust-sensitive seams is part of the source package.

Research consulted during the audit, using official sources:

- [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits)
  and [hosted runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners):
  concurrency, cache limits and resource classes. `ubuntu-slim` is a potential
  metadata-only benchmark, not a bypass for standard concurrency or a Docker host.
- [Events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
  and [dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching):
  PR merge identity, lifecycle triggers and cache scope. Recheck current behavior
  before freezing an implementation contract.
- [Docker Actions cache backend](https://docs.docker.com/build/cache/backends/gha/):
  cache scope and backend behavior; validate compatibility with the pinned builder.
- [Turborepo remote caching](https://turborepo.dev/docs/core-concepts/remote-caching),
  [task caching](https://turborepo.dev/docs/crafting-your-repository/caching) and
  [configuration](https://turborepo.dev/docs/reference/configuration):
  self-hosted HTTP storage, task hashes, outputs and environment inputs.

Research owner was main; no external advisor or independent review was run.
These documents establish platform behavior, not a benchmark for this repository.
No additional research service or paid experiment was used for this handoff.

### Success, pauses and proposed execution approval

For the first source package, ask for one coherent approval covering event
guards, draft/ready coverage policy and evidence-bound build reuse, focused
verification, ordinary push and draft PR. Add explicit conditional merge and
post-merge activation authority only if the user chooses those delivery layers.
Do not bundle runner-group expansion or deployment changes into that ask.

After approval, continue routine implementation, correction and authorized
delivery without generic proceed checkpoints. Pause only the dependent work
when a material policy/trust/cost change is required, an overlapping owner has
unresolved custody, or a required capability is unavailable. A failing check is
a diagnosis loop, not permission to hide or retry it blindly.

The complete roadmap is accepted only when each package has a measured outcome
or an explicit evidence-backed decision to defer it. Report source, merged
activation and performance separately. No infrastructure change is currently
required from the user.

## Progress

- Planning and local takeover artifacts completed on 2026-09-13; implementation
  has not started.
- Repository audit and fresh overlapping-PR checks complete; all implementation
  packages above remain proposed, with no rollout performed in this delivery.
- Fresh worktree starts 0 ahead / 0 behind `origin/v3` at `062719406b`; the
  primary checkout's unrelated Dockerfile, cache and tooling edits are preserved.
- Review: main-session evidence/contract review under the user's no-subagent
  instruction. No independent planner/final-review result is claimed. Successor
  task applies current review requirements when deriving the first source package.
- Verification: Prettier with ignore rules disabled passes; all five relative
  document links resolve; whitespace check passes. Handoff frontmatter validation
  reports zero errors, with five warnings belonging to older files. No build or
  application test run is claimed for documentation-only work. Test delta:
  0 added / 0 changed / 0 removed.
- Delivery layer: local roadmap and separately saved global handoff. No roadmap
  PR exists, and no implementation goal or watcher was started for this request.
- 2026-09-13 takeover (receiving task): handoff state verified against live
  repository, PRs and worktrees; user approved the first source package
  (Playwright event and coverage policy) as one draft PR. Slice 1 lifecycle
  guards committed `b12e5814eb`; slice 2 evidence-bound PR reuse committed
  `46ac646644`; validator contract pinned `b6549bae82`; docs updated. 175
  tests pass across the CI queue-policy and Playwright CI contract suites;
  Biome format clean. Test delta: 13 added / 0 changed / 0 removed (the
  reject-every-reuse validator test was rewritten to the new contract).
  Coordination: zero file overlap with PR #5936 and PR #5924. Delivered as
  draft [PR #5948](https://github.com/uzh-bf/klicker-uzh/pull/5948) against
  `v3` (branch `rs/ci-efficiency-roadmap`, pushed 2026-09-13). Remaining
  (named gate): post-merge exact-head activation proof on a real unchanged-head
  transition; merge authority stays with the user.
- Next action: receiving task reads this roadmap and the global handoff, refreshes
  `v3` and adjacent ownership, then resolves approval for the first source package.
