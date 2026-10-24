# Verified CI result reuse

Status: plan published before implementation in draft PR #6664; implementation
and verification are recorded below. Keep this PR draft. Base inspected:
`8ab99bd5fe2ec651856d9087b79a3126f6b8d49e` (`v3`). No deployment, merge,
auto-merge, repository setting, credential or runner-policy changes are authorized.

## Problem and acceptance criteria

Readiness currently repeats the codebase check without changing its inputs.
Playwright's PR concurrency group cancels a useful draft run; its reuse key
includes the complete control commit, and integration reuse excludes squash
merges, v3 and staging. A green skipped reporter is not test evidence.

1. An unchanged draft becoming ready does not launch Check codebase. New commits,
   reopening and pushes retain their existing validation.
2. Playwright preserves a same-input in-flight execution in GitHub's concurrency
   queue, and only reuses independently verified complete successful coverage.
   Reduced plans, changed trees, failed/cancelled/stale attempts, unavailable
   provenance and incompatible architecture execute normally. Every decision
   reports a reason and a source link when available.
3. Squash and ordinary merges may reuse a verified PR's exact tested tree through
   GitHub's commit/PR association. The push still reports its own required status.
   The staging controller independently validates the source evidence before
   accepting skipped push shards. No PR artifact alone grants promotion.

## Suite inventory and boundaries

| Suite | Lifecycle / reuse policy |
| --- | --- |
| Codebase build/type/lint/contracts | Remove readiness trigger; push execution remains full because commit identity and other history checks share this job. |
| Unit, GraphQL integration, OLAT, intl production | Already avoid readiness triggers; keep push execution until trusted producer provenance and environment identity can be established for each suite. |
| Playwright | First reuse target: trusted reusable workflow, complete eight-shard plan, exact source tree and independently verified run/attempt. |
| Gitleaks, ancestry, dependency review, Sonar, CodeQL | Retain history/context-sensitive execution and first-ready responsibilities. |
| Images and scans | Preserve current digest fingerprints, architecture, publishing, scan admission and frontend build-time environment boundaries. No PR image publication. |

## Trust model

Receipts are claims, never authority. Verify repository, workflow identity and
actual referenced trusted workflow revision through GitHub; verify the caller
workflow against trusted policy; bind run ID and latest attempt, PR head/base,
the actual tested commit's parents/tree, complete canonical plan, and successful
build/shard execution. Reject ambiguous/expired/oversized/missing artifacts.
Require a new receipt version for new reuse paths; legacy receipts cannot opt in.
No transitive reuse chains. Recheck source run state and current PR or branch
association before acceptance. API errors and pagination truncation fail closed.

Control fingerprints must conservatively cover transitive local execution inputs,
including workflows/actions/scripts, toolchains, lockfiles, test selectors,
browser/service definitions and environment policy. Prefer a conservative
repository-wide closure with explicitly documented non-executable deployment
data exclusions over a brittle list of known scripts. The candidate source tree
is always exact, including files excluded from the control-only fingerprint.
Moving action refs and mutable external services must be accounted for; if their
identity cannot be proven, retain execution and document the limitation.

Runner compatibility is explicit and exact: hosted Linux x64 and public Linux
ARM64 are distinct. A draft x64 result cannot satisfy an ARM64 ready plan, nor
may ARM64 satisfy the hosted staging requirement. Paid qualification runs keep
their admission and actual-execution requirements.

## Ordered implementation commits

1. This plan and draft PR, before behavior changes.
2. Remove the redundant codebase readiness trigger and update lifecycle tests.
3. Add auditable control/provenance verification and regression fixtures; preserve
   in-flight Playwright runs without allowing stale code to satisfy current checks.
4. Add verified squash/merge push reuse and update staging evidence validation
   together; retain independent execution for suites without a safe receipt path.
5. Document rollout/rollback, reconcile the plan with implementation, and record
   exact-head local and hosted verification evidence.

## Regression and verification plan

Use deterministic Node tests with mocked GitHub responses and temporary Git
fixtures: draft-ready identity; active-to-success/failure/timeout; reduced/full
coverage; source, toolchain and transitive CI changes; unrelated deployment data;
architecture mismatch; squash and two-parent association; stale/failing/cancelled
attempts; forged receipts/caller workflows; missing scopes; artifact expiry and
ambiguity; independent promoter acceptance/rejection. Exercise actual workflow
predicates and existing promoter/event/reuse tests. Run YAML/workflow validation,
format/lint and relevant repository checks against final code. Record root checks
and builds honestly when the environment cannot run them. Avoid repeated long
Playwright executions during iteration; use final exact-commit CI and distinguish
trusted reusable workflow runtime (which changes only after landing) from PR tests.

## Rollout, rollback and limitations

Deploy no changes as part of this task. Keep opt-in rollout for expanded reuse;
default to execution when proof or policy is unavailable. Readiness-trigger removal
can land independently. New producer receipts must exist before any consumer can
reuse them. Promotion consumer and push reuse must ship together, and the controller
must use its own trusted revision. A documented kill switch disables expanded reuse
without changing required checks or security settings. Rollback restores actual
execution; receipts are disposable and expire. Architecture transitions deliberately
retain reruns. Unit/integration push reuse is deferred unless their current workflow
can supply equally strong provenance; do not weaken promotion to claim broad hits.


## Implementation record and explicit remaining scope

Stage 1 removes only the `check.yml` readiness trigger. Stages 2–3 add the v2
Playwright proof path, preserve active execution across readiness, accept verified
squash/two-parent merges on `v3` and `v3-*`, and update the independent staging
consumer in the same implementation commit. Atomic producer/consumer changes
avoid an intermediate push-reuse contract that promotion cannot verify.

The control closure was refined during implementation: hashing every application
file in the trusted checkout would invalidate every application squash merge.
Instead, every trusted checkout now materializes exactly `.github/`, `playwright/`, `.devrouter.yml`
and `.gitattributes`, with non-cone sparse patterns enforced by the workflow guard.
Every entry within that whole boundary is fingerprinted; the complete candidate
source tree is bound separately. The planner has a dedicated lockfile, upstream
actions are SHA-pinned, Node/pnpm are exact, and browser/service images are digest
pinned. The v2 verifier accepts no old receipts or reused-result chains.

Readiness uses GitHub's concurrency queue rather than a polling loop. The current
producer finishes under its existing timeouts; the ready event then verifies it.
There is no separate custom queue deadline. Source failure/cancellation, source
or base changes, reduced coverage and unproven equivalence still execute.

The runner policy deliberately leaves the central x64-to-ARM64 readiness example
as an actual rerun. ARM64 PR results also cannot replace hosted staging coverage.
Same-route host patch/kernel versions are considered compatible inside the pinned
container; receipt verification is not host-integrity attestation.

Broader avoidable push reruns are **not all eliminated**. These exclusions are
explicit remaining work, not completed stages for those suites:

| Suite | Concrete missing proof | Safe migration needed |
| --- | --- | --- |
| Unit (including auth HTTP/HTTPS integration) | v1 receipt from candidate workflow; no trusted complete-plan receipt for the auth legs; mutable hosted image, setup actions and Postgres tag; coverage consumed by Sonar has a separate provenance contract | Move production of receipts and execution policy to a trusted reusable envelope, bind every actual test step and environment, pin execution dependencies, then update required selection evidence and Sonar transport together. Feasible as a subsequent implementation, but not safely covered by the Playwright receipt or a green unit job. |
| GraphQL integration | Candidate workflow and v1 receipt; unbound service/toolchain identities for Postgres, Redis and Hatchet; no full-suite trusted producer | The same trusted-envelope migration with all services and serialized DB/seed/test steps bound, followed by coverage/selection-consumer tests. Feasible with additional producer/consumer work; this PR keeps actual execution rather than treating existing receipts as authority. |
| OLAT integration | No tested-tree/run-attempt receipt; nested Docker build/test execution has no recorded image/input/environment identity | Introduce a trusted producer covering the nested Docker dependency closure and exact architecture, then add an independently checked selection path. It cannot safely borrow Playwright provenance. |
| Production translation | Checks PR head directly, whereas pushes test the merged tree; its harness receipt records source/lock/topology but is not a trusted run/attempt/workflow artifact | Add a trusted full matrix producer that proves both app builds and exact tested tree/environment, and independently validate its harness receipts before selection reuse. Existing head-only success is insufficient for merge reuse. |
| Codebase and security/history checks | Commit identity ranges, ancestry, dependency/new-code boundaries and first-ready security responsibilities differ across contexts | Retain actual history-sensitive execution. Separating pure build/type/lint from history policy would be a separate workflow decomposition, with required-context continuity tests. |

No additional permission is needed merely to implement those migrations, but they
are not implemented or claimed complete here. The trusted Playwright producer
already provided the necessary isolation, so this PR completes that producer's
lifecycle/merge/promotion path without granting equivalent authority to unrelated
candidate workflows. The rollout variable remains unchanged and off by default.

The changes must first land on `v3` before the new trusted reusable workflow or
controller can execute. Local contract tests and PR CI therefore do not prove a
real reuse hit or a live staging admission. Qualify those via the documented
synthetic/dry-run rollout before enabling reuse. No merge, auto-merge, deployment,
credential, runner-group or repository security change is part of this PR.

## Verification evidence (2026-10-23)

- Current `v3` (`4f11f2251daa36ed6f75e641ed531d5e9ff90618`) was merged into
  this isolated branch before final verification, preserving the original
  published plan commit `1857df0d46f3fb200060a2d7e16f60352e98a04d` without a
  force push. Existing OIDC/WarpBuild admission permissions remain unchanged.
- Node 24.21.0: all CI script contract files (`.github/scripts/*.test.cjs` and
  `*.test.js`) completed with **872 passed, one intentional skip, zero failed**.
  The focused lifecycle/route/plan/cache/promotion group passed **233/233**.
  After final proof hardening, the verifier/promoter ZIP/provenance regression
  file was rerun and passed **40/40**, including same-route public ARM64,
  application squash equivalence across changed control commits, missing run
  detail, provider mismatch and independent privileged admission.
- The initial broader sandboxed attempt failed on prohibited synthetic localhost
  listeners and shell/Git fixtures. Re-running outside the sandbox with the
  shell startup hook disabled resolved those environment failures; the results
  above are that successful run. No test was deleted or weakened to bypass them.
- Biome check: zero errors, existing-style template-expression/style warnings and
  informational suggestions remain. Prettier checks passed for touched workflow,
  action and Markdown files. `bash -n` and ShellCheck passed for the locked
  installer. AGENTS validation, removed-wiki-path guard, Prisma-sync drift and
  current Git identity checks passed.
- Actionlint 1.7.12 flags the existing GitHub `job.workflow_repository` and
  `job.workflow_sha` contexts as unknown. The raw result is not a clean pass;
  with only those two unsupported-property diagnostics filtered, all four
  changed workflows validate. The live GitHub API confirms the trusted reusable
  workflow path/ref/SHA metadata shape used by the verifier.
- The locked planner installed **71 packages** with Node 24 and `npm ci`; its
  read-only `profile resolve --profile full` returned the expected schema/apps/
  dependency/readiness fields. No runtime was started.
- Staged Gitleaks scans found no leaks. No full workspace dependency install,
  root `check:all`, application build, database suite or browser E2E was run
  locally: this worktree has no provisioned application dependency/runtime tree.
  Final-commit hosted CI is recorded in the PR and task report separately.
- A real new trusted-workflow reuse hit and live promotion remain **not run**:
  `@v3` and the controller must receive this implementation first, and the
  rollout switch must then be qualified explicitly. No rollout setting was
  changed by this work.


## Merge-readiness repair record (2026-10-24)

The original exact-head CI was green, but the draft review found two runtime
blockers the initial smoke did not exercise: the locked planner exported a
`node_modules` binary path that the host resolver rejects, and the promoter token
lacked `pull-requests: read` for its new PR-association reads. This pass reproduces
both original defects with failing tests, restores the fixes and reruns them.
The installer smoke now calls `util/playwright-profile-runtime.mjs resolve`
through the production `resolveDevrouter` wrapper, rather than only invoking the
CLI directly. It installs 71 locked packages on Node 24 and resolves seven apps,
nine Turbo filters and seven endpoints without starting servers.

All 21 findings from draft review run `39952401506` are addressed:

| Findings | Disposition |
| --- | --- |
| Clean planner path and missing promoter PR scope (2) | Fixed; resolver-level installer regression and explicit least-privilege permission contract. |
| Sparse roots duplicated across verifier/workflows/tests (1) | One frozen `CONTROL_SPARSE_PATHS` definition drives predicate and validator expectations; all seven real checkout patterns are checked against it. |
| Generic promoter rejection and repeated shard literals (2) | Sanitized cause suffix retained; inventory, coverage and admission share route/count constants. |
| Missing action-adjacency regression, mutable checkout counting and readiness-cancellation mutations (3) | Negative mutations cover reserve/ref/repo/path/order, full SHA/persisted credentials, all seven sparse boundaries and both regressed cancellation expressions. |
| Artifact oversize reason, repeated size budget and inline digest import (3) | Distinct rejection token, one budget constant, top-level hash import and named digest. |
| Locale-sensitive canonicalization, mismatched edited lifecycle and ignored kind/push opt-in (3) | Deterministic ordering, live-validated edited compatibility, supported-kind and strict explicit push opt-in enforcement. |
| New dynamic Function evaluation, stale reporter env/silent branch failure and stale rollout test comment (4) | Static exact predicate assertion; unused staging env removed; named ineligible-branch error; enabled-flag rejection regression. |
| Seven-checkout count comment and Node version coupling on build/shard (3) | Auditable count comment and exact pins checked against root Volta version for both actions. |

The independent audit also closed two provenance gaps beyond the draft findings:

- Root `.gitattributes` is fingerprinted/materialized. A synthetic sparse Git
  checkout demonstrated that omitted root attributes still change control script
  line endings from the index. Root/nested attributes are covered; default-disabled
  submodule and LFS behavior adds no unbound executable content.
- API artifact digest/run/head identity is verified against actual downloaded
  public ZIPs, and artifact creation must fall inside the independently reported
  successful producer upload step of the exact run attempt. Artifact runtime
  deletion/recreation does not establish producer identity; late replacements
  fail closed. Receipt claims additionally bind PR number and target branch, so
  a same-SHA branch retarget or another PR cannot reuse the old claim.

Current `v3` was merged into the feature branch before these repairs; no force
push, merge of the PR, rollout change or deployment occurred. Expanded reuse stays
off until post-merge qualification. Actual source-reuse/promotion runtime under
the new trusted `@v3` code remains a post-merge rollout check, with all other
suite exclusions above unchanged. Fresh final CI and manual final-review status
are recorded in the PR and task report for the repaired head.


Fresh repair verification on Node 24.21.0: **973 tests, 971 passed, two intentional
skips, zero failures**, covering all CI script contracts plus the production
profile-runtime, host-launcher and Next-runtime wrappers. The verifier file
passes 49/49, the workflow guard 16/16, and the installer 3/3. The original
installer path and missing permission were each temporarily restored in an
isolated regression run: both failed as expected, then passed after restoring
the repairs. No test was weakened or removed.

Native ESM wrapper tests needed the existing YAML package and installed planner
available to the test process. A temporary link to the existing YAML dependency
was removed after the run; the verified locked planner's clean bin path was
added to the test PATH. Earlier attempts lacking those dependencies failed as
environment setup errors; the complete result above includes them correctly.
No application dependency installation or runtime/server startup was performed.

The producer-time gate also requires candidate-executing build to begin strictly
after the upload-completion timestamp second. Same-second boundaries, missing
producer/step timing, late replacement of receipt or either plan, and ambiguous
producer data all miss. Independent audit verified the real API ZIP digests and
step/timestamp shape; this ordered-workflow provenance check is not presented as
a general cryptographic signature. Actionlint passes with only its two existing
unsupported GitHub job-context diagnostics filtered; ShellCheck, Bash syntax,
Prettier, AGENTS/wiki/Prisma guards and diff checks pass. Biome reports warnings
and suggestions but no errors.
