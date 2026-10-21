# Verified CI result reuse

Status: plan published before implementation; keep this PR draft. Base inspected:
`8ab99bd5fe2ec651856d9087b79a3126f6b8d49e` (`v3`). No deployment, merge,
auto-merge, repository setting, credential or runner-policy changes are authorized.

## Problem and acceptance criteria

Readiness currently repeats the codebase check without changing its inputs.
Playwright's PR concurrency group cancels a useful draft run; its reuse key
includes the complete control commit, and integration reuse excludes squash
merges, v3 and staging. A green skipped reporter is not test evidence.

1. An unchanged draft becoming ready does not launch Check codebase. New commits,
   reopening and pushes retain their existing validation.
2. Playwright preserves a same-input in-flight execution, waits within a bounded
   budget, and only reuses independently verified complete successful coverage.
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
