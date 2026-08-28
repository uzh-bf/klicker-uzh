# Provider-safe devcontainer bootstrap plan

## Goal

- Make a fresh KlickerUZH managed devcontainer start reliably with both DevPod
  and Devsy before any profile-owned app, local MCP process, or route runs.
- Add an explicit Dev Container wait contract plus a fail-closed completion
  marker so provider lifecycle regressions cannot expose a half-bootstrapped
  environment.
- Preserve the dependency-aware profile model already merged from PR #5574:
  app profiles start their real dependencies, while LiteLLM, the local MCP
  fixture, and MailHog remain optional capabilities.
- Validate every declared core profile, representative combinations, native
  full mode, cold creation, warm switching, exact cleanup, and delegated local
  authentication without secrets or external provider calls.

## Non-goals

- Do not collapse optional capabilities back into every application profile.
- Do not rerun post-create, reset or reseed the database, recreate the app
  container, or remove volumes during a warm profile transition.
- Do not add analytics, the Office add-in, or the documentation site to the
  managed core stack. They are intentionally outside the current devcontainer
  topology and need separate dependency/runtime design if that changes.
- Do not change application behavior, production deployment, database schema,
  stored product data, authentication policy, or an external data boundary.
- Do not require OpenRouter, Azure, an API key, Infisical, or a model request to
  prove the `ai` or `mcp` capability.
- Do not change the machine's workspace-runtime preference, install or
  configure Devsy, merge the Klicker pull request, deploy, force-push, or delete
  branches, worktrees, workspaces, containers, or volumes.

## Execution contract

- Proposed authority: One approval of this plan and the linked upstream plan
  authorizes work in the named task worktrees, bounded implementation
  delegation, repository edits, repository-native checks, local conventional
  commits, fresh synthetic DevPod and Devsy validation workspaces, exact runtime
  stops, browser proof with seeded local accounts, required reviews, push,
  pull-request creation and maintenance, and exact-head CI monitoring.
- Upstream dependency: Klicker implementation may prepare locally in parallel,
  but the version pin, final provider matrix, push, and pull request require the
  published devrouter `0.0.43` artifact. An unpublished package or host checkout
  is not final acceptance evidence.
- Withheld authority: Klicker merge, deployment, machine provider-preference
  changes, Devsy installation/configuration, secret access, external model
  calls, real or personal data, force-push, destructive cleanup, branch or
  worktree deletion, and container or volume removal remain withheld.
- Execution owner: The current main session is the cross-repository execution
  orchestrator because the upstream validator, release artifact, consumer pin,
  provider runtimes, and final evidence are one critical path.
- Terminal: The pushed Klicker exact head pins published devrouter `0.0.43`;
  static checks, provider matrix, required reviews, and exact-head CI pass; its
  pull request is merge-ready; every task runtime is stopped with zero owned
  routes. Merge and destructive cleanup remain separate decisions.
- Pause: Stop if post-start can run before a successful marker, warm switching
  reruns bootstrap, provider failure leaves a route or process, profile service
  ownership is ambiguous, or final proof would use an unpublished CLI.
- Pause: Stop if proof requires credentials, an external model call, real data,
  provider installation/configuration, machine preference changes, destructive
  cleanup, force-push, or mutation of another workspace.

## Plan identity and dependency

- Plan: `project/2026-08-28-provider-safe-devcontainer-bootstrap-plan.md`
- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/provider-safe-devcontainer-bootstrap`
- Worktree: `trees/provider-safe-devcontainer-bootstrap`
- Target: `v3`
- Fresh base: `origin/v3` at `0892b61dc5c35694faa4e7ed90d36cddffadb8aa`,
  0 ahead and 0 behind when the worktree was created.
- Pull request: not created.
- Upstream plan: devrouter
  `docs/project/2026-08-28-managed-bootstrap-ordering-plan.md` on branch
  `rs/managed-bootstrap-ordering`.
- Required release: published devrouter `0.0.43`.
- Packaging: One ordinary consumer pull request after one upstream release.
  This is not a cross-repository GitHub stack.
- Unrelated checkout: The primary checkout branch
  `docs/chatbot-hitl-config-roadmap` is 1 commit ahead and 113 behind
  `origin/v3`, with a dirty and untracked working tree. This plan neither reads
  it as authoritative nor integrates, rebases, moves, cleans, or commits it.

## Findings and root cause

- `.devcontainer/devcontainer.json` declares
  `postCreateCommand: bash .devcontainer/post-create.sh` but no `waitFor`.
- The Dev Container default wait point is `updateContentCommand`, so later
  lifecycle work may continue after a provider reports the environment ready.
- Klicker's post-create installs dependencies, builds workspace packages,
  resets and pushes the local Prisma schema, seeds synthetic data, creates
  required empty `.env` shims, and captures the local Hatchet token.
- `.devcontainer/post-start.sh` currently sources post-create outputs and starts
  selected managed processes immediately. A cold Devsy run exposed this race;
  a warm environment can hide it because the outputs already exist.
- Dependency-aware profiles themselves remain sound: app profiles select the
  three Redis services and the relevant Turbo roots; `ai`, `mcp`, and `email`
  are optional and route-free; Postgres and Hatchet remain managed base
  services; native and omitted/`full` behavior remains all-on.
- Devrouter `0.0.42` cannot reject the unsafe lifecycle configuration before
  provider mutation. The linked upstream plan adds that generic gate.

## Settled bootstrap contract

### Dev Container synchronization

- Add `"waitFor": "postCreateCommand"` beside the existing lifecycle command.
  This is the provider-facing synchronization contract.
- Keep the committed native `runServices`, lifecycle command, Compose files,
  mounts, ports, and workspace folder unchanged.
- Pin published devrouter `0.0.43`, whose managed-adapter preflight rejects this
  repository if the wait contract is removed or weakened.

### Completion marker

- Add three focused operations to the existing `util/dev-runtime.sh` helper:
  begin bootstrap, complete bootstrap, and require completed bootstrap. Tests
  may override the state directory; production uses a fixed container-local
  directory outside the mounted workspace.
- The marker contains only an exact deterministic bootstrap contract token. It
  carries no credential, environment value, personal data, database content, or
  provider identity.
- `post-create.sh` invalidates any prior marker at its first semantic step. It
  atomically publishes the completion marker only after install, build,
  database setup, seed, runtime shims, and bounded Hatchet handling succeed.
- `post-start.sh` requires the exact marker immediately after strict shell mode,
  before changing directories, sourcing environment files, resolving a profile,
  calling the delivered helper, starting a process, or probing readiness.
- The marker assertion does not poll. `waitFor` owns synchronization; a missing
  or mismatched marker is proof of an incomplete or violated lifecycle and
  fails immediately.
- The token remains stable across warm profile transitions. A transition never
  invalidates, rewrites, or manufactures bootstrap completion.

### Failure and recovery

- Static lifecycle misconfiguration is rejected by devrouter before provider or
  service mutation.
- If a provider violates the declared wait point, the marker fails post-start.
  Devrouter must roll back newly selected profile services, retain recoverable
  exact ownership, and publish zero candidate processes and routes.
- A failed post-create never writes completion. A later warm switch must not
  bypass or repair it.
- Recovery never reruns the destructive database bootstrap implicitly. A truly
  broken fresh workspace stops and remains inspectable; recreation or deletion
  is a separately approved destructive action.

## Preserved dependency profile model

| Profile | Routed apps | Optional services | Managed processes | Acceptance focus |
| --- | --- | --- | --- | --- |
| `manage` | manage, api, auth | three Redis services | `klicker-dev` | Manage shell, API, delegated lecturer login |
| `pwa` | pwa, api, auth | three Redis services | `klicker-dev` | Student shell and API |
| `chat` | chat, pwa, api, auth | three Redis services | `klicker-dev` | Chat shell and no-login PWA dependency |
| `live-quiz` | pwa, control, api, auth, response-api | three Redis services | app roots and both Hatchet workers | response path and worker ownership |
| `ai` | none | LiteLLM | none | in-network health only; no upstream call |
| `mcp` | none | none | `klicker-local-mcp` | deterministic local health and metadata |
| `email` | none | MailHog | none | local service health; no external message |
| `full` | every currently routed core app | every profile service | both process markers with full roots | native-compatible complete topology |

- The managed base remains the app container, Postgres, and Hatchet. Capability
  profiles are smaller, not containerless.
- Omitted profile selection and explicit `full` remain all-on.
- Merged selections remain additive, canonical, order-insensitive, and
  de-duplicated. No capability implicitly adds API, Auth, Redis, an app route,
  or an external provider call.
- “All Klicker stuff” in this package means every declared core profile and
  combination above. Analytics, Office add-in, and docs remain explicitly
  outside the managed stack rather than being silently untested.

## Product primitive and ADR gates

- Product primitive: No learner, lecturer, content, API, or stored-data
  primitive changes. This is local developer-runtime behavior.
- ADR: The generic lifecycle decision belongs upstream in devrouter. Klicker is
  a consumer implementation of the Dev Container specification and existing
  profile ADR, so no new ADR is required.
- Re-arm the ADR gate if implementation changes foundational service ownership,
  makes a warm switch destructive, adds another provider/data boundary, or
  expands the managed application topology.

## Research and planning review

- The Dev Container lifecycle reference documents the asynchronous default and
  explicit wait points:
  <https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-reference.md>.
- The schema defines `postCreateCommand` and `postStartCommand` as valid later
  `waitFor` values:
  <https://github.com/devcontainers/spec/blob/main/schemas/devContainer.base.schema.json>.
- Current source and the merged PR #5574 plan establish the profile dependency
  table, route-free capabilities, native-full compatibility, exact process
  ownership, and warm no-recreate contract.
- The required native planner route could not launch because this task retained
  stale role metadata. Continuity used one read-only generic planner on
  `gpt-5.6-sol` at xhigh; it returned `DONE_WITH_CONCERNS`.
- Accepted: explicit `waitFor`, fail-closed marker, upstream validator, two
  provider cold proofs, every profile and representative mixed selections,
  browser authentication, exact stops, and no external model calls.
- Accepted correction: Assert the marker immediately rather than polling.
- Accepted correction: Provider-started selected services may exist before a
  marker failure, so rollback evidence must prove zero candidate routes,
  processes, and profile-owned services.

## Delegation and review map

| Slice | Owner | Dependency | Acceptance boundary | Review gate |
| --- | --- | --- | --- | --- |
| K0 plan | main | approval | Both linked plans are approved and committed | planner complete via disclosed continuity route |
| K1 bootstrap marker | executor | K0 | Marker operations, scripts, tests, and docs pass locally | simplifier + lifecycle slice-reviewer |
| K2 released pin and static matrix | main | upstream `0.0.43` | Pin, config, profile tests, and generated-config proof pass | simplifier; main verifies |
| K3 provider matrix | main | K1-K2 | DevPod and Devsy cold/warm/browser/cleanup proof passes | main integration evidence |
| K4 delivery | main | K3 | Final review, exact-head CI, PR body, and threads reach merge-ready | final-reviewer |

- K1 is a bounded shell-helper slice with no credentials, provider calls, or
  private data. The main session defines its exact write set and verifies it.
- K2-K4 stay in the main session because release identity, provider ownership,
  synthetic destructive database bootstrap, browser authentication, and
  cross-repository evidence are critically coupled.
- Reviewers are distinct from implementers. Findings are advice until the main
  session verifies and dispositions them.

## Test portfolio

| Consequential behavior | Stable seam | Required cases | Distinct failure |
| --- | --- | --- | --- |
| Wait contract | source and generated config inspection | source uses post-create; generated config preserves it | provider may return before bootstrap |
| Marker lifecycle | helper tests with temporary state | missing, malformed, begin invalidation, atomic complete, exact require | stale/partial bootstrap is accepted |
| Script ordering | static script harness | begin first, complete last, require before env/profile/helper | process starts before bootstrap proof |
| Failed bootstrap | bounded fixture | failing middle step leaves no completion marker | post-start accepts partial setup |
| Warm preservation | marker identity plus runtime state | every switch retains same app container and marker | switch reruns seed/bootstrap |
| Profile resolution | existing table tests | all singles, mixed order, duplicates, omitted/full, invalid | resource union silently changes |
| Route-free capabilities | runtime status | `ai`, `mcp`, `email` have no app route or Turbo process | optional service starts core apps |
| Application dependencies | runtime status | app profiles have Redis; base has Postgres/Hatchet | app boots without eager dependency |
| Provider cold start | fresh DevPod and fresh Devsy checkout | no manual bootstrap; marker and shims exist; manage routes ready | warm artifacts hide ordering race |
| Provider violation | controlled fixture | marker fail rolls back selected services and publishes no route/process | partial environment remains exposed |
| Browser authentication | agent-browser | delegated lecturer login on each provider; student shell on PWA | HTTP readiness hides auth/cookie failure |
| Capability health | local probes | LiteLLM health, MCP health/metadata, MailHog health | service exists but capability is unusable |
| Full topology | runtime status and representative routes | every declared core service/process/route appears | optional profile work breaks full mode |
| Final cleanup | exact devrouter status | provider workspace stopped; zero owned routes | task runtime survives completion |

## Provider validation matrix

### Isolation and safety

- Use separate never-before-used validation worktree paths for DevPod and Devsy,
  both at the same exact candidate commit. Do not reuse the development
  worktree's existing runtime.
- Select the provider command-locally with
  `DEVROUTER_WORKSPACE_RUNTIME=devpod` or `devsy`. Do not mutate the machine
  preference.
- Use committed synthetic local seed data only. Do not inject OpenRouter or
  Azure credentials and do not send a model request or external email.
- Record exact CLI version, commit, provider, workspace identity, selected
  profile, route set, service set, process set, marker token, and cleanup state.
  Do not record environment values or response bodies containing credentials.

### Cold proof on each provider

- Start `manage` with one canonical `devrouter ensure` and no manual bootstrap.
- Require successful post-create completion, exact marker, required empty app
  `.env` shims, dependency stamp, Prisma client/schema/seed readiness, and
  Hatchet bootstrap state.
- Require only Manage, API, and Auth routes; Postgres and Hatchet base; all three
  Redis services; and the exact `klicker-dev` process.
- Use `agent-browser` for delegated local lecturer login and a Manage page shell.
- Stop the exact workspace and require zero routes before the warm matrix is
  started in its retained provider workspace.

### Warm proof on each provider

- Start each single profile: `manage`, `pwa`, `chat`, `live-quiz`, `ai`, `mcp`,
  and `email`.
- Prove representative unions: `ai,mcp,email`, `manage,email`, and
  `chat,ai,mcp`, including reversed-order canonical equivalence where the
  resolver test is not sufficient.
- Start `full`, then return to `manage`.
- At every transition require the same app container identity and bootstrap
  marker, no post-create or seed rerun, exact selected services/processes/routes,
  stopped dropped resources, and successful readiness.
- Browser-prove the PWA student shell and Chat shell. Prove live-quiz routes and
  both worker processes. Probe LiteLLM health only, the deterministic MCP health
  and metadata, and MailHog health without external side effects.
- Stop the exact runtime at the end and require zero owned routes. Retain
  worktree, workspace metadata, containers, and volumes for separately approved
  cleanup; do not delete them under this plan.

## Slices and commits

### K0: commit the reviewed plan

- Commit this file after approval and record Progress as active.
- Verify the task worktree remains on the recorded `origin/v3` and stages none
  of the dirty primary checkout's files.
- Commit: `docs(project): plan provider-safe devcontainer bootstrap`.

### K1: add the wait contract and bootstrap marker

- Route: `executor` in the Klicker task worktree, parallel with Devrouter D1.
- Acceptance: Marker lifecycle and script-order tests, shell syntax, profile
  tests, affected documentation, and changed-file formatting pass on the
  committed slice.
- Add `waitFor: postCreateCommand` without changing native service topology.
- Add begin, complete, and require operations to `util/dev-runtime.sh` with a
  fixed container-local state path and a test-only override.
- Wire begin to the first semantic post-create step, complete to the final
  successful step, and require to the first semantic post-start step.
- Add focused helper and script-order tests. Update `.devcontainer/README.md`,
  `docs/getting-started.md`, the devrouter project skill, and affected lifecycle
  testing guidance.
- Run shell syntax, focused helper/profile tests, formatting, and
  `git diff --check`.
- Commit: `fix(devcontainer): enforce completed bootstrap`.
- Run simplifier and lifecycle slice-reviewer in parallel; verify and disposition
  each finding before K2.

### K2: pin the published validator and verify static contracts

- Route: `main`; execution-tier skip reason: exact published artifact identity
  and the cross-repository release gate are critically coupled.
- Acceptance: Published `0.0.43` is read back, the pin and generated/source
  configs agree, and the complete static profile matrix passes.
- After registry verification, pin exactly devrouter `0.0.43` in
  `.devrouter.yml` and matching guidance.
- Run `test:dev-runtime`, `test:profile-resolver`, source/generated devcontainer
  inspection, Compose validation, changed-file formatting, relevant docs/skill
  checks, and focused package checks.
- Confirm the profile table, native `runServices`, managed base, profile service
  registry, process registry, and route-free capability behavior are unchanged.
- Commit: `chore(devcontainer): require devrouter 0.0.43`.

### K3: run the provider matrix

- Route: `main`; execution-tier skip reason: provider ownership, synthetic
  destructive bootstrap, browser authentication, and cleanup evidence are
  critically coupled.
- Acceptance: Fresh DevPod and Devsy cold/warm matrices pass on the same exact
  commit and both exact runtimes finish stopped with zero owned routes.
- Create provider-specific validation checkouts from the same exact candidate
  commit and use command-local provider selection.
- Run the cold and warm matrices above without secrets or external calls.
- Use the local runtime lifecycle procedure at provider startup, after the final
  runtime-dependent check, and at each exact stop.
- If a failure is branch-introduced, fix the smallest semantic region, rerun the
  affected matrix cells, and repeat only reviews invalidated by material change.
- If Devsy violates the declared wait point, retain values-free diagnostics and
  exact ownership evidence, stop the runtime, and report a provider blocker
  rather than adding sleeps or bypasses.

### K4: review, publish the branch, and reach merge-ready

- Route: `main`; execution-tier skip reason: integrated final review, external
  PR mutation, exact-head CI, and review-thread disposition are critically
  coupled.
- Acceptance: The complete branch passes final review and exact-head CI; its PR
  targets `v3`, has no actionable unresolved thread, and looks merge-ready.
- Run the repository-native static finish checks appropriate to touched shell,
  JSON, YAML, Markdown, and runtime-test files.
- Run one final-reviewer over the integrated exact range and apply only verified
  corrections. Rerun affected checks and provider cells.
- Inspect staged content for credentials and personal data.
- Push and open an ordinary pull request targeting `v3`. Write its description
  from exact-head static, DevPod, Devsy, browser, cleanup, and release evidence.
- Monitor exact-head CI and unresolved review threads; fix only actionable
  branch-introduced failures. Stop at merge-ready. Do not merge.

## Progress

- `2026-08-28`: Root cause confirmed against current `origin/v3`, current
  devrouter `0.0.42`, and the Dev Container specification. Fresh branch created
  from `origin/v3` at `0892b61`.
- `2026-08-28`: Read-only planning review completed through the disclosed Sol
  continuity route with corrections incorporated.
- `2026-08-28`: The user approved both linked plans and the named provider,
  push, PR, and upstream release boundaries. K0 is active; K1 may run in
  parallel with Devrouter D1 in this separate worktree.
- `2026-08-28`: K0 committed as `813b7169c`. K1 adds the explicit wait point,
  fixed container-local completion marker, first/last script assertions,
  missing/malformed/symlink/invalidation coverage, and synchronized runtime
  guidance. The configured executor route failed terminally on stale model
  metadata; generic-continuity used Luna/max. The child was interrupted before
  completion, so the trusted main session verified and completed its partial
  work without a second executor attempt.
- Current state: `active`. Completed slices: K0. Active: K1 verification and
  commit. Remaining: K2-K4. Latest evidence: `bash util/test-dev-runtime.sh`,
  shell syntax, and `git diff --check` pass; no task provider runtime is active.
  Required delivery: merge-ready Klicker PR; achieved delivery: committed plan
  plus verified uncommitted K1 implementation.
