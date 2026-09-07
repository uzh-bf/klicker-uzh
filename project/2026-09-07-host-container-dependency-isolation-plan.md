# Isolate host and container workspace dependencies

## Approval summary

Host Playwright installs can rewrite dependency links used by the running Linux devcontainer. Root dependencies are isolated, but most package-level dependency directories remain shared. This can make Chat and other apps fail even though their source has not changed.

Extend the existing project-scoped named volumes to every workspace package's `node_modules`. Keep the shared content-addressed pnpm store, existing package versions, host Playwright boundary, and runner profiles unchanged. Strengthen the existing mount regression test and document the isolation contract.

The user approved a separate tooling fix, local implementation and commits, and subsequently one fresh disposable test workspace. Use that fresh workspace for bootstrap and runtime verification, preserving both existing workspaces and databases. Changing mounts on a retained runtime can trigger bootstrap and reset its database; that operation remains outside this approval.

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

2026-09-07: user approved a fresh disposable workspace after the retained-runtime guard blocked safe verification. Created `trees/rs/chatbot-isolation-proof` from feature baseline `50c1c318f1624ee3d7ae2b5665d1fcf3e933d252`. Applied only isolation changes, four feature-specific package mounts, and the test-only launcher profile. All nine host contract tests pass there. Infisical-backed startup completed successfully under Compose project `default-rs-bee49`, with Blob port 10033 and 35 distinct dependency volumes. Existing test and validation runtimes remain untouched. Container Next resolution passes before host installation; the actual frozen-lockfile host install is in progress. This startup is not yet post-install acceptance.

Slice review identified missing CI execution of the host regression suite. Added the existing `check:playwright-host` command to `.github/workflows/check.yml`; all nine host contract tests, workflow formatting, and whitespace checks pass. The reviewer corrected its reported range to `534d0019200169450a1ae25fabf03d1d4e7c1bd5..c75ea6df20784f6ac049f03e7345f60a2831133f`; its earlier unrelated hash is not evidence. Final review and browser acceptance remain pending.

2026-09-07: remote refs fetched; dedicated clean tooling worktree created. No implementation or runtime mutation has started. The native planner requested explicit database preservation, immediate post-rewrite proof, and separate baseline receipts. All findings were accepted; revised plan received APPROVED. Gemini 3.8 Flash High approved the isolated conceptual repair. Its mountpoint-permission concern is an acceptance check, not authority to add setup machinery. Its generic cross-device storage observations are not treated as measured repository behavior.

The configured explorer failed before work with provider 400. Native Luna generic continuity completed the bounded source mapping. The advisor's first model-label form was rejected; the exact catalog ID `gemini-3.8-flash-high` succeeded without changing the selected model or effort.

2026-09-07: detailed execution plan approved. The single tooling slice is active; main is establishing the supported non-destructive mount-update procedure in parallel. Existing chatbot product and multi-KB work remain outside this package.

Source slice implemented: 27 additional package mounts preserve the four existing dependency volumes, covering the root and all 30 workspace packages. Parent checks pass: all nine host-runner tests on Node 24.16.0, Biome on the changed test, Prettier on all three implementation files, and whitespace checks. Both primary and linked Compose models render successfully with 31 distinct dependency mounts. The regression rejects the original incomplete mount fixture. No dependency installation occurred. Host-only tooling checks used already installed tools; no application runtime was started merely for source verification. Local commits use scoped checks and a staged secret scan instead of the full application hook.

Runtime acceptance is paused before patch application. Installed devrouter 0.0.55's retained Compose guard rejects configuration changes; no supported non-destructive mount update has been established. The test baseline's post-create script explicitly resets and seeds the database. Context7 returned no relevant devrouter library; installed help and source provided the lifecycle evidence. Fresh host-side status confirms `rs-chatbot-editor-e2e` stopped, all present services stopped, zero exact routes, and no drift. The validation workspace was not touched.

Remaining: slice simplification/review, then a separately approved fresh disposable runtime or explicit recreation/reset authority for the test workspace. Live post-rewrite isolation proof and authoring acceptance have not run; integrated final review remains gated on that evidence. No merge-readiness claim is made.

Source slice committed as `c75ea6df20784f6ac049f03e7345f60a2831133f`. Simplifier completed; both behavior-preserving reductions accepted, removing repeated YAML parsing/serialization and redundant intermediate collections. Parent reran all nine host tests, Biome, and Prettier successfully. Slice correctness review remains active. Feature-baseline inventory has four additional packages absent from this tooling baseline: `apps/mcp-lecturer`, `apps/mcp-student`, `packages/kb-management`, and `packages/knowledge-graph`. A later approved test-patch transfer must add test-only isolation mounts for those four packages; it must not copy the feature Compose configuration into this tooling branch.
