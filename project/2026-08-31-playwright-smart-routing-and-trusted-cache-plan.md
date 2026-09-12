# Playwright smart routing and trusted cache plan

## Status

- Date: 2026-08-31
- Repository: `uzh-bf/klicker-uzh`
- Planning baseline: `origin/v3` at
  `5a21988fb1b4acd285d60d3c41f481f0a96be892`
- Planning branch: `rs/playwright-smart-routing-cache-plan`
- Execution owner: the main implementation session acts as execution
  orchestrator for each approved milestone.
- Delivery shape: sequential milestone PRs from fresh `v3` branches. This is
  intentionally not a native PR stack because the public runner group may run
  only the reusable workflow at `refs/heads/v3`; an upper stack layer cannot
  receive representative self-hosted acceptance before its workflow dependency
  is merged to `v3`.
- Current authority: M1-M3 local implementation and verification are
  authorized; pushing/opening milestone PRs, merging them, running live
  canaries, changing repository variables, and runner or infrastructure
  changes remain separately gated.

## Goal

Reduce pull-request feedback time without weakening the public-runner trust
boundary:

1. Draft PRs run only the Playwright specs that a deterministic, conservative
   selector considers relevant.
2. A PR becoming ready for review always runs the complete Playwright suite,
   even when no source commit changes.
3. Both GitHub-hosted and public ARM64 execution consume the same selection,
   profile, shard, artifact, cancellation, and final-status contract.
4. Trusted `v3` builds populate reusable pnpm and Turborepo caches; untrusted
   public PRs can restore but never write shared cache state or receive cache
   credentials.
5. Later optimizations activate only when telemetry proves that they address a
   material remaining bottleneck.

The target is shorter draft feedback, predictable full-suite review gates, and
lower repeated build work. The target is not to make every individual ARM64
worker faster than a GitHub-hosted x64 worker.

## Non-goals

- Do not weaken the runner group from one repository and one exact reusable
  workflow.
- Do not expose repository, package, Turborepo, cache-signing, or infrastructure
  credentials to public PR jobs.
- Do not use `pull_request_target` to execute PR code.
- Do not treat smart routing as proof that the full suite passes.
- Do not bundle existing functional or flaky Playwright failures into this CI
  architecture package.
- Do not add more VMs or increase runner cost in the initial milestones.
- Do not deploy a new cache service, alter runner hosts, or edit shared skills
  as part of M1-M4.

## Product and architecture gates

This package changes an internal CI and runner trust contract. It does not add
or alter a user-facing product primitive.

M1-M3 do not require an ADR because they refine existing GitHub Actions,
Playwright, and cache behavior with explicit rollback controls. Re-open the ADR
gate before adopting an owned Remote Cache API service, changing the runner
trust model, or making smart selection a contract outside this repository.

## Current evidence

### Repository behavior

- `.github/workflows/test-playwright.yml` sends drafts, forks, bots, private
  repositories, and disabled rollout cases to GitHub-hosted workers. That path
  currently uses a fixed eight-shard full suite.
- Eligible ready same-repository public PRs call
  `public-pr-playwright-shards.yml@v3`, while the runner-group policy is
  documented against the canonical `@refs/heads/v3` ref.
- The public reusable workflow rejects drafts, restores ARM64 pnpm and `.turbo`
  caches without saving, builds all 21 Turbo tasks, and runs eight fixed shards.
- `get-shard-files.js` already validates active runtime profiles and performs a
  timing-aware greedy file assignment, but it has no selected-subset contract.
- `playwright/profiles.json`, `runtime-contract.yml`, and
  `playwright-profile-runtime.mjs` already provide the runtime profile source of
  truth. Runtime startup is profile-scoped; the build is not.
- `.github/workflows/check.yml` already uses credentialed remote-only Turbo
  caching through `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_REMOTE_ONLY`. The
  Playwright cache work in M1 is additive and does not replace or migrate that
  existing cache.
- The current coarse changed-path pattern omits relevant root files such as
  `turbo.json` and `pnpm-workspace.yaml`; it must not remain an authority in
  front of the new selector.

### Measured CI behavior

- Public ARM64 Playwright run `33333075517` used all eight named
  `public-pr-arm64` runners, built in about 4 minutes 10 seconds, and completed
  in about 23 minutes.
- Its build log reported both pnpm and Turbo Actions cache misses, remote caching
  disabled, a 12.6-second dependency install, and 21 of 21 Turbo tasks executed
  with zero cache hits.
- A comparable GitHub-hosted run, `33378190382`, built in about 2 minutes 8
  seconds and completed the full suite in about 20 minutes.
- This supports prioritizing cache reuse and avoided work before host tuning.
  It does not support claiming the self-hosted CPUs are intrinsically faster.

### Official platform constraints

- Turborepo does not require Vercel. It supports a custom Remote Cache API and
  the `TURBO_API`, `TURBO_TOKEN`, and `TURBO_TEAM` configuration surface.
  An S3 bucket alone is not a Turborepo remote cache; an API-compatible service
  must mediate access to object storage.
- Turborepo officially supports using GitHub Actions cache for `.turbo` in CI.
- GitHub Actions cache permits PRs to restore eligible default-branch cache
  entries. Cache contents must not include secrets, and PR-created entries have
  narrower merge-ref scope.
- GitHub's standard `ubuntu-24.04-arm` runner currently provides 4 vCPUs and
  16 GB RAM. It is sufficient as a trusted cache writer even though the public
  shard pool remains self-hosted.

Sources:

- [Turborepo remote caching](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/core-concepts/remote-caching.mdx)
- [Turborepo Remote Cache API](https://github.com/vercel/turborepo/blob/main/apps/docs/content/openapi/index.mdx)
- [Turborepo on GitHub Actions](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/guides/ci-vendors/github-actions.mdx)
- [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [GitHub-hosted runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

## Settled decisions

### 1. Use GitHub Actions cache first

M1 uses GitHub Actions cache for the Playwright pnpm store and local Turbo
artifacts. It introduces no new cache server and no Vercel dependency.

This is the lowest-cost and lowest-operational-risk option because the public PR
jobs need no secret. A trusted GitHub-hosted ARM64 workflow writes cache entries
from exact `v3`; public PR jobs restore those entries only.

An owned Remote Cache API remains a metrics-gated, separately authorized pilot.
It may use S3-compatible storage behind the API, but public PRs must not receive
a shared write token.

### 2. Preserve architecture separation in cache keys

The pnpm and Turbo keys include:

- cache contract schema;
- operating system and CPU architecture;
- immutable build-container digest;
- Node and pnpm versions;
- lockfile hash;
- `turbo.json`, `pnpm-workspace.yaml`, and workspace package metadata hashes;
- the fixed synthetic Playwright build-environment schema.

Trusted writers add a unique `v3` source SHA suffix and publish stable restore
prefixes from most specific to least specific. x64 and ARM64 entries never share
keys.

### 3. Use one immutable build environment

The trusted seed build and public ARM64 build use the same ARM64-capable build
container pinned by digest, the same Node and pnpm versions, and the same
synthetic non-secret test environment. Implementation must resolve and record
the digest; tags alone are insufficient.

The seed workflow:

- runs on `push` to exact `v3` and optional `workflow_dispatch`;
- rejects a manual dispatch unless `github.ref == 'refs/heads/v3'`;
- explicitly checks out `refs/heads/v3` and verifies the checked-out SHA against
  the trusted event or branch head;
- saves a cache only after the complete no-secret Playwright build succeeds;
- never runs PR code or accepts a caller-provided ref.

The reader uses `actions/cache/restore`, never `actions/cache` or
`actions/cache/save`.

### 4. Keep an ordinary no-cache path

`PLAYWRIGHT_CACHE_SCHEMA` versions cache compatibility.
`PUBLIC_PR_PLAYWRIGHT_CACHE_ENABLED` defaults to false until the post-merge
canary is approved. `PUBLIC_PR_PLAYWRIGHT_CACHE_CANARY_PR` optionally enables
restore for one exact PR while global restore stays disabled. When neither
control matches, the workflow skips cache restore and runs the ordinary build.
A schema bump invalidates all old entries without deleting them.

M1 acceptance includes one successful cache-disabled build, one trusted cache
creation, and one later PR restore with the expected fingerprint. A corrupt,
missing, slow, or unavailable cache must degrade to a normal build rather than
fail the test workflow.

### 5. Make the selector the sole skip authority

Remove the coarse outer changed-path skip or broaden it to all paths and make it
non-authoritative. Every PR event reaches the trusted selector.

The planning job performs two checkouts with persisted credentials disabled:

- a trusted control checkout of exact `refs/heads/v3`, containing the selector,
  sharder, relevance manifest, policy validator, and artifact inventory;
- the untrusted PR candidate checkout, treated only as data and later build/test
  input.

The job executes no policy code from the PR checkout. Any PR change to selector,
sharder, manifest, policy, inventory, or their workflow seams forces full mode;
the changed policy takes effect only after merge to `v3`.

For a PR, fetch enough history to resolve the event's exact base SHA and head
SHA. Compute `mergeBase = git merge-base <baseSHA> <headSHA>`, then consume
rename-aware, null-delimited records from
`git diff --name-status -z -M <mergeBase> <headSHA>`. This is the only diff
algorithm. A missing object, shallow-history failure, ambiguous merge base, or
parse error forces full mode. For a stacked PR, the event's exact parent-branch
base SHA defines the lower boundary, so the selector sees only the current
stack layer.

The relevance manifest is separate from runtime profiles. Runtime profiles say
what a selected spec needs; the relevance manifest says which specs a change
can affect.

Selector v1 outcomes are frozen as follows:

| Change | Draft outcome | Ready outcome |
| --- | --- | --- |
| Existing Playwright spec modified | Select that exact spec | Full suite |
| Non-spec renamed to a spec | Select the destination spec | Full suite |
| Spec renamed to another spec | Select the destination spec | Full suite |
| Spec deleted or renamed outside Playwright | Full suite | Full suite |
| Known feature or app path | Union of mapped spec groups | Full suite |
| Shared runtime, schema, lockfile, CI, profile, or global surface | Full suite | Full suite |
| Explicit documentation-only or proven non-runtime path | Skip | Full suite |
| Unknown or malformed diff entry | Full suite | Full suite |

The explicit skip set stays deliberately small. `turbo.json`,
`pnpm-workspace.yaml`, root package metadata, the lockfile, Devrouter/runtime
contracts, Playwright support code, GraphQL/Prisma shared surfaces, and relevant
workflow code are full-suite changes.

Ready mode overrides every draft selector outcome, including documentation-only
skip, and inventories the complete candidate suite. Every `ready_for_review`
event therefore runs all active candidate specs.

Trusted selector code inventories the untrusted candidate tree as data using a
fixed `playwright/tests/*.spec.ts` predicate. Full mode includes every matching
candidate spec exactly once. It never relies on the trusted branch's list of
active files, because that list can omit a spec added by the PR.

Profile assignment is conservative:

1. A candidate spec whose basename exists in the trusted `v3`
   `playwright/profiles.json` receives that trusted profile.
2. A new or renamed candidate spec receives the maximal validated profile union
   from the trusted runtime contract: every app named by any trusted Playwright
   profile, canonicalized once.
3. Candidate changes to `playwright/profiles.json` force full mode but do not
   alter current-run profile assignments. They take effect after merge.
4. An empty inventory, duplicate basename, invalid candidate path, invalid
   trusted profile, or profile outside the trusted runtime contract fails the
   planning job rather than silently omitting a test.

This fallback may start more services than a new spec needs, but it prevents a
PR from under-declaring its own runtime and makes newly added tests runnable in
the same PR.

### 6. Define deterministic draft sharding

The selector emits a canonical JSON execution plan containing schema version,
mode, reason codes, selected specs, runtime profiles, estimated durations,
shard count, shard assignments, base SHA, and head SHA.

For a non-empty selected draft subset, selector v1 computes:

1. Use each spec's positive duration from the current timing file.
2. For an untimed spec, use the median positive duration in its runtime profile.
3. If that profile has no timing, use the global positive-duration median.
4. If no timing data exists, use the versioned fallback of 120 seconds.
5. Set `targetShardSeconds` to 600.
6. Set `shardCount` to
   `min(4, selectedFileCount, max(1, ceil(totalEstimatedSeconds / 600)))`.
7. Assign files with the existing deterministic longest-duration-first greedy
   algorithm and stable lexical tie-breaking.

Ready mode, any full-suite reason, missing timing metadata required to parse the
file, or selector validation failure overrides the formula and uses the exact
full eight-shard matrix. Empty selected mode is a true skip and creates no test
matrix.

All constants and reason codes are versioned and fixture-tested. Changing them
requires a selector schema bump and shadow evidence.

### 7. Use one backend-neutral execution envelope

M3 consolidates selection and execution behind the reusable workflow pinned as
`uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`.
The caller does not implement a separate hosted selection path.

The reusable workflow uses the separate trusted control checkout from Decision
5 to compute one execution-plan artifact, then both hosted and public jobs
consume that artifact. Route selection changes only the runner labels and
container architecture; it cannot change mode, selected specs, profiles,
matrix, artifacts, or final status semantics.

This means draft forks, bots, private repositories, disabled rollout cases, and
public-pool overflow still run the same selective draft plan on GitHub-hosted
workers. Ready PRs run the same full plan on either backend.

The reusable workflow independently rejects inconsistent caller inputs and
recomputes event-sensitive mode from the immutable event payload. A malicious
or stale caller cannot ask a draft run to masquerade as ready, or a ready run to
skip the full suite.

Direct pushes to `v3` and `v3*` use explicit hosted/full mode. They preserve the
current eight result artifacts, artifact names, timing metadata, and the inputs
consumed by `update-playwright-timings.yml`. Push mode never uses the public PR
runner group or selective routing.

### 8. Make lifecycle and cancellation route-neutral

Add `converted_to_draft` to the caller events. `ready_for_review` triggers the
full suite without a code change. A later `synchronize` uses the current draft
state.

Put the PR-wide route-neutral concurrency identity only on the single reusable-
workflow caller job. Do not place the same concurrency group on jobs inside the
called workflow, because sibling jobs in one run must not cancel each other.
The required-status job remains outside that group and unconstrained so it can
report the current invocation result.

A synchronization, ready transition, draft transition, or backend change
cancels the obsolete reusable invocation on either backend. Exactly one current
`test-playwright-status` remains the required status.

### 9. Roll out smart drafts independently

Existing variables continue to control whether eligible jobs may use the public
pool. They do not activate selective draft execution.

Add two independent controls:

- `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED`, absent or non-`true` by default;
- `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_CANARY_PR`, an optional exact PR number.
- `PUBLIC_PR_ARM64_PLAYWRIGHT_FORCE_HOSTED_CANARY_PR`, an optional exact PR
  number that routes only that PR to hosted workers without disabling the
  public pool globally.

Before either variable is changed, a fresh organization-policy readback must
prove:

- organization `uzh-bf`;
- group `public-pr-arm64`;
- selected repository only `uzh-bf/klicker-uzh`;
- exact selected workflow
  `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`;
- workflow restriction enabled;
- public repositories allowed intentionally;
- all expected runner names online.

The user owns the short-lived organization token and launches the existing
policy-lock script in read-only/check mode. The execution orchestrator may
prepare the exact command but must not receive or print the token. Repository
variable mutation and restoration are separate explicit approvals. If approved,
the execution orchestrator uses host `gh` to set only the named repository
variables and immediately reads them back.

Stop the rollout and restore smart-draft variables to disabled when any canary
shows runner-group drift, wrong mode, missing specs, duplicate current status,
unexpected cache write, secret exposure, obsolete work surviving cancellation,
or a selector result that does not match its fixture contract.

### 10. Enforce the complete public boundary statically

Extend the workflow policy validator beyond cache action names. It must reject:

- any self-hosted public job with permissions beyond the approved minimum;
- any secret, `TURBO_TOKEN`, `TURBO_TEAM`, cache-signing key, or write credential;
- `pull_request_target` execution;
- checkout with persisted credentials;
- cache save or combined restore/save actions in public PR jobs;
- an unpinned or non-canonical reusable-workflow ref;
- direct public runner labels outside the one approved reusable workflow;
- execution of queue-inspection logic on self-hosted workers.

Queue-delay telemetry starts in M1. It runs after execution in a GitHub-hosted
job that does not check out PR code. It receives only `actions: read` plus the
default metadata needed for the scoped current-run API query. That permission
is not granted to planning, build, public execution, or PR-code jobs. M4 consumes
this evidence; it does not introduce the collector.

### 11. Defer profile-scoped builds until measured

The profile runtime already avoids starting unrelated services. Cache reuse may
remove enough build cost that a new artifact contract is unnecessary.

Arm a profile-scoped build package only after at least 20 ready runs if the
cache-warm median build remains above 90 seconds or above 15% of total wall
time. Its design must:

- compute the union of selected runtime profiles before building;
- map profiles to exact Turbo filters and required transitive dependencies;
- validate an explicit artifact manifest before upload;
- fall back to the complete build on unknown mappings or missing outputs;
- prove each profile alone and all profile unions against the current runtime
  contract.

### 12. Defer queue-aware overflow until measured

Arm hosted overflow only if at least 20 ready runs show public-runner queue delay
above 90 seconds at the p50 or above 180 seconds at the p95.

The admission job runs in the unified reusable envelope, before checkout, on a
GitHub-hosted runner. It selects public execution only when projected demand
fits currently idle public slots; API ambiguity, rate limiting, or races fail to
GitHub-hosted execution. The route-neutral concurrency identity prevents a
backend flip from leaving old work alive.

### 13. Keep four processes per host for now

The eight current processes provide eight-way suite concurrency. Do not reduce
or increase processes based on per-job intuition. Revisit only with per-host
CPU, memory, disk I/O, container startup, and job-duration telemetry showing
sustained contention and a reproducible improvement from a different density.

### 14. Treat self-hosted remote cache as an optional service

Evaluate an owned Remote Cache API only after at least 20 ready cache-enabled
runs if either:

- Turbo hit rate remains below 70%, or
- median Actions cache transfer exceeds 60 seconds and does not save more build
  time than it costs.

The pilot is a separate plan and approval. Minimum design constraints are:

- deploy outside public runner hosts and private application networks;
- store only public-source-derived artifacts;
- separate trusted write credentials from public read access;
- use short-lived or anonymous namespace-limited reads for PRs;
- authenticate and authorize every write;
- namespace by repository, architecture, cache schema, and toolchain;
- enforce quotas, object-size limits, rate limits, retention, audit logs, and
  deletion procedures;
- verify artifact integrity before reuse;
- keep a cache-disabled fail-open build path;
- document operator ownership, upgrades, backup expectations, and outage
  behavior.

This service could later replace the existing Vercel-backed Turbo cache only in
a separately reviewed migration. M1 does not make that change.

## Delivery topology

Each milestone starts from fresh `v3`, lands as one cohesive PR unless its
metrics gate explicitly splits it, and updates this plan's `Progress` section.
M1 commits this shared plan. Later branches inspect the plan from `v3` and
update it rather than creating a second plan root.

### M1 — Cache correctness and observability

**Dependency:** none.

**M1.1 — Freeze the cache and build contract**

- Problem: current x64 and ARM64 Playwright cache keys do not fully encode
  compatibility, and Turbo outputs have not been audited for trusted reuse.
- Do: document the key schema, immutable build image, fixed synthetic build env,
  cacheable Turbo outputs, excluded transient outputs, and cache-disabled path.
  Audit `.next/dev`, `.next/cache`, generated Prisma state, and all uploaded
  runtime artifacts before admitting them to the cache.
- Check: fixture-based key compatibility tests and a static manifest test prove
  that a toolchain, architecture, build-image, lockfile, workspace, Turbo, or
  environment-schema change invalidates the proper cache layer.
- Acceptance: the contract has no secrets, x64/ARM64 collision, mutable image,
  or runtime artifact ambiguity.
- Route: main session because this is the trust and architecture boundary.

**M1.2 — Add the trusted writer and restore-only readers**

- Problem: public builds currently miss both pnpm and Turbo Actions cache.
- Do: add the trusted `v3` ARM64 seed workflow, align hosted/public readers, add
  schema and enable controls, and extend the public-boundary validator.
- Check: workflow syntax/policy tests; manual-dispatch wrong-ref rejection;
  cache-disabled build; trusted `v3` save; public PR restore with matching
  fingerprint; forced cache miss still succeeds.
- Acceptance: only trusted `v3` writes, every public PR path is restore-only,
  and no Turbo/Vercel or cache-signing credentials enter public jobs.
- Route: executor.

**M1.3 — Add actionable telemetry and documentation**

- Problem: build time alone cannot distinguish cache transfer, cache hits, Turbo
  work, queue delay, or test duration.
- Do: emit a compact artifact and step summary with route, mode, cache keys,
  restore results, bytes/time where available, Turbo cached/total tasks, build
  duration, queue delay, shard durations, runner names, and status outcome.
  Add the hosted, no-checkout, current-run queue collector with only
  `actions: read`.
  Update `docs/ci-and-deployment.md` and
  `.agents/skills/klicker-playwright-e2e/SKILL.md`.
- Check: schema test plus one cache-miss and one cache-hit run produce complete,
  non-secret summaries.
- Acceptance: 20-run comparison data can be collected without reading raw logs.
- Route: executor.

**M1.4 — Prove restore with one post-merge cache canary**

- Problem: restore cannot be accepted while the global cache control remains
  disabled, and global activation is too broad for first proof.
- Do: after M1 merges and the exact `v3` seed succeeds, use the M2 shadow PR as
  the exact canary. Before its first post-open update, request explicit approval
  to set
  `PUBLIC_PR_PLAYWRIGHT_CACHE_CANARY_PR=<number>` while leaving global cache
  enablement false. The main session performs the host `gh` mutation and
  immediate readback. A normal, traceable M2 plan/implementation commit is then
  pushed under its already-approved PR delivery boundary; the resulting
  `synchronize` event is the exact canary trigger. The main session follows that
  exact-head run, removes the canary value, and reads back the disabled state.
- Check: the nominated run restores the expected ARM64 fingerprint, reports
  hit/miss and transfer/build timings, executes no cache save, and passes. A
  second cache-disabled run or fixture proves the ordinary path remains valid.
- Acceptance: exact trusted writer SHA and cache key match the reader evidence;
  the variable is restored to disabled; runner-group policy remains unchanged.
- Route: main session. Variable mutation and restoration require a separate
  explicit user approval. If approval is withheld, M1 is delivered but remains
  `acceptance pending`; M2 shadow work may not claim cache performance benefits.

**Milestone acceptance:** cache creation and M1.4 restore are proven on exact
merged `v3`; normal no-cache execution remains green; the runner-group policy is
unchanged. Do not activate smart routing in M1. Without M1.4 authority, record
the milestone as delivered but acceptance-pending.

### M2 — Selector shadow mode

**Dependency:** M1 merged and telemetry available.

**M2.1 — Implement the versioned relevance selector**

- Problem: coarse path filtering cannot safely express draft relevance.
- Do: add the relevance manifest, rename-aware null-delimited diff parser,
  selector reason codes, selected-spec output, profile union, and fail-closed
  full-suite behavior.
- Check: table-driven fixtures cover direct spec edits; spec add, delete, and
  both rename directions; known feature paths; documentation-only paths; every
  root/global surface; unknown paths; malformed diff records; stacked PR base
  ranges; divergent base history; shallow/missing object failure; and missing
  manifest entries. All use the exact merge-base algorithm from Decision 5.
- Acceptance: the selector is the sole skip authority and the exact frozen
  outcomes in Decision 5 pass.
- Route: executor.

**M2.2 — Implement deterministic dynamic sharding**

- Problem: fixed eight-way sharding wastes slots for a small draft subset.
- Do: extend the existing timing-aware sharder to consume the canonical plan and
  implement Decision 6 exactly.
- Check: fixtures cover timing/profile/global fallback, lexical ties, one to
  four selected shards, selected-file cap, full eight override, no empty shard,
  exact-once file assignment, and stable output across repeated runs.
- Acceptance: every selected spec appears once, no unselected spec appears, and
  the same inputs produce byte-identical JSON.
- Route: executor after M2.1 output schema is fixed.

**M2.3 — Observe decisions without changing execution**

- Problem: path mappings need empirical comparison before they can skip tests.
- Do: add `converted_to_draft` and a hosted-only shadow-planning job. It uses the
  trusted `v3` control checkout and untrusted candidate data, publishes the plan
  as telemetry, and never requests `public-pr-arm64`. Keep the existing full
  hosted/public execution and draft public-runner rejection unchanged. Moving
  shadow planning into the unified reusable envelope waits for M3.
- Check: at least 10 representative draft heads compare the proposed subset
  with full-suite outcomes; every failure outside a proposed subset is reviewed
  and either expands the manifest or blocks activation.
- Acceptance: zero unexplained missed failures, deterministic summaries, and no
  public-runner policy change or public slot allocated by draft shadow planning.
- Route: main session; evidence collection may use one bounded watcher only.

**Milestone acceptance:** selector v1 and its evidence are merged, but drafts
still execute the full suite. Update CI docs, Playwright skill, and this plan's
`Progress`.

### M3 — Activate draft-selective and ready-full execution

**Dependency:** M2 merged; at least 10 shadow draft heads with no unexplained
missed failure; fresh runner-group readback passes.

**M3.1 — Unify hosted and public execution**

- Problem: current backends can apply different selection and cancellation
  behavior.
- Do: move both routes behind the exact pinned reusable envelope, consume one
  canonical plan, use route-neutral concurrency, and preserve one aggregate
  required status.
- Check: event/backend matrix proves draft, ready, fork, bot, private, disabled,
  canary, public, and hosted cases receive the expected identical plan. A
  synchronization that changes backend cancels the obsolete reusable invocation
  without canceling sibling jobs in the current called workflow.
- Acceptance: backend selection changes only `runs-on`/architecture details; it
  cannot alter selected tests or status semantics.
- Route: main session due cross-workflow and runner-policy coupling.

**M3.2 — Add default-off smart-routing gates**

- Problem: removing the draft rejection while the existing public rollout is
  enabled could activate every draft immediately.
- Do: add the independent smart-draft canary/global variables, keep both absent
  as disabled, and encode rollback/readback instructions.
- Check: absent, false, malformed, canary-match, canary-mismatch, and global true
  fixtures all fail to the intended mode and backend.
- Acceptance: merge alone changes no draft execution behavior.
- Route: executor.

**M3.3 — Canary the lifecycle**

- Problem: static tests cannot prove GitHub event transitions, runner names, or
  artifacts.
- Do: after explicit variable-mutation approval, select one same-repository
  draft canary. Prove selective execution, then mark it ready without a code
  change and prove exact full eight-shard execution. Convert it back to draft and
  prove obsolete work cancels and selective mode returns. Then set and read back
  `PUBLIC_PR_ARM64_PLAYWRIGHT_FORCE_HOSTED_CANARY_PR` for that exact PR while
  leaving public routing globally enabled. Push a traceable plan `Progress`
  update under the approved PR boundary; its `synchronize` event is the exact
  hosted selective trigger. Clear and read back the force-hosted variable after
  proof.
- Check: exact heads, plan artifacts, actual runner names, selected specs,
  profiles, shard count, exact-once coverage, build/cache telemetry, artifacts,
  and `test-playwright-status` all match.
- Acceptance: one draft-selective/public, one ready-full/public, one
  converted-draft/public, and one hosted-fallback lifecycle pass with no policy
  drift. Variable mutation alone is never counted as a trigger.
- Route: main session; one watcher. Review-state changes remain an external user
  action.

**M3.4 — Global activation**

- Problem: canary success does not authorize repository-wide behavior.
- Do: present evidence and request a separate explicit approval to set
  `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED=true` and clear the canary variable.
- Check: immediate readback and first three eligible draft runs; stop on any
  Decision 9 condition.
- Acceptance: drafts use selected 1-4 shards, ready PRs use full 8, and all
  ineligible/public-disabled cases preserve the same plan on hosted workers.
- Route: main session after the external approval boundary.

**M3.5 — Preserve trusted push behavior**

- Problem: `v3`/`v3*` push runs feed the timing-update workflow and must not be
  altered accidentally by PR routing consolidation.
- Do: route pushes through explicit hosted/full mode and preserve all eight
  result artifact names and timing metadata.
- Check: push fixtures plus one exact merged `v3` run prove full eight-shard
  execution and successful timing-workflow consumption.
- Acceptance: PR routing changes do not change direct-push coverage or timing
  update inputs.
- Route: main session because it closes the cross-workflow compatibility seam.

**Milestone acceptance:** the two-mode lifecycle works on both backends,
trusted pushes preserve all timing inputs, the runner group remains exact, and
rollback is rehearsed. Update CI docs, Playwright skill, and this plan's
`Progress`.

### M4 — Metrics-gated remaining bottlenecks

M4 is not one automatic PR. After 20 cache-enabled ready runs, prepare a
read-only report and open only the packages whose thresholds are met.

**M4.0 — Read-only threshold report**

- Owner: main session.
- Dependency: 20 normalized accepted runs from M1 telemetry.
- Do: summarize cache hit/transfer/build time, queue p50/p95, shard wall time,
  runner density, and total critical path without mutating workflows or hosts.
- Cohort: exactly 20 successful, non-cancelled, ready/full public ARM64 runs with
  all eight shards, the same runner-pool size and four-process host density, the
  same architecture, immutable build-image digest, toolchain fingerprint, cache
  schema, selector schema, and cache-restore outcome `hit`. A change to any field
  starts a new cohort. Hosted runs, misses, skips, selective drafts, failed runs,
  and cancelled runs are reported separately and never enter threshold
  calculations. Cancelled/failed runs remain visible as operational signals but
  cannot arm M4.
- Acceptance: explicitly arm or decline M4.A, M4.B, and the separate remote-cache
  pilot against their frozen thresholds.

**M4.A — Profile-scoped build and artifact package**

- Dependency: Decision 11 threshold met.
- Do/check/acceptance: implement and prove the profile/filter/artifact contract
  in Decision 11, including fail-closed full build.
- Route: executor.

**M4.B — Queue-aware hosted overflow package**

- Dependency: Decision 12 threshold met and M3 unified envelope merged.
- Do/check/acceptance: add the GitHub-hosted no-checkout admission job, narrow
  `actions: read`, route-neutral cancellation, ambiguity-to-hosted fallback, and
  exact status proof.
- Route: main session because it crosses permissions, API reliability, cost, and
  runner capacity.

Each armed M4 package uses its own fresh branch and PR, updates CI docs,
Playwright skill, and this plan's `Progress`, and requires a new approval before
any repository-variable mutation.

## Separate proposed tasks after M1-M4

These tasks are not authorized by this plan and do not share an implementation
branch:

1. **Runner-host reconciliation:** pre-pull exact container images and perform
   bounded host maintenance only while every `Runner.Worker` is absent. No broad
   prune, sysctl tuning, or custom runner image without measured evidence.
2. **Other-repository onboarding:** update `rs-github-runner-onboarding` with a
   generic trusted-workflow, restore-only cache, selector, canary, policy
   readback, and acceptance template. This changes a shared skill outside this
   repository and needs separate authority and launcher.
3. **Owned Remote Cache API pilot:** design, deploy, and qualify an API-compatible
   cache service under Decision 14. This is infrastructure, security, and
   operational ownership work with a separate ADR and explicit deployment
   approval.
4. **Playwright flake remediation:** diagnose functional failures independently
   from routing and runner performance.

## Delegation map

Every slice has one implementation/evidence owner. The main session always owns
integration and final verification; that integration duty is not co-ownership of
the slice. User approvals are external gates, not implementation ownership.

| Item | Exact owner | Depends on | Integration | External approval | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| M1.1 cache contract | Main | None | Main | None | Key/output/env fixtures and trust review |
| M1.2 seed/read workflows | Executor | M1.1 | Main | PR delivery gates | No-cache and trusted save |
| M1.3 telemetry/docs | Executor | M1.1 | Main | PR delivery gates | Hit/miss/queue summaries and redaction |
| M1.4 cache canary | Main | M1.2 merged seed | Main | Variable set and restore | Public restore and disabled readback |
| M2.1 selector | Executor | M1 | Main | PR delivery gates | Full trusted-selector fixture table |
| M2.2 sharder | Executor | M2.1 schema | Main | PR delivery gates | Determinism/exact-once fixtures |
| M2.3 shadow evidence | Main | M2.1-M2.2 | Main | PR delivery gates | 10 draft/full comparisons |
| M3.1 unified envelope | Main | M2 | Main | PR delivery gates | Backend/event/cancellation matrix |
| M3.2 smart gates | Executor | M3.1 | Main | PR delivery gates | Default-off predicate fixtures |
| M3.3 lifecycle canary | Main | M3.1-M3.2, policy readback | Main | Variable and review-state changes | Exact runner/job/artifact evidence |
| M3.4 global activation | Main | M3.3 | Main | Global variable mutation | Readback and first 3 drafts |
| M3.5 push preservation | Main | M3.1 | Main | PR delivery gates | Push artifacts and timing update |
| M4.0 threshold report | Main | 20 ready runs | Main | None, read-only | Frozen threshold dispositions |
| M4.A scoped build | Executor | M4.0 arms A | Main | New package execution/delivery | Profile/union/artifact canaries |
| M4.B overflow | Main | M4.0 arms B, M3 | Main | New package execution/delivery | Queue/API/backend-flip canaries |
| M5 runner-host reconciliation | Separate task (proposed) | M4.0 evidence | Separate task | Host mutation | Idle-host reconciliation proof |
| M5 onboarding skill | Separate task (proposed) | M3 accepted | Separate task | Cross-repo skill edit | Generic onboarding qualification |
| M5 Remote Cache API | Separate task (proposed) | M4.0 arms pilot | Separate task | ADR, infrastructure, deploy | Security/performance/outage pilot |
| M5 flake remediation | Separate task (proposed) | Independent | Separate task | Separate plan | Reproduced and fixed failures |

Before each delegated implementation, the main session applies the configured
privacy/secret preflight, gives the child a disjoint write set, and verifies the
result. Security decisions, external mutations, integration, and final proof
remain with the main session.

## Test portfolio

### Static policy tests

- Canonical reusable ref is exactly `@refs/heads/v3`.
- Only the approved reusable workflow can name `public-pr-arm64`.
- Self-hosted public jobs use minimal permissions, no secrets, no persisted
  checkout credentials, no cache writes, and no `pull_request_target`.
- Queue inspection remains hosted, no-checkout, and narrowly scoped.
- Trusted seed rejects non-`v3` refs and uses the immutable build image.

### Cache tests

- Key changes for architecture, image digest, Node, pnpm, lockfile, Turbo config,
  workspace config, and synthetic environment schema.
- Restore prefixes never cross x64/ARM64 or schema boundaries.
- Public jobs cannot save.
- Cache disabled, miss, hit, corruption/unavailable fallback, and schema-bump
  paths all produce a valid build.
- Turbo output audit excludes transient or unsafe state and includes every
  runtime artifact required by shards.

### Selector tests

- Modified, added, deleted, and renamed specs have the exact Decision 5 outcome.
- Trusted code inventories every candidate `playwright/tests/*.spec.ts` exactly
  once; newly added/renamed specs receive the trusted maximal-profile fallback.
- Known feature/app groups produce the expected spec union.
- Shared/global/root paths force full.
- Explicit docs-only paths skip in draft and force full when ready.
- Unknown and malformed input force full.
- Null-delimited names with spaces and rename records parse safely.
- Exact event base/head objects and stacked-branch ranges use the frozen merge-
  base algorithm, including divergent history and missing/shallow-object failure.
- Missing manifest/profile/timing data fails closed.
- Policy files are loaded only from the trusted `v3` checkout; PR policy changes
  force full and cannot alter current execution.

### Sharding tests

- Formula constants and fallback medians are versioned.
- One to four selected shards and exact full eight override.
- No empty shards, duplicates, omissions, or unselected files.
- Stable lexical tie-breaking and byte-identical repeated output.
- Runtime-profile unions match assigned specs.

### Workflow lifecycle tests

- opened, synchronize, reopened, ready-for-review, and converted-to-draft.
- Draft selective, ready full, docs-only skip, and unknown full.
- Same-repository public, fork, bot, private, rollout disabled, canary, and
  hosted overflow consume the same plan.
- M2 shadow planning is hosted-only and cannot allocate a public runner.
- Backend flip and lifecycle transition cancel obsolete jobs.
- One current `test-playwright-status` reports skip, pass, failure, or
  cancellation correctly.
- `v3` and `v3*` pushes use hosted/full eight-shard mode and preserve all timing
  artifact names and metadata.

### Live canaries

- M1: exact merged `v3` writer, cache-disabled build, later PR restore.
- M2: 10 shadow draft/full comparisons.
- M3: draft -> ready -> draft on public runners plus hosted fallback.
- M4.A if armed: every profile and all profile unions.
- M4.B if armed: idle pool, saturated pool, API ambiguity/rate limit, and backend
  flip.

## Documentation and maintenance

Every behavior-changing milestone updates:

- `docs/ci-and-deployment.md` with behavior, trust boundary, controls,
  observability, recovery, and operator commands;
- `.agents/skills/klicker-playwright-e2e/SKILL.md` with draft/full expectations,
  selector evidence, cache interpretation, and canary proof;
- this plan's `Progress` and exact acceptance evidence.

The relevance manifest must state its owner and review rule. Feature PRs that add
or move Playwright specs update the manifest or intentionally fall back to full.

## Rollback

1. Set `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED` to false or remove it, and
   clear the canary variable. Drafts return to full execution without changing
   the public/hosted route.
2. Set `PUBLIC_PR_PLAYWRIGHT_CACHE_ENABLED` to false. Builds ignore shared
   Playwright caches and continue normally.
   Also clear `PUBLIC_PR_PLAYWRIGHT_CACHE_CANARY_PR`.
3. Bump `PLAYWRIGHT_CACHE_SCHEMA` to invalidate a bad cache family.
4. Disable public-pool routing with the existing variables to preserve the same
   full/selective plan on GitHub-hosted workers.
5. Revert the milestone PR only if controls cannot restore correct behavior.

Variable mutations and restoration require explicit approval and immediate
readback. Runner-group changes are not part of rollback; any policy drift stops
the rollout for separate repair.

## Authority and stop conditions

### Authorized by approval of this plan

Only if the user later approves execution, the execution orchestrator may create
the named fresh worktrees/branches, implement M1-M3 sequentially, run repository
checks and required reviews, update this plan, make local conventional commits,
and prepare each milestone for the next named delivery boundary.

### Separately gated

- pushing and opening each PR;
- making a PR ready, merging, or deleting branches/worktrees;
- changing repository variables;
- runner-group or organization settings;
- runner-host reconciliation;
- deploying an owned cache service;
- editing shared onboarding skills outside this repository.

Stop and return to the user when a metric gate changes which M4 package is
needed, a trust invariant cannot be proved, representative full-suite evidence
finds an unexplained selector miss, or an external mutation needs approval.

## Plan hardening

The required native planner review identified gaps in backend parity, selector
authority, deterministic sharding, trusted cache writing, rollout controls,
canonical workflow pinning, existing Turbo cache coexistence, public policy
validation, route-neutral cancellation, trusted policy provenance, exact diff
semantics, push compatibility, queue telemetry, cache canary authority,
candidate inventory/profile fallback, hosted-only shadow planning, explicit
canary triggers, normalized telemetry cohorts, and delegation ownership. This
revision incorporates each finding.

The native planner returned `REVISE` in all three permitted rounds. The final
round's five findings were accepted and incorporated, but the default round cap
prevents a fourth verification pass. The formal stop state is therefore
`review_deadlock`, with one documented dissent: these final revisions are
main-session verified but do not have a terminal planner `APPROVED` verdict.
Execution requires the user to accept this documented dissent, raise the review
round cap, revise scope, or abandon the plan.

The optional opposing-provider plan review did not return a result before its
bounded timeout. It is recorded as unavailable and does not replace the required
native planner gate.

## Progress

- [x] Refreshed `origin/v3` and created a clean plan worktree at exact baseline
  `5a21988fb1b4acd285d60d3c41f481f0a96be892`.
- [x] Inspected the caller, public reusable workflow, selector/sharder, runtime
  profiles, Turbo configuration, existing CI plans, and current cache use.
- [x] Collected exact public ARM64 and GitHub-hosted run evidence.
- [x] Confirmed from official documentation that Vercel is optional and a
  custom Remote Cache API is supported.
- [x] Completed one native planner challenge round and incorporated its findings.
- [x] Reached the three-round plan-hardening cap; recorded `review_deadlock` and
  incorporated every final-round finding without fabricating approval.
- [x] User accepted the documented plan-hardening dissent and authorized
  execution through a goal.
- [x] M1 cache correctness and observability implemented and locally verified
  in `fe9e02cab4edbbea7eb8a47a28d29202fe066cbc`; focused tests (12),
  `check:playwright-ci` (16), full build (23 tasks), and `check:all` (25 tasks)
  pass. Post-merge cache creation and restore canary remain externally gated.
- [x] M2.1 selector implemented locally with trusted policy provenance,
  rename-aware null-delimited diff handling, candidate inventory validation,
  conservative profile fallback, and selector tests (7 passing).
- [x] M2.2 deterministic selected-subset sharding implemented in
  `9d9bb7b86`; selected plans use profile/global medians, the 120-second
  fallback, a four-shard cap, stable greedy assignment, and exact-once tests.
- [x] M2.3 hosted-only selector shadow planning implemented locally in the
  current branch. It observes all pull-request lifecycle transitions, loads
  selector policy from trusted `v3`, treats candidate code as data, and never
  allocates the public runner group. Representative ten-head evidence remains
  externally gated until this slice is delivered to `v3`.
- [x] M3.1/M3.2 local unified execution envelope and default-off smart routing
  implemented in `49185181c`. Trusted hosted preparation computes one route and
  canonical plan; hosted and public backends consume the same artifact; ready
  runs require exactly eight shards; drafts remain hosted/full unless the
  independent smart-draft control enables a selected plan. Public jobs use
  trusted `v3` remote composite actions, restore-only caches, no secrets, and
  the existing Klicker-only runner group.
- [x] M3 local verification completed: 39 focused tests, repository-wide checks
  (25 tasks), workflow policy validation, YAML parsing, and the cached build
  (23 tasks) passed. Node 26.8.1 emitted the existing warning because the repo
  pins Node 24.
- [x] M3.2 rollback-control fixtures now cover false, malformed, and
  non-matching smart-draft controls plus exact canary rollback to hosted
  execution; the focused suite passes 41 tests.
- [x] M3 route eligibility now fails closed when repository, head repository,
  author, or pull-request number identity is missing or malformed; regression
  coverage is committed in `c3f3fe753` and the focused suite passes 42 tests.
- [x] Cache consumers now fail open when the contract is unavailable or the
  Actions cache service misses/fails: they skip restoration and continue with
  a normal install/build. The trusted seed keeps its strict contract check;
  repository-wide checks remain green after this hardening.
- [x] The cache fingerprint now includes both trusted composite action
  definitions, so changes to build or shard setup cannot reuse stale cached
  artifacts; the cache-contract fixtures cover the added inputs.
- [x] `check:playwright-ci` now runs the cache-contract, Playwright telemetry,
  and Turbo telemetry tests alongside selector and workflow checks; the
  complete focused gate passes 48 tests.
- [x] Read-only v3 baseline checked on 2026-08-31: [run
  33368808077](https://github.com/uzh-bf/klicker-uzh/actions/runs/33368808077)
  used hosted build and eight hosted shards; the build took 2m10s and the
  shards started within one second and finished 11m14s–16m18s later. The run
  was not a public-runner sample. Its build succeeded, while one hosted shard
  failed six Playwright tests; the public route was skipped. This is a test
  baseline failure, not evidence of a runner or cache regression. The prior
  [public canary
  33205237613](https://github.com/uzh-bf/klicker-uzh/actions/runs/33205237613)
  used three ARM64 shards: preparation took 19s, build took 7m51s, and shards
  took 35m30s–40m27s, with one failure. These samples are not comparable and
  are far below the M4 threshold of 20 accepted ready/full cache-hit runs, so
  no M4 package is armed.
- [x] Current remote drift was rechecked after the final local gate: `origin/v3`
  is `fed364a338104b4cdd12f97649d22edb5b124a8b`, two commits beyond this
  branch's base. The two commits overlap the workflow, helper, package, and
  documentation files in this plan, so no automatic integration was attempted.
- [x] A current runner-group readback was attempted read-only but the available
  GitHub token lacks the organization runner-group permission (`admin:org`).
  The last confirmed policy remains the Klicker-only `public-pr-arm64` group
  restricted to the exact `public-pr-playwright-shards.yml@refs/heads/v3`
  workflow; fresh proof remains pending an authorized readback.
- [x] Repository control variables were checked read-only on 2026-08-31:
  `PUBLIC_PR_ARM64_PLAYWRIGHT_ENABLED=true` and
  `PUBLIC_PR_ARM64_PLAYWRIGHT_CANARY_PR=0`; the smart-draft and Playwright
  cache controls are not present. The new routing and cache paths therefore
  cannot be live until the branch is delivered and their controls are created.
- [x] A read-only run lookup confirmed that `playwright-cache-seed.yml` is not
  present on the remote default branch, so no trusted seed or new cache-hit
  cohort exists yet. M4 therefore remains unarmed rather than merely
  unmeasured.
- [x] PR review remediation now captures both build pipeline exit statuses,
  pins trusted control checkouts to the called workflow commit, keeps telemetry
  and cache-save failures from masking build outcomes, validates complete shard
  coverage and safe reason codes, hardens route fallbacks, and adds direct
  duration/profile-median/cache-fingerprint coverage. The focused CI contract
  suite passes 57 tests locally; updated PR delivery and exact-head CI remain
  pending.
- [ ] M2 selector shadow evidence: compare at least ten representative draft
  plans with the authoritative full suite and disposition every miss.
- [ ] M3 canary and global activation; live proof still requires the exact
  `v3` delivery, runner-group readback, and separately approved controls.
- [ ] M4 read-only metric decision and any separately approved packages.
