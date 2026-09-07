# Isolate host and container workspace dependencies

Draft [PR #5821 — isolate host and container dependencies](https://github.com/uzh-bf/klicker-uzh/pull/5821) targets `v3`. The task branch is pushed and tracks its matching remote branch. Draft publication is complete; exact-head CI, feedback and explicit ready/merge authority remain separate.

## Approval summary

Host Playwright installs can rewrite dependency links used by the running Linux devcontainer. Root dependencies are isolated, but most package-level dependency directories remain shared. This can make Chat and other apps fail even though their source has not changed.

Extend the existing project-scoped named volumes to every workspace package's `node_modules`. Keep the shared content-addressed pnpm store, existing package versions, host Playwright boundary, and runner profiles unchanged. Strengthen the existing mount regression test and document the isolation contract.

The user approved a separate tooling fix, local implementation and commits, and subsequently one fresh disposable test workspace. Use that fresh workspace for bootstrap and runtime verification, preserving both existing workspaces and databases. Changing mounts on a retained runtime can trigger bootstrap and reset its database; that operation remains outside this approval.

Success means host dependency preparation occurs while the exact runtime is stopped, followed by healthy module resolution and app routes after startup. Warm runs must not reinstall dependencies or stop the runtime. Record the existing authoring suite results afterward. Leave the user's validation workspace untouched and running. Stop only the disposable test runtime and retain its volumes.

The user approved the extension on 2026-09-07: repository-wide fail-closed dependency validation, launcher ordering, disposable verification, required reviews, and draft PR delivery. No upstream integration, merge, deployment, data deletion, dependency upgrade, product change, or changes to the validation workspace are authorized.

## Execution details

### Working context and ownership

The tooling worktree is `trees/rs/devcontainer-dependency-isolation`, branch `rs/devcontainer-dependency-isolation`, created from fetched `origin/v3` at `d8e29ee75168b61e5c6902a5a8d8afa12495e261`. It currently tracks `origin/v3`; this does not authorize pushing to that branch. The intended eventual PR target is `v3`.

The disposable test worktree is `trees/rs/chatbot-isolation-proof` at feature baseline `50c1c318f1624ee3d7ae2b5665d1fcf3e933d252`. Its launcher profile edit and four additional package mounts are test-only and must be preserved, not shipped. Transfer only the reviewed isolation and launcher patches, never the entire Compose file. The older `trees/rs/chatbot-editor-e2e` workspace remains stopped and excluded from mutation.

The running validation worktree `trees/rs/chatbot-c1-standard-modes` is excluded from mutations, restarts, dependency installs, and fixture resets. Concurrent primary-checkout cache and tooling edits belong to other work and remain untouched.

Authority: local scoped edits, focused checks, review corrections, commits, non-destructive disposable-runtime reconciliation, ordinary task-branch push and draft PR delivery. The user explicitly approved focused tooling checks and staged secret scanning in place of the full application commit hook. Boundary owner: self. Terminal: reviewed tooling package with launcher evidence, authoring results recorded, test-runtime shutdown verified and draft PR published. Marking ready, merging and deployment remain separately gated.

### Evidence and repair contract

The test baseline's Compose file bind-mounts the checkout, then shadows root dependencies and only the Playwright, Prisma, and types dependency directories. The host launcher can run a frozen-lockfile pnpm install. An app's relative dependency link then resolves against the container's different root virtual store. The observed Next resolution failure is consistent with that mismatch.

The runtime's dependency fingerprint tracks manifests, not host rewrites of package-local links. The existing host-runner regression asserts only the three currently isolated package paths. Extending isolation, rather than disabling dependency validation or repeatedly reinstalling, repairs that contract.

Use explicit, distinct project-scoped volumes for all packages discovered through `pnpm-workspace.yaml`. Preserve existing volume names and content-addressed store mounts. Validate mounts on the app service, matching declarations, complete package coverage, and absence of globally shared dependency-volume names. Add no dependency.

This repairs development behavior without changing product primitives. No ADR is proposed: the repair is reversible. The launcher extension below is approved; shared build-output changes and workspace-layout changes remain outside scope.

### Delegation and single implementation slice

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| Complete dependency isolation | Executor | Compose coverage, strengthened existing regression, focused checks, and scoped local implementation commit |
| Runtime reconciliation and acceptance | Main | Exact identity checks, guarded preparation before startup, module and route proof, original authoring suite, verified shutdown |

The executor owns `.devcontainer/docker-compose.yml`, `util/run-playwright-host.test.mjs`, and the existing isolation explanation in `.devcontainer/README.md`. The main session owns lifecycle decisions, patch transfer, integration, and final proof because those steps share runtime state and authority boundaries.

Commit the approved plan first. Implement the cohesive fix, run focused checks, inspect every changed hunk, and commit locally. Run the required simplifier and host/container-seam slice review on that immutable range. Integrate accepted corrections. After runtime acceptance, run integrated final review on the complete committed tooling package. Store reports in ignored `project/_local/reviews/`.

### Test portfolio and acceptance order

| Obligation | Primary evidence |
| --- | --- |
| Extend existing mount regression | Structured complete-workspace coverage in `util/run-playwright-host.test.mjs`; demonstrate failure against original mounts |
| No new bootstrap suite | Effective primary and linked Compose mount models, with environment values suppressed |
| Direct isolation proof | Guarded host preparation before startup, followed by named-mount/module and Manage, Auth, and Chat route checks; no deliberate live mountpoint replacement |
| No new browser suite | Existing nine cases in `playwright/tests/T-chatbot-authoring.spec.ts`, through the host launcher |

Use repository-native tooling in its prescribed host/container environment. First establish a supported mount-update procedure that does not reset or reseed the database. Record exact source, container, and database-volume identities. Check host mountpoint permissions and package inventory coverage without broad filesystem cleanup.

Apply the approved patches to the disposable workspace. Verify the outer pnpm guard with a synthetic fixture and command ordering with the existing host test suite. Exercise the real launcher against the disposable runtime without inducing a destructive rewrite. When dependencies already exist, a warm run must not reinstall them.

Check container dependency targets, Linux module resolution and routes after launcher reconciliation. Then run the original authoring suite. Report unrelated application failures separately instead of modifying product code. Distinguish tooling-baseline checks from feature-baseline runtime evidence. The earlier live-rewrite experiment is failed historical evidence, not the final acceptance contract.

Use the approved host Infisical operator for any upstream-backed runtime. Use synthetic content only. Preserve existing provider and cost boundaries. Stop the exact E2E runtime after acceptance and verify it stopped, retaining volumes and artifacts. Do not stop the validation runtime.

### Pause conditions

Pause before destructive bootstrap, unsupported lifecycle operations, dependency-policy bypasses, changes to the validation workspace, new provider effects, or expansion into shared build artifacts. A missing safe mount-update procedure is a real prerequisite failure, not permission to recreate or reset data.

## Progress
Before committing or testing the launcher extension, preserve this execution contract: set workspace `verifyDepsBeforeRun: error` and force lowercase `pnpm_config_verify_deps_before_run=error` for every launcher-owned pnpm child. Missing Playwright CLI requires a successful exact-checkout stop before explicit filtered frozen installation. Stop/install failure aborts; no automatic deletion, retry or store repair. Host builds and browser preparation precede `ensure`. Warm runs issue no stop or package installation. Preserve profiles, filters, headed and list behavior. `--print-env` retains reconciliation without dependency preparation; `--show-report` never calls `ensure`, though cold report preparation can stop the runtime and leave it stopped. Documentation distinguishes direct Node cold bootstrap from explicit stale-dependency repair. Executor owns the launcher, existing test, workspace policy and README; main owns runtime proof and integration.


The user approved the launcher extension, repository-wide fail-closed pnpm policy, focused tooling checks plus staged secret scanning in place of the full application hook, and reviewed draft PR delivery. No upstream integration, merge, deployment, database deletion or validation-workspace mutation is authorized.

Implementation is committed through `6b7f7166b5`. The package isolates all 30 tooling-baseline workspace packages plus root dependencies, runs the existing host contracts in CI, guards pnpm before scripts can implicitly install, and prepares host dependencies before runtime reconciliation. The simplifier's unused injection-point removal is committed. The final launcher has 18 passing host tests on Node 24.16.0; Biome, focused Prettier, whitespace and staged gitleaks checks pass. Full application `check:all` and all-app builds were not run.

Runtime proof uses only `trees/rs/chatbot-isolation-proof` at feature baseline `50c1c318f1624ee3d7ae2b5665d1fcf3e933d252`, with four additional test-only package mounts and the retained selective profile. Infisical-backed startup reuses app container `96d0e4a6e6663292b44e4199fe403da7e3f89aabf4c86cc2e519f4a97a4fb4d0` and database volume `default-rs-bee49_pgdata`. Named dependency mounts and module resolution pass; readiness passes. The corrected launcher lists nine authoring tests. A full run reuses app process identities without host package installation: four pass, the previously observed hidden description field fails at `T-chatbot-authoring.spec.ts:791`, and four serial cases do not run. This is not a green authoring-suite claim.

Shutdown completed through the same Infisical environment. Fresh exact-path status confirms stopped services and processes, no active routes and no drift. All volumes remain retained. The validation workspace and older E2E workspace were untouched. Two recoverable ignored host-dependency backups from the earlier investigation remain in the disposable workspace; no cleanup is authorized.

The original mount-only assumption was insufficient. Pinned pnpm 11.5.0 defaults to implicit installation before script execution. An isolated outer-entrypoint probe with the new policy exits with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` before running the script or creating dependencies. The accepted repair prevents installation while live rather than claiming named mounts survive deliberate host directory replacement. The earlier failed experiment and checkpoints remain available in Git history.

Planning review: approved, including the outer-pnpm finding and explicit user policy ruling. Advisor consultation completed; the parent rejected its uppercase environment-variable suggestion and changes to special-mode semantics. The installed pnpm override is lowercase `pnpm_config_verify_deps_before_run`. Reports are retained under ignored `project/_local/reviews/`.

Slice simplification: done; unused private injection seams removed, with tests unchanged and passing. Launcher slice review: done, no findings for `1dd0c87623..1b2c7c342f`; report `project/_local/reviews/2026-09-07-launcher-seam-review.md`. Integrated final review: done for `d8e29ee75168b61e5c6902a5a8d8afa12495e261..5beacfb46ed91b66e26b6d5904c141f9ab5be1be`, with no implementation findings. Its sole bookkeeping correction is resolved by this update; no repeat review is needed. Ordinary task-branch push and draft PR delivery are next. The branch tracks `origin/v3`; push only to the named task branch, never to that upstream. The last remote refresh showed six target commits not integrated.
