# Isolate host and container workspace dependencies

## Approval summary

Host Playwright installs can rewrite dependency links used by the running Linux devcontainer. Root dependencies are isolated, but most package-level dependency directories remain shared. This can make Chat and other apps fail even though their source has not changed.

Extend the existing project-scoped named volumes to every workspace package's `node_modules`. Keep the shared content-addressed pnpm store, existing package versions, host Playwright boundary, and runner profiles unchanged. Strengthen the existing mount regression test and document the isolation contract.

The user approved a separate tooling fix. This detailed plan proposes local implementation and commits on the dedicated tooling branch, exact patch application to the stopped disposable E2E workspace, and supported non-destructive runtime verification there. Changing mounts can trigger bootstrap; bootstrap resets the database. Stop if the supported path cannot preserve data. Synthetic data does not imply reset permission.

Success means a real host dependency rewrite leaves container module resolution and app routes working before any reconciliation can conceal the failure. Record the existing authoring suite results afterward. Leave the user's validation workspace untouched and running. Stop only the test runtime and retain its volumes.

No upstream integration, push, merge, deployment, data deletion, dependency upgrade, product change, or changes to the validation workspace are authorized by this plan. The user approved this detailed execution contract on 2026-09-07.

## Execution details

### Working context and ownership

The tooling worktree is `trees/rs/devcontainer-dependency-isolation`, branch `rs/devcontainer-dependency-isolation`, created from fetched `origin/v3` at `d8e29ee75168b61e5c6902a5a8d8afa12495e261`. It currently tracks `origin/v3`; this does not authorize pushing to that branch. The intended eventual PR target is `v3`.

The stopped test worktree is `trees/rs/chatbot-editor-e2e` at `50c1c318f1624ee3d7ae2b5665d1fcf3e933d252`. Its existing launcher profile edit is test-only and must be preserved, not shipped. Transfer only the reviewed isolation patch, never the entire Compose file. Compare workspace inventories and record any baseline-specific coverage differences.

The running validation worktree `trees/rs/chatbot-c1-standard-modes` is excluded from mutations, restarts, dependency installs, and fixture resets. Concurrent primary-checkout cache and tooling edits belong to other work and remain untouched.

Authority: after detailed-plan approval, local scoped edits, checks, review corrections, local commits, and non-destructive test-runtime reconciliation. Boundary owner: self. Terminal: reviewed local tooling package with passing isolation evidence, authoring results recorded, and test-runtime shutdown verified. Remote delivery requires separate approval.

### Evidence and repair contract

The test baseline's Compose file bind-mounts the checkout, then shadows root dependencies and only the Playwright, Prisma, and types dependency directories. The host launcher can run a frozen-lockfile pnpm install. An app's relative dependency link then resolves against the container's different root virtual store. The observed Next resolution failure is consistent with that mismatch.

The runtime's dependency fingerprint tracks manifests, not host rewrites of package-local links. The existing host-runner regression asserts only the three currently isolated package paths. Extending isolation, rather than disabling dependency validation or repeatedly reinstalling, repairs that contract.

Use explicit, distinct project-scoped volumes for all packages discovered through `pnpm-workspace.yaml`. Preserve existing volume names and content-addressed store mounts. Validate mounts on the app service, matching declarations, complete package coverage, and absence of globally shared dependency-volume names. Add no dependency.

This repairs existing development behavior without changing product primitives. No ADR is proposed: the repair is reversible and restores the intended isolation model. Reopen planning if shared build outputs, workspace layout, lifecycle machinery, or runner behavior also need to change.

### Delegation and single implementation slice

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| Complete dependency isolation | Executor | Compose coverage, strengthened existing regression, focused checks, and scoped local implementation commit |
| Runtime reconciliation and acceptance | Main | Exact identity checks, real host rewrite, immediate module and route proof, original authoring suite, verified shutdown |

The executor owns `.devcontainer/docker-compose.yml`, `util/run-playwright-host.test.mjs`, and the existing isolation explanation in `.devcontainer/README.md`. The main session owns lifecycle decisions, patch transfer, integration, and final proof because those steps share runtime state and authority boundaries.

Commit the approved plan first. Implement the cohesive fix, run focused checks, inspect every changed hunk, and commit locally. Run the required simplifier and host/container-seam slice review on that immutable range. Integrate accepted corrections. After runtime acceptance, run integrated final review on the complete committed tooling package. Store reports in ignored `project/_local/reviews/`.

### Test portfolio and acceptance order

| Obligation | Primary evidence |
| --- | --- |
| Extend existing mount regression | Structured complete-workspace coverage in `util/run-playwright-host.test.mjs`; demonstrate failure against original mounts |
| No new bootstrap suite | Effective primary and linked Compose mount models, with environment values suppressed |
| Direct isolation proof | Actual host dependency rewrite followed immediately by container module resolution and Manage, Auth, and Chat route checks |
| No new browser suite | Existing nine cases in `playwright/tests/T-chatbot-authoring.spec.ts`, through the host launcher |

Use repository-native tooling in its prescribed host/container environment. First establish a supported mount-update procedure that does not reset or reseed the database. Record exact source, container, and database-volume identities. Check host mountpoint permissions and package inventory coverage without broad filesystem cleanup.

Apply only the isolation patch to the test workspace. Establish healthy container module resolution and app responses. Perform an actual frozen-lockfile host install through the repository-supported path. Record evidence that package links were rewritten; a no-op install is insufficient. If inducing the rewrite requires deletion, pause and design a reversible synthetic fixture.

Immediately check container dependency targets, Linux-native resolution, and the three routes. Do this before another `ensure`, container install, or restart. Only then run the original authoring suite. Report unrelated application failures separately instead of modifying product code. Distinguish tooling-baseline checks from feature-baseline runtime evidence.

Use the approved host Infisical operator for any upstream-backed runtime. Use synthetic content only. Preserve existing provider and cost boundaries. Stop the exact E2E runtime after acceptance and verify it stopped, retaining volumes and artifacts. Do not stop the validation runtime.

### Pause conditions

Pause before destructive bootstrap, unsupported lifecycle operations, dependency-policy bypasses, changes to the validation workspace, new provider effects, or expansion into shared build artifacts. A missing safe mount-update procedure is a real prerequisite failure, not permission to recreate or reset data.

## Progress

2026-09-07: remote refs fetched; dedicated clean tooling worktree created. No implementation or runtime mutation has started. The native planner requested explicit database preservation, immediate post-rewrite proof, and separate baseline receipts. All findings were accepted; revised plan received APPROVED. Gemini 3.8 Flash High approved the isolated conceptual repair. Its mountpoint-permission concern is an acceptance check, not authority to add setup machinery. Its generic cross-device storage observations are not treated as measured repository behavior.

The configured explorer failed before work with provider 400. Native Luna generic continuity completed the bounded source mapping. The advisor's first model-label form was rejected; the exact catalog ID `gemini-3.8-flash-high` succeeded without changing the selected model or effort.

2026-09-07: detailed execution plan approved. The single tooling slice is active; main is establishing the supported non-destructive mount-update procedure in parallel. Existing chatbot product and multi-KB work remain outside this package.
