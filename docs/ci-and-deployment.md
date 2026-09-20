---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-09-20'
tags:
  - ci
  - deployment
---

# CI & Deployment

**The deploy driver is ArgoCD** (confirmed with maintainers; the ArgoCD `Application`/sync trigger itself lives outside this repo). What IS in-repo: the chart (`deploy/charts/klicker-uzh-v3/` — internally still named `klicker-uzh-v2`, chart version drifted behind the repo version), per-env values (`deploy/env-uzh-stg`, `deploy/env-uzh-prd`), Stakater **Reloader** annotations (`reloader.stakater.com/auto: "true"`) so config/secret changes restart pods, and an ArgoCD **PreSync migration hook** that runs `prisma migrate deploy` before each rollout — enabled on stg and prd (see [Deployment migrations](#deployment-migrations)).

## Draft sync PR maintenance

`maintain-draft-sync-prs.yml` maintains the exact forward pairs `v3` ->
`v3-ai` and `v3-ai` -> `v3-audit`. It opens a draft only when the source has
commits and a non-empty diff absent from the target and no matching open PR.
Existing PR descriptions and draft/ready states are preserved. Source pushes
already update their diffs, so maintenance does not edit PR metadata, update
branches, resolve conflicts, merge, or enforce merge methods. Maintainers choose
when to mark ready and merge with a merge commit to preserve ancestry.

The controller runs from `v3` after Check codebase completes for a push to
either source branch, regardless of the check result. Completion is a wakeup,
not a merge-readiness signal. Both pairs are reconciled against current refs on
every run; delayed or coalesced events do not replay old heads. The workflow
checks out its own trusted workflow SHA, never the triggering branch or its
artifacts. It becomes active when merged into `v3`, without waiting for the
workflow to reach the integration branches.

For manual reconciliation, dispatch from `v3`. Preview is the default:

```bash
gh workflow run maintain-draft-sync-prs.yml --ref v3 -f dry_run=true
gh workflow run maintain-draft-sync-prs.yml --ref v3 -f dry_run=false
```

The ordinary `GITHUB_TOKEN` has contents-read and pull-requests-write access;
GitHub Actions must be allowed to create PRs in repository settings. No separate
bot credential is needed. GitHub may require approval before running workflows
for token-created PRs. Drafts skip staging image builds and some analysis, but
other PR checks and source-branch push CI can still run. Marking ready invokes
the existing ready-state validation; required checks must pass before merging.

Closing a sync PR without merging does not pause maintenance: the next eligible
run may create a new draft if changes remain. Conflicts remain a maintainer
task. Avoid Update branch on these PRs because it merges the target back into
the long-lived source branch. An API failure is reported rather than treated
as evidence that a PR exists; a duplicate-creation response is accepted only
after the matching open PR is found.

### Changing the sync chain

The `PAIRS` constant in [draft-sync-prs.cjs](../.github/scripts/draft-sync-prs.cjs)
is the authoritative list of automated source (`head`) and target (`base`)
pairs. Branch names matching `v3-*` do not enroll themselves. Change this list
only for an explicitly approved integration-chain change; ordinary feature
branches and reverse release promotions remain outside automatic maintenance.

When adding, renaming, reordering, or retiring an integration branch, agents
must update the following together in the same PR:

1. Update `PAIRS` to contain exactly the approved adjacent forward hops, removing
   obsolete pairs without introducing shortcuts or reverse pairs.
2. Set `on.workflow_run.branches` in
   [maintain-draft-sync-prs.yml](../.github/workflows/maintain-draft-sync-prs.yml)
   to the distinct source branches in `PAIRS`. Verify that Check codebase still
   runs on pushes to every source; its name must match the workflow subscription
   and controller event guard.
3. Update the structured pair and event expectations in
   [draft-sync-prs.test.cjs](../.github/scripts/draft-sync-prs.test.cjs), retaining
   coverage that every new PR is a draft and unapproved sources are rejected.
   Update the chain in `AGENTS.md` and this page to match.
4. Run the focused controller tests and, after the controller change reaches
   `v3`, its manual dry run. Check the reported pairs against the approved chain
   before relying on automated creation.

Removing a pair stops future maintenance but does not close or retarget its
existing PR. Report any such PR for explicit disposition. Branch deletion,
merge authority, and staging-source configuration remain separate decisions.

## Required branch checks

The required baseline for PRs into `v3` and `v3-*` is `check`,
`check-gitleaks`, `test-graphql-status`, `test-playwright-status`,
`test-unit-status`, `test-olat-api-status`, `test-intl-production-status`, and
`build-images-status`. Selected suites must pass; a validated no-change
selection may succeed without an irrelevant suite. Missing, cancelled, failed,
or unexpectedly skipped evidence blocks the summary. Ready PRs require the
full eight-shard Playwright run unless the changed paths resolve to a bounded
change class, in which case the ready run carries that class’s bounded
envelope (see **Minimum validation envelope** under PR gates below); adding one
application file to the same diff restores the full envelope.

One `v3_images-stg.yml` workflow owns every staging image. Its `plan` job
resolves the changed-image selection at run time from the trusted inventory in
`.github/scripts/staging-image-targets.cjs` instead of through per-image path
filters, so a single run covers every affected image. Each target declares the
transitive workspace dependency closure of its image. Every Dockerfile runs
`turbo prune --scope=<workspace package> --docker`, so only those directories
can reach the build. A change to a package the image never bundles no longer
triggers it: `packages/transactional` and `packages/prisma-data` select only
chat, `packages/word-cloud` and the other frontend-only shared packages select
the six Next images, and `packages/export` selects none. Root manifests,
`turbo.json` and `.dockerignore` select every node target, and a push to
`v3`/`v3*` still builds all of them because the plan selects every available
target for a push. `staging-image-plan.test.cjs` derives each closure from the
workspace manifests, so adding a workspace dependency to an image without
widening its target fails the suite rather than silently skipping a needed
build.

Repository administrators may bypass CI on stable `v3` and on integration
branches only through a pull request; direct updates, force pushes, and deletion
remain protected on both. Stable `v3` still requires code-owner review,
resolved discussions, linear history, and strict up-to-date status checks, while
integration branches require none of those. A merge override does not qualify a
staging candidate:
promotion independently requires exact candidate push validation and images.
Older integration branches must receive the reporting workflows before they
can satisfy this baseline.

Biome and Knip advisory steps, AI reviews, CodeQL analysis, and the SonarCloud
analysis remain outside this deterministic required baseline. The SonarCloud
workflow waits for the quality gate, so a failing gate fails that workflow
instead of leaving a green run beside a red gate, and it fails closed with a
named reason when an event cannot receive the analysis credential. Neither
workflow is a required status check. Those checks must not be described as
enforced test results.

## PR gates

GraphQL and lightweight unit CI build their dependencies through scoped Turbo
`build` graphs with at most four tasks running concurrently. The GraphQL graph
includes the general worker and feature-flags package. Unit CI builds only
Prisma, types, grading, and util; it does not add Chat or PWA application builds.
Database setup and tests still run after successful dependency builds.
These jobs retain the hosted pnpm cache but do not restore the Playwright
Turbo snapshot: its `build:test` task identities and test-container environment
are not compatible with these hosted `build` tasks.

The shared `setup-node-pnpm` action preserves setup-node v4's exact lockfile key,
runner OS/architecture, and pnpm store path. Only successful codebase-check push
jobs write this cache; GraphQL, unit, and all PR jobs restore only. Every reader
still performs a frozen install. Dependency-changing PRs may download packages
on repeated runs until a matching push cache is available, and a failed check
push does not seed it. This reduces future duplicate PR entries without deleting
existing caches or changing storage allowances. A harmless setup-node post step
can remain on readers; verify the absence of cache upload attempts, not of post
steps. Playwright's separate trusted seed and cache contracts are unchanged.

Per-commit workflows: required `check` (one install covering format, syncpack,
lint, schema and guide drift, incremental builds and types, the rendered chart's
scheduling contract, plus advisory Knip) and required `check-gitleaks`. Branch
protection binds both contexts to GitHub
Actions and no longer requires the former split check jobs. The Node/pnpm
workflow uses pnpm 11.5.0, pins Node 24 via the root Volta configuration
(`package.json`), and uses the Turbo remote cache; `check-gitleaks` is a
standalone secret scan that installs the Gitleaks binary directly and needs
neither Node nor pnpm.

For a pull request whose changed paths resolve to a bounded class, the codebase
check keeps that class's contract suites and skips its application-wide steps;
see **Bounded codebase check** below. Pushes always run the full suite.

- **Path filtering**: A custom composite action `.github/actions/changed-paths` executes on PR events. Heavy multi-job test suites (e.g. `test-graphql` and `test-playwright`) run path-scoped filters to only build and spawn backing services (Postgres, Redis, Hatchet) when relevant files are changed. A pull_request `edited` event that only changed PR metadata (title or body) leaves the merge tree unchanged, so a suite may skip only when its own required-status context already completed successfully for this head; a failed, pending, or unavailable prior result re-runs the suite, so editing a PR title can never turn a failed suite green. Workflows that enable that lookup pass the stable terminal context name and declare `checks: read`. An `edited` event carrying `changes.base.from` is a base retarget and still computes the real diff, so the merge input always re-selects when it changes. The action fetches the base ref shallowly **only when the clone is already shallow**; on a full clone, adding a shallow graft can truncate a stacked PR's history and break later merge-base-dependent commands. The required `check` workflow uses the same action with an unrestricted pattern and reuses its suite only for a validated metadata-only edit; a job that always runs reports its required context, so an unexpected skip, a cancellation, or a failed suite still fails the check.
- **Playwright build handoff**: Each Playwright build job (hosted and public-PR) uploads the built GraphQL package, and each shard restores its generated client map into the source path used by the course-sharing specs. This keeps cached Turbo builds and uncached builds equivalent without regenerating the package eight times.
- **Minimum validation envelope**: One repository-owned classifier (`.github/scripts/minimum-validation-class.cjs`) turns the rename-aware changed-path records into exactly one change class and the decisions that class requires: `documentation-and-planning` for Markdown and assets under `docs/`, `project/`, and `.agents/skills/`, which runs no Playwright, no application build, and no static analysis; `ci-orchestration` for `.github/workflows/` and `.github/scripts/`, which runs a bounded Playwright selection, a bounded codebase check, and still the static analysis, because `.github/scripts` is analyzed source and a workflow file is analyzed input; and `application` for everything else. It fails closed: an empty, unresolvable, renamed, copied, or deleted diff, a path outside those trees, a mixed documentation-and-CI diff, and a root `README.md` or `AGENTS.md` all expand to the application envelope. The class travels with the run: the Playwright plan artifact and its `envelope_class` output carry it into the required status reporter, the codebase check uploads a classification receipt naming the paths that justified the class, and `.github/actions/change-envelope` is the one adapter every lane calls. Narrowing applies to pull requests only, so every push validates a deployment candidate in full whatever the class of its changed paths. A lane reads an empty or unreadable decision as the full envelope, and a classifier failure widens the lane with a warning instead of failing it, so a broken classification can neither remove validation nor block a required context. Class boundaries are reviewable source changes, and the reduced coverage a bounded class accepts is an explicit review contract rather than a silent path filter.
- **Bounded codebase check**: A pull request whose class is bounded still installs dependencies and still runs every contract suite that can falsify the class, including the CI queue and workflow contracts, the Playwright CI contracts, formatting, syncpack, and the documentation and policy drift checks; it deliberately skips the application-wide steps, which are the Turbo build, the TypeScript check, ESLint, Biome, Knip, and the Prisma schema-sync drift check. Pushes run all of them. The envelope is computed inside the suite job, on the checkout it already performs, so it never delays the suite behind a second runner allocation, and every skipped step is gated on its class output, so an unproven class runs it.
- **Playwright cache contract**: The pnpm store uses a stable dependency fingerprint containing Node/pnpm compatibility, the lockfile, workspace configuration, package manifests, `.npmrc`, `.pnpmfile.cjs`, and tracked patches. It does not create a duplicate store for each source commit or invalidate dependencies for a telemetry-only workflow edit. The separate `.turbo` fingerprint retains the conservative build configuration, synthetic environment schema, and immutable build-image contract, with source-specific snapshots. Both cache families include OS and architecture in their keys. The trusted `v3` cache-seed matrix builds on hosted ARM64 and x64 runners and is the only writer; public PR jobs remain restore-only readers. Restore stays disabled for PRs until a global or exact canary control enables it. Cache-service errors fall back to an ordinary install/build, while actual build failures remain failures. Compact build, shard, route, selector, and queue telemetry is retained for seven days; large build outputs and diagnostics keep their existing short retention. Seed telemetry artifacts include the architecture in their names. The hosted, checkout-free Playwright status job collects queue telemetry with only `actions: read` permission; telemetry errors do not alter the test result. Configuration and successful seeding are not performance proof: verify compatible matched keys, Turbo task hits, output equivalence, and a normalized comparison cohort before claiming a speedup.
- **Profile-aware Playwright runtime**: `playwright/profiles.json` assigns every active spec exactly once and the timing-aware sharder emits the canonical profile union for each shard. Exact `@devrouter/cli` `0.0.72` resolves that union and validates it against the repository-owned `playwright/runtime-contract.yml` without runtime access. When the trusted planner assigns a candidate-only spec to `full`, the adapter resolves that trusted union through the explicit `playwright` Devrouter profile, which covers every CI-supported application without selecting local-only MCP, LiteLLM, or MailHog resources. Activity-lifecycle specs that publish, schedule, start, or end activities select `live-quiz` because it owns both Hatchet workers. Both hosted and public-PR workflows fail closed when planning is unavailable or unexpected, then start only the selected app processes without exposing the host Docker socket. A caller checkout created before profile runtimes existed may use the explicit legacy full-stack startup only when all three profile-runtime files are absent; partial migrations fail closed. The job-level Postgres, Redis, and Hatchet containers remain fixed. The corrected manifest selects 57 app and worker process instances across eight shards instead of the previous fixed 72, a configuration-derived 20.8% reduction; this is not yet measured end-to-end speedup evidence.
- **Stacked pull requests**: The consolidated `check` workflow runs for every opened, synchronized, or reopened pull request target, including feature-branch targets used by stacked PRs. Its push trigger remains limited to `v3` and `v3*`.
- **Status reporting and cancellation**: GraphQL and Playwright status jobs report real failures and successful path skips. Draft and ready PRs run the same Playwright execution envelope. Every push and every ready PR must show successful execution in full mode with the complete eight-shard matrix; a draft may attest the narrower plan the trusted envelope selected for it, which is a partial shard set or a skip, while any other mode, a partial matrix on a full plan, unexpected skips, missing outputs, failures, and cancellations without proven supersession fail. Smart-draft selection stays off until the `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED` repository variable, or its exact-canary PR variable, enables it for an eligible same-repository draft; forks, bots, private repositories, and the force-hosted canary keep the full plan. PR closure cancels running execution through the same checkout-free no-op job; a conversion to draft no longer cancels, because the running plan stays valid evidence. They exclude workflow cancellation and canceled execution dependencies, so obsolete reporters do not keep waiting for a runner. Playwright retains one route-neutral concurrency group on its reusable-workflow caller; the called workflow has no concurrency and its sibling jobs cannot cancel each other. The status job stays outside this group. Queue telemetry and metadata uploads run in that same hosted reporter, including after test failures, and stop on cancellation.
- **Equivalent push validation**: Non-`v3` pushes may reuse completed successful hosted Playwright PR validation. Unit reuse applies to push reruns only, so initial unit validation does not acquire an extra runner or scheduling wait. The read-only gate requires one open, ready, same-repository PR with the exact head and base, an equivalent merge tree, the latest workflow run and attempt, and actual successful test coverage. A run- and attempt-bound artifact records the actual checkout tree; older runs without it cannot be reused. Playwright also requires the same trusted control revision and a matching full eight-shard plan. The summary links the reused run. Missing, stale, failed, skipped, partial, or ambiguous evidence runs normal validation. Default-branch pushes and manual runs remain independent; other workflows retain their different path/build semantics. Translation validation is already PR-only. Playwright performs its lookup inside the existing preparation job, so it can check first attempts without adding another runner allocation. Preparation inherits caller permissions: older contents-only callers continue normal validation when API access is insufficient, while updated callers forward read access to Actions and pull requests. Execution jobs retain explicit contents-only tokens.
- **Equivalent pull-request lifecycle validation**: A `ready_for_review`, `edited`, or `reopened` event on an unchanged head may validate the PR's own completed full run instead of repeating it. The same read-only gate binds the prior run to the same pull request, head, base, merge tree, trusted control revision, full eight-shard plan, latest attempt, and complete coverage of exactly the route the current event selected (hosted or public ARM64, never mixed). The validating event's own run is excluded from the candidate set, because it is always the newest run for that head and is still executing; without that exclusion the lookup could only ever reach a run that has not finished. A base retarget changes the bound base, so it always runs normal validation. The prior run's tested-source receipt must exist on the route that produced it, so both hosted and public builds record one. Push validation is never reused by a lifecycle event, and any failed or ambiguous proof runs the full suite; the reporter fails if a duplicate is ever offered on a push.
- **Playwright lifecycle guards**: Playwright execution and its status reporter run only for open pull requests or pushes. Lifecycle events on a merged or closed pull request — such as a post-merge title edit — start nothing, and the close action keeps its dedicated cancel job. `ready_for_review` is retained because the ready boundary runs the envelope so it can validate the existing full proof of an unchanged head; `edited` distinguishes base retargets (full validation) from title and body edits (reuse or full validation through the same envelope); converting back to a draft conservatively re-runs full validation.
- **Draft → ready transition contract**: Marking a draft PR ready fires `ready_for_review` on the unchanged head SHA and re-runs every workflow that lists it. Draft and ready PRs now run the same validation, so a green draft-era run stays authoritative. The validation suites (`test-unit`, `test-olat-api`, `test-graphql`, `test-intl-production`) run identically for drafts and ready PRs; they do not list `ready_for_review` and do not gate any job on `github.event.pull_request.draft`. The consolidated staging image workflow (`v3_images-stg.yml`) is the documented exception: draft pull requests defer every build leg of the selected plan (each build job gates on `github.event_name != 'pull_request' || github.event.pull_request.draft == false`; pushes always build) to relieve the constrained hosted ARM64 pool, and the workflow lists `ready_for_review` so the boundary restores the deferred builds on the unchanged head. The same run owns the required `build-images-status` context, so the image-build contract recomputes against those restored builds. Its always-reporting terminal job passes a genuine success and fails a real failure, an unexpected skip, a cancellation, or missing selection data, whether or not the pull request is a draft. `test-playwright` runs the full eight-shard suite for drafts and ready PRs alike unless the changed paths resolve to a bounded class, whose bounded Playwright selection applies in both states; at the `ready_for_review` boundary its envelope validates the draft-era full proof instead of rebuilding and retesting an unchanged head (see equivalent pull-request lifecycle validation above). The AI review and code-review workflows own their ready-boundary handoff. `ci-event-gates.test.cjs` fails any `ready_for_review` trigger without a documented lifecycle role, and fails any required suite that gates on the draft state, so the duplicate-run and draft-deferral classes cannot return silently.

- **Public PR ARM64 runners**: The exact reusable `public-pr-playwright-shards.yml` workflow is now the single backend-neutral Playwright envelope. A hosted preparation job checks out trusted `v3` control files separately from the candidate data, computes one route and one canonical selector plan, and both hosted and public execution jobs consume that same plan. The execution jobs call the trusted `v3` composite actions remotely; candidate code supplies source and tests but cannot replace the orchestration action. Every PR, draft or ready, uses the full eight-shard suite. The trusted routing always returns the ready-state selector and never selects the partial draft plan, so the draft-selection controls cannot narrow a draft even when enabled. Forks, bots, private repositories, pushes, malformed event or policy data, and disabled smart routing fall back to hosted full execution; only `route_hint: auto` is accepted, and any other hint rejects the invocation. `PUBLIC_PR_ARM64_PLAYWRIGHT_FORCE_HOSTED_CANARY_PR` can force one exact PR to hosted execution without changing the global public rollout. The build artifact archives `packages/*/dist`, so every workspace package dist is covered without a hand-maintained list. Public jobs use read-only contents permission, receive no secrets, do not persist checkout credentials, and publish no service ports. They restore available pnpm and Turbo caches but never save caches from public PR jobs. The required `test-playwright-status` gate remains GitHub-hosted and consumes the one reusable invocation result. The public runner group stays restricted to `uzh-bf/klicker-uzh` and the exact workflow `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`; no other repository or workflow can target it. Two persistent public hosts expose eight runner processes, four per host. They have no private repository or private-network access and require scheduled rebuilds plus immediate replacement after anomalies. Disk cleanup is not compromise recovery.
- **Reusable workflow reference syntax**: The Playwright caller uses `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@v3`; GitHub records that ref as `refs/heads/v3`. Keep the full `@refs/heads/v3` spelling for the organization runner-group policy and trusted composite action refs. Using the full spelling in the reusable-workflow caller creates a zero-job workflow run. The trusted cache seed also marks only its exact checked-out workspace as a Git safe directory before reading repository metadata inside its container.
- **Public ARM64 performance evidence**: The first eight-way run after rollout (`33246023106`, 2026-08-29) scheduled all eight shards simultaneously on distinct `public-pr-arm64-01` through `-08` runners. The restore-only build took 3m59s instead of the prior 7m43s cache-writing build. Shard jobs ranged from 14m30s to 21m24s; the remaining floor was spec structure, led by the 846-second serial live-quiz file. Job summaries report the prepare, build, and shard runner names, while the hosted status job records the selected route and dependency results. GitHub's own step timestamps remain the source for phase duration.
- **Closed PR execution**: Closing or merging a PR starts a checkout-free GitHub-hosted no-op in that PR's existing execution concurrency group. It cancels obsolete Playwright execution without an Actions write token. The close event does not start preparation, builds, shards, status reporting, or telemetry. Push verification uses a branch-ref key and remains independent. Cancellation is asynchronous; verify actual job termination before counting capacity as recovered. Reopening a PR resumes the normal execution path.
- **Closed PR check sweeping**: `cancel-closed-pr-checks.yml` fires only on `pull_request: closed` and joins every other per-PR workflow concurrency group through a no-op matrix leg with `cancel-in-progress`, so merged or closed pull requests also reclaim queued `check`, gitleaks, CodeQL, SonarCloud, OpenCodeReview, unit/GraphQL/OLAT/translation validation, dependency review, staging image builds, and build-fallback capacity without an Actions write token. Each matrix entry carries the target's literal group prefix — the workflow name, or `intl-production` for the translation suite whose group does not use `github.workflow`. Three entries cover the lecturer/student MCP workflows that exist only on the v3-ai and v3-audit integration branches; on v3 those legs finish as no-ops, and the gate test allowlists them as documented integration-only entries so the single v3-owned matrix stays valid across the sync chain. Playwright keeps its own dedicated cancel job, the final-review workflow owns its closed-event supersession, and push-only, `workflow_run`, dispatch, and reusable workflows have no per-PR groups. A target still waiting for its first runner can reject the joining leg with a 409 conflict; that state self-resolves, `fail-fast` is disabled, and sweeping is a large reduction rather than a guarantee. `ci-event-gates.test.cjs` fails when a per-PR workflow appears without a sweeper entry or a sweeper entry stops matching a live workflow, so renames cannot silently break coverage.
- **Playwright selector shadow**: The trusted envelope still builds the draft selector shadow plan on draft PRs, and because drafts now run the full canonical suite, that shadow observes the partial plan a draft could have used without narrowing execution. Ready transitions and subsequent ready updates run the same full eight-shard suite; integration-branch pushes retain their separate verification.
- **Organization ARM64 pool provisioning**: `util/provision-hetzner-arm64-runner.sh` provisions a fresh or explicitly reset ARM64 VM as either `public-pr-arm64-01` through `-08` or `trusted-arm64-01` through `-04`. A VM may host several isolated runner directories and services while sharing Docker and disk cleanup. `util/provision-public-pr-arm64-pool.sh` runs from an administrator host and provisions runners `01` through `04` on one fresh 16-vCPU, 32-GB VM and `05` through `08` on another. It verifies both remote platforms, pins and verifies the remote provisioner, keeps the short-lived GitHub token out of command arguments and files, proves `runner-admin` SSH before root login is disabled, and verifies every service. The matching runner groups must exist before provisioning and must use selected-repository access. The provisioner deliberately does not enforce GitHub's optional workflow allowlist, so the groups and runners can be created before their final reusable workflows exist. The public group may select only public repositories, while the trusted group may select only private repositories. Before enabling public rollout, restrict the public group to `uzh-bf/klicker-uzh` and the exact `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3` workflow. Configure trusted repository and workflow restrictions after its workflow exists; neither policy change requires runner reprovisioning. Pool assignment is immutable after provisioning because a persistent runner may retain job data. Every apply downloads the pinned runner archive, verifies its checksum, and compares an existing installation against every packaged file before reuse. The short-lived registration token enters `config.sh` through its supported environment input rather than process arguments. `util/reset-hetzner-arm64-runner-host.sh` supports the one-time conversion of the five dedicated, local-disk hosts created by the earlier Klicker-specific provisioner. It removes runner credentials, work data, the runner account, Docker packages, and all local Docker data while preserving `runner-admin`, SSH hardening, SSH keys, UFW, and OS updates. It is not compromise recovery or secure disk erasure: never use it after untrusted execution or suspected compromise, and never prepare a public-PR host if it has received repository, organization, environment, or external secrets, private data, or private source. Those cases require VM replacement. Public PR services are reachable only inside each job's Docker network, and each Playwright shard uses a run-specific Hatchet volume. The provisioner enables UFW with deny-by-default inbound traffic and OpenSSH as the only inbound allowance. Threshold cleanup removes unused Docker volumes as well as old containers, images, and builder data. Use the VM's local NVMe storage initially and add a protected volume only after monitoring shows sustained disk pressure.
- **Prisma Schema Drift**: A custom `check:prisma-sync` smoke check compares schema structures in the monorepo against mirrored schemas in `apps/analytics` to enforce database integrity.
- **Markdown Linter**: `check:agents-md` validates links and command script correctness inside the codebase guide.
- **Format + lint**: `check` runs blocking Biome + Prettier formatting and the blocking Turbo/ESLint safety net. Biome lint remains advisory. The same job also runs `check:prisma-sync`, `check:agents-md`, and `check:removed-doc-artifacts`.
- **Unused code**: `check` runs Knip **advisory** (non-blocking); ratchet it to blocking only after the per-workspace entry config is tuned.
- **Secret scanning**: `check-gitleaks` runs a **blocking** Gitleaks scan of commits introduced by the push or pull request (`.gitleaks.toml`, default ruleset + false-positive allowlist). For a branch-creation push, where GitHub supplies an all-zero `before` SHA, it fetches the repository default branch and scans from its merge base to the new tip; it fails closed when the default branch or merge base cannot be resolved. The configured push trigger covers `v3` and `v3*`; other branch names are covered when a pull request is opened or updated. A local husky pre-commit hook scans staged changes when the binary is present.
- **SonarCloud suppressions must live in `sonar-project.properties`.** Sonar reports rules such as `typescript:S3776` on the function declaration line, and Biome always moves a trailing `NOSONAR` comment onto its own line, so an inline marker silently stops suppressing after formatting. Use a scoped `sonar.issue.ignore.multicriteria` entry instead (current example: the chat POST handler's cognitive complexity).
- **Security analysis**: `codeql-analysis.yml` analyzes JavaScript/TypeScript, the analytics Python sources, and the GitHub Actions workflows with SHA-pinned CodeQL v4 actions, and runs the `security-extended` suite as a pilot; the job is not a required check. A documentation-and-planning pull request skips the analysis in both workflows, because it changes no analyzed source: each workflow computes the class in a small classify job from the same changed-path records, and each analysis gate repeats the pull-request-only boundary, so a push, the weekly CodeQL run, and any class the classifier cannot prove still analyze. `v3_sonarcloud.yml` pins the Sonar scanner, derives the project version from the root `package.json`, awaits the quality gate on a pull request, and imports LCOV coverage only from a test run that belongs to the analyzed head and recorded the same tested source tree, rewriting the imported report paths to repository-relative form (`.github/scripts/sonar-coverage-inputs.cjs`, `.github/scripts/sonar-coverage-transport.cjs`); a missing or unverified report leaves coverage "not computed" in SonarCloud instead of reporting a satisfied metric, and no coverage threshold is armed yet. `.github/workflows/sonar-analysis.yml` holds the single analysis definition, and `v3_sonarcloud.yml` (branch push and ready-for-review boundary) and both coverage producers call it, so the analysis has one definition instead of one per host: the producer run that observes every producer terminal imports the coverage and analyzes, and a run that still sees a queued producer defers with a named reason instead of holding a runner, so no analysis job waits for a queued test run. At most one analysis is published per pull request, head, and base: a successful scan uploads a receipt artifact named for that revision, a later host that finds the receipt defers, and an explicit re-run (`github.run_attempt > 1`) ignores it and analyzes again. Fork and Dependabot pull requests cannot receive `SONAR_TOKEN`, so their analysis fails closed with a named unavailable result rather than an authorization error. **New-code definition**: SonarCloud fixes a branch's type at its first analysis and never changes it, and the type decides what new code means. A long-lived branch — the main branch, or a name matching the organization's `sonar.branch.longLivedBranches.regex` pattern — uses the project New Code definition. A short-lived branch has no project definition: its new code is everything that differs from the branch it merges into. The `uzh-bf_klicker-uzh` project keeps the repository's former default branch `dev` as its main branch, last analysed 2022-08-20, and neither `v3` nor `v3-*` matches the inherited `(branch|release)-.*` pattern. Before the project pattern was widened, `v3` was therefore a short-lived branch measured against `dev`, so nearly the whole repository counted as new code there and the branch gate failed on historical findings while the pull-request analysis of the same code stayed healthy. The project pattern is now `(branch|release)-.*|v3(-.*)?`, so every `v3` branch is long-lived and uses the project definition; a branch re-analysed after that change reports the definition on its next analysis, so no separate New Code setting is required. Because the type is fixed at a branch’s first analysis, the branch analysis is published without awaiting the gate — a failure there would block the staging promotion controller without changing the condition — and only the pull request, where new code is the diff against the base, remains gated. The red `v3` check is not caused by the scanner's `-Dsonar.projectVersion`: a version cannot inflate a short-lived branch, and the pre-#5924 job never awaited the gate, so it surfaced only once the workflow began to. `.github/scripts/sonar-new-code-boundary.cjs` names the cause from the branch's recorded type and merge target plus the measured `lines` and `new_lines`; it runs after the scan so the branch analysis is always published, carries `if: always()` so it also runs when the awaited pull-request gate has already failed the job, and stays non-fatal when either API is unavailable or the branch has no measures yet; it reports the boundary and never gates a branch run. Because the type is assigned once, correcting it is a platform action: extend the long-lived branch pattern on the project's Branches page to cover the `v3` names, delete the branch analysis through `api/project_branches/delete`, then re-analyse so the branch is recreated with the type the pattern assigns — or recreate the project with `v3` as its main branch. The project pattern is the lever because the organization-level pattern is Enterprise-only. It was applied on 2026-09-16 with the repository's own `SONAR_TOKEN`, which does carry project administration, from a disposable push-triggered workflow rather than an operator console. `dependency-review.yml` reviews changed dependencies and fails on high severity. GitHub's dependency graph resolves the pinned pnpm 11.5 workspace: the `v3` SBOM records 4,487 npm packages with 10,757 dependency edges, and the 336 open alerts are attributed to the root `pnpm-lock.yaml` (250), workspace `package.json` files (83), and `apps/analytics/uv.lock` (3), with resolved npm versions matching the `pnpm-workspace.yaml` override targets. Detection and graph coverage are verified; PR-time blocking of a newly introduced vulnerable dependency, and triage of the existing backlog, are not. Trivy scanning is piloted on the staging backend-docker image and migrator by the `scan-arm-backend-docker` and `scan-arm-backend-docker-migrator` legs of `v3_images-stg.yml`, and the trusted staging controller admits a candidate only when the receipt of each scanned image matches the digest it is about to promote. The pilot scope is still those two images, so the other staging images publish no receipt yet. Because the controller runs the workflow definition of its own revision, this admission applies to the controller once this source reaches the default branch.
- **Automation**: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JavaScript/TypeScript, Python, and Actions; weekly + PR) and SonarCloud run alongside — note that `sonar-project.properties` puts `packages/i18n/messages/**` in `sonar.cpd.exclusions`, because locale catalogs are parallel translations of one key structure and copy-paste detection reads that as duplication by construction, failing the new-code duplication gate on any string-heavy PR; the files stay in scope for every other rule, so do not remove the exclusion. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.
- **Playwright timing feedback**: `update-playwright-timings.yml` listens for a successful direct `v3` run of `test-playwright`, validates all eight compact JUnit artifacts, and opens or updates one human-reviewed timing PR on `automation/playwright-timings`. It requires `PLAYWRIGHT_TIMINGS_BOT_TOKEN` with repository contents and pull-request write permissions. The default `GITHUB_TOKEN` is deliberately insufficient because PRs it creates do not trigger their required checks; the timing workflow never auto-merges.

Shard durations differ by architecture, so `playwright/timings.json` names the architecture its weights were measured on. The timing workflow maps the run's recorded route to `x64` for hosted runs and `arm64` for the public pool, passes it to the updater as `--architecture`, and the updater leaves the table untouched when it is calibrated for a different architecture, reporting why instead of writing. An untagged table is adopted by the producing architecture on its first tagged write. Replacing a calibration with another architecture's measurements is therefore a human decision rather than an automatic side effect of a successful run.

- **AI review**: While a PR is a draft, OpenCodeReview runs the low-cost DeepSeek V4 Flash 0731 model (`deepseek/deepseek-v4-flash-0731`) through OpenRouter against the exact PR head and its immediate base. A ready transition cancels an in-flight draft run, and ready PRs do not start new cheap reviews. OpenRouter is an external model provider, so review diffs cross that provider boundary and incur usage cost.
- **Manual final review**: After CI and the draft feedback are settled, a collaborator with calculated `write` or `admin` permission posts `/final-review` on an unstacked PR or on one verified native stack layer. The workflow uses `z-ai/glm-5.3-flash` with high reasoning, applies the repository's diff-led operational lenses, and publishes one consolidated review attached to an immutable head. Before review fan-out, one fixed public-safe request must return the expected function call; failure stops the run with bounded provider diagnostics. The manual jobs pin OpenCodeReview 1.11.0 and use its low review-effort preset for one review round; this does not lower the model's high reasoning setting. Each OCR task has a 30-minute deadline, and an individual range has a 750,000-token ceiling. When the first attempt returns structurally valid partial coverage for a non-budget failure, the same job may resume that exact session once with only the unused token allowance. Strict lineage and identity checks protect checkpoint reuse, and combined usage cannot exceed the original range ceiling. Budget exhaustion, an invalid session, or a still-partial resume fails immediately. The job has a 75-minute ceiling and reserves time after OCR for cleanup and finalization. No incomplete result reaches publication. The mode-0600 OpenRouter config lives only at OCR's current-user default path on a fresh GitHub-hosted runner and is removed by the existing always-run cleanup before publication. Do not move these jobs to persistent self-hosted runners without redesigning that secret lifecycle. If no actionable findings exist, it records an evidence-bound clean success status with description `z-ai/glm-5.3-flash final review clean; evidence=<64-hex evidence digest>` and skips the PR comment. The evidence digest covers the exact PR range, review mode, root review, stack identity, dispositions, and policy. A later descendant containing only bounded, declared repairs may be attested incrementally; material scope changes, stale stack identities, missing dispositions, or exceeded bounds require another complete manual review. For a finding-bearing report, a permitted collaborator records the exact machine-readable marker `<!-- final-ai-disposition/v1 {"schema_version":"final-ai-disposition/v1","review_id":"...","root_head":"...","workflow_run_id":123,"entries":[{"finding_id":"...","state":"fixed|follow-up|rejected","reference":"public-safe reference","paths":["path/to/finding"]}]} -->`; every entry must cover exactly one root finding and include its finding path in the explicit remediation paths. Malformed or missing records force a complete review. Findings are advisory: collaborators verify them and record each blocker as fixed, follow-up, or rejected.
- **Manual stack review**: For a verified native stack, post `/final-review-stack` on the top PR. The workflow uses `z-ai/glm-5.3-flash` with high reasoning to review the cumulative change and stack topology, assigns cross-layer findings to exact layer deltas, and publishes one report on the top PR. Each cumulative OCR task has a 30-minute deadline. A full-stack range has a 20,000,000-token ceiling; each incremental layer range retains its own 750,000-token ceiling. The first eligible partial range in declared order may consume the job's single resume allowance and shares that range's ceiling. A later or ineligible partial fails immediately. The 90-minute job uses an inner code-review deadline to reserve time for cleanup, topology review, publication, and finalization. Partial coverage is never published. The topology request removes derivation-only patch operations before sending evidence and fails closed above its bounded request and output budgets. It receives bounded excerpts of prior code findings, reports only defects that depend on a cross-layer interaction, and suppresses a topology result when it restates an overlapping code finding with the same path and category. Metadata retains both generated and published topology counts for later evaluation. If neither pass produces an actionable finding, it records an evidence-bound clean success status with description `z-ai/glm-5.3-flash stack review clean; evidence=<64-hex evidence digest>` and skips the PR comment. It stores the immutable reviewed-path and rename-alias set in the trusted `Final AI stack clean evidence` check output so an unrelated default-branch advance can be revalidated without recreating a comment. The stack evidence digest covers the ordered layer identities, topology identity, exact range, dispositions, and policy. A later repair in one or more layers may use the same bounded, disposition-backed attestation contract when every changed layer descends from its reviewed head, every upper layer contains the current parent head, and each per-layer remediation range remains within the declared bounds. Topology drift, material scope changes, or missing dispositions require another cumulative review. Any layer drift resets the top `final-ai-stack-review` status, even when the top PR's SHA is unchanged. Neither final status grants merge authority; merge readiness still requires current evidence, green required CI, and terminal dispositions. The repository grants agents and the shared PR babysitter standing approval to post `/final-review` or `/final-review-stack` after exact-head CI and ordinary feedback settle; no per-run approval is required for the configured external OpenRouter request and its usage cost. This standing approval does not cover non-public payloads or grant merge authority. The babysitter still stops after two autonomous head-changing rounds and never guesses a tracker destination. Add `final-ai-review` or `final-ai-stack-review` to branch protection only after a controlled live run has proved its status lifecycle.
- **Publisher rejection diagnostics**: A failed validation or publisher step keeps its exact rejected JSON input as a one-day workflow artifact. The individual job retains its initial, resumed, or final result JSON as applicable. The stack job normally retains the combined code result and optional topology result. An incremental validation or resume failure may instead retain the exact affected range result JSONs, while a combine failure retains every range result passed to the failed combine step. The workflow never adds stderr, OpenRouter configuration, stack manifests, review-range directories as directories, unrelated wildcard inputs, or runner workspaces to these artifacts. Treat the payloads as public because this repository is public: use them only for offline parser diagnosis, never as authorization to replay or publish a review. The upload runs only after the corresponding validation or publisher step fails and does not change the failed job or final status. Live artifact proof remains a post-merge check because `pull_request_target` uses workflow code from the default branch. See [OpenCodeReview publisher rejection payloads](./solutions/integration/opencodereview-publisher-rejection-payloads.md) for the failure pattern and safe diagnostic boundary.
- **Legacy generated staging promotion**: Phase 1 supersedes the annotation-write-back mechanism and removes its `Verified generated staging promotion` no-report exemption. The successor creates no pull request, and a legacy-named promotion pull request follows ordinary final-review policy. Its privileged `workflow_run` executes only trusted default-branch control code; candidate Git objects and API metadata are inputs, never executable policy.
- **Offline qualification**: Public-safe synthetic receipts and a dependency-free evaluator live under `.github/open-code-review/qualification/`. The evaluator's strict synthetic contract covers explicit blocker and false-blocker dispositions, prompt-injection text treated as untrusted data, valid and invalid stack topology, exact path ownership, incomplete coverage, and token-counter consistency. It is intentionally separate from the runtime OCR parser and does not claim to validate live provider receipts. Run `node --test .github/open-code-review/qualification/final-review-qualification.test.js` and `node .github/open-code-review/qualification/final-review-qualification.js`; this checks deterministic local contracts and reports offline-only metrics. OpenCodeReview 1.11.0 is also qualified before publication against a fake OpenAI-compatible endpoint with a synthetic one-file diff; that probe checks the released binary's model, high reasoning, tool request, 16,384-token completion cap, automatic provider routing, and one-round effort wiring. Neither offline path qualifies live model behavior, proves first-trigger success, or makes a merge-readiness decision. Real `/final-review` and `/final-review-stack` proof remains a post-merge gate because `pull_request_target` executes trusted default-branch workflow code.

The draft, individual and stack review jobs disable OCR's background updater
with `OCR_NO_UPDATE=1`, including the installation version check. OCR 1.11.0
otherwise starts a background global npm update even for `ocr version`, so a
pinned installation alone does not keep the executable immutable. That
background reinstall deletes and re-extracts the package while the same job
starts its review, so a job without the guard fails on module resolution
instead of reviewing the diff. `ocr-self-update-guard.test.cjs` fails any
workflow job that runs the action without the guard. Each review
attempt verifies the pinned version before running. Process failures retain
their exit code and write only a fixed stage, exit status and numeric output
sizes to the job summary: stdout for that attempt and explicitly labelled
`stderr_total_bytes` accumulated across the step's attempts. Raw version failures, stdout, stderr and provider
configuration remain suppressed. An execution error is not a clean review;
cleanup and final-status failure handling still run.

## Obsolete validation cleanup

From the repository root, inspect candidates with the host GitHub CLI:

```bash
node .github/scripts/ci-obsolete-runs.cjs
node .github/scripts/ci-obsolete-runs.cjs --run-id <run-id>
```

After reviewing exact IDs, apply normal cancellation:

```bash
node .github/scripts/ci-obsolete-runs.cjs --apply --run-id <run-id>
```

The utility accepts allowlisted PR and push validation runs in five cases: the
PR is closed; the run's old head has a verified current replacement in the same
workflow; the run is still queued while a newer run of the same workflow already
covers the same current head; the run is a push run behind the branch's current
tip, and the tip's run of the same workflow is active or already successful; or
the run is a PR run whose pull-request binding is gone because the head branch
was deleted after merge, and that branch no longer exists with no open PR
referencing it. The queued-duplicate case exists because a push and a
pull-request event for one branch use different concurrency groups, so both can
create a run for the same head; the older queued entry has consumed no runner
time and the newer run carries the authoritative plan. Each case revalidates
repository, workflow, PR, head, branch and attempt before cancellation and
checks the terminal result. The utility never cancels by age, and excludes
manual runs, image publication, deployments and final-review status writers.
A run that has not yet reached a runner rejects cancellation with HTTP 409 or
422; that run is reported as deferred and the batch continues with the next ID,
while any other cancellation error still stops the operation.
Incomplete API evidence stops the operation. If a verified obsolete run retains
an `always()` tail, `--apply --force --run-id <run-id>` first attempts ordinary
cancellation, then revalidates before force cancellation. Unconfirmed readback
stops further work. This utility is manual; no recurring cleanup is installed.

Unrelated issue comments are filtered before Final AI review allocates its
trusted-policy runner. PR lifecycle status handling and exact review commands
retain their existing authorization and serialized status locks.

## Public ARM64 runner operations

Run the policy reconciler from a trusted administrator checkout. Both modes
accept `GH_TOKEN` or a hidden prompt for a short-lived fine-grained token;
`--check` needs organization
Self-hosted runners read access and `--apply` needs write access, plus repository
Metadata read access. Revoke the token after the verified readback.

```bash
util/reconcile-public-pr-arm64-runner-group.sh --check
util/reconcile-public-pr-arm64-runner-group.sh --apply
```

The exact target is selected access to `uzh-bf/klicker-uzh`, workflow
restrictions enabled, and only
`uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`.
The script fails on inherited or read-only policy, extra repositories or
workflows, and runner membership other than `public-pr-arm64-01` through `-08`.

Check both existing hosts from the administrator machine before applying the
optional optimization. Verify and register both SSH host keys before running
the controller; unknown or changed keys are rejected. Pause new workflow
dispatch to the pool and let active jobs finish before applying changes.
`--check` streams the checksum-verified payload and
makes no persistent remote change. `--apply` is rerunnable, requires both hosts
to be idle, and asks once before changing either host.

```bash
util/reconcile-public-pr-arm64-pool.sh \
  --check \
  --host-a "$VM_A_IP" \
  --host-b "$VM_B_IP"

util/reconcile-public-pr-arm64-pool.sh \
  --apply \
  --host-a "$VM_A_IP" \
  --host-b "$VM_B_IP"
```

After applying, inspect a bounded UTC interval on each host and correlate
`run_id` and `runner` with the GitHub job summary and step timestamps:
Set `RECONCILE_START_UTC` and `RECONCILE_END_UTC` to the actual apply interval.

```bash
sudo journalctl \
  -t actions-runner-telemetry \
  --since "${RECONCILE_START_UTC:?set the apply start time in UTC}" \
  --until "${RECONCILE_END_UTC:?set the apply end time in UTC}" \
  -o cat
```

Record one row per job with run ID, runner, GitHub start/completion, install and
build seconds, exact cache-hit flags, shard setup and test seconds, host load,
available memory, Docker-disk pressure, conclusion, and artifact. This separates
cache misses, host contention, service setup, test structure, and scheduling;
do not infer one cause from total duration alone.

### In-job resource samples

Build and shard telemetry artifacts also contain `playwright-resources-*.jsonl`.
The command wrapper samples every ten seconds for up to one hour (361 rows).
Prisma and application builds have separate files; shard samples span service
readiness and tests. Sampling failures do not change the wrapped command result.
Artifacts retain the existing seven-day lifetime. No VM update is required.

Samples contain only numeric procfs observations and timestamps. CPU tick order
is user, nice, system, idle, iowait, irq, softirq, steal; guest ticks are already
included in user/nice. Compute interval shares from successive counter deltas,
not cumulative totals. Pressure totals are microseconds; divide their deltas by
elapsed microseconds. Missing metrics are null, not zero. Counters describe the
system visible from the container, not exclusive usage by its job. They do not
measure per-process activity or establish a causal performance diagnosis alone.

## Image builds

The selected staging source has one `v3_images-stg.yml` workflow with 16
targets, including the backend migrator and the two MCP images. Its `plan` job
selects targets at run time from the trusted inventory in
`.github/scripts/staging-image-targets.cjs`, and the matrix builds one
`build-arm-<target>` job per selected target. They push images to ghcr.io
through those `-arm` jobs. The two MCP images also publish AMD64 variants
through `build-amd-<target>` jobs, but those repositories are not
staging-chart runtime inputs and are excluded from the release receipt. The
terminal `build-images-status` job owns the required context, so the former
`Build Fallback` reporter is no longer needed: a run that selects nothing
still reports a validated no-change result.

- **stg**: push to `v3`/`v3*` or PR touching the app's paths. Every metadata block retains branch and pull-request tags and adds the full source commit SHA. Pull requests build without pushing. On push, `.github/scripts/stg-image-publish-guard.sh` checks the full-SHA tag after registry login. A missing tag permits the existing build to push all tags once; an existing tag records its canonical digest and skips the build, so a rerun cannot overwrite the SHA tag or move the floating branch tag backward. An uncertain registry response fails closed. Both Trivy-scanned images expose that recorded digest as the build job output, so a run that reuses an existing tag still scans the exact image it will promote and publishes its own receipt.
- **prd**: tags `v*.*.*` only.

Active `-arm` jobs build same-repository pull requests from a shared BuildKit
registry cache (`<image>-arm:buildcache` in ghcr.io, exported with `mode=max`),
while push publications stay fully uncached. Fork and other cross-repository
pull requests keep the uncached build path, and the push-gated registry login
jobs extend that login to same-repo PRs only for cache reads and writes. The
native ARM64 `-arm` jobs no longer install QEMU; the disabled `-amd` jobs
retain theirs. The two MCP staging workflows keep their active \`build-amd\`
jobs (validated as non-runtime publishers by the release receipt) and follow
the same cache contract with an \`-amd:buildcache\` registry cache.

Build context is the repo root with `file: apps/<app>/Dockerfile` — Dockerfile changes must keep monorepo-root context assumptions.

The five Next images (auth, chat, control, manage, PWA) consume Next's `.next/standalone` output. Auth and chat production builds use Turbopack. Control, manage, and PWA production builds explicitly use Webpack while `@ducanh2912/next-pwa` remains responsible for `sw.js`, Workbox chunks, and the custom worker bundle copied by their Dockerfiles. Before publishing a framework upgrade, run the mixed production build, inspect those artifacts, smoke the standalone server paths, and require the ARM image jobs. These are **config-derived** contracts until the corresponding command and CI check is recorded for the release SHA.

The same five images receive browser GrowthBook configuration at build time.
Staging workflows use the repository variables
`NEXT_PUBLIC_GROWTHBOOK_API_HOST_STG` and
`NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_STG`; production workflows use the matching
`_PRD` names. These values are deliberately GitHub Actions variables rather than
secrets because every `NEXT_PUBLIC_*` value is embedded in public browser
assets. The Dockerfiles declare and export matching build arguments before the
Next build. See [Feature Flags](./feature-flags.md) for the complete runtime and
operator contract.

The consolidated staging workflow forwards that configuration through the
`build-args` list of its `build` job, which covers every web target. Those
five Dockerfiles are the only ones that declare the arguments, so a target
that bundles none of them ignores the list instead of failing. Each declares
`NEXT_PUBLIC_ENV=production` as its default, which is why the workflow passes
`NEXT_PUBLIC_ENV=staging` explicitly. The same list carries
`NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS`
(`vars.NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS_STG`), the exact-origin allowlist
the chat image applies to eLearning chat contexts. An argument that never
reaches the build fails without a build error or a failed check: the chat
image then treats every context message as untrusted and answers without page
context. After changing the list, confirm the arguments in the
`build-arm-chat` job log and the expected origin in its served bundle.

The Manage assistant target is also build-time browser configuration.
`apps/frontend-manage/.env.stg` and `.env.prd` both map
`NEXT_PUBLIC_CHAT_URL` from their environment-specific `APP_ORIGIN_CHAT`.
`apps/frontend-manage/Dockerfile` checks that exact mapping after the STG or PRD
workflow has installed its file as `.env.production`; an image build fails
instead of producing a Manage bundle that silently hides the assistant
launcher.

### Dependency overrides

The `overrides` block of `pnpm-workspace.yaml` decides which patched
transitive releases the scanned images carry, so every entry there has to stay
load-bearing against the locked graph: some dependency range still resolves
below the patched release, or the line is pinned for lockstep or consolidation.
An entry whose selector no longer matches any resolved version buys nothing and
keeps rewriting importer specifiers — `verifyDepsBeforeRun: error` compares
those strings against the manifests, so that drift, not the pin itself, is what
fails an install in the Docker builders and the dev launcher. Audit, add, drop,
and repair entries with
[.agents/skills/klicker-dependency-overrides/SKILL.md](../.agents/skills/klicker-dependency-overrides/SKILL.md);
the 2026-09-19 audit of that block dropped 17 stale image-scan lifts that
resolved at or above their patched release without the pin.

## Release flow

Version bumps are **local and manual** via standard-version: `pnpm run release[:alpha|:beta|:rc]` bumps the root plus ~20 package.jsons (`.versionrc.js`), writes the changelog, commits, and tags. Pushing the tag triggers the prd image builds; strict `vX.Y.Z` tags additionally create a GitHub Release (`release.yml`) — alpha tags build prd images without a Release. The Helm `Chart.yaml` auto-bump is commented out in `.versionrc.js`, which is why the chart version drifts.

**When bumping prd image tags** in `deploy/env-uzh-prd/values.yaml`: if the new tag is the first release whose CI built `backend-docker-migrator-arm`, set `migrator.enabled: true` in the same commit — that is what switches prd from manual migrations to the automatic hook. Conversely, rolling prd back to a tag from before this feature requires setting it to `false` again, or the hook fails on a missing image and blocks the sync.

## Deploy parity across `v3` and `v3-ai`

**Production renders `deploy/` from one branch and runs images built from the
other.** ArgoCD `app-klicker` tracks `rev=v3` with
`path=deploy/charts/klicker-uzh-v3` and the value file
`deploy/env-uzh-prd/values.yaml`, while the production images are tagged on
`v3-ai` (`v*.*.*` tag pushes). A `deploy/` change that exists on only one
branch therefore ships a release whose images never met those manifests: the
lecturer and student MCP servers stayed out of production although their images
were published, and a later promotion reverted `v3`'s `FASTMCP_STATELESS` fix,
which `v3-ai` never carried.

`check.yml` runs `.github/scripts/deploy-parity.cjs` on pushes to `v3` and on
pull requests whose base is `v3`. It compares the candidate revision with
`origin/v3-ai` and names every path under `deploy/` that differs. A push to `v3`
is an authoritative check of the branch itself and must match.

A pull request is responsible only for the `deploy/` paths it edits: it passes
its base revision, so a change that leaves `deploy/` untouched reports an
already divergent pair of branches as a warning instead of failing work that
cannot influence it. A pull request that does edit `deploy/` is blocked until
the two revisions match: promote the `v3-ai` revision to `v3`, or backport the
`v3` change to `v3-ai` first. Keep them aligned, because any merge into `v3`
while they diverge can ship production a chart that the tagged images never met.

Image `tag:` and `pullPolicy:` lines in `deploy/env-<environment>/values.yaml`
are excluded: the environment's image reference is owned by the branch that
renders the environment, which is `v3` for production, so a tag roll or a
pull-policy change is not a divergence there. The rest of the environment file
must still match, so a promotion or a `v3` integration merge cannot drop keys.
Repointing production at `v3-ai` would invalidate that exclusion, because stale
pins in `v3-ai` would then reach production. When `v3-ai` is retired
([ADR-0007](./adr/0007-reintegrate-v3-ai-behind-feature-flags.md)), the gate
reports itself as not applicable and can be removed with the branch.

## Deployment values (facts, not procedures)

- **stg** (`*.klicker.stg.df-app.ch`): `STG_SOURCE_BRANCH` selects the supported `v3*` branch that publishes staging candidates; it currently selects `v3-audit`. The release-ref design makes ArgoCD track `stg-release` and inject its resolved full commit SHA as the first-party image tag. Automatic promotion is active, so the selected source advances staging on every qualified candidate — see [Staging promotion](#staging-promotion) below.
- **prd** (`*.klicker.uzh.ch`): pinned version tags and `replicaCount: 2` for web/API services. Production stays on `v3`, receives no `global.imageTag` parameter, and keeps the existing release-tag flow.
- **Secrets are external**: deployments reference `envFrom.secretRef` names, but the chart defines no `Secret` manifests — provision them out-of-band with matching names. GrowthBook-ready Node workloads reference the optional shared `<rendered-chart-fullname>-secret-growthbook`, which supplies only `GROWTHBOOK_API_HOST` and the server SDK `GROWTHBOOK_CLIENT_KEY`; `GROWTHBOOK_ENV` comes from the global ConfigMap. The primary GraphQL backend separately retains the optional `<rendered-chart-fullname>-secret-growthbook-management` reference for `GROWTHBOOK_MANAGEMENT_API_URL` and `GROWTHBOOK_MANAGEMENT_API_KEY`. Beta preferences are stored in the application database, so enrollment does not use that management connection or a saved-group identifier. Optional references preserve startup before provisioning. Do not place the write-capable management key in the shared evaluator Secret.
- **Hatchet endpoint pair**: `hatchet.client.apiUrl` in the environment values renders `HATCHET_API_URL`, while the external secret supplies `HATCHET_CLIENT_HOST_PORT`. They must resolve to the same Hatchet installation; worker health alone does not validate programmatic schedule creation over the HTTP API. Staging uses `app-hatchet-svc-api.stg-hatchet-svc.svc.cluster.local:8080`, and production uses `app-hatchet-svc-api.prd-hatchet-svc.svc.cluster.local:8080` (see [Async & Workers](./async-and-workers.md)).
- **Hatchet general-worker resources**: staging and production set a `2Gi` memory limit on the general worker because it executes course duplication. The response-processor deployments retain their lower, independent limits.
- **Hatchet worker runtime contract**: the base chart and both environment overlays render separate per-pod identities and slot budgets for the general, regular-response, and assessment workers. General, regular-response, and assessment workers expose named ports 8001, 8002, and 8003 respectively, plus `/healthz` liveness, `/readyz` readiness, and a 90-second termination grace period (`deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml`). This is desired-state evidence; it does not prove a deployed or live worker. See [Async & Workers](./async-and-workers.md#worker-runtime-contract).
- **Hatchet worker disruption budgets**: staging sets `minAvailable: 0` for all three singleton worker Deployments so voluntary node drains can proceed, while production keeps one general worker and two workers in each response-processing mode available. The base chart defaults each worker budget to one. The render gate verifies these worker-only values and that the assessment backend keeps its independent floor of two.
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- **Topology spread contract**: production values define zone + hostname `topologySpreadConstraints` for seven workloads — the three Hatchet workers, the assessment frontend and backend, and the two MCP servers. The chart renders the value at each pod spec only when non-empty (chart defaults are `[]` and render nothing), and every constraint selector must match the workload's own `app.kubernetes.io/component` pod label — the assessment frontend selects `frontend-assessment`, not `frontend-pwa-assessment`. The required `check` workflow runs `node --test deploy/scripts/verify-topology-spread.test.mjs` and `node deploy/scripts/verify-topology-spread.mjs`: the script lints and renders the chart with defaults, staging values, and production values, requires exactly one zone and one hostname constraint for each of the seven workloads with `maxSkew: 1` and `whenUnsatisfiable: ScheduleAnyway`, requires every selector to match the workload's pod label, requires the default and staging renders to contain no spread field at all, and rejects constraints on any workload outside that contract. It also compares the contract's values paths with the production values in both directions, so a workload cannot leave the assertions unnoticed by deleting its contract entry. The MCP pair already rendered its constraints before these template additions, so the contract pins them instead of relaxing them. The check is not part of `check:all`, which must run in any working copy, because the Helm CLI is not part of the dev container; the hosted runner provides it. A passing render is still source-level proof — live spread behavior must be confirmed against the synced cluster.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.
- **KB graph builds couple two values**: `hatchet.kbGraph.workflowName` and `backendGraphql.knowledgeGraph.host` must be set together, or the chart stops at render time with an explicit `fail`.
- **KB graph token ordering**: the general worker's external secret must already carry `KB_GRAPH_HATCHET_CLIENT_TOKEN` before `hatchet.kbGraph.workflowName` is set. The token alone does not arm the worker's startup gate (so a secret rollout cannot stop unrelated jobs), but once any chart-owned `KB_GRAPH_*` value is present the token is required and startup fails without it.
- **KB ingestion staging contract is rendered explicitly**: `pnpm run check:kb-ingestion-stg` renders the STG backend and worker ConfigMaps and requires this layer's exact state. The readiness layer requires both ingestion kill switches; the activation layer requires those false-valued keys to be absent. Both layers require the exact cluster-local ingestion and source-gateway endpoints, both graph kill switches, response-processor isolation, and no ingestion secret keys in ConfigMaps.

### Replica ownership

Every rendered Deployment has exactly one replica owner. A static Deployment
sets `spec.replicas` from its Git-owned `replicaCount`. An autoscaled Deployment
leaves `spec.replicas` out and is targeted by exactly one HPA or KEDA scaler. A
Deployment must never combine the two ownership models or have more than one
scaler target.

Only PWA, Manage, and GraphQL may declare an `autoscaling` stanza. Their current
HPA templates scale on CPU utilization only; memory utilization is intentionally
excluded because retained Node.js heap can keep that metric elevated after load
subsides. Every other workload is statically owned and must not declare an
unused autoscaling stanza.

LTI is intentionally static in the chart base and both environment overlays:
the base keeps `replicaCount: 2`, staging sets `replicaCount: 1`, and production
sets `replicaCount: 2`. No LTI scaler or LTI autoscaling stanza is rendered.

When external ArgoCD desired-state configuration permits replica differences
for an active autoscaler, the exception must name the exact scaler target and
the exact `/spec/replicas` field. W1 does not add or change an ArgoCD ignore
rule, and static LTI has no replica ignore. ArgoCD `Healthy` describes resource
health; it does not mean the application is `Synced`. Check application sync
status and resource-level drift separately.

Run `pnpm run check:klicker-replica-ownership` as the focused chart gate when
values or replica-owner templates change. The command renders base, staging,
production, and a synthetic all-three-HPA configuration. CI provisions Helm in
the shared codebase workflow. It runs the same gate for pushes to `v3` and
`v3*`, and when a pull request is opened, synchronized, or reopened. The gate
also rejects unsupported autoscaling stanzas in the base, staging, and
production values files.

## Deployment migrations

`prisma migrate deploy` runs automatically as an ArgoCD **`PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`) before each stg and prd rollout. **On prd the hook is enabled** (`migrator.enabled: true`) because the pinned release tags have matching migrator images, so normal prd rollouts apply pending Prisma migrations to the primary GraphQL database before its application Deployments start. The assessment database is covered only if its separate backend Secret targets that same database; otherwise it needs a separately proven migration path. The dedicated `backend-docker-migrator` image (`packages/prisma/Dockerfile`) is CI-built in lockstep with `backend-docker` (`v3_backend-docker-{stg,prd}.yml`). Without a global override, its tag tracks `migrator.image.tag`, then `backendGraphql.image.tag`; on Phase 1 staging, `global.imageTag` takes precedence so the hook and all app workloads use ArgoCD's same resolved commit. Production receives no global override and keeps its pinned release tag. A failed hook aborts the whole sync, so app Deployments in the main wave never start against an unmigrated DB. The hook uses **ArgoCD-native** annotations (`argocd.argoproj.io/hook: PreSync`), not Helm chart hooks — the two must not be mixed, because a single ArgoCD hook annotation makes ArgoCD ignore _all_ Helm-native hooks on the chart. Full details: [Data & Migrations → Deployment migrations](./data-and-migrations.md#deployment-migrations). Manual `pnpm --filter @klicker-uzh/prisma prisma:deploy:prod` remains a break-glass fallback only.

Why this shape (ArgoCD-native hook, dedicated migrator image, manual demoted to break-glass): [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md).

## Staging promotion

Phase 1 replaces annotation write-back with an immutable-revision promotion
contract. Every selected-source image workflow publishes a full commit-SHA tag
alongside its branch tag. A SHA-shaped tag is still mutable registry metadata,
so the publish-once guard is load-bearing: an existing SHA tag is never rebuilt,
and its canonical registry digest is recorded before the build is skipped.

`.github/workflows/deploy-stg-promote.yml` is a trusted default-branch
`workflow_run` controller. It checks out only `github.workflow_sha`, executes
only the promoter script from that checkout, and treats candidate workflow
files, run and job metadata, and registry responses as untrusted data. It does
not check out or execute candidate actions or scripts or consume candidate
caches. It reads bounded JSON evidence artifacts as untrusted data and binds
their identities and suite names to the actual GitHub job results.

For each candidate, the controller validates all of these before considering a
ref update:

- `STG_SOURCE_BRANCH` is a safe supported `v3*` source and the candidate is its
  ancestor.
- The candidate has the exact trusted staging workflow names, paths, push
  triggers, active ARM jobs, runtime image repositories, and backend migrator
  ordering. Intentionally disabled AMD jobs are excluded.
- The code check, secret scan, GraphQL, Playwright, unit, OLAT, translation,
  image-build summary, and SonarCloud analysis jobs all have successful push
  runs for the exact candidate SHA, repository, and selected branch. The Sonar
  job only succeeds once the awaited quality gate passes, so a green workflow
  that hid a failed gate cannot qualify a candidate. The newest matching run and
  its current attempt are required; duplicate terminal jobs fail validation.
  Candidate pushes run GraphQL, unit, OLAT, both translation smoke jobs, and
  all eight Playwright shards. PR-only no-change selections cannot qualify a
  staging candidate. Only missing or still-running evidence is retried, for a
  bounded interval; skipped, failed, cancelled, or mismatched evidence fails
  immediately.
- Every expected runtime repository exposes the full candidate SHA tag with a
  complete digest. Each accepted OCI or Docker manifest response must be
  redirect-free, complete, and have raw body bytes whose SHA-256 equals its
  validated `Docker-Content-Digest` header. The controller reads the registry
  inventory twice and fails if any digest is absent or changes during
  collection.
- Every image that publishes a scan is covered by that run: the scan job
  succeeded, and a receipt names the same source revision, run, attempt, image
  repository, and digest the controller is about to promote. A rebuild after
  the scan therefore cannot be promoted as the scanned artifact.

At activation, staging ArgoCD will track `stg-release`. ArgoCD resolves that ref
to an exact commit, then the external Application passes `$ARGOCD_APP_REVISION` to Helm as
`global.imageTag` with `forceString: true`. The chart applies that tag to all enabled
first-party images, including the PreSync migrator. The values file therefore
does not need a promotion commit or pull request. The retained rollout
annotations and old promotion credential are stability-window rollback aids,
not the new revision source.

The sorted evidence becomes a canonical JSON receipt with the controller run and source SHA,
source and candidate revisions, workflow/run/job identities, registry tags and
digests, retry history, ref decision, update result, post-push verification
state, and previous/applied release revisions. Its SHA-256 checksum is written
beside the receipt, and both are uploaded as a workflow artifact; the job
summary records the same checksum and run identity. A successful Git push is
followed by bounded ref readback retries. If readback remains unavailable or
reports another ref, the controller writes the receipt and checksum with
`uncertain` or `mismatch` verification before failing the run.

`refs/heads/stg-release` is the only write target. An explicit expected-old
lease provides the remote compare-and-swap after the controller has proved the
candidate is a fast-forward. Initial creation and fast-forward are the only
accepted updates; equal and stale candidates are no-ops, while divergence and
any concurrent ref movement fail. Candidate-SHA concurrency serializes
duplicate evaluation of one commit without suppressing a different, possibly
newer candidate.

Keep the evidence layers separate:

- the ArgoCD resolved revision proves which Git commit supplied the image tag;
- the controller's canonical registry digest receipt proves what each mutable
  SHA tag resolved to before promotion;
- each deployed container's `imageID` must match its receipt digest after sync;
- successful sync, successful migration, workload health, and user acceptance
  remain independent checks.

Operational notes:

- Set `STG_SOURCE_BRANCH` to the active supported `v3*` source. There is no default; missing selection fails validation. The promoter requires
  that explicit input and does not query repository variables itself. Promotion
  fails closed unless the branch has the exact trusted publisher inventory and
  full-SHA tags.
- GitHub evaluates `workflow_run` from the default branch. A correction on a
  selected-source branch does not change the privileged controller. Candidate
  source may contain an identical mirror for manual diagnostics, but the
  automatic run executes only the default-branch revision.
- `STG_RELEASE_PROMOTION_ENABLED=true` is the live setting that lets the
  controller write automatically; set it absent or `false` to pause automatic
  promotion while leaving the manual path intact. A
  manual dispatch defaults to dry-run; a write requires `dry_run=false` and the
  exact input `confirm_ref_update=stg-release`, plus `expected_release_sha` and
  `expected_controller_sha` copied from the reviewed dry-run receipt. A changed
  release or controller rejects the apply. For initial creation only, use
  `expected_release_sha=absent` and require the release still be absent. Initial ref creation,
  repository-variable changes, and activation remain separate operations.
- Before activation, prove every full-SHA image and retain the receipt, create
  `stg-release` through the confirmed manual path, then update only the private
  staging ArgoCD Application to track that ref and pass
  `global.imageTag=$ARGOCD_APP_REVISION` as a forced string. Preview, apply,
  runtime health, and acceptance remain separate evidence and approvals.
- API and Git fetch reads use `GITHUB_TOKEN` with `actions: read` and
  `contents: read`. Only the lease-protected Git push uses the existing
  `STG_PROMOTE_TOKEN`. Its credential must have repository contents write and
  permission to write workflow files; the job token cannot provide the latter.
  Confirm the existing credential's scope before activation. Missing write
  credentials fail before Git runs, without falling back to the job token.
  Dry-runs, disabled runs, and equal/stale no-ops require no write credential.
  No pull-request permission, source-branch bypass actor, auto-merge setting,
  or squash-title behavior is part of the new path.
- Unlike `GITHUB_TOKEN`, a separate promotion credential can trigger workflows
  on ref updates. Check the candidate's push/create filters and default-branch
  downstream controllers before activation; a release-ref write must not
  rebuild staging images. The publishers accept `v3`/`v3*`, not `stg-release`.

The static contract test at
`.github/scripts/stg-release-ref-promotion.test.cjs` derives the consolidated
workflow's target, guard, and repository/job contract from the trusted
inventory, checks the promoter trigger list, and verifies chart image override
and fallback behavior through source checks and Helm renders.

The superseded annotation mechanism and its incident context remain in
[ADR-0003](./adr/0003-promote-stg-via-release-annotation-write-back.md).
Production is unchanged: it stays on `v3`, receives no global image parameter,
and promotes by hand-editing pinned tags in `deploy/env-uzh-prd/values.yaml`.
