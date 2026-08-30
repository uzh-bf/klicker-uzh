# Playwright profile-aware CI runtime plan

Date: 2026-08-30. Branch: `rs/playwright-ci-profiles` at exact `origin/v3`
`e84103606`. Target: `v3`. Pull request: none.

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
- Do not publish, push, open or merge a pull request, change runner hosts, or
  alter organization settings under this plan.

## Execution contract

- Execution owner: this main session. No new subagents are created.
- Authority: edit the isolated worktree, add scripts and tests, run focused and
  repository-native checks, consume a locally packed Devrouter CLI for
  qualification, and create local conventional commits.
- Terminal: the source package is locally committed and verified against a
  packed upstream CLI. Publication-ready dependency and lockfile changes wait
  for an authorized `@devrouter/cli` `0.0.48` release.
- Withheld: rebase, upstream merge, push, PR creation, merge, release
  publication, live runner execution, runner settings, secrets, and cleanup.
- Pause: PR #5678 has not landed before `.devrouter.yml` changes are needed;
  Devrouter's report changes incompatibly; a spec cannot be mapped safely; or
  runtime selection requires a secret or host-control capability.

## Package boundary and coordination

- Worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/playwright-ci-profiles`.
- The active profile task owns PR #5678 and its `0.0.46` pin. This branch does
  not edit that task's documentation or integrate it automatically.
- Upstream Devrouter plan:
  `docs/project/2026-08-30-ci-profile-resolution-plan.md` on
  `rs/ci-profile-resolution`.
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
devrouter profile resolve --repo . --profile <selection> --json
```

A Klicker-owned adapter maps the exact returned app names to Turbo package
filters and local readiness URLs. It rejects unknown apps and never parses
profile names itself. Devrouter owns profile syntax, defaults, merging,
wildcards, and validation; Klicker owns how its app names start in CI.

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
  command reads only the checked-out `.devrouter.yml` and starts only
  allowlisted Klicker packages.
- The adapter never evaluates shell text from YAML or JSON. Every app name must
  match a checked-in exact mapping before an argv entry is created.
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
| Safe app mapping | known Devrouter apps become exact Turbo argv; unknown names fail without shell evaluation |
| Readiness scope | selected HTTP apps produce the exact endpoint set; unselected Chat, Control, and Response endpoints are absent |
| Unsupported scope | profiles that select apps outside the Playwright allowlist fail closed instead of starting a larger stack |
| Workflow parity | hosted and public workflows invoke one planner/adapter path |
| Runner boundary | no Docker socket, secret, cache save, runner label, runner group, or service-container change |
| Upstream package | a packed `@devrouter/cli` resolves the real `.devrouter.yml` for every manifest profile union |

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

Consume shard profile output in hosted and public reusable workflows. Add the
exact Devrouter dependency only after `0.0.48` is published, update changed-path
filters and the testing wiki, and preserve all security gates and service
containers.
Commit: `ci(playwright): use resolved runtime profiles`.

### K4 - Qualify and measure

Before publication, use a local packed Devrouter CLI for all profile unions and
run format, script tests, YAML parsing, shell syntax, TypeScript, and applicable
repository checks. After a separately authorized push, exact-head CI must prove
runner names, profile summaries, process counts, readiness, all eight artifacts,
and `test-playwright-status`. Compare startup and shard wall time with the
recorded eight-runner baseline; do not claim a speedup from static checks.

## Progress

- [x] Existing profile and Devsy tasks confirmed non-overlapping source seams.
- [x] Fresh isolated worktree created from exact `origin/v3` `e84103606`.
- [x] K0 plan is committed as `04e0b48db`.
- [ ] K1 manifest and shard planning are committed.
- [ ] K2 runtime selection is committed and tested with a packed upstream CLI.
- [ ] K3 waits for PR #5678 and published Devrouter `0.0.48`.
- [ ] K4 local checks pass; live runner measurement remains separately gated.
