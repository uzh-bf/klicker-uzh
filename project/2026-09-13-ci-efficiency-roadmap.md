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
- 2026-09-13 slice C1 (affected-image path filters): each `v3_*-stg.yml`
  pull-request filter now lists that image's transitive workspace dependency
  closure (`turbo prune --scope=<package> --docker`) instead of the blanket
  `packages/**`. Measured on today's traffic: PR-side image builds executed
  980.7 hosted minutes across 152 `build-arm` jobs, and every node image
  matched nearly every `packages/**` change. On nine representative changed
  files the selection drops from 86 to 40 image builds, including
  `packages/transactional`/`packages/prisma-data` (12 -> 1, chat only),
  `packages/word-cloud` (12 -> 6, Next images only) and `packages/export`
  (12 -> 0). Root manifests and `.dockerignore` still select every node image,
  analytics keeps its dependency-free filters, and pushes to `v3`/`v3*` still
  build all images because push triggers have no path filter. The evaluator's
  `IMAGE_WORKFLOWS` inventory and the twelve workflow filters were rewritten
  together; three new tests derive each closure from the workspace manifests
  and fail if a filter omits a real dependency or wakes an unrelated image.
  Verification: 24/24 required-build-status tests, 9/9 event gates, 57/57
  across the three CI suites, Prettier clean, stable across three runs.
  Delivered on branch `rs/ci-image-edit-reuse`.
- Remaining known avoidable work, unchanged by C1: the image workflows still
  rebuild on `edited` and `ready_for_review` for an unchanged head (measured
  97 extra unchanged-head runs across the repository in two days), and the five
  `Build Fallback` pollers occupy hosted runners for up to 2103s per event.
  Both need the B3 consolidation or a same-head reuse contract and stay
  sequenced behind PR #5924.


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
- 2026-09-13 AMD audit and queue relief: PR #5948 was merged as squash
  `1431b9aca3`; exact-head activation proof is still pending a real
  unchanged-head transition because the Actions queue was saturated. AMD
  verification: every `build-amd` job across the stg and prd image workflows,
  including release tags, is gated `if: ${{ false }}` and consumes no runner
  slots today. Ruling recorded: AMD stays disabled; any re-enable is limited to
  prd-tag release artifacts, never branch or PR builds.
- 2026-09-13 slice B2 (staging image build cache): all 14 active ARM64 image
  jobs across the 13 `v3_*-stg.yml` workflows on `v3` now build
  same-repository pull requests from a shared BuildKit registry cache
  (`<image>-arm:buildcache` in ghcr.io, `mode=max`) while push publications
  stay uncached. Fork and other cross-repository pull requests keep the
  uncached path, the push-gated login jobs admit same-repo PRs for cache
  access only, and the native ARM64 jobs no longer install QEMU. A policy
  test pins the cache contract; 30 tests pass across the required-build-status
  and event-gate suites; Prettier and Biome report clean formatting. Delivered
  on branch `rs/ci-image-build-consolidation`.
- 2026-09-13 slice B3 sequencing decision: PR #5936 is already merged into the
  branch base (the earlier open-draft note was stale), and PR #5971 is
  MERGEABLE/BLOCKED-only-by-required-checks. Full image-workflow consolidation
  must wait for PR #5924: that open PR directly rewrites
  `stg-release-promoter.js`, `stg-release-promoter-fixtures.js`,
  `stg-release-promoter.test.js`, `deploy-stg-promote.yml`, and
  `v3_backend-docker-stg.yml` — the same seams slice B3 replaces. Starting B3
  now would force a large conflicting rewrite of the promotion controller's
  fail-closed validation. Queue evidence at 18:21Z: every Playwright run since
  17:40Z remains queued, so both the #5948 unchanged-head activation proof and
  #5971's first live cached builds are runner-gated, not code-gated. Next
  action after #5924 merges: rebase, then execute B3 as one package (single
  affected-image matrix workflow, needs-based `build-images-status`, promoter
  and sweeper updates).
- 2026-09-13 queue-gate verification and remaining-slice audit: PR #5971 is a
  draft, so every `build-arm` job correctly reported `skipping` through the
  #5948-era draft-deferral gate — the first live post-merge observation of that
  contract, though the required `build-images-status` confirmation is itself
  queued (run `34774514076`, observed queued at 18:24Z and again after a
  bounded wait; a seconds-long metadata job cannot start, confirming the
  organization concurrency cap is the gate, not per-job logic). #5924 remains
  OPEN at `d673956b`, so the B3 blocker stands. Remaining (e) packages were
  audited against live source: `playwright/timings.json` is architecture-blind
  (version 1, one duration table, written only from hosted v3 push runs of
  `test-playwright.yml`, consumed by both the hosted sharder and the
  public-PR selector). A per-architecture timing family (schema v2,
  producer-tagged feedback, architecture-matched consumption with explicit
  fallback) is the next ready package once ARM-side measurement data exists —
  shipping the schema before any ARM writer would add contract without
  measured payoff. Type-check caching and `check` path-scoping overlap #5924's
  `check.yml` edits and stay sequenced behind it.
- 2026-09-13 B3 execution spec (validated against #5924's full diff): #5924
  adds image-scan admission to the promotion controller — new per-image scan
  jobs inside the stg workflows, `SCAN_ADMISSION_INVENTORY` keyed by
  `workflowPath`, `collectScanAdmission` retrying scan runs and binding scan
  receipts to resolved digests, plus `v3_sonarcloud.yml` in
  `REQUIRED_CI_WORKFLOWS`. This deepens the same per-file seams B3 must
  restructure, so B3 executes only after #5924 merges and must then cover:
  (1) `WORKFLOW_PATH_PATTERN` and `STAGING_WORKFLOWS` become a single
  target-based inventory (`v3_images-stg.yml` matrix, one entry per image;
  matrix job names replace `build-arm`/`build-migrator-arm` identifiers);
  (2) `validateStagingWorkflow`'s job-id matching, the migrator
  `needs:`-ordering check, and `collectBuildEvidence`'s per-workflow run
  enumeration are rewritten against the single workflow and its matrix runs;
  (3) `SCAN_ADMISSION_INVENTORY` re-keys from workflow paths to image targets,
  and scan admission consumes the one workflow's run; (4)
  `deploy-stg-promote.yml`'s 21-name `workflow_run` watch list collapses to
  the non-image workflows plus the new workflow name, eliminating per-image
  controller wakeups; (5) `v3_build-fallback.yml` is deleted — the new
  workflow owns a `needs`-based `build-images-status` job preserving the exact
  required context name and `required-ci-evidence` artifact contract;
  (6) `cancel-closed-pr-checks.yml` sweeper entries and
  `ci-event-gates.test.cjs` collapse to the single new concurrency group;
  (7) the changed-file selection from #5936 moves into the new workflow's
  plan job with its merge-base resolution and validated-selection evidence.
  Fail-closed semantics preserved: plan failure fails the status, empty
  selection skips builds and passes with evidence, any selected build
  failure/cancellation fails the status, and the promoter's complete
  exact-SHA candidate matrix is unchanged.
- 2026-09-13 timing-architecture provenance slice (branch
  `rs/playwright-timing-architecture`): PR #5971 merged as `136a867280`,
  verified live on `v3` (cache contract in the ARM jobs, QEMU only in the
  disabled AMD jobs). The hazard this slice closes: `playwright/timings.json`
  holds the weights regenerated from ARM64 run `34692527245` in PR #5921,
  which replaced the earlier x86-measured weights because they no longer
  reflected ARM64 reality, while the only automated writer runs from hosted
  x64 `v3` pushes — its next timing PR would have silently restored the
  mismatch. The updater now requires `--architecture`, records it in the
  table, and refuses to replace a table calibrated for another architecture
  (no write, explicit reason, no timing PR); an untagged table is adopted by
  the producing architecture. The workflow derives the architecture from the
  run's recorded route (`hosted` -> `x64`, `public-pr` -> `arm64`) and fails
  closed on an unknown route. Evidence: 14/14 python timing tests (3 new:
  architecture recorded, cross-architecture replacement refused with the file
  byte-identical, untagged table adopted), 8/8 `get-shard-files` tests against
  the real tagged table, 23/23 selector and plan-metadata tests, 9/9
  event-gate tests, Prettier clean. Follow-up still open: per-architecture
  timing families with route-matched consumption, which needs measured
  x64 data and a human decision before either route changes its balance.
- 2026-09-13 (a) activation audit at 19:50Z, PR #5948 post-merge:
  **lifecycle guard verified live.** Five pull-request runs on merged or
  closed pull requests report `test-playwright-execution` as `skipped` while
  `cancel-closed-pr` succeeds — external-attested activation of the open-state
  guard rather than a repository claim. The work is real, but incomplete.
  **Reuse marker not yet observed: no run has published a non-empty
  `duplicate_run_id`.** Of 40+ Playwright runs since the merge, each one with
  run metadata shows `duplicate_run_id=`. The reuse step only executes for
  push-on-non-v3, `ready_for_review`, `edited`, or `reopened` events, and in
  the one `ready_for_review` case available (PR #5970 at 18:32:13Z on head
  `29262f4e`) the same-head predecessor runs were cancelled before completing
  a full proof, so the conservatively correct outcome was a real build.
  Reuse is deployed and inert rather than proven by a positive case.
  **AMENDMENT — corroborated by the merge guard.** Merge of #5971 at 19:36:47Z
  produced run `34778229849` on the unchanged head `c2511ee2` with
  `test-playwright-execution` `skipped`; the concurrent run `34778195485` was
  cancelled by supersession. Together these show the guard prevents both a
  post-merge revalidation launch and a duplicate execution for one head.
- 2026-09-13 throughput attribution at 19:55Z: the eight-shard wave is not the
  pool's constraint. Run `34776822028` placed build and all eight shards on
  `public-pr-arm64-01` through `-08` and completed every execution job
  successfully; only the required `test-playwright-status` reporter remained
  queued, because it runs on GitHub-hosted runners. Repository-wide state at
  that moment: 13 runs in progress, 299 queued, 0 waiting. The hosted
  concurrency cap, not ARM capacity, now dominates the observed queue. Any
  further pool-side optimization cannot shorten the critical path while the
  reporter waits behind that cap. Moving that trusted required context to the
  persistent public pool is not available: the runner group admits exactly one
  public workflow, and the roadmap keeps credential-adjacent reporting
  hosted. This strengthens the case for the org Team upgrade (20 -> 60 hosted
  concurrent jobs) as the single remaining lever outside repository source.
- 2026-09-13 (d) cache-activation audit at 20:10Z: the merge is verified in
  source (`git show origin/v3:.github/workflows/v3_auth-stg.yml` carries the
  `no-cache: ${{ github.event_name == 'push' }}` / `cache-from` / `cache-to`
  triple and QEMU appears only in the disabled AMD jobs), but the cache has
  not yet been exercised. GHCR reports no `-arm:buildcache` tag on any of the
  four largest repositories (`auth-arm`, `chat-arm`, `backend-docker-arm`,
  `frontend-manage-arm`: absent across 100 versions each), so no pull-request
  build has written the registry cache. Every image workflow run created after
  the merge is a draft deferral (`build-arm` `skipped`) or a push publication
  into the saturated hosted queue (`v3-ai` push runs `34779097222` and
  siblings remain `queued`); the last pull-request builds that actually
  executed (`34774712103` and siblings, 18:28Z) predate the merge. The
  contract is deployed and inert, awaiting the first same-repository
  non-draft pull request whose diff touches image inputs. `buildcache` is
  written through the ordinary ghcr.io push-token path rather than the
  Actions cache service, so the ~10 GiB quota does not apply and the
  `mode=max` export is visible as a distinct tag in the repository's version
  list once it happens.
- 2026-09-13 Playwright reuse defect found and fixed (branch
  `rs/ci-metadata-edit-guard`): the merged equivalent-run contract could never
  fire. `findEquivalentPullRequestRun` selected its candidate as the newest
  `pull_request` run for the head, filtered only by pull-request number. The
  event validating reuse is itself a run of the same workflow on the same
  head, so it was always the newest entry, and a still-executing run is never
  both `completed` and `successful`. Every lifecycle event therefore fell
  through to full validation. Fix: exclude `context.runId` from the
  pull-request candidate set, the same established pattern
  `required-build-status.cjs` already uses. Two regression tests pin the
  contract — a completed run is reused while its own event run is in flight,
  and the current run can never qualify itself as reusable evidence. A probe
  confirmed fail-closed behaviour is intact: a cancelled or failed earlier run
  is still rejected and a newer completed run still wins. Evidence: 144/144
  tests pass across the six `check.yml` gate files. Live corroboration: PR
  #5922 fired a third full wave at 21:21:57Z on unchanged head `ab5164bc`
  from a body edit, with the same merge tree as its 16:58 predecessor that had
  already succeeded on the same route; that pair also differed in control
  revision, which reuse legitimately rejects, so the live case corroborates
  rather than demonstrates the bug. Fleet measurement across the 40 newest
  pull requests, one commit each: 430 image suites collapse to 284
  `(path, head)` groups, with 146 extra runs, 107 of them non-skipped.
  Expectation-setting: reuse now requires the same control revision, base,
  head and merge tree, so it fires in quiet windows rather than on every
  lifecycle event; qualify it with a real unchanged-head transition after
  merge instead of promising an immediate win.
- 2026-09-13 required-gate false-failure attribution: the 35-minute
  `build-images-status` failures were not a live defect. Run `34770188746`
  (PR #5922, `action: edited`) failed with
  `v3_analytics-stg.yml (no run for this event, branch and commit)` plus a
  queued sibling; its downloaded evidence artifact reports
  `changed files: two-endpoint comparison (conservative)`, an old
  conservative fallback that exists only in base `f00e272a`. Both
  `origin/v3` and `origin/v3-ai` now carry the merge-base version from
  #5936 (`dfadccd1db`, an ancestor of `origin/v3`), so that cause is already
  fixed. The remaining genuine cause is plain hosted-queue saturation: run
  `34773533734` (PR #5924) failed on a single queued sibling after 60 polls x
  30s. That is roadmap item B3 and stays blocked until #5924 merges.
- 2026-09-13 metadata-only edited slice (branch `rs/ci-metadata-edit-skip`):
  PR #5977 merged as `6bcd91e4c9`; the reuse fix is live on `v3` at
  `ci-equivalent-run.cjs` lines 235/253. This slice removes the sibling waste
  class: 21 workflows list `edited`, and a title or body edit previously
  re-launched every one of them on an unchanged head even though the path
  diff is byte-identical to the event before it. The `changed-paths`
  composite now returns `should_run=false` for a pull_request `edited` event
  without `changes.base.from` (title/body only) and still computes the real
  diff when `changes.base.from` is present (base retarget). The four
  path-filtered suites (`test-unit`, `test-graphql`, `test-olat-api`,
  `test-intl-production`) already treat `should_run=false` as a validated
  `no-change` selection, so their required status stays green without
  executing. `check-gitleaks` keeps its unconditional run; `check`,
  `public-pr-playwright-shards`, and the `v3_*-stg.yml` image workflows are
  not changed here because their edited-event behaviour is contractual
  (required context, reusable-run lifecycle, and draft-deferral/retarget
  recompute respectively) and belong to their own packages. Evidence: 5 new
  behavioural tests run the composite's exact script against temp repositories
  with a local origin remote (metadata-only edit skips, base retarget
  re-selects, synchronize and reopened still select, empty push diff still
  fails open). Scope note: image-workflow `edited` re-runs are governed by the
  B3 consolidation package and remain blocked on #5924.
- 2026-09-14 build-cache scope slice (branch `rs/playwright-build-cache-scope`):
  draft PR #5987 at head `b9a906ae73` fixes the (e) cache-compatibility
  defect where the build fingerprint mixed build inputs with orchestration
  and telemetry files. The four telemetry/scheduling files
  (`playwright-telemetry.cjs`, `turbo-telemetry.cjs`,
  `public-pr-playwright-shards.yml`, `test-playwright.yml`) previously
  invalidated every cached build artifact on both routes when edited, even
  though build outputs were identical. The fingerprint now hashes only
  build-relevant files; `CACHE_SCHEMA` bumps 2 → 3 so artifacts reseed
  under the corrected contract, and trusted run-reuse still binds the
  orchestration files through the control revision. Shard jobs consume only
  `dependency-fingerprint` and build artifacts, so their key scope is
  unchanged. Evidence: 5/5 cache-contract tests including a new invariance
  case (telemetry edits preserve, build-relevant edits invalidate), 124/124
  across the six check.yml gate suites, Biome clean. Activation evidence
  (warm artifact reuse on a post-merge PR) is a later live proof.
- 2026-09-14 (d) BuildKit registry cache activated: the first pull_request
  builds from a cache-enabled head wrote the first `-arm:buildcache` tags.
  PR #5986 (non-draft v3-ai reconciliation, head `da9fd928`) carried the
  cache triple and its `chat` build completed 00:41:56Z; GHCR records
  `chat-arm:buildcache` written 01:20:50Z, `auth-arm:buildcache` at
  01:11:50Z, `frontend-manage-arm:buildcache` at 01:04:36Z, and
  `backend-docker-arm:buildcache` at 00:10:53Z. The contract is no longer
  inert: subsequent same-repository PR builds now import these layers.
  Warm-consumer timing proof (a PR build measurably faster on cache hit)
  remains the follow-up observation for the next image-touching PR wave.
  2026-09-14 exact-head CI on draft PR #5987 at head `7f0af1c522`:
  `check` passed in 3m56s (run 34795721832, job 103828312555), including
  the updated cache-contract suite; `build-images-status` passed; the
  full hosted Playwright route passed prepare, build (4m43s) and all
  eight shards (9m40s–14m34s). Remaining pending items are the four
  path-filtered status reporters and the hosted reporter queued behind
  the organization concurrency cap; `ocr-review` failed as the known
  external-agent flake and carries no required weight for this change.

- 2026-09-14 queue anatomy and Dependabot fan-out slice (branch
  `rs/ci-dependabot-fanout`): the merged work did not hold, and the queue was
  full again at 10:40Z. Live counts: 286–300 runs queued and 7 in progress;
  **208 of those queued runs (about 70%) belong to `dependabot/*` branches**,
  against 78 open non-Dependabot pull requests. The wave opened 22 update pull
  requests in twenty minutes (`#6002`–`#6021`): nine separate
  `docker/apps/<dir>/library/node-26.8-alpine` pull requests for one shared
  base-image bump, six `uv` analytics bumps, and four `github-actions` bumps.
  Each of those pull requests fires roughly thirteen workflows and then
  consumes the most expensive route in the repository: `playwright-route.cjs`
  deliberately routes bot-authored pull requests to hosted with
  `selectorPrState: 'ready'` (`playwright-route.test.cjs` line 117), so every
  Dependabot pull request runs the full eight-shard suite on hosted runners and
  cannot use the self-hosted ARM64 pool. `check-ocr-review.yml` already exempts
  Dependabot, which is why only the final review appears in the queued set.
  Slice contents: `.github/dependabot.yml` now groups the `uv` and
  `github-actions` ecosystems, replaces the twelve per-directory `docker`
  entries with one `directories: ['/apps/*']` entry, and sets
  `open-pull-requests-limit` plus `groups.<name>.group-by: dependency-name`,
  which is the documented option for producing one pull request per updated
  image across directories. The next wave should therefore open about four
  pull requests instead of twenty-two, removing roughly 200 queued runs of the
  current backlog. Verification limit: the option set is documented in the
  Dependabot reference (`directories` supports globbing, `group-by:
  dependency-name` collapses multi-directory updates), but the file is only
  validated by GitHub after it reaches the default branch, so the reduction is
  an expectation until the next scheduled run.
- 2026-09-14 open routing decision from the same data: with base-image pull
  requests routed to the full hosted suite, the cost per Dependabot pull
  request is eight hosted shards plus the shared check, SonarCloud and CodeQL.
  Deciding whether a base-image tag bump needs full Playwright coverage is a
  routing/product decision, not a configuration repair, so it is proposed here
  rather than changed.
- 2026-09-14 B3 pre-flight blocks the roadmap's original execution spec: the
  trusted controller is read from the default branch (`actions/checkout` with
  `ref: github.workflow_sha`) while the candidate tree is
  `vars.STG_SOURCE_BRANCH`. That variable is **not** `v3`. The promotion receipt
  from controller run 34813630732 (artifact
  `stg-release-promotion-receipt-cb1599d9a596860c6fc988d84fae4d44f7650309`)
  records `"source_branch":"v3-audit"`, `"schema_version":"stg-release-promotion/v2"`,
  `"controller_sha":"cbc6ba43a1"`, decision `{"action":"fast-forward","mode":"apply"}`
  and a verified push of candidate `cb1599d9a5` onto `refs/heads/stg-release`
  (previous release `dda3cd04a8`), so automatic promotion is live and currently
  tracks `v3-audit`. Beware the misleading field: the promote run's own
  `head_branch` reads `v3` because the workflow file comes from the default
  branch, while `github.event.workflow_run.head_branch` — the value the branch
  gate compares — is `v3-audit`; every v3-branch event is skipped by that gate.
  The candidate therefore carries **fifteen** staging image
  workflows, including `v3_mcp-lecturer-stg.yml` and `v3_mcp-student-stg.yml`,
  which do not exist on `v3` at all; `STAGING_WORKFLOWS` and the `Build Fallback`
  `workflow_run` list name them precisely so the trusted inventory matches that
  branch, and the same receipt lists `mcp-lecturer-arm` and `mcp-student-arm`
  among the fifteen promoted images. Consequences the original spec must absorb
  before the matrix
  consolidation ships: (1) collapsing `v3`'s thirteen files alone changes the
  candidate set on `v3-audit` and fails the controller closed until `v3` is
  merged into `v3-audit`; (2) the two `mcp-*` entries keep **active** `build-amd`
  legs (`nonRuntimeJobs`), unlike the thirteen `v3` files whose `build-amd` jobs
  are already inert `if: ${{ false }}`, so a consolidated matrix that omits them
  would drop MCP staging images from the promotion contract; (3) the MCP
  workflows live on the integration branches, so the landing plan has to either
  keep them as legacy files in the inventory or add their legs to the
  consolidated workflow on `v3-audit`, and they are not clones of the thirteen:
  each also wraps publication in a `publish_guard` step that the `v3` files do
  not have. B3 also now has a measured wakeup target:
  the current 21-name `workflow_run` list produced **44 controller runs for the
  single `v3` commit `0c2a7a6a33`**, almost all of them skipped. The controller
  itself was healthy when checked, as the receipt above shows, and
  `build-images-status` is the required context from
  rulesets `v3 quality and merge protection` and `v3 integration baseline CI`
  (a job name, not a workflow name), so a workflow rename keeps the context.
- 2026-09-14 second selection finding, not yet sliced: metadata-only pull
  requests are still costly outside the four path-filtered suites. Neither
  `test-playwright.yml` nor `check.yml` carries a path filter, so a pull request
  that changes only prose still runs the full typecheck and the complete
  Playwright suite; branch `docs/writing-coach-proposal` held **18 queued runs**
  in the same snapshot. The #5977 metadata rule cannot simply be extended here,
  because the required `build-images-status` reporter binds the *newest* run for
  the same head, event and branch rather than the newest non-metadata run: the
  run list carries no event action, so a skip would either be read as an
  unexpected `skipped` failure or let a later metadata edit overwrite an earlier
  failed build. A sound version needs an explicit signal in the evidence
  artifact or a run-age comparison, which is why it is scoped separately.
- 2026-09-16 full-portfolio review (branch `rs/ci-roadmap-review`, this
  revision): re-measured the whole roadmap after the #5924 sonar/canary,
  #5936 merge-base selection, #5948 reuse, #5971 image-cache, #5977
  metadata-skip, #5987 build-cache-scope and #6087 flake-fix deliveries.
  Queue: ~300 queued runs on 2026-09-14 fell to 14 queued / 1 running at
  review time (Actions API `status=queued` / `in_progress`), against 299
  queued at the 09-13 observation. Open Dependabot PRs: 0 (grouping config
  live on `v3`). Current v3 head `8cf526e6ce` ran the complete
  public-ARM64 Playwright wave green: prepare, build 2m56s and 8/8 shards
  SUCCESS (run `35117591566`). AMD stays disabled everywhere (re-verified:
  every `build-amd` leg is `if: false`; only `v3-audit`'s `mcp-*`
  workflows still carry active legs, now part of the B3 integration gate).
  Build Fallback: 30 runs on 09-16, mean 5min / max 23min; the 2103s
  polling baseline is gone behind the single required context. Playwright
  wall-minutes on 09-16 across five executions: about 65. The one real
  Playwright failure (`35130087179`, `v3-ai` push, 25min) was not a test
  or product defect: pnpm restored 0/3608 packages on the hosted shard (no
  compatible seed) and `sharp@0.32.6`'s libvips fetch hit a transient
  GitHub Releases HTTP 500; no retry hardened the install step, so the
  failure cost a full 8-shard wave. Promotion-controller waste
  re-measured: 100 records on 09-16, 94 skipped, 1 success, same
  wake-per-producer shape as the 44-runs-for-one-commit finding.
- 2026-09-16 low-hanging-fruit re-ranking (same revision), measured against
  the live fleet. Ranked by wall-time saved per unit of risk, with the
  contract boundary that a merge-ready PR keeps full-coverage proof:

  1. **Playwright install resilience (new, highest value).** The only
     Playwright failure since #6087 was a cold-install flake: hosted shard
     restored 0/3608 packages, then `sharp@0.32.6`'s libvips fetch hit
     GitHub Releases HTTP 500 and one shard failed the whole 8-shard wave
     (run `35130087179`, 25min wasted, non-retried). Minimal fix: retry
     the pnpm install step (bounded, e.g. two retries with backoff) and
     prefer a prebuilt `sharp` platform package in the lockfile so the
     runtime binary download disappears from the install path. Rescues a
     full wave per occurrence at near-zero risk. No trust boundary moves.

  2. **Promotion-controller wakeup consolidation (already specified in B3).**
     100 records / 94 skipped / 1 success on 09-16. The fix is already
     designed in the B3 spec (needs-based aggregation or a single
     post-qualification wakeup). Nothing new to design; it lands with the
     B3 integration package after `v3` merges into `v3-audit`. Until
     then it is pure queued-record noise, not runner-minutes, because each
     skipped controller run occupies a hosted slot only briefly.

  3. **Docs-only and metadata-only PR routing.** A prose-only PR still runs
     `check` (full typecheck, today's suite: 100 records, 707
     wall-minutes, avg 7min / max 29min) and the full Playwright wave. The
     blocker named on 09-14 is real but narrow: the required
     `build-images-status` reporter binds the newest same-head run, so the
     slice needs the explicit evidence-artifact signal (or run-age
     comparison) first. First slice: extend the existing evidence artifact
     with a run-action field and make the reporter accept a validated
     metadata-only skip. Then a docs-path filter on `check.yml` and
     selected-coverage Playwright on prose-only PRs becomes safe. This is
     the largest remaining runner-minute class after resilience.

  4. **Hosted pnpm seed coverage for `v3` pushes and `v3-*` integration
     branches.** The failed wave's shard restored 0 packages; today's
     successful waves still show per-shard installs. The seed workflow
     exists but its fingerprints rarely match PR shards. First slice:
     publish the seed from trusted required builds on `v3` (inputs already
     match by construction) and let PRs consume read-only. Roadmap contract
     3 already authorizes this shape; no new trust surface.

  5. **check.yml path scoping for non-build docs.** Companion to item 3;
     once the evidence-artifact signal exists, prose-only PRs can skip the
     7-29min typecheck with the same validated no-change selection the four
     path-filtered suites already use. Keep gitleaks unconditional.

  Not re-ranked, confirmed done or idle: C1 image path filters (live), B2
  ARM BuildKit cache (live; warm-hit timing proof still unmeasured),
  single image status context (live), reuse/lifecycle guards (live,
  positive-case proof still thin), AMD (inert everywhere on `v3`),
  Dependabot fan-out (0 open), ARM64 pool rollout (green on current
  head). Profile-aware packing and runner placement stay mid-roadmap
  pending measurement; the 16:08 snapshot of 9 queued `Promote to stg`
  wakeups was stale-superseded records from 09-13, not new queue
  pressure.
- 2026-09-16 independent review correction (same branch, follow-up
  commit): the self-review audited every number in the two entries above
  against the live API and found one wrong figure plus two classifications
  that needed sharpening before the roadmap PR merges.

  Corrected figures. (1) The "build 2m56s" line belonged to the PR-head
  run `35101325026`; the merged-v3 wave in run `35117591566` built in
  2m21s (job 104916253330). (2) Build Fallback on 09-16: 75 non-cancelled
  records, success mean 7.1min / max 27min (n=73), failures 2 at mean
  4min; including 25 cancelled records the mean was 5.9min. The entry
  above's "mean 5min / max 23min" mixed windows; use the corrected
  numbers. (3) check.yml on 09-16: 100 completed records, 720
  wall-minutes, mean 7.2 / max 29min — not 707. (4) The "~65min across
  five Playwright executions" figure was wrong in scope: the five
  executions were only one conclusion class. Full-day totals: 95
  completed records, 1956 wall-minutes (success 55 records / 1547min /
  mean 28.1 / max 67; failure 5 / 175min; cancelled 32 / 234min / mean
  7.3). Success p50 29min, p90 55min. (5) Promotion controller on 09-16:
  100 records, 94 skipped, 6 cancelled, 0 success in the first-100 API
  window; one success (`35117043318`, 15:41:33Z) sits just outside it —
  201 records in the gh view, 170 skipped / 23 cancelled / 6 failure / 1
  success. The "94 skipped" figure stands; the "1 success" belonged to
  the wider window. (6) The 9 queued `Promote to stg` wakeups at 16:08
  were 09-13 stale records, as recorded above; live promotion wakeups
  from 09-16 complete in seconds (skipped records, mean under a minute).

  Failure-cause classification, which changes the fruit ranking. Four of
  the five failed Playwright waves were real spec failures that failed
  twice (base attempt plus retry), not flakes: `Y-chat.spec.ts:3460`
  "Citations and source cards render on a live streamed answer" failed in
  two waves on two branches with the same assertion shape — the
  viewport-scroll growth predicate saw the score climb to 533 while
  expecting <= 1 (test at lines 3576-3581 of the spec), i.e. the
  streaming autoscroll fix is not holding on the hosted route yet;
  `U-catalog.spec.ts:1656` (toBeHidden), `O1-live-quiz-core.spec.ts:4695`
  (toContainText) and `T-resources.spec.ts:3249` each failed one wave.
  Only `35130087179` (v3-ai push) was the cold-install sharp/libvips
  HTTP 500 flake. The install-resilience fruit therefore remains valid
  but drops to one occurrence today; the top actionable item from this
  review is the recurring `Y-chat.spec.ts:3460` scroll-predicate failure
  (two waves, two branches, same-day, deterministic shape) — either the
  test's growth predicate races the newly-fixed autoscroll hook or the
  hosted environment behaves differently from the ARM64 pool where the
  same test passed 8/8.

  AMD guard re-verification. The two 09-13-era entries claim "every
  build-amd job is gated if: false". Re-verified on this branch against
  current `origin/v3`: all 28 `v3_*.yml` workflow files that declare
  `build-amd:` guard it with `if: ${{ false }}` (spot-checked six files
  via API plus a full-worktree grep; the worktree is diff-clean against
  `origin/v3` at `8cf526e6ce`). The claim stands.

  Queue at re-verification: 16-18 queued / 5-6 running, consistent with
  the 14/1 snapshot inside normal wave churn; the ~300x improvement
  claim is not sensitive to this drift.
