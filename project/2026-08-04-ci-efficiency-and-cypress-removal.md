# CI efficiency + Cypress removal — execution plan

Target: one PR on a new branch off `v3`. Not stacked on the chat work.

This plan was reviewed read-only by a capable model and reworked after that
review invalidated its original premise. The corrected diagnosis is in §1.

## 1. Diagnosis (measured 2026-08-04, PR #5299)

**The bottleneck is GitHub Actions runner queue time, not work and not
`pnpm install`.** All five check workflows for one push triggered at 15:46:09.
Their jobs then started staggered and each finished quickly:

| Job | Queue wait | Job exec | of which install |
| --- | --- | --- | --- |
| check-lint | 5m20s | 78s | ~60s |
| check-syncpack | 5m58s | 73s | 56s |
| test-util | 7m01s | 94s | ~56s |
| test-markdown | 7m58s | 79s | ~87s |
| check-format | 9m20s | 92s | ~65s |
| check-types | 10m02s | 210s | ~59s |

The syncpack check itself runs in **1 second**; its run shows 7m12s because the
job waited ~6 minutes for a runner. Roughly **36 jobs queue per push** on this
branch (5 check-* + 5 test-* + gitleaks + CodeQL + SonarCloud + Playwright's
build job and 8 shards + path-matched Docker builds). They drain in waves
against the free-tier concurrency cap, and each additional job pushes every
later job's start time out.

Measure job time with the jobs API, never `gh run list --json createdAt,updatedAt`
— run-level timestamps include queue and vary 2s–825s for the same job:

```
gh api repos/uzh-bf/klicker-uzh/actions/runs/<id>/jobs \
  --jq '.jobs[] | {job:.name, started:.started_at, completed:.completed_at,
                   steps:[.steps[]|{n:.name,s:.started_at,c:.completed_at}]}'
```

**Therefore: reducing job count is the primary lever. Dependency caching is
secondary and small** — it can remove at most ~56s from a ~75s job, and the
repo's own cached job (`test-playwright` build-and-compile) spends 12–21s on
cache restore plus 11–27s on save to save ~40s of install, i.e. close to break
even. Prove it on one workflow before rewriting ten.

Also relevant: the repo is public, so Actions minutes are free. The payoff here
is developer time-to-signal, not billing.

## 2. Slice 1 — collapse the five `check-*` workflows into one job

`check-format`, `check-lint`, `check-syncpack`, `check-types` (required) and
`check-knip` (advisory) each pay a full queue wait and a full install to run
work measured in seconds. Merge them into a single workflow with a single job
that installs once and runs the checks as sequential steps.

Removes four queue positions and four installs per push. This is the largest
single win available and it compounds with slice 2.

**Requires a branch-protection change that only the repository admin can make.**
Required checks on `v3` are currently `check-format`, `check-lint`,
`check-syncpack`, `check-types`, `test-graphql-status`, `test-playwright-status`,
`build-amd`, `build-arm`. Consolidating renames four of them, so the admin must
swap those four for the new single context. Sequence it carefully:

1. Land the new consolidated workflow **alongside** the existing five so both
   report on the same PR and the new context appears in the checks list.
2. Admin adds the new context to required checks and removes the four old ones.
3. A follow-up commit deletes the five old workflow files.

Do not delete the old workflows before step 2 — required checks that never
report block every merge to `v3`.

Keep `check-knip` advisory (non-blocking) inside the consolidated job, matching
its current status. Preserve each check's existing `changed-paths` filter
semantics as step-level conditions, or accept running all checks whenever any
of their patterns match; state which was chosen in the PR description.

Fallback if the admin change is declined: skip slice 1 and go to slice 2 only,
accepting that the expected improvement is then small.

## 3. Slice 2 — dependency caching, proven on one workflow first

Do **not** rewrite ten workflows up front. Convert `check-syncpack` alone,
push twice (the first push is a guaranteed cache miss), and compare job
execution time against its 73s baseline. Continue only if the measurement shows
a real reduction.

The correct order — `pnpm/action-setup` must precede `setup-node`, otherwise
pnpm is not on PATH and `cache: 'pnpm'` cannot work:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 11.5.0
- uses: actions/setup-node@v4
  with:
    node-version-file: package.json
    cache: 'pnpm'
    cache-dependency-path: pnpm-lock.yaml
- run: pnpm install --frozen-lockfile
```

`cache-dependency-path: pnpm-lock.yaml` stops the key from globbing the whole
tree. The `11.5.0` pin matches root `package.json` `volta.pnpm` and
`packageManager` — keep them in sync.

**Per-workflow gating differs and a blanket `if:` will silently break two
required checks:**

- `check-format.yml` has **no** filter step. Adding
  `if: steps.filter.outputs.should_run == 'true'` makes the expression empty,
  every step skips, and the job reports success having checked nothing.
- `test-graphql.yml` filters at **job** level
  (`if: needs.filter.outputs.should_run == 'true'`); its steps carry no `if:`.
- The remaining workflows keep their existing step-level `if:`.

Preserve workflow-specific steps the template above omits: `astral-sh/setup-uv`
in `check-lint.yml`, `docker/setup-buildx-action` in `test-olat-api.yml`.

Scope on `v3` is **10 workflows**, not 11: `check-format`, `check-knip`,
`check-lint`, `check-syncpack`, `check-types`, `test-grading`, `test-graphql`,
`test-markdown`, `test-olat-api`, `test-util`. `test-chat.yml` does **not**
exist on `v3` — it arrives with PR #5299. If that PR merges first, rebase and
include it. Workflows folded into slice 1 need this treatment only once, in the
consolidated job.

Do not add `TURBO_TOKEN` to the `test-*` workflows expecting a win: their vitest
steps run outside turbo. Their hand-rolled per-package build steps are a
separate candidate (see §6).

## 4. Slice 3 — remove Cypress

Note: Cypress **already does not run in CI** — `cypress-testing.yml` triggers on
`workflow_dispatch:` only. This slice is code, dependency and documentation
cleanup; it does not speed up CI. It is safe: Cypress is not a required status
check, and every Cypress spec `0`/`A`–`X` has a Playwright counterpart, plus
`Y-chat`, `Z-credential-verification` and `0-video-embed` (file-level parity;
per-case parity was tracked during the migration and is not re-verified here).

**Delete:**

- `.github/workflows/cypress-testing.yml`
- the `cypress/` workspace (50 tracked files) and its `pnpm-workspace.yaml` entry
- `@cypress/code-coverage` from `apps/backend-docker/package.json`, plus the
  `global.__coverage__` declaration at `apps/backend-docker/src/app.ts:16-18`
  and the middleware block at `:42-49`
- root `package.json`: the `dev:test` script (line 65 — the Infisical
  `dev-cypress` wrapper) and `cypress/` from the `format` / `format:check`
  prettier globs; also fix `test:watch` (line 104,
  `run-p --npm-path pnpm test dev:test`), which consumes the deleted script —
  delete it or repoint it at `dev:playwright`
- the `dev-cypress` option in `util/_run_with_infisical.sh` (usage line + case arm)
- `'cypress'` from the workspace list in `util/check-agents-md.mjs`
- `.agents/skills/klicker-cypress-e2e/` and `.agents/skills/cypress-author/`,
  and their `skills-lock.json` entries
- `packages/prisma/package.json` `prisma:resetCypress`
- the `test|cypress` mode in `util/_run_app_dependencies.sh:71-120`
- stale references: `README.md:64` (Cypress Cloud badge), `.github/CODEOWNERS:7`,
  `check-lint.yml` filter pattern, `biome.json:13`, `.lintstagedrc.mjs:14-16`,
  `.dockerignore:5` and the five app `.dockerignore` files, `.syncpackrc.mjs:107`

**Do NOT delete — these feed the required Playwright check:**

- `util/_create_hatchet_token_cypress.sh` — used by `test-playwright.yml:275`
  and referenced in its path filter at line 28. Despite the name it is the CI
  Hatchet token path for Playwright. Renaming is possible but adds risk for no
  gain; leave it.
- `turbo.json` `dev:test` / `start:test` tasks and the nine per-app
  `dev:test` / `start:test` scripts — `start:playwright:ci` (root
  `package.json:94`) runs `turbo run start:test`, and `test-playwright.yml:315`
  sets it as `SERVICE_START_SCRIPT`.
- `nyc`, `@istanbuljs/nyc-config-typescript`, `.nycrc`, and the
  `build:instrument` / `build:test` / `start:test` scripts in
  `apps/backend-docker` — `test-playwright.yml:76` runs the root `build:test`.
  The now-unused instrumentation is a separate, measured follow-up.
- all `data-cy` attributes — Playwright selects on them.

**Completeness gate before opening the PR:**

```
git grep -in cypress -- . ':!CHANGELOG.md' ':!docs/log/archive.md' ':!project/'
```

must return only intentional historical mentions. `CHANGELOG.md`,
`docs/log/archive.md` and `project/plans_archive/*` are history — do not edit them.

The lockfile must be regenerated **inside the devcontainer**, never on the host.

## 5. Slice 4 — docs, wiki, skills (same PR; repo rule)

- `docs/testing.md` — collapse "Two e2e stacks" to Playwright only; drop the
  Cypress column, the `dev:test`/`dev-cypress` rows, the Cypress CI-signal quirk
  paragraph and the Cypress tsconfig note; correct the CI matrix. Its current
  claim that both suites "still run in CI" is already false.
- `docs/ci-and-deployment.md` — remove Cypress from PR gates; document the
  consolidated check job and the new required-check name.
- `AGENTS.md` lines 28, 97, 113, 190, 201, 223 — tech-stack Test row, Repo
  Layout `cypress/`, the `dev:test` command, pre-commit/format description,
  skill list. **`CLAUDE.md` is a symlink to `AGENTS.md` (git mode 120000) — edit
  `AGENTS.md` and keep the symlink a symlink.**
- `docs/index.md` — skill-routing line for `klicker-cypress-e2e`.
- `docs/getting-started.md:19,21,116`, `docs/data-and-migrations.md:92`,
  `docs/developing-a-feature.md:36`, `docs/frontend-conventions.md:12`,
  `docs/async-and-workers.md:49`, `docs/chat-platform.md:82`.
- `.agents/skills/klicker-testing-verification`, `klicker-playwright-e2e`,
  `klicker-data-model/SKILL.md:42`, `klicker-feature-design/SKILL.md:23`,
  `klicker-environment-doctor/SKILL.md:15`.
- New log file `docs/log/2026-08-04-ci-efficiency-and-cypress-removal.md`.
  `v3` already uses the one-file-per-batch convention — never append to
  `docs/log.md` or to another batch's file.

## 6. Deferred (do not include in this PR)

- **Turbo remote cache for the `test-*` build chains.** `test-graphql.yml:134-149`
  builds seven packages by hand (~59s measured); `test-util`, `test-grading`,
  `test-olat-api` build two to three each. This is what remote cache is for.
  Separate, measured change.
- **Docker build layer caching.** 26 workflow files set `no-cache: true`
  (e.g. `v3_backend-docker-stg.yml:73`, `:154`). Adding `cache-from: type=gha`
  without reversing that flag is a no-op, and the reason for the opt-out is
  undocumented — trace it with `git blame` first. The amd jobs set no cache
  backend at all and could gain directly.
- **Playwright shard count and PR-time Docker builds.** Both add many jobs to
  the queue; revisit after slice 1 shows how much queue pressure remains.

## 6b. Two verified CI defects found on 2026-08-04 (fix in this PR)

Both were diagnosed while restacking the chat-v3 stack. Neither is speculative.

**`changed-paths` re-shallows a full clone — already fixed, do not redo.**
`.github/actions/changed-paths/action.yml:28` ran `git fetch --depth=1 origin
"$BASE_REF"` unconditionally. On a full clone (`check-types.yml` uses
`fetch-depth: 0`) that writes a shallow graft at the base ref; on a stacked PR
the base is an ancestor of HEAD, so HEAD's own history is truncated and
`turbo --filter="...[origin/v3...HEAD]"` dies with `fatal: no merge base
found`. Every stacked PR whose base was not `v3` failed `check-types`; the
bottom PR (base `v3`) passed, which is why it looked content-specific. The fix
— shallow-fetch only when `$(git rev-parse --git-dir)/shallow` exists — landed
on `claude/chat-v3-2-upgrade` as `fd5de031e` and propagates up the stack. If
that stack merges before this PR opens, the fix is already on `v3`; verify
before touching the file.

**`-status` gates report failure when their dependency is cancelled.** The
gates are documented and intended as fail-open, and they do fail open for a
*skipped* dependency. A *cancelled* one is different: an atomic multi-branch
push (or any quick second push) starts two runs of the same workflow seconds
apart, `cancel-in-progress` kills the older, and the older run's
`test-graphql-status` / `test-playwright-status` conclude `failure`. The
surviving run is green and branch protection reads the latest check-run per
name, so merges are not blocked — but the PR shows a permanent red that only a
manual re-run clears. Observed on PR #5250: two `failure` check-runs against a
head SHA whose latest-per-name conclusions were all `success`. Fix the gate
conditions to treat `cancelled` like `skipped`, in `test-graphql.yml` and
`test-playwright.yml`. Do not "fix" it by removing the gates — they are
required status checks.

## 7. Commit order and verification

Order matters because the lockfile change invalidates any warmed cache:

1. Cypress removal, including the regenerated lockfile.
2. Consolidated check job added alongside the existing five.
3. Caching, on `check-syncpack` only, then the rest if measurement justifies it.
4. Docs, wiki, skills, log entry.
5. After admin updates branch protection: delete the five superseded workflows.

In-container: `pnpm install --frozen-lockfile`, `pnpm run check:all`,
`pnpm run build`. In CI: all required checks green, plus a before/after table in
the PR description built from **job-level** step timings, recorded after at
least two pushes so the second runs against a warm cache.

## 8. Do not

- Delete or rename a required status check before branch protection is updated.
- Apply a blanket `if: steps.filter.outputs.should_run` template (see §3).
- Run `pnpm install` on the host in a linked worktree — container only.
- Touch `CHANGELOG.md`, `docs/log/archive.md`, or `project/plans_archive/*`.
- Merge. No merge authority; keep the PR draft until told otherwise.
