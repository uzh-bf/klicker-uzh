# Public ARM64 runner hardening and optimization

Status: proposed; not yet approved

## Goal

Lock the `public-pr-arm64` runner group to the KlickerUZH repository and its
trusted reusable Playwright workflow, reduce repeat CI work with trusted ARM64
cache warming, and provide one safe administrator-host command for reconciling
both runner VMs without rebuilding or re-registering them.

Package the resulting onboarding procedure as a shared skill so another public
repository can be assessed and added later without weakening the current
Klicker-only policy by accident.

## Non-goals

- Do not rebase or merge the dirty primary checkout.
- Do not reinstall, reset, re-register, or replace the eight existing runners.
- Do not change the `trusted-arm64` group or grant a public workflow access to
  private repositories.
- Do not run fork pull requests, secret-bearing jobs, releases, deployments,
  publication, or private-network jobs on the public pool.
- Do not add shared writable host caches, unbounded cleanup, kernel tuning,
  external monitoring agents, or a custom CI image without measured evidence.
- Do not merge the implementation PR or push the shared dotfiles repository
  without separate authority.

## Plan identity

- Repository: `uzh-bf/klicker-uzh`
- Plan: `project/2026-08-29-arm64-runner-operations-plan.md`
- Branch: `rs/arm64-runner-operations`
- Worktree: `trees/rs/arm64-runner-operations`
- Target: `v3`
- Baseline: `origin/v3` at `f0659e1301254320b2f67a0a4be752ebf6a41c0f`
- Historical plan:
  `project/2026-08-29-public-arm64-playwright-followup-plan.md`
- Related shared-skill repository:
  `/Users/rschlae/.homesick/repos/dotfiles` on direct-default branch `master`

## Execution contract

- Boundary owner: self.
- Execution owner: main session. The user's existing no-subagent instruction
  applies to implementation, skill evaluation, and review.
- Ceremony: full path because the package changes CI, a public-code execution
  trust boundary, organization settings, and runner-host administration.
- Authority after approval: edit and commit the plan and in-scope Klicker files;
  run static and repository-native checks; create focused local commits; push
  `rs/arm64-runner-operations`; open or update one PR targeting `v3`; monitor
  exact-head non-review CI; create and locally commit the new shared skill using
  explicit paths only; apply the exact `public-pr-arm64` organization policy
  after the user supplies local authenticated execution.
- Withheld: upstream merge or rebase; PR merge; runner-host `--apply`; runner
  reset or registration; `trusted-arm64` changes; branch/worktree deletion;
  dotfiles push; secrets in prompts, commands, files, or transcripts.
- Terminal: the Klicker PR exists and passes its exact-head non-review checks;
  the live runner-group readback matches the exact policy below; both public
  hosts pass the new reconciler's `--check`; the shared skill and its sequential
  evaluations are locally committed; the first post-merge cache benchmark is
  either recorded or explicitly marked as awaiting merge authority.
- Pause: stop if the group is inherited or workflow restrictions are read-only;
  the exact workflow is absent on `refs/heads/v3`; repository access contains an
  unexpected repository; any runner is busy before a required restart; a host
  differs from its managed state; a token or host secret would have to be
  disclosed; or implementation changes the trust model above.

## Current evidence

- `origin/v3` contains only one workflow that targets `public-pr-arm64`:
  `.github/workflows/public-pr-playwright-shards.yml`.
- `test-playwright.yml` calls that reusable workflow at `@v3`; the jobs that
  directly target the self-hosted group are defined in the reusable workflow.
- The reusable workflow denies pushes, private repositories, fork PRs, drafts,
  bots, and disabled rollout before checkout. Public jobs have `contents: read`,
  receive no secrets, and use restore-only caches.
- Run `33249980839` built 21 tasks in about 3m06s with `0/21` Turbo cache hits.
  Its total ARM64 build job was about 3m53s. Shard setup was about 2m29s to
  2m38s, while app startup and tests remained the dominant cost.
- The eight-runner proof scheduled all shards immediately across
  `public-pr-arm64-01` through `-08`. Capacity is working; repeated build and
  setup work is the next measured opportunity.
- The source documentation still states that workflow restrictions are not
  enforced. Live organization settings cannot currently be read because the
  host `gh` credential is invalid. Source state is not live-policy proof.
- The primary Klicker checkout is 125 commits behind `origin/v3`, one commit
  ahead, and dirty with unrelated work. This plan uses a new clean worktree.
- The shared dotfiles checkout is on direct-default `master`, eight commits
  ahead of `origin/master`, and dirty in unrelated paths. A new skill must use
  explicit path staging and must not absorb or rewrite that work.

## Decisions

### Exact live runner-group policy

The policy reconciler will fail unless it can establish and read back this
complete state:

```text
organization: uzh-bf
group: public-pr-arm64
inherited: false
visibility: selected
allows_public_repositories: true
restricted_to_workflows: true
workflow_restrictions_read_only: false
selected repositories:
  - uzh-bf/klicker-uzh
selected workflows:
  - uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3
group runners:
  - public-pr-arm64-01 through public-pr-arm64-08, with no extras
```

Only the reusable workflow belongs in `selected_workflows`. GitHub grants
runner-group access to jobs directly defined in selected workflows; the hosted
caller and hosted status job do not target the group.

The group may later select another public repository only through a reviewed
policy change that adds both that repository and its exact default-branch
workflow. The current implementation hard-codes the single-repository policy
so a casual CLI argument cannot broaden access.

### Cache ownership

A trusted `push` or manual run on `v3` may write ARM64 pnpm-store and Turbo
caches from a GitHub-hosted ARM runner. Public PR jobs remain restore-only and
treat restored files as untrusted build inputs. Cached paths contain no tokens,
credentials, private source, environment files, or generated secret-bearing
configuration.

### Host reconciliation

The user runs one administrator-host controller. It verifies both VMs first,
uploads a checksum-pinned remote payload, applies hosts one at a time, and
verifies all four runner services before moving to the second host. It has no
arbitrary remote-command option and stores neither host addresses nor tokens in
the repository.

The first desired-state revision adds bounded local resource telemetry and
pre-pulls the images used by the pinned `v3` workflow. It does not alter runner
registration, workspaces, Docker data, UFW, users, SSH, storage, or OS packages.
It restarts a runner service only when its `.env` hook configuration changed,
and refuses to do so while any `Runner.Worker` is active.

### Shared onboarding skill

Create `rs-github-runner-onboarding` as a shared skill. Do not extend
`rs-local-github-actions`: that skill runs workflows locally with `act`, while
this procedure classifies remote trust, edits hosted CI routing, manages runner
group policy, and proves live capacity.

The shared skill is read-only by default. It produces an eligibility decision,
settings delta, workflow design, canary, rollback, and evidence checklist.
External settings, runner hosts, publication, and merges remain separately
authorized actions.

## Research

- GitHub runner groups support both selected-repository access and selected
  workflow access. Workflow references use the full owner, repository, path,
  and qualified ref. Only jobs directly defined in an allowed workflow can use
  the group. Source:
  [Managing access to self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access).
- The organization API updates workflow restrictions separately from replacing
  the selected repository IDs. A fine-grained token needs organization
  `Self-hosted runners: write`; repository metadata read is also required by
  repository-access endpoints. Source:
  [REST API endpoints for self-hosted runner groups](https://docs.github.com/en/rest/actions/self-hosted-runner-groups).
- Default-branch caches are available to PR workflows. GitHub recommends a
  trusted default-branch writer and restore-only operations in low-trust
  workflows; caches must not contain secrets. Source:
  [Dependency caching reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
- Runner job-started and job-completed hooks execute synchronously as the runner
  service account and have no built-in timeout. Telemetry hooks therefore need
  an explicit short timeout and must not become a cleanup or security boundary.
  Source:
  [Running scripts before or after a job](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts).

Limitations: no current authenticated runner-group readback is available; host
resource telemetry is not yet collected; performance acceptance therefore uses
the measured successful run above and requires a fresh post-change sample.

## ADR gate

No new ADR is planned. The public-runner trust boundary and hosted fallback
already exist in the repository. This package tightens an operational policy,
adds reversible cache warming, and adds administration tooling. Re-open the ADR
gate if a later change allows fork PRs, secrets, private-network access, a
shared writable host cache, a central cross-repository reusable workflow, or
ephemeral autoscaling.

## Delivery topology

| Package | Owner | Delivery | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Klicker runner operations | main | One PR to `uzh-bf/klicker-uzh:v3` | Current `origin/v3` | Static checks, exact-head CI, live group readback, host `--check` |
| Shared onboarding skill | main | Scoped local commit on dotfiles `master`; no push | Klicker contracts and scripts settled | Three sequential skill evaluations meet their assertions |
| Live runner-group policy | user-local authenticated execution | GitHub organization settings | Policy script exists and current workflow exists on `v3` | API readback exactly matches the declared policy |
| Host desired state | user-run controller | Two existing public VMs | Host script reviewed; all runners idle | Rolling apply and post-apply verification; not authorized by plan approval |

## Delegation map

All slices stay in the main session because the user instructed that subagents
and review passes be skipped. This is an explicit override of the workflow's
normal planner and reviewer routes. The main session owns design, edits,
verification, integration, and evidence. The user owns only local credential
entry and any separately approved host apply.

## Test portfolio

| Consequential behavior | Existing evidence | Obligation | Stable seam | Owning slice |
| --- | --- | --- | --- | --- |
| No unlisted repository can target the group | Provisioner checks selected visibility only | Add exact policy fixture tests and live API readback | Policy script JSON comparison | S0 |
| No unlisted workflow can target the group | Source docs say allowlist is absent | Require one qualified workflow and fail on extras | Runner-group API response | S0 |
| Klicker public Playwright remains schedulable | Eight-runner run `33249980839` | Exact-head PR run uses named public runners | GitHub job runner names | S0/S5 |
| Public PRs cannot write shared caches | `actions/cache/restore@v4` already used | Preserve restore-only public workflow | Workflow YAML assertions | S1 |
| Trusted ARM cache can be restored by PR jobs | Current run reports misses | Add trusted writer and prove a hit | Cache outputs and Turbo summary | S1/S5 |
| Host update cannot interrupt active jobs | No general reconciler exists | Refuse apply when any worker is active | Fake-SSH tests and remote preflight | S2 |
| Host update does not re-register or erase runners | Existing provision/reset scripts are separate | Forbid registration, reset, Docker prune, and workspace deletion | Static script assertions and host check | S2 |
| Hooks cannot hang jobs or expose environment values | No hooks exist | Bound runtime, log fixed metrics only, exit safely | Hook unit tests and journal output | S2 |
| Another repository is rejected or onboarded safely | No shared skill exists | Cover eligible, ineligible, and ambiguous repositories | Skill evaluations | S4 |
| Required hosted status remains authoritative | Existing `test-playwright-status` | Preserve route complement and status semantics | Workflow syntax and exact-head check | S3/S5 |

## S0: Reconcile and lock the organization policy

- Problem: repository selection alone lets any workflow in the selected
  repository target the public pool when it knows the group and labels.
- Evidence: current source documentation explicitly says workflow restrictions
  are not enforced. The reusable workflow now exists on `v3`, so the temporary
  bootstrap exception is no longer needed.
- Decision: add `util/reconcile-public-pr-arm64-runner-group.sh` with immutable
  organization, group, repository, workflow, and expected runner names.
- Do: support `--check` and `--apply`; prompt for a short-lived token on the
  controlling terminal without echo; require one exact group; reject inherited
  or read-only policy; verify the workflow exists at `refs/heads/v3`; replace
  repository access with only the Klicker repository ID; patch the group with
  selected visibility and one selected workflow; read back group, repositories,
  and runners; print only non-secret policy fields.
- Do: use GitHub's current JSON API and a temporary in-memory `GH_TOKEN` for
  `gh api`. Do not modify the user's stored `gh` credential.
- Check: `bash -n`, ShellCheck when available, fake-`gh` fixture tests for exact,
  drifted, inherited, read-only, extra-repository, extra-workflow, and partial
  API failure cases; live `--check` after `--apply`.
- Acceptance: the live readback equals the Exact live runner-group policy above,
  and the current PR still schedules its public jobs on named pool runners.
- Route: main. Execution-tier skip reason: security-sensitive external setting.
- Commit: `ci(runners): lock public ARM64 runner access`

## S1: Warm trusted ARM64 caches

- Problem: the successful public build spent about three minutes compiling with
  zero Turbo hits, while the public workflow intentionally cannot publish a
  shared cache.
- Evidence: run `33249980839` reported `0/21` cached tasks and no matching ARM64
  pnpm or Turbo cache.
- Decision: add one GitHub-hosted ARM workflow that writes only trusted `v3`
  cache entries. Keep public PR jobs restore-only.
- Do: add `.github/workflows/warm-public-pr-arm64-cache.yml` on relevant `v3`
  pushes and manual dispatch; run `ubuntu-24.04-arm` in the same pinned
  Playwright container; use Node and pnpm versions from the repository; restore
  and save the same ARM64 pnpm-store and `.turbo` paths and key prefixes used by
  the public workflow; run frozen install and the same test build command.
- Do: report cache key, exact hit/fallback state, cache sizes, install time,
  build time, and Turbo task counts without printing cache contents.
- Do: retain the current one-build/eight-shard artifact handoff. Do not cache
  final application artifacts across PR source revisions.
- Check: actionlint or repository YAML validation when available; Prettier;
  key/path equivalence assertions between writer and reader; workflow permission
  audit; a trusted `v3` writer run followed by an eligible PR run.
- Acceptance: the public workflow still contains no cache-save action; the
  trusted writer completes without secrets in cached paths; the next eligible
  PR restores at least one base-branch ARM64 cache and reports more than zero
  Turbo hits. Record timings even if the speed threshold is not met.
- Performance decision: keep the change only if three eligible samples reduce
  median public build duration by at least 20 percent or remove at least 60
  seconds without increasing workflow failures. Otherwise retain pnpm warming
  only and remove ineffective Turbo caching.
- Route: main. Execution-tier skip reason: critical-path coupling with the
  runner security contract.
- Commit: `perf(ci): warm trusted ARM64 Playwright caches`

## S2: Add one safe runner-host reconciliation command

- Problem: provisioning and reset scripts exist, but there is no idempotent way
  to apply later host-level improvements to both existing public VMs.
- Decision: add one user-facing controller,
  `util/reconcile-public-pr-arm64-pool.sh`, plus its checksum-pinned remote
  payload `util/reconcile-hetzner-arm64-runner-host.sh`.
- Do: accept `--check|--apply`, `--host-a`, `--host-b`, and optional SSH identity;
  accept only validated addresses; discover root or `runner-admin`; preflight
  both hosts before any write; verify Ubuntu ARM64, managed public profile,
  runner names `01-04` on host A and `05-08` on host B, UFW SSH-only ingress,
  Docker health, disk cleanup timer, free disk, and no active `Runner.Worker`.
- Do: upload the repository-pinned remote payload to a temporary path, verify
  its SHA-256 remotely, install it root-owned, and reconcile host A then host B.
  Stop on partial failure and report the exact converged host; do not attempt a
  destructive rollback.
- Do: install short, root-owned telemetry hooks outside runner application
  directories. Each hook uses an explicit timeout, logs only runner name, UTC
  time, load, available memory, root-disk use, and aggregate Docker disk use to
  journald, and exits safely. Update each runner `.env` and restart only changed
  idle services.
- Do: pre-pull the exact job and service image tags referenced by trusted `v3`.
  A cached layer is reused by all four runner processes on a host. Do not
  install Node, pnpm, or browsers on the host because jobs execute inside the
  Playwright container.
- Check: `bash -n`, ShellCheck, fake-SSH tests for two-host preflight, busy host,
  checksum mismatch, partial apply, no-op apply, and service verification;
  inspect scripts for reset, registration, prune, workspace deletion, package
  upgrade, secret logging, and arbitrary command paths.
- Acceptance: local `--check` reports both current hosts healthy without
  changes; fixture `--apply` is idempotent; the user can later run one command
  to reconcile both hosts. Actual host `--apply` remains separately approved.
- Route: main. Execution-tier skip reason: security-sensitive host boundary.
- Commit: `chore(runners): add public pool host reconciliation`

## S3: Make performance evidence durable

- Problem: GitHub job timing proves workflow phases, but host contention and
  cache effectiveness are not visible together.
- Decision: use existing job summaries plus local bounded hooks. Do not add an
  external metrics service in this package.
- Do: add cache and phase summaries to the trusted writer and public build; keep
  runner names and shard allocation; document commands for reading the two host
  journals and correlating by UTC time and runner name.
- Do: keep eight shards, four runner processes per 16-vCPU/32-GB host, one build
  artifact, hosted fallback, and the hosted required status job unchanged.
- Do: make `max-parallel: 8` explicit only if schema validation confirms it does
  not alter current behavior. Do not add per-process CPU or memory limits until
  telemetry proves one job harms another.
- Check: workflow diff audit, route predicate equivalence, status-job semantics,
  no secret-bearing summary values, and exact-head artifacts for all shards.
- Acceptance: one evidence table can report queue, prepare, build, cache,
  install, shard setup, test, runner name, and host pressure for a complete run.
- Route: main. Execution-tier skip reason: critical-path coupling.
- Commit: fold into S1 or S2 unless the diff is independently substantive.

## S4: Create the shared onboarding skill

- Problem: the runner pool can serve another public repository, but the safe
  trust classification and GitHub policy sequence currently live only in this
  repository and conversation history.
- Decision: create
  `agent-resources/agent-skills/rs-github-runner-onboarding/` in the shared
  dotfiles repository. Keep it provider-neutral within GitHub and
  repository-neutral.
- Do: define triggers for onboarding a repository or workflow to an existing
  self-hosted GitHub runner pool; map current runner groups, repositories,
  workflows, labels, capacity, and branch protection; classify public
  same-repository PR, fork PR, private/trusted, secret-bearing, deploy, and
  ambiguous jobs; require container/image ARM64 compatibility and service
  isolation; design hosted fallback and an always-reporting required status;
  produce the exact repository/workflow policy delta, canary, rollback, and
  live-proof checklist.
- Do: default to read-only discovery. Require explicit authority for policy
  writes, workflow publication, runner changes, retries, and merge. Refuse to
  solve unsafe workloads by passing secrets or private access to the public
  pool.
- Do: include references for the trust matrix, GitHub runner-group API contract,
  workflow-call/direct-job rule, cache ownership, capacity fairness, and
  onboarding report format. Link the Klicker scripts as one concrete example,
  not a mandatory implementation.
- Check: run three sequential main-session evaluations because subagents are
  disabled: an eligible public Playwright repository, a fork/secret-bearing
  ineligible repository, and a public ARM64 integration-test repository sharing
  the pool. Require correct trust verdict, exact settings delta, hosted fallback,
  no unauthorized write, and a verifiable canary in each output.
- Acceptance: the skill produces a complete safe plan for all three cases and
  does not recommend broad repository or workflow access. Human review confirms
  the outputs are reusable rather than Klicker-specific.
- Route: main. Execution-tier skip reason: explicit user no-subagent boundary
  and dirty direct-default skill repository.
- Commit: `feat(skills): add GitHub runner onboarding workflow` using explicit
  skill paths only. Do not push the dotfiles repository.

## S5: Verify, document, and publish the Klicker package

- Problem: source scripts and a green syntax check do not prove organization
  policy, runner availability, cache reuse, or runtime performance.
- Do: update `docs/ci-and-deployment.md` and `docs/testing.md` with the enforced
  workflow allowlist, policy and host check commands, cache writer/reader
  boundary, measured results, rollback, and another-repository onboarding gate.
- Do: correct the historical follow-up plan's S3 progress to record merged PR
  `#5648` and its merge commit. Preserve it as history; do not reuse it as this
  plan.
- Do: run focused script tests, workflow validation, formatting, and the
  repository's relevant static checks. Inspect every staged file for tokens,
  host addresses, private data, and unrelated changes before each commit.
- Do: apply the runner-group policy through the new script using user-local
  short-lived authentication, immediately rerun `--check`, and revoke the token.
  This changes organization policy only; it does not restart runners.
- Do: push the complete branch and open one PR to `v3`. Monitor the exact head,
  ignore optional AI/code reviews as requested, and require the existing hosted
  status plus public runner-name evidence. Do not merge without explicit
  authority.
- Do: after merge authority is separately granted and the trusted cache writer
  succeeds on `v3`, record three eligible PR samples. Keep or narrow Turbo cache
  warming according to S1's measured threshold.
- Check: exact GitHub API policy readback, all eight expected group runners, host
  `--check`, exact-head required check runs, cache writer logs, PR runner names,
  eight shard artifacts, and `test-playwright-status`.
- Acceptance: settings are locked to Klicker and the one `v3` workflow; the PR
  is reviewable and green; host changes remain optional and executable through
  one command; the first benchmark boundary is explicit.
- Route: main. Execution-tier skip reason: external state and final integration.
- Commit: `docs(ci): document ARM64 runner operations` followed by any verified
  plan progress update required before publication.

## Rollback

- Runner-group policy: rerun the policy script in `--check` mode first. A policy
  rollback may restore the previously captured non-secret JSON only with a new
  explicit approval; never broaden to `all` as an emergency fallback. Hosted
  Playwright remains the safe fallback if self-hosted scheduling fails.
- Cache writer: disable its trigger or revert the workflow. Public jobs remain
  functional on a cache miss and never depend on cache availability.
- Host hooks: the controller removes only its exact `.env` keys and root-owned
  hook files, then restarts idle affected services. Existing runner credentials,
  work directories, Docker data, users, firewall, and SSH remain untouched.
- Cross-repository onboarding: remove both the repository ID and its workflow
  reference in one reviewed policy change. Never leave repository access broader
  than workflow access or vice versa.

## Progress

- [x] Current `origin/v3`, primary-checkout divergence, prior plan, workflows,
      provisioners, documentation, and closest shared skill inspected.
- [x] Exact runner-group contract confirmed against current GitHub documentation.
- [x] Clean task branch and worktree created from `origin/v3`.
- [x] User approved this plan and its named external policy boundary.
- [ ] S0 locks and proves the live runner-group policy.
- [ ] S1 adds and proves trusted ARM64 cache warming.
- [ ] S2 delivers the idempotent two-host reconciliation command.
- [ ] S3 records cache and host performance evidence.
- [ ] S4 creates and evaluates the shared onboarding skill.
- [ ] S5 publishes and verifies the Klicker PR; merge remains separate.
