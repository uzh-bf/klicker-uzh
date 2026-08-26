# Devcontainer dependency profiles plan

## Goal

- Make KlickerUZH's managed devcontainer profiles reflect the real runtime
  dependency structure instead of filtering routes while all services and local
  processes continue to run.
- Keep task-shaped application profiles (`manage`, `pwa`, `chat`, `live-quiz`)
  and add orthogonal capability profiles (`ai`, `mcp`, `email`) that can be
  selected independently or combined additively.
- Preserve the existing native DevContainer and omitted/`full` all-on behavior,
  while managed devrouter starts and retains only the exact selected routes,
  profile-owned services, and managed processes.
- Correct the released-version pin, Chat's PWA dependency, process replacement,
  and recurring Turbo dependency graph as one downstream consumer package after
  the prerequisite devrouter release exists.

## Non-goals

- Do not split the primary app container or create per-app containers.
- Do not remove native `forwardPorts`, change the legacy host runtime, or make
  native DevContainer startup selective by default.
- Do not create `workflow`, `realtime`, Redis-specific, Hatchet-specific, or
  database-specific user profiles in this package. Hatchet and Postgres remain
  bootstrap/base services until application and post-create initialization are
  decoupled.
- Do not change production deployment, database schema, stored data, user-facing
  application behavior, authentication, secrets, or external data boundaries.
- Do not add application or package dependencies or call an external model.
- Do not install or update the host devrouter CLI, publish the upstream package,
  push, open or merge a pull request, deploy, delete the branch or worktree,
  remove containers or volumes, or use real or personal data.

## Execution contract

- Authority: Approval authorizes the plan commit now and, after the immutable
  upstream release gate is satisfied, reversible local consumer implementation
  in the named worktree, bounded delegation, repository-native checks, exact
  runtime start/switch/stop, required reviews, Progress updates, and local
  conventional commits.
- Authority: Approval does not authorize upstream or downstream push,
  pull-request creation, merge, release publication, host CLI or package
  installation/update, deployment, secret access, external provider calls,
  real or personal data, container or volume removal, branch deletion, or
  worktree deletion.
- Boundary owner: The main execution session owns the profile table, dependency
  decisions, integration, runtime identity, review disposition, and final proof.
  Delegated agents receive only named slices and disjoint write sets.
- Upstream gate: Implementation beyond K0 pauses until the prerequisite
  devrouter package is published and its exact version and artifact are verified.
  A local release candidate is not sufficient evidence for the final consumer
  pin or release-compatible completion.
- Terminal: The consumer branch is locally committed against the published
  minimum devrouter version; static and runtime matrices pass; all required
  findings are resolved; the exact task runtime is stopped; zero owned routes,
  managed processes, and running profile-owned services remain; Progress records
  the evidence.
- Pause: Stop if the upstream public contract differs from this reviewed plan,
  exact service or process ownership cannot be proven, invalid selection mutates
  the prior runtime, profile switching would recreate the app container or rerun
  post-create, or verification requires secrets, an external model, real data,
  installation, publication, deletion, or another user's files.

## Plan identity and dependency

- Plan: `project/2026-08-25-devcontainer-dependency-profiles-plan.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Branch: `rs/devcontainer-dependency-profiles`
- Worktree: `trees/devcontainer-dependency-profiles`
- Target: `v3`
- Fresh base: `origin/v3` at `cd5cfd574`, 0 ahead and 0 behind after the remote
  advanced while the plan was paused. The task branch was fast-forwarded before
  implementation.
- Pull request: not created. Push and pull-request creation are outside the
  local terminal.
- Prerequisite package: devrouter plan
  `/Users/rschlae/Git/personal/devrouter/trees/devcontainer-dependency-profiles/docs/project/2026-08-26-devcontainer-dependency-profiles-plan.md`.
- Release dependency: next published patch after devrouter `0.0.38`; `0.0.39` is
  expected but not authoritative until release publication is verified.
- History: `project/2026-08-24-devrouter-profiles-three-mode-plan.md` and PR #5539
  introduced route/process profiles. This package closes the omitted container
  and process lifecycle seam rather than reopening that merged package.
- Packaging: One ordinary consumer pull request after one ordinary upstream
  pull request. This is not a cross-repository stack.

## Settled dependency model

### Managed base

- The DevPod primary `app` service is implicit and always active.
- `postgres` remains a managed base service because post-create resets, pushes,
  and seeds the local database and every app profile needs it.
- `hatchet` remains a managed base service because current post-create captures
  Hatchet configuration and backend startup treats Hatchet initialization as
  boot-critical. Reducing it further requires a separate bootstrap/application
  decoupling package.
- The three Redis services are profile-owned but selected by every application
  profile because backend startup eagerly creates all three clients.
- Pure capability profiles therefore keep an idle app container plus Postgres
  and Hatchet, but start no Turbo/API/Auth/application process and publish no app
  routes. This is intentionally smaller, not containerless.

### Profile contract

| Profile | Routed apps | Profile-owned services | Managed processes and roots | Readiness |
| --- | --- | --- | --- | --- |
| `manage` | manage, api, auth | all three Redis services | `klicker-dev`: backend, auth, manage | manage and api HTTP readiness |
| `pwa` | pwa, api, auth | all three Redis services | `klicker-dev`: backend, auth, pwa | pwa and api HTTP readiness |
| `chat` | chat, pwa, api, auth | all three Redis services | `klicker-dev`: backend, auth, pwa, chat | chat, pwa, and api HTTP readiness |
| `live-quiz` | pwa, control, api, auth, response-api | all three Redis services | `klicker-dev`: backend, auth, pwa, control, response-api, both Hatchet workers | pwa and api plus response path readiness |
| `ai` | none | LiteLLM | none | LiteLLM container health only |
| `mcp` | none | none | `klicker-local-mcp` | deterministic local MCP endpoint proof |
| `email` | none | MailHog | none | MailHog container health only |
| `full` | all current routed apps | all profile-owned services | both managed process markers with current full roots | current full readiness plus optional capability health |

- The three Redis services are `redis_exec`, `redis_assessment`, and
  `redis_cache`. Capability services are `litellm` and `mailhog`.
- The `chat` profile includes PWA because the no-login path routes through it.
- The `live-quiz` profile retains the response processor and general Hatchet
  worker because both participate in the live response path.
- Omitted selection and explicit `full` preserve today's all-on environment.
- Merged selections are additive, canonical, order-insensitive, and
  de-duplicated. Examples:

  - `chat` runs Chat without LiteLLM or the local MCP fixture.
  - `chat,ai` adds LiteLLM for model work without MCP.
  - `chat,mcp` adds the deterministic MCP fixture without requiring a model call.
  - `chat,ai,mcp` runs the complete local model-tool topology.
  - `manage,email` adds MailHog only to the Manage application profile.
  - `ai`, `mcp`, and `email` are valid pure capability selections.

- Unknown, empty, or no-op profile components fail before generated config,
  services, managed processes, or routes change. Equivalent reordered input
  reuses the same process and runtime fingerprints.

## Native, managed, and host mode contract

- Native DevContainer: Keep committed `.devcontainer/devcontainer.json`
  `runServices` all-on. VS Code, DevPod used directly, and Dev Container CLI
  retain current service and `forwardPorts` behavior.
- Managed devrouter: Declare base services, profile-owned services, and process
  markers in `.devrouter.yml`. Ignore the exact devrouter-generated sibling
  config path. Devrouter changes only effective `runServices` for the selected
  managed profile and never rewrites the committed source config.
- Managed Compose: Do not rely on Compose profile environment state to override
  an explicitly named `runServices` set. The devrouter effective config is the
  service authority. Add or retain health checks needed for values-free
  readiness, but avoid topology changes unrelated to the selected services.
- Managed processes: `.devcontainer/post-start.sh` consumes the resolved profile
  and desired process markers. It validates the complete selection first, stops
  absent owned process groups, ensures desired process groups, and proves local
  readiness before returning. The upstream `devrouter-process stop/status`
  ownership contract replaces ad hoc PID signaling.
- Host runtime: Legacy Infisical and host Compose commands remain unchanged. The
  package must not claim that devrouter profiles govern host-started processes.

## Process and build resolution

- Extract one pure, sourceable profile resolver for exact app roots, worker
  roots, readiness targets, and process markers. Keep lifecycle commands thin.
- Capability-only selection yields no API/Auth defaults and no Turbo filter.
  When no `klicker-dev` marker is desired, stop that exact owned process instead
  of starting an empty or full Turbo command.
- When `mcp` is absent, stop `klicker-local-mcp`; when present, ensure it and
  prove the deterministic endpoint without sending a model request.
- Replace fixed recurring build lists in the four development tasks with
  Turbo's declared transitive workspace build dependency, `^build`, where the
  package graph is already authoritative. Do not edit package manifests merely
  to reshape the graph, and retain Chat's legitimate test-only GraphQL edge.
- Post-create keeps its broader one-time install/build/reset/seed contract. This
  package changes recurring development prerequisites, not workspace creation.

## Transition and failure semantics

- Devrouter validates and computes the entire candidate state before invoking
  post-start. Added services become healthy before processes use them.
- The adapter stops or replaces exact obsolete processes while their old service
  dependencies still exist, starts the candidate process set, and proves local
  process readiness.
- Devrouter then stops dropped profile-owned services by exact container ID,
  verifies desired services and processes, and publishes the candidate route set
  only as the final visible commit point.
- On failure, candidate routes remain absent. Devrouter restores the prior
  service set, reruns the prior adapter selection, and restores prior routes when
  exact state is known. Incomplete restoration is explicit drift and a failed
  `ensure`, never silent full fallback.
- Switching does not recreate `app`, rerun post-create, reset the database,
  remove containers, or remove volumes.
- Unchanged canonical selection is idempotent: no service restart, process
  replacement, or route churn.

## Product primitive and ADR gates

- Product primitive: No user-facing primitive, public API, stored data, or
  product workflow changes. No product-design pass is required.
- ADR: The generic lifecycle, state, and rollback decision belongs to the
  upstream devrouter ADR. Klicker records only consumer configuration and
  verified dependency facts, so no separate ADR is required.
- Re-arm the Klicker ADR gate if implementation changes foundational service
  ownership, post-create/database behavior, the single-container architecture,
  or an external data boundary.

## Research and evidence

- `.devcontainer/devcontainer.json` currently names all eight services in
  `runServices`: app, Postgres, three Redis services, Hatchet, MailHog, and
  LiteLLM.
- `.devcontainer/post-create.sh` installs and builds the workspace, resets and
  seeds Postgres, and captures Hatchet configuration. Backend startup eagerly
  initializes the three Redis clients and Hatchet integration.
- MailHog is used only for local email delivery/inspection. LiteLLM is used only
  for AI/model work. The deterministic local MCP is an in-container Node process
  on port 1417, not a Compose service.
- The external seeded Context7 MCP is remote configuration and is not selected,
  started, stopped, or claimed by this local `mcp` profile.
- Dev Container `runServices` is the explicit startup set, while omission means
  all services:
  <https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainerjson-reference.md>.
- DevPod PR #1583 made warm `up` honor `runServices`:
  <https://github.com/loft-sh/devpod/pull/1583>. The upstream plan still
  characterizes the installed `0.6.15` path before relying on it.
- Current `.devrouter.yml` pins `0.0.36`, but the existing profile schema first
  shipped in `0.0.38`. This package pins only the published dependency-aware
  release after its artifact is verified.

## Planning review

- One required read-only `planner` reviewed the upstream and downstream package
  together and returned `DONE_WITH_CONCERNS`.
- Accepted: Use two linked package-local plans; keep native full; add independent
  app, service, and process dimensions; make pure capabilities route-free;
  require exact ownership, last-successful state, rollback, drift reporting,
  final route publication, and a hard publication gate between packages.
- Accepted with correction: Hatchet remains in the Klicker managed base because
  current post-create and backend bootstrap require it. The planner's proposed
  app-only Hatchet selection would fail a fresh pure-capability workspace.
- Accepted: No additional product decision is required if pure capability means
  no app process or route while retaining the idle primary and declared base
  services.

## Delegation and review map

| Slice | Owner | Dependency | Acceptance boundary | Review gate |
| --- | --- | --- | --- | --- |
| K0 plan and release gate | main | approval | Plan committed; exact upstream version recorded before K1 | planner already complete |
| K1 profile/service contract | main | published upstream | Exact app/capability unions and native-full compatibility pass | simplifier + slice-reviewer |
| K2 process lifecycle | main | K1 | App and MCP process start/stop/readiness are exact | simplifier + slice-reviewer |
| K3 Turbo graph | executor | K1 | Recurring builds follow declared workspace dependencies | simplifier |
| K4 guidance | executor | K1-K3 | README, wiki, AGENTS, skills, and solution docs agree | main integration review |
| K5 integrated proof | main | K1-K4 | Matrix, lifecycle cleanup, full checks, and final review pass | final-reviewer |

- K1 and K2 stay serial because process resolution consumes the profile and
  service contract. K3 may run after K1 with a disjoint write set. K4 starts only
  after observable behavior is stable.
- Delegated prompts exclude credentials, private material, external model calls,
  and unrelated worktree content. The main session verifies every result.

## Test portfolio

| Consequential behavior | Stable seam | Required cases | Distinct failure |
| --- | --- | --- | --- |
| Published contract | released artifact inspection | exact minimum version, schema, native config, managed generated config | consumer pins an unreleased or incompatible version |
| Profile union | pure resolver and config inspection | every single profile; reversed mixed order; duplicates; omitted/full; unknown/empty/no-op | a profile silently adds or loses a resource |
| Pure capability | resolver plus runtime state | `ai`, `mcp`, `email` have no routes or app process; base remains | capability unexpectedly starts API/Auth/apps |
| App service dependencies | config plus runtime | all app profiles have three Redis; base has Postgres/Hatchet | backend starts without a boot dependency |
| Chat route dependency | config and bounded browser navigation | `chat` includes PWA and no-login navigation reaches PWA/Auth | Chat route works but login path is broken |
| Live-quiz path | resolver and runtime process state | response API and both workers present | responses or aggregation have no consumer |
| Optional capabilities | health and deterministic local probes | LiteLLM health without model call; MCP marker response; local MailHog SMTP/health | container runs but capability is unusable |
| Managed process lifecycle | helper and adapter tests | ensure, stop, status, unchanged idempotence, rollback, foreign/corrupt refusal | leaked, duplicate, or foreign process mutation |
| Native-full compatibility | committed config and native validation | original runServices/forwardPorts; full service set | selective managed mode breaks direct mode |
| Turbo dependency graph | Turbo dry JSON | all four recurring tasks and representative app roots | required workspace build is lost or fixed overbuild remains |
| Transition safety | exact runtime matrix | full to pure capability to mixed app; invalid preservation; reversed order; full restore | recreate, seed rerun, route leak, or incomplete removal |
| Final cleanup | exact lifecycle proof | stop exact workspace; zero owned routes/processes/running profile services | task runtime survives completion |

## Slices and commits

### K0: commit the consumer plan and hold the release gate

- Do: Commit this reviewed plan first. Record the upstream plan path and
  `release_pending` gate without guessing an immutable version.
- Check: Re-run freshness and dirty-state checks; verify only plan/index changes
  are staged; inspect staged content for secrets and personal data.
- Gate: Do not start K1 until upstream push, PR, merge, publication, and any
  required local package/CLI update have separately been authorized and the
  released artifact is verified.
- Commit: `docs(project): add devcontainer dependency profile plan`.

### K1: define orthogonal app and capability profiles

- Do: Pin the verified dependency-aware devrouter release. Add the managed base,
  profile-owned service registry, process marker registry, exact profile table,
  default/full wildcard, and ignored generated-config path to `.devrouter.yml`
  and related Dev Container configuration.
- Do: Keep committed native `runServices` and `forwardPorts` all-on. Add only the
  service health checks or Compose metadata needed for exact managed readiness.
  Do not add a second committed Dev Container topology.
- Do: Add or extract a pure profile resolver and table-driven tests for exact
  routes, services, processes, app/worker roots, readiness, merged-order
  equivalence, deduplication, full/default, and fail-closed invalid selections.
- Check: Use the published artifact to inspect every profile. Validate both
  Compose overlays and native config. Run focused resolver tests and shell
  syntax checks.
- Reviews: Run `simplifier` and architecture/lifecycle `slice-reviewer` in
  parallel after the slice commit; verify and disposition every finding.
- Commit: `feat(devcontainer): define orthogonal runtime profiles`.

### K2: reconcile exact application and MCP processes

- Do: Update managed post-start to consume the candidate process markers and
  pure resolver. Ensure or stop `klicker-dev` and `klicker-local-mcp` exactly,
  without implicit API/Auth startup for pure capability profiles.
- Do: Prove LiteLLM and MailHog through container health and the MCP through its
  deterministic endpoint. Keep model/provider requests and secrets outside the
  tests.
- Do: Add focused adapter tests for app-only, capability-only, mixed, unchanged,
  invalid, transition, rollback, helper foreign-state refusal, and no stale MCP.
- Check: Run `bash -n`, focused profile/process tests, and the existing
  `test:dev-runtime` suite. Inspect process status and logs without bodies,
  credentials, or environment values.
- Reviews: Run `simplifier` and lifecycle/rollback `slice-reviewer` in parallel
  after the slice commit and rerun affected checks after verified corrections.
- Commit: `fix(devcontainer): reconcile exact managed processes`.

### K3: derive recurring builds from the workspace graph

- Do: Replace only the four duplicated fixed recurring build lists with `^build`
  so Turbo follows each selected workspace's declared transitive dependencies.
  Do not change manifests or remove legitimate development/test dependencies.
- Check: Inspect Turbo dry JSON for `dev`, `dev:lti`, `dev:offline`, and
  `dev:assessment`, covering backend, PWA, Chat, live-quiz roots, and full mode.
  Confirm required dependencies remain and unrelated recurring builds disappear.
- Review: Run `simplifier` after the slice commit and verify its advice.
- Commit: `refactor(turbo): use transitive dev build dependencies`.

### K4: align developer guidance and durable knowledge

- Do: Update `.devcontainer/README.md`, `docs/getting-started.md`,
  `docs/testing.md`, `docs/chat-platform.md`,
  `docs/solutions/integration/openrouter-local-chat-runtime.md`, AGENTS.md, and
  the devrouter, environment-doctor, and testing-verification skills where their
  contracts changed.
- Do: Explain app versus capability profiles, base services, native-full versus
  managed-selective behavior, exact combinations, provider-free checks,
  external Context7 non-ownership, transition rollback, and exact stop. Record
  delivery evidence in this plan; the wiki's reserved log paths stay absent.
- Do: Run the supported devrouter agent-guidance generator only if the published
  release requires it. Inspect and retain only in-scope generated hunks.
- Check: Run documentation validation, wiki checks, link checks, formatting, and
  a guidance-to-implemented-contract comparison.
- Commit: `docs(devcontainer): document dependency-aware profiles`.

### K5: run the integrated matrix and close the package

- Static checks: Run focused tests, `pnpm run check:all`, applicable package
  tests, full build, both Compose validations, and Turbo dry graphs inside the
  exact task container. Run Opengrep when installed and separate new findings.
- Runtime matrix: Prove omitted/full; each pure capability; each app profile;
  `chat,ai`, `chat,mcp`, `chat,ai,mcp`, and `manage,email`; reversed equivalent
  input; unchanged idempotence; `full` to pure `mcp` to `chat,ai,mcp` to `full`;
  and invalid-selection preservation.
- Capability proof: Check LiteLLM health without a completion request, call the
  deterministic local MCP directly with synthetic input, and send one synthetic
  local-only email into MailHog. Do not inspect or record message bodies.
- Browser proof: With `chat` selected, use the repository browser workflow to
  verify bounded Chat no-login navigation through PWA/Auth without a model
  request. No screenshots are required unless implementation changes UI code or
  visible UI behavior.
- Finish: Inspect staged content for secrets and personal data and account for
  every changed hunk. Run one `final-reviewer` over the integrated committed
  package, resolve findings, and rerun affected checks. Stop the exact task
  workspace and prove its provider stopped plus zero exact routes, managed
  processes, and running profile-owned services. Do not remove volumes,
  containers, the worktree, or the branch.
- Commit: `docs(project): record devcontainer profile verification` only when a
  separate final Progress evidence commit is needed.

## Upstream publication checkpoint

- The devrouter package's honest local terminal is a verified release candidate
  with status `release_pending`.
- Advancing to K1 requires explicit authority for the upstream push, pull
  request, merge, release publication, and any host package or CLI installation
  or update. Batch that request with the exact branch, version, and artifact.
- After publication, verify the released tag/package and update this plan's
  Progress with the immutable version before changing `.devrouter.yml`.
- Downstream push and pull-request creation remain separately withheld even
  after local consumer completion.

## Expected final evidence

- Published devrouter version and released-artifact inspection.
- Profile resolver, process helper, adapter, and existing dev-runtime test
  results.
- Native/full and managed profile/service inspection results.
- Turbo dry-graph conclusions for all changed recurring tasks.
- Full repository checks and build from the exact task container.
- Provider-free LiteLLM, MCP, MailHog, route, and bounded browser conclusions.
- Simplifier, slice-reviewer, and final-reviewer dispositions.
- Exact final runtime stop with zero owned routes, managed processes, and running
  profile-owned services; no volume, worktree, branch, or container deletion.

## Progress

- Status: K0-K5 are implemented and the integrated runtime matrix passes.
  Devrouter 0.0.40 is released and its published artifact passes the
  representative downstream lifecycle matrix.
- Active slice: Integrated final review and PR readiness.
- Completed: Fresh downstream worktree, dependency and process mapping,
  first-party Dev Container and DevPod research, upstream package decomposition,
  and required planning review.
- Remaining: Run the integrated final review, push the final Klicker commits,
  update PR #5574, and prove the exact runtime stopped.
- Latest verified target: `origin/v3` at `a36c21626`. The package is ten
  commits ahead and two deployment-only commits behind; those target commits
  touch only `deploy/env-uzh-stg/values.yaml`, outside this package's diff.
- Runtime: The exact linked-worktree runtime is active on the `ai,chat,mcp`
  profile for final checks. It will be stopped without deletion after the final
  runtime-dependent check.
- Active children: none.
- Unresolved gates: Integrated final review and downstream exact-head CI.
  Klicker PR merge remains separately withheld.
- 2026-08-26 upstream publication: devrouter PR #37 was squash-merged at
  `af55b23`, GitHub release `v0.0.39` was published, and the release workflow
  completed successfully. `npm view @devrouter/cli` reports version 0.0.39;
  the published tarball validated the new `.devrouter.yml` contract.
- 2026-08-26 K1: Added the `managedRuntime` registry (base: postgres, hatchet;
  profile-owned: 3x Redis, litellm, mailhog; processes: klicker-dev,
  klicker-local-mcp), the eight-profile contract with pure capabilities
  (`ai`, `mcp`, `email`), the devrouter pin at 0.0.39, the ignored generated
  config path, and the pure sourceable resolver `util/profile-resolver.sh`
  with table-driven coverage (`test:profile-resolver`: every profile, merged
  order, duplicates, full, fail-closed unknown).
- 2026-08-26 K2: `post-start.sh` now resolves the complete selection first,
  stops dropped owned markers (klicker-dev, klicker-local-mcp) exactly, ensures
  desired ones, gates the MCP fixture and Manage warm-up on the selection, and
  prints a capability-only summary. Readiness apps come from the resolver.
- 2026-08-26 K3: Replaced the four fixed recurring build lists (`dev`,
  `dev:lti`, `dev:offline`, `dev:assessment`) with `^build`. Turbo dry JSON
  keeps all declared dependencies and removes the undeclared `transactional`
  overbuild; post-create keeps its broader one-time contract.
- 2026-08-26 K4: Updated `.devcontainer/README.md` (profile table, base
  contract, transition guarantees), `AGENTS.md`, the affected engineering wiki
  pages, and the devrouter, environment-doctor, and testing-verification skills
  for the three-dimension profile model. The OKF validator still reports 19
  pre-existing bundle-wide frontmatter errors outside the changed pages.
- 2026-08-26 upstream correction: A failed first cold selective transition
  exposed that devrouter 0.0.39 removed the generated Dev Container config and
  left DevPod metadata temporarily unstoppable. Devrouter PR #38 adds rollback
  coverage for cold and warm transitions and was squash-merged at
  `bc38a7d3697b8658618e538b1d6bacd19ab0d98b`. The 0.0.40 source candidate
  passes 659 tests and package smoke; exact-head main CI run 32984746600 is
  still queued without an assigned job, so the release is not yet published.
- 2026-08-26 upstream release: The immutable `v0.0.40` tag resolves to
  `bc38a7d3697b8658618e538b1d6bacd19ab0d98b`. Exact-tag non-publishing CI run
  32992245103 passed before release. GitHub release v0.0.40 is published, and
  explicit publication run 32992503893 passed both `check` and `publish`.
  npm reports `@devrouter/cli` 0.0.40 with tarball SHA-1
  `400aadd7049c35f7c80eacf4788f49dd1b12b059`. The release stays scoped to the
  rollback fix; a later Devsy commit on `main` remains unreleased.
- 2026-08-26 K5 matrix: Cold `chat` recaptured a late Hatchet token before app
  startup. Every standalone profile (`manage`, `pwa`, `chat`, `live-quiz`,
  `ai`, `mcp`, `email`), omitted/full, `chat,ai`, reversed `ai,chat`,
  `chat,mcp`, `chat,ai,mcp`, and `manage,email` reached `ready` with zero drift.
  The exact `full` to `mcp` to `chat,ai,mcp` to `full` chain removed and restored
  apps, services, and owned processes without recreation. An unknown profile
  failed before mutation. Repeating canonical full retained every exact
  container ID and managed process identity.
- 2026-08-26 capability and route proof: LiteLLM liveliness passed without a
  completion request; direct synthetic MCP input returned
  `KLICKER_LOCAL_MCP_OK`; MailHog accepted one synthetic local-only SMTP
  message without body inspection. A fresh browser session loaded Chat without
  a model request, followed its `Open KlickerUZH` link to the PWA login form,
  and loaded the namespaced Auth route.
- 2026-08-26 static proof: Resolver and process-helper suites, Compose
  validation for linked and primary checkouts, formatting, all 25 TypeScript
  checks, and lint for all 29 container-supported workspaces pass. The full
  production build completed all 23 tasks. Repository-wide `check:all` reaches
  the excluded analytics package, where uv selects Python 3.14 and tries to
  compile pandas 2.2.2 without a C compiler; analytics remains outside this
  devcontainer by contract. DevPod occasionally omits its remote exit status
  after printing devrouter's exit-zero marker, so those successful workload
  results are read from the marker and task totals rather than the wrapper exit.
- 2026-08-26 final-review correction: The integrated reviewer required the
  released minimum to be stated consistently, the planned wiki pages to be
  updated, and live-quiz startup to prove its response path. All guidance now
  requires devrouter 0.0.40 and explicitly excludes 0.0.39 for rollback-safe
  managed transitions. Focused resolver/runtime tests and ShellCheck pass.
  A real `live-quiz` reconciliation reached Response API `200 application/json`
  at `/healthz` and proved live general and response-processor worker runtimes
  as descendants of the exact managed Turbo root before reporting zero drift.
- 2026-08-26 published-artifact proof: npm-executed devrouter 0.0.40 reported
  the matching consumer version. After an exact stop, cold `mcp` started only
  Postgres, Hatchet, the idle app container, and the MCP process. A warm
  `chat,ai,mcp` transition reached ready with LiteLLM and all three Redis
  services healthy, both managed processes running, and zero drift. One
  stale-Chat repair advanced the runtime generation as designed; the following
  steady-state repeat retained every exact container ID and both process PIDs.
  An unknown profile failed at configuration validation and read-only status
  confirmed the prior `ai,chat,mcp` state remained ready with zero drift.
- Required delivery layer: locally committed, release-compatible consumer
  package with exact runtime stopped.
- Achieved delivery layer: Integrated local implementation, released upstream
  dependency, and source-built plus published-artifact runtime proof.
- Next action: Run final review, publish the Klicker branch and PR update, then
  stop the exact runtime and prove no owned resource remains active.
