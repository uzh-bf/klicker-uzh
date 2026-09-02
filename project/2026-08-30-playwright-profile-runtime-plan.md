# Playwright profile-aware CI runtime plan

Date: 2026-08-30. Branch: `rs/playwright-ci-profiles` at exact `origin/v3`
`e84103606`. Target: `v3`. Pull request: #5683.

## Goal

- Stop starting every Klicker application and Hatchet worker in every
  Playwright shard.
- Reuse the same named profile contract that already scopes managed local
  development, while keeping test-to-profile and app-to-package knowledge in
  KlickerUZH.
- Reduce CPU, memory, startup contention, and readiness time on the existing
  eight ARM64 runners without adding hosts or changing runner settings.

## Non-goals

- Do not run `devrouter ensure`, expose the host Docker socket, or let Devrouter
  mutate a GitHub runner.
- Do not dynamically create GitHub Actions service containers. Actions fixes
  service topology before repository steps execute, so Postgres, Redis, and
  Hatchet remain statically declared in the first iteration.
- Do not change Playwright workers, retries, test behavior, shard count,
  database isolation, runner-group policy, secrets, or cache write policy.
- Do not change runner hosts or organization settings.

## Execution contract

- Execution owner: this main session. No new subagents are created.
- Authority: the approved cross-repository plan in Devrouter
  `docs/project/2026-08-30-ci-profile-plan-contract-plan.md` extends this package
  through exact `@devrouter/cli` `0.0.51` adoption, one merge of `origin/v3`,
  push, PR qualification, safe merge, and first eligible public-runner proof.
- Terminal: the source package is merged, exact-head CI passes, and the first
  safe eligible public run proves the restricted runner route or records
  `delivery_pending` when no trigger exists.
- Withheld: rebase, force-push, runner settings, secrets, cleanup, and unrelated
  source changes.
- Pause: Devrouter's report changes incompatibly; a spec cannot be mapped
  safely; or runtime selection requires a secret or host-control capability.

## Package boundary and coordination

- Worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/playwright-ci-profiles`.
- PR #5678 merged with the repository metadata pin at `0.0.46`; PR #5681 later
  advanced it to `0.0.50`. This branch now advances the exact root dependency
  and repository metadata to published `0.0.51`.
- Upstream Devrouter plan:
  `docs/project/2026-08-30-ci-profile-plan-contract-plan.md` on merged PR #50.
- Devrouter `0.0.51` is published from merge commit `93acdcae80be4688bd792ed3256e2e37b5e47ede`
  and adds the strict side-effect-free profile-plan contract.
- The runner group remains locked to
  `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`.
  This package does not widen repository or workflow access.

## Runtime design

### Test-to-profile manifest

Add one versioned manifest that assigns every active `playwright/tests/*.spec.ts`
file to exactly one profile selection. The initial conservative groups are:

- normal application coverage: `manage,pwa`;
- login and Chat coverage: `manage,chat`;
- controller and live-quiz coverage: `manage,live-quiz`.

The shard planner validates that every active spec appears exactly once and
that no stale manifest entry remains. It emits the selected files and the
canonical union of their profiles. A new spec without an explicit assignment
fails planning instead of silently receiving an undersized runtime.

### Profile-to-runtime adapter

Pin the released `@devrouter/cli` exactly and invoke only:

```text
devrouter profile plan --repo . --profile <selection> \
  --contract playwright/runtime-contract.yml --output <plan> --json
```

The repository-owned contract maps exact app names to literal Turbo filters and
loopback readiness URLs, constrains selected services, and requires the exact
managed process marker. Devrouter owns profile syntax, defaults, merging,
wildcards, resource validation, deterministic binding aggregation, and secure
output. The thin Klicker adapter owns expected binding keys, safe literal
shapes, and argv construction; it never parses profile names itself.

The start command receives only validated package filters and replaces its
current fixed nine-process list. Readiness waits only for selected HTTP apps
plus the existing database, Redis, and Hatchet dependency checks.

### Workflow use

Both `test-playwright.yml` and `public-pr-playwright-shards.yml` consume the
same shard plan and runtime adapter so hosted fallback and ARM64 execution do
not diverge. The public workflow remains secret-free, same-repository-only,
non-draft, non-bot, restore-only, and restricted by the existing runner group.

## Security and failure behavior

- Public PR code already executes on the dedicated public runner pool. The new
  command reads only checked-in `.devrouter.yml` and
  `playwright/runtime-contract.yml`, then starts only contracted packages.
- Devrouter treats binding values as data. The adapter accepts only exact
  binding keys, scoped Turbo-filter literals, and loopback HTTP endpoints, and
  passes every filter as a distinct argument without a shell.
- Profile or manifest errors fail before application startup. There is no
  fallback to the full stack because that would hide drift and erase the
  performance signal.
- Static service containers remain disposable per job. Persistent runner
  caches stay restore-only and no secret or private repository is exposed.

## Test portfolio

| Risk | Acceptance evidence |
| --- | --- |
| Complete test coverage | every active spec is assigned exactly once; stale and missing entries fail |
| Deterministic shard plan | all eight shards retain exact-once file coverage and canonical profile unions |
| Safe app mapping | every selected app has a contract mapping; unknown resources and unsafe literals fail before argv construction |
| Readiness scope | selected HTTP apps produce the exact endpoint set; unselected Chat, Control, and Response endpoints are absent |
| Unsupported scope | profiles that widen dependencies, services, processes, or unmapped apps fail contract validation |
| Workflow parity | hosted and public workflows invoke one planner/adapter path |
| Runner boundary | no Docker socket, secret, cache save, runner label, runner group, or service-container change |
| Upstream package | published `@devrouter/cli@0.0.51` resolves and plans every real manifest profile union |

## Slices

### K0 - Persist this contract

Add this plan. Check formatting and diff hygiene.
Commit: `docs(ci): plan profile-aware Playwright runtime`.

### K1 - Make shard profiles explicit

Add the exact spec manifest and extend the existing deterministic shard planner
with a machine-readable profile result while preserving its current file-list
mode. Add focused Node tests for complete coverage, stale/missing entries,
canonical unions, and all eight shards.
Commit: `feat(ci): assign Playwright shards to profiles`.

### K2 - Start only resolved applications

Add the side-effect-free CI adapter and profile-aware start wrapper. Replace the
fixed `start:playwright:ci` process list with validated exact filters and scoped
readiness. Test every known app mapping, unknown-app refusal, route-free input,
full input, and argv integrity.
Commit: `feat(ci): scope Playwright services by profile`.

### K3 - Wire both workflows

Consume shard profile output in hosted and public reusable workflows. Add exact
`@devrouter/cli` `0.0.50`, update changed-path filters and the testing wiki, and
preserve all security gates and service containers.
Commit: `ci(playwright): use resolved runtime profiles`.

### K4 - Qualify and measure

Use the exact locked Devrouter CLI for all profile unions and run format, script
tests, YAML parsing, shell syntax, TypeScript, and applicable repository checks.
A branch run can prove this change only on the hosted route:
the public caller intentionally remains pinned to the reusable workflow on
`v3`, and the runner group rejects every other ref. After a separately
authorized merge, the first direct `v3` public run must prove runner names,
profile summaries, process counts, readiness, all eight artifacts, and
`test-playwright-status`. Compare startup and shard wall time with the recorded
eight-runner baseline; do not claim a speedup from static checks.

### K5 - Consume the reusable profile-plan contract

Move app-to-Turbo, endpoint, service, and process policy into
`playwright/runtime-contract.yml`. Upgrade to exact Devrouter `0.0.51`, keep the
adapter as a safe literal consumer, explicitly deny optional native SSH build
scripts, and rerun local plus exact-head qualification before delivery.
Commit: `ci(playwright): use reusable profile plans`.

## Progress

- [x] Existing profile and Devsy tasks confirmed non-overlapping source seams.
- [x] Fresh isolated worktree created from exact `origin/v3` `e84103606`.
- [x] K0 plan is committed as `04e0b48db`.
- [x] K1 manifest and shard planning are committed as `23a7fb76b`.
- [x] K2 runtime selection is committed as `854994b8b`; nine focused tests
      pass and every shard resolves with the locally built upstream CLI.
- [x] PR #5678 is merged; `v3` initially supplied the profile configuration at
      Devrouter `0.0.46`. PR #5681 later advanced the configuration to exact
      `0.0.50`, matching this package's root CLI pin without changing profiles.
- [x] `origin/v3` commit `e24287c97470f7ca4621e7d9646b40ae114ee371`
      was integrated once without rebasing in merge commit `1e9f7b0046845191`.
- [x] K3 uses exact `@devrouter/cli` `0.0.50`, including an exact reviewed
      minimum-release-age exception, and applies the same fail-closed adapter
      to both hosted and public workflows.
- [x] K4 registry qualification resolves all eight shard profile unions through
      installed CLI `0.0.50`. The manifests select 45 Turbo processes instead
      of the previous fixed 72; this remains a configuration-derived reduction,
      not live speedup evidence.
- [x] Final verification passes with Node `24.16.0` and pnpm `11.5.0`: frozen
      install, the 21-task topological test build, complete repository checks,
      focused profile tests, YAML parsing, staged secret scanning, and diff
      checks. Main-session integrated review found no reportable finding; no
      subagent was created under the execution contract. This plan is included
      in the local K3 commit.
- [x] Devrouter PR #50 merged at
      `93acdcae80be4688bd792ed3256e2e37b5e47ede`. Release workflow
      `33322193976` published exact `@devrouter/cli@0.0.51`; registry integrity,
      shasum, SLSA provenance, and an isolated installed profile plan match that
      commit.
- [x] K5 moves app, filter, endpoint, service, and process policy into
      `playwright/runtime-contract.yml`. The adapter now consumes only exact
      binding keys and safe literal shapes. Optional `cpu-features` and `ssh2`
      build scripts are explicitly denied.
- [x] Current-base qualification passes the final frozen install and supply-chain
      policy, 10 focused profile/shard tests, YAML and formatter checks, all
      eight real shard plans through installed `0.0.51`, and `check:all`. The
      eight plans retain 45 total Turbo filters.
- [x] Current `origin/v3` `acf56b5331a24d4f53729046d9784d4aed006f65`
      was integrated once without rebasing in merge commit
      `d95902da4fc80931175ae0e4ec4bbe90730f9c33`. The resolved tree retains
      Devrouter `0.0.51`; frozen install, focused profile/shard tests, all real
      profile plans, and `check:all` pass on the merged base. Concrete old-head
      feedback is covered by exact profile-union, invalid timing/shard-count,
      empty-app, and readiness-widening regressions; frozen install disproves
      the stale lockfile finding.
- [x] PR #5683 merged to `v3` as `b0a824e09`. Direct run `33326967458`
      scheduled the public build and all eight shards on the restricted ARM64
      pool, but shards 1, 4, and 8 failed because activity-lifecycle specs did
      not select the `live-quiz` profile that owns both Hatchet workers. This
      run is routing proof, not runtime acceptance or performance evidence.
- [x] Remediation commit `d32e6e8d6` assigns every activity-lifecycle spec to
      the worker-bearing profile, adds a focused regression, and gives caller
      checkouts from before the profile migration an explicit all-or-nothing
      legacy startup. A partial profile runtime still fails closed. Full
      `check:all`, staged secret scanning, formatting, and the exact legacy
      checkout fixture pass under Node `24.16.0`.
- [ ] Publish and qualify the focused remediation, merge it when safe, then
      rerun both a current-source public route and the legacy PR compatibility
      case before claiming runtime acceptance or measuring performance.
