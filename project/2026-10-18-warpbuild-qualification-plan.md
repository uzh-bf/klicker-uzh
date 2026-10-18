# WarpBuild CI qualification

## Approval summary

Measure whether disposable WarpBuild runners improve KlickerUZH feedback time
at an acceptable recurring cost. The user approved a pilot of at most twelve
complete validations within a USD30 gross usage budget and permitted US execution.
Keep the existing Hetzner pool and ordinary required-check routing available.

Start with the existing pinned Playwright image, build action, shard action,
read-only dependency/build caches and complete eight-shard test plan. Compare
matched source revisions before varying runner sizes or cache behavior. Separate
queue reduction, execution speed and cache reuse; compare total billed work,
including failures, rather than successful test-command duration alone.

The source package adds an isolated trial workflow that requests the existing
selector's complete same-revision plan. The trial is disabled initially. Only the
named task branch can launch it through a workflow-file push; a later registered
manual dispatch is subject to the same gate. No automatic pull-request, mainline
or deployment routing changes. No secrets, OIDC, publication or private services
are introduced.

Before paid execution, independently verify the actual provider connection,
public runner-group policy and effective billing controls. Missing policy or
cost evidence blocks execution, not source preparation. Account and runtime
observations, usage records and the operator's cost reservations remain private.
The finite experiment ends with a measured comparison or an honest evidence gap.

## Execution details

### Authority and ownership

Approval mode: executable batch. Boundary owner: self. Main session owns source,
verification, submission and proof. Existing explicit main-session ownership and
no-subagent instructions override generic delegation. Planning, simplification
and final review here are labelled self-reviews, never independent proof.
Execution mode: standard; main-model identity is not inferred.

Authority covers implementation, focused checks, local commits, ordinary task
branch push, draft PR and the approved bounded trial after its prerequisites
hold. Merge, marking ready, credential expansion, installing agent integrations,
runner-group access expansion, Hetzner mutation/removal and deployment remain
withheld. Existing approved cost scope does not authorize a new subscription or
an unrelated account-wide policy change.

Terminal: verified draft source plus the bounded runtime/cost report, or a
concrete missing permission, account fact or material decision after independent
work is complete. No completed earlier source goal is recreated.

Pause paid work on unresolved group policy, insufficient reserved budget, a
failing correctness producer, unexpected secrets/private access or materially
different billing. Stop further submissions on failure; preserve already
submitted jobs and receipts. Do not cancel unrelated work or reset caches.

### Research and source contracts

Target `v3`; branch `rs/warpbuild-qualification`. Source baseline is
`f50c46bcb16193876f2ba60da1651d4364947d8d`. Existing operations guidance remains
[CI & Deployment](../docs/ci-and-deployment.md#public-arm64-runner-operations).
Draft [PR #6606](https://github.com/uzh-bf/klicker-uzh/pull/6606) contains this package.

[WarpBuild cloud runners](https://www.warpbuild.com/docs/ci/cloud-runners)
document ephemeral Linux ARM64 machines. Initial candidates are an eight-vCPU
build and four-vCPU shards, subject to memory headroom. Larger builds and smaller
shards are separate measured alternatives, not automatic capacity claims.
[Public repository setup](https://www.warpbuild.com/docs/ci/public-repos)
documents the organization's Default runner group: prove complete repository,
workflow and membership policy before enabling execution. An API denial never
authorizes broader credentials.

[Reports](https://www.warpbuild.com/docs/ci/features/reports) distinguish execution
time, billed time, runner/snapshot costs and queue metrics. Resource reporting
requires observability. [Caching](https://www.warpbuild.com/docs/ci/features/caching)
supports alternate cache actions but custom containers require extra tools and
runner-token propagation. Preserve current GitHub caches for the first comparison.
[Snapshots](https://www.warpbuild.com/docs/ci/features/snapshot-runners) carry
additional charges and require sterile trusted state. Adopt either only after a
separate scoped comparison proves compatibility and benefit within the same cap.

No product primitive changes. This is a temporary experiment, not a durable
provider-selection architecture; no ADR is introduced. Permanent migration,
multi-repository routing or cache-authentication changes reopen that decision.

### Experiment contracts

Freeze candidate source and execution control separately. Every job checks out
the same exact public source SHA with credentials disabled. The existing shared
composites are pinned to the inspected source baseline; trusted control is the
reviewed trial workflow revision. Initial build task concurrency remains four
and Playwright workers remain one. Preserve service isolation and build-artifact
consumption. Trial outcomes never satisfy ordinary required PR checks.

Use the selector's existing complete-suite planning and canonical shard balancing.
An explicit full request includes every eligible candidate spec, excludes the
existing separately owned production lane and always emits all eight shards.
Ordinary selector callers retain their current classification behavior.

Hetzner controls use existing allowed ordinary workflow executions at matched
source, not a second entry into the locked physical-runner group. Do not expand
that group's workflow allowlist for the experiment. If a matched control cannot
be obtained within the approved submission budget, record that comparison as
inconclusive while retaining provider compatibility and cost evidence.

The operator privately records each submission's workflow/source SHAs, provider,
sizes, cache state, billed-cost reservation and consumed wave count. Admit at
most three concurrent waves. The nominal job timeout bounds are forty-five
minutes for the build and each shard. Reserve provider-billed setup/teardown
allowance as well; job timeouts alone do not establish an invoice hard cap.
Never submit when consumed cost plus in-flight reservations plus the next
reservation can exceed USD30. Credits are separate from sustainable gross cost.

Run matched hardware/cache cases sequentially, then a bounded burst only after
single-wave correctness. An empty trial cache uses restore disabled; shared
caches are not deleted. Exact-repeat warm results establish a best case, while
real changed-source cases establish ordinary cache behavior. Changing source or
control invalidates only comparisons depending on those dimensions. Do not
extend the twelve-wave budget to replace inconclusive samples.

Read actual command producers and every shard/aggregate before accepting a wave.
Record queue, setup, Prisma, application build, shard setup/tests, artifact
transfer and end-to-end check completion separately. Keep memory headroom,
failures, cancellations and retry costs visible. Sparse pilot samples support
observed ranges/medians, not a qualified latency tail.

The final private report compares heavy-job migration, all eligible compute and
a retained-Hetzner burst hybrid at observed volume and growth scenarios. Include
seeding, cache/storage, snapshots and separate image-builder costs when used.
Monthly extrapolation requires complete workload accounting or an explicit
sampling/completeness limitation. No cold-start, extra-slot, natural-recovery or
fleet-replacement claim follows from a green trial.

### Slices and verification

All work is main-owned because of the explicit no-subagent constraint.

1. Add `.github/workflows/warpbuild-playwright-trial.yml`, reusing shared build,
   shard and service contracts. Extend the existing workflow contract test file
   for the disabled gate, branch scope, pinned source, read-only permission,
   bounded jobs and failing aggregate. Keep ordinary CI files unchanged.
2. Document the isolated entry and private operator preflight in the existing
   CI guide. Run focused Node 24 contract tests in an isolated container, YAML
   parse, formatting, diff inspection and staged secret/data review. Simplify
   and self-review the integrated package before draft publication.
3. Independently gather current account and workload evidence. Resolve policy
   and cost prerequisites before an enabling edit. Perform the approved trial
   only when they hold; otherwise name the missing evidence for the operator.

Test portfolio: reuse the selector's existing empty-diff full-coverage tests;
extend workflow contract tests for isolation and fail-closed execution.
Existing tests own ordinary routing, cache ownership and shared build failures.
No application runtime or browser UI change is introduced; screenshots are not
source verification. Live provider compatibility still requires an actual job.

## Progress

Planning self-review found that a new manual workflow cannot be dispatched before
it exists on the default branch. Use a narrowly scoped, initially disabled
task-branch push entry to avoid a prerequisite source merge. Preserve ordinary
workflow identity and required checks. No independent planner was used under the
user's no-subagent instruction. Inspection also found the existing selector
already produces a complete plan for an exact same-revision comparison, so no
selector option, helper or duplicated planner is needed.

Source implementation and focused verification are complete: all 96 Playwright
CI contracts pass in isolated Node 24.21.0 with the existing Devrouter 0.5.1
planner. YAML/shell syntax, Biome and Prettier checks pass. The two-file Opengrep
scan reported five mutable action references, corrected with verified immutable
pins; its follow-up scan has zero findings. Ordinary CI routing and shared
actions remain unchanged.
Substantive package size is about four hundred lines, excluding the plan/docs;
one cohesive provider experiment does not need a stack.

Main-session simplification reused the existing selector rather than adding an
option/helper, and retained existing workflow access for Hetzner controls. The
initial prepare gate is a literal false, so publication cannot inherit an
unexpected organization-variable opt-in. Integrated review is a self-review,
covering correctness, scope, security, architecture and maintainability.

Review corrections strengthen the existing three trial tests: trusted checkout
and permission boundaries, output/runner/matrix/result wiring, role-specific
containers, immutable shared action pins, full-source admission and fail-closed
outputs. The unused control variable is removed; the workflow revision supplies
trusted selector control and literal commit pins identify shared actions.
Operator admission retains ownership of concurrent-wave and spending caps.
Test delta: three changed, none added or removed. Main-session correction review
is a self-review, not independent proof. The corrected full 96-contract suite
passes in the same isolated Node 24.21.0 environment.

Status: published draft with source CI and feedback disposition in progress.
Account/policy and cost evidence is kept privately. No paid trial has been
submitted. Actual provider compatibility, latency and cost remain unproved.
