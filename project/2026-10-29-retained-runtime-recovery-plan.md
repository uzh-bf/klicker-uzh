# Preserve development data during runtime recovery

## Approval summary

Automatic post-create replay and retained recovery must preserve existing development database contents. Reuse the existing bootstrap helper, make preservation the default at both lifecycle entry points, and require explicit one-shot intent before initializing newly provisioned empty disposable databases. Missing identity, schema, install or build prerequisites must prevent bootstrap completion and application startup.

This changes fresh setup: database initialization becomes explicit rather than an implicit reset and seed. Existing database guards, lifecycle locks and admission checks remain part of the contract. Initialization must refuse populated databases, including targets with an existing schema. A disposable database marker alone never grants permission to overwrite its contents.

The user approved this executable batch on 2026-10-29 after the recovery proposal and its purpose were explained. Approval includes source changes, configured reviews, required checks, ordinary task-branch commits and pushes, and one draft PR to `v3`. It also includes the bounded synthetic scratch qualification below when the installed provider supports it. No merge, ready-state change, deployment, existing Control runtime recovery, stack propagation, shared-tool changes or data repair is included.

Finish with a reviewed draft candidate, applicable hosted checks, and either successful provider qualification or an explicit capability/failure limitation. A source-only result cannot establish real provider data preservation. Source revert is the code rollback; it cannot recover previously lost data.

## Execution details

### Scope and ownership

Approval mode: executable batch. Boundary owner: self. Main-session ownership; no implementation delegation is required.

Branch: `fix/retained-runtime-recovery`. Target: `v3`. Starting target: `52d1abddfb33607bd3a6c0d891219c4d11fad0d6`. Artifacts root: `project/`. PR: none yet.

Implement against this target's source. The separate Control signing fixture and CI-observer adoption recommendations remain with their existing owner. This branch changes no application product primitive. The developer lifecycle contract and preservation default are the affected public behavior. No domain ADR is required; a new provider API, ownership boundary, credential requirement or data boundary would reopen planning.

Expected write set: `.devcontainer/post-create.sh`, `.devcontainer/recover-bootstrap.sh`, `.devcontainer/recover-runtime.sh`, `util/test-recover-bootstrap.sh`, `util/test-dev-runtime.sh`, and `.devcontainer/README.md`, plus a short fresh-setup pointer in `AGENTS.md`. Read `.devcontainer/post-start.sh` and `util/dev-runtime.sh` as call sites; change them only if their existing admission contract cannot enforce the approved outcome. Refresh affected recovery source pins together. No new executable module, framework or dependency.

### Evidence and design contracts

The ordinary post-create script currently resets, pushes schema and seeds. The recovery callback explicitly selects the bootstrap helper's initialization option. The helper's default mode already verifies an existing marked database/schema without those database mutations. It still installs dependencies, builds prerequisites, captures runtime token files and updates bootstrap state.

Use that existing helper rather than another preparation implementation. Validate explicit arguments; initialization intent must be one-shot and cannot be inherited through a persisted ambient mode flag. Missing schema during default recovery is a refusal, never an initialization trigger. Keep explicit reset commands outside automatic lifecycle entry points. Preserve supported isolated preparation behavior where present without importing unrelated feature-branch changes.

Bootstrap completion and application readiness are separate evidence. Preflight must resolve selected resources/profile, lifecycle intent, effective configuration and runtime-path overrides, source/mount pins, bootstrap state, pending repair requests, supported commands, locks and cleanup. Enumerate downstream adapter effects, including preparation, token/generated files, local storage CORS, selected processes/routes, MCP bootstrap and cache repair.

### Test portfolio

| Independent risk | Obligation and stable seam |
| --- | --- |
| Provider replay resets or seeds retained data | Extend existing lifecycle regressions through the actual post-create entry point and recovery callback |
| Failed identity, schema, install or build still certifies startup | Reuse/extend existing bootstrap marker and admission regressions |
| Explicit initialization accepts existing data or schema | Extend existing bootstrap identity/initialization regressions; both disposable targets must be empty before any schema write |
| Real restart/replacement loses contents | Add a bounded acceptance procedure to the existing README; verify synthetic domain sentinel values and relationships with the real provider |
| Documentation/version drift | Source and capability inspection; no prose snapshots or content-pinning tests |

### Slice 1: lifecycle correction

Establish the focused existing-test baseline. Extend meaningful regressions, then make post-create replay and the recovery callback select preservation. Reuse the helper and refresh reviewed pins. Explicit fresh initialization must refuse populated main or shadow targets before any schema write. Argument, prerequisite and database failures leave bootstrap incomplete and startup refused.

Validate shell syntax and the existing `test:dev-runtime` portfolio. These scripts use test-owned synthetic command stubs and do not require an application runtime. Run repository-native checks applicable to the changed paths. Inspect every changed hunk and preserve unrelated code/comments. Commit the coherent source correction with its documentation.

### Slice 2: supported provider qualification

Before any runtime action, use `rs-local-runtime-lifecycle` and inspect installed help, supported transitions and directly relevant provider contract tests. Do not infer capability from version strings or historical README commands. If the installed provider cannot perform explicit fresh initialization, one ordinary restart, one app-container replacement and exact stop through its managed path, block this slice. No tool installation/patch, raw lifecycle fallback, lock clearing or admission bypass is included.

Use one new scratch runtime belonging only to this task checkout. Allocate a unique derived provider/Compose namespace and route prefix. Record exact generated container/volume IDs before initialization. Reject overlap with existing namespaces, resource IDs or mounts, apart from ordinary additive use of established shared dependency/image content caches. Existing Control and native/iPad runtimes, private routes, real data, signing and publication resources are excluded.

Limits: one runtime; at most 8 vCPU and 16 GiB aggregate service memory; 90 minutes active runtime; one restart and one app-container replacement. Enforce resource limits through supported scratch configuration before start or block this slice. Download only pinned project dependencies and declared images. Shared caches permit additive downloads only. No cloud resources, cache reconfiguration/deletion or paid application/model experiment calls. Record actual build/download/storage evidence rather than claiming an unknown cost is zero.

Resolve the minimal existing application profile to synthetic local endpoints with MCP bootstrap and inference excluded. Approval permits creation of those new resources, explicit initialization of only empty marked scratch databases, synthetic sentinel writes, startup, the named restart/replacement, and exact scratch stop/route removal. Only the scratch app container may be disposed of by the approved replacement. Database-volume, worktree and branch deletion remain separately gated.

After setup, create a test-owned domain sentinel with meaningful values and a relationship. Compare contents after restart and replacement. Prove replacement through a changed app ID and unchanged database/service volume identities. Prove application readiness separately from bootstrap completion.

On success or failure, stop the exact scratch runtime and owned routes and verify provider stopped/zero exact routes by source path. Retain synthetic database contents, sanitized diagnostics and the worktree for separately approved cleanup. Report the failed phase. No reset, reseed, fallback initialization, marker forgery or guard repair is a failure branch.

### Slice 3: reviewed draft delivery

Use configured independent implementation review for correctness, plan compliance, maintainability and focused security/data-integrity effects. The plan critique does not establish source correctness. Scope any architecture lens to lifecycle admission and initialization intent. Use one focused reviewer correction when needed and reuse unaffected evidence. Run relevant Opengrep when available and distinguish new findings from existing ones.

Prepare the complete candidate, inspect staged content for secrets, personal/real-environment data and unrelated hunks, and push normally to the task branch. Create one draft PR to `v3` using `rs-mr-description-writer`. This is a nonvisual development-lifecycle change; browser screenshots do not observe its database-preservation contract. Required platform review/check gates remain required.

Use one standard GitHub evidence observer, at most one request batch per minute with a four-hour deadline. Handle in-scope feedback and failures without repeating approvals. A rate-limited observer is not failed CI. Do not retry a provider-payment failure. Stop the watcher at its terminal boundary and report the held candidate with terminal evidence or exact blockers. No human review requests are authorized.

## Plan critique

The native Astra planner returned `REVISE`, then `APPROVED` after one focused correction. Accepted findings established preservation at both entry points, failure-safe environment cleanup in the separate fixture recommendation, explicit ultimate-target evidence in the separate monitoring recommendation, independent bootstrap/runtime acceptance, and concrete ownership, target, cost and cleanup bounds. The approval was verified against scoped source before this plan was presented. No additional plan critique is required for these unchanged decisions.

## Progress

Status: source complete; slice 3 review and hosted verification pending. Root outcome: recover development runtimes without silently resetting retained data. Authority: the user's 2026-10-29 approval following the reviewed proposal and purpose explanation. Required terminal: reviewed draft PR and honest provider qualification status. The exact approval locator is retained locally. Native binding cannot represent this nested repository plan under the session's containing directory; the recovered approval remains valid.

Slice 1 implements preserving lifecycle entry points and explicit initialization checks. The complete lifecycle portfolio passed: runtime-script regressions, local issuer regressions, five semantic readiness cases and focused bootstrap regressions. Shell syntax, embedded TypeScript syntax, Prettier, AGENTS lint, identity checks and focused Opengrep passed. Application checks remain subject to required hosted CI; this checkout has no application dependency install.

Slice 2 is blocked before runtime creation: a supported managed one-shot initialization and retained-replacement path has not been established. No application runtime was touched. No provider/content preservation claim is made from script mocks. The acceptance procedure remains documented for qualification when the capability is available.

Remaining: independent integrated source review, ordinary task-branch publication and draft/hosted delivery. No active child or watcher yet. Substantive size excluding project artifacts: 385 changed lines, including 292 executable/test lines. The short AGENTS pointer was added because the fresh-setup contract changes. No additional solution document is needed because it would duplicate the recovery guide. Next action: commit the complete candidate, request its independent review and open the draft for hosted checks.

### Approved provider adoption continuation — 2026-10-30

The human approved task-local pinned Devrouter 0.6.3 adoption, official Devsy
1.24 agent-cache preparation and minimal consumer recipe/resource-limit
configuration, followed by the original conditional synthetic acceptance.
This adds those setup actions to the original batch and preserves its resource,
data, stop and withheld-authority boundaries. Source changes are limited to
`.devrouter.yml`, the existing fresh-initialization guide and this plan.

The native planner's focused continuation critique identified effective cap
propagation and host-governed agent readiness as real risks. Use an explicit
fourth Compose reference in the canonical descriptor for an ignored in-checkout
acceptance overlay. Keep that local descriptor/overlay unchanged through stop;
verify all six selected services' effective limits before initialization. The
planned limits total 7.5 CPU and 15.5 GiB. Verify a concrete official Linux ARM64
1.24 agent path, digest and managed/explicit source; generic readiness is not
cache preparation evidence.

Current source delivery: preserving executable source is merged; its full
lifecycle tests and independent review remain applicable. The docs correction
is held in [draft PR #6773](https://github.com/uzh-bf/klicker-uzh/pull/6773). The new provider declaration and effective six-service render pass focused
static checks; independent integration review and real acceptance remain pending. Consumer runtime acceptance
starts only after supported identity, source, mounts, caps and agent checks pass.
The original single runtime/90-minute limit and final exact non-destructive
stop/zero-routes/data-retained terminal condition still apply.
