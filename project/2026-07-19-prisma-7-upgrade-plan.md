# Prisma 7.8 Upgrade Plan

Status: approved; execution in progress.

## Goal

Upgrade the merged TypeScript 6 workspace from Prisma 6.16.1 to Prisma 7.8.0. Preserve PostgreSQL runtime behavior, generated JSON and Pothos types, Auth.js database access, local and CI database commands, Analytics Python schema generation, Docker builds, and browser-visible application behavior.

Terminal proof:

- one owner for PostgreSQL adapter construction
- no active raw `new PrismaClient()` call without an adapter
- Prisma 7 generation is deterministic and TypeScript 6 declarations compile
- database reset, push, migrate, diff, deploy, seed, resolve, and Studio contracts are verified
- Analytics owns its Python datasource through sync and Docker assembly
- Auth adapter methods and delegated login work with the reviewed peer-compatibility treatment
- all relevant repository checks and GitHub checks pass

## Non-Goals

- no Prisma schema model or SQL migration
- no production database command or live deployment
- no pool, timeout, SSL, or Query Plan Cache tuning without measured evidence
- no Analytics Python client upgrade
- no Pothos upgrade unless Prisma 7 generation or tests prove it necessary
- no Auth.js or NextAuth major migration
- no Prisma Accelerate, Optimize, metrics replacement, or new Prisma feature adoption
- no Office Add-in changes
- no removal of historical maintenance scripts merely because they need adapter-safe construction

## Plan Identity

- Review artifact: `/private/tmp/prisma-7-upgrade-plan-draft.md`
- Final plan after approval: `project/2026-07-19-prisma-7-upgrade-plan.md`
- Branch after approval: `codex/upgrade-prisma-7`
- Project-local worktree after approval: `trees/prisma-7-upgrade`
- Target: `v3`
- Base: `origin/v3` at `15fededdb78a69b09eb80f81b522ef6bc024f18e`
- Related merged PR: https://github.com/uzh-bf/klicker-uzh/pull/5167
- PR: not created
- Current state: implementing branch and project-local worktree created from the recorded base

## Resolved Decisions

1. Target Prisma 7.8.0, the latest stable release checked on 2026-07-19.
2. Use `prisma-json-types-generator` 5.1.0. Version 5.1.1 is blocked by the repository 14-day release-age policy until 2026-07-23.
3. Prepare adapter-safe client creation on Prisma 6 before changing the major version.
4. Centralize `PrismaPg` construction in `@klicker-uzh/prisma`; remove redundant direct adapter ownership from consumers.
5. Preserve all maintenance scripts and convert their construction mechanically.
6. Keep existing node-pg pool and SSL behavior; verify rather than tune.
7. Preserve Analytics-specific `datasource.prisma` in local sync and Docker assembly.
8. Compile raw Prisma 7 generated output before deciding whether the TypeScript namespace patch remains.
9. Use a narrow Auth adapter peer correction only if current types, build, direct adapter-method smoke, and delegated-login behavior pass. Otherwise stop the Prisma 7 upgrade.
10. Keep the PR draft until local finish gates pass; image jobs skipped on drafts must pass after the user marks it ready.
11. Prove the unsupported Auth adapter runtime surface with a local-only adapter-method round-trip; delegated credentials login alone does not call those methods.

## Research Summary

Research completed 2026-07-19 against merged `v3`.

Primary sources:

- Prisma 7 upgrade guide: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Prisma 7.0 release notes: https://github.com/prisma/prisma/releases/tag/7.0.0
- Prisma 7.8 release notes: https://github.com/prisma/prisma/releases/tag/7.8.0
- Prisma null-type issue: https://github.com/prisma/prisma/issues/28581
- JSON generator releases: https://github.com/arthurfiorette/prisma-json-types-generator/releases
- npm registry metadata for all direct Prisma-family and adapter packages
- merged repository manifests, lockfile, configs, generated-code patch, CI, devcontainer, Dockerfiles, docs, and skills

Findings:

- Node 24, TypeScript 6, ESM, custom client output, `prisma-client`, `engineType = client`, and `PrismaPg` already satisfy the main runtime prerequisites.
- JavaScript datasource URLs must move to `prisma.config.ts`; Analytics still needs schema URLs for `prisma-client-py`.
- 47 active raw `new PrismaClient()` calls omit an adapter; six more GraphQL scripts and one backend script construct adapters locally.
- Prisma 7 removes automatic generation after `migrate dev` and `db push`, plus automatic seeding after migrate/reset flows.
- Current `migrate diff` uses removed flags and the wrong migration directory.
- Latest `@auth/prisma-adapter` 2.11.2 still declares Prisma support only through version 6.
- No Prisma client middleware, metrics API, Accelerate URL, removed engine environment variable, or `db execute` flag requires migration.
- Prisma 7.8 still emits inferred `DbNull`, `JsonNull`, and `AnyNull`; upstream issue 28581 remains open.

Limitations:

- Exact Prisma 7.8 CLI behavior must be proved after install.
- Auth adapter runtime compatibility is not officially declared by its peer range.
- Production migration execution is not mapped in this repository; this branch preserves commands but does not claim deployment proof.

## Full Dependency Inventory

| Package | Current | Target | Role | Decision |
| --- | --- | --- | --- | --- |
| `prisma` | 6.16.1 in Prisma, Auth, backend | 7.8.0 in Prisma only | CLI | upgrade owner; remove two unused copies |
| `@prisma/client` | 6.16.1 in Prisma and Chat | 7.8.0 in Prisma only | generated client runtime | upgrade owner; remove unused Chat copy |
| `@prisma/adapter-pg` | 6.16.1 in Prisma, GraphQL, backend, OLAT, Cypress | 7.8.0 in Prisma only | PostgreSQL adapter | centralize construction; remove redundant consumer copies |
| `@prisma/instrumentation` | 6.14.0 | remove | telemetry | no import or registration |
| `@prisma/extension-optimize` | 2.0.1 | remove | query optimization | unused; peer range excludes Prisma 7 |
| `prisma-json-types-generator` | 3.6.0 | 5.1.0 | JSON type generator | Prisma 7 and TypeScript 6 compatible; release-age eligible |
| `@pothos/plugin-prisma` | 4.10.0 | unchanged | GraphQL type generator | peer range accepts Prisma 7; change only on evidence |
| `@auth/prisma-adapter` | 2.10.0 | 2.11.2 candidate | Auth database adapter | latest still lacks Prisma 7 peer declaration; gated correction and smoke test |
| `@next-auth/prisma-adapter` | 1.0.7 | remove | legacy Auth adapter | unused duplicate |
| `pg` | 8.16.3 | unchanged | PostgreSQL driver | preserve pool and SSL behavior |

Transitive packages stay lockfile-owned unless Prisma 7 changes their resolved graph.

## Prisma 7 Guide Compliance Matrix

| Guide change | Merged repository state | Required action | Proof |
| --- | --- | --- | --- |
| Node 20.19+ and TS 5.4+ | Node 24, TS 6 | none | pins plus checks |
| ESM | Prisma package and server libraries use ESM | no target churn unless compile fails | build and runtime smoke |
| `prisma-client` plus custom output | already configured | preserve | deterministic generate |
| datasource URLs in config | still in JS schema | move to `prisma.config.ts`; preserve Python datasource | validate, generate, Analytics generate |
| driver adapter required | singleton ready; many scripts not ready | shared factory plus mechanical conversion | zero unsafe constructors, live script smoke |
| changed node-pg pool and SSL defaults | adapter already used on Prisma 6 | no tuning | DB connect and TLS-path smoke |
| explicit environment loading | Infisical/native environment already used | do not add dotenv; keep generate secret-free | generate with DB variables absent |
| metrics removed | no `$metrics` usage | remove unused instrumentation package | repository search and checks |
| mapped enum behavior reverted | compatible with Prisma 6 | none | generated diff |
| client middleware removed | no `$use()` usage | none | repository search |
| automatic seeding removed | command contracts assume old behavior | configure correct seed and invoke explicitly | reset plus seed and fixture query |
| automatic generation removed | migrate/push wrappers rely on old behavior | add explicit generation or make split contract explicit | tracked generated hash and command tests |
| removed CLI flags | diff uses removed flags; reset uses stale skip flag | translate diff; clean reset callers | ephemeral database matrix |
| removed `db execute` flags | no usage | none | repository search |
| removed engine environment variables | no usage | none | repository search |

## Runtime and Package-Manager Findings

- Package manager: pnpm 11.5.0 via Volta/Corepack.
- Runtime: Node 24.16.0 via root Volta pin; package engines require Node 24.
- Lock policy: `minimumReleaseAge: 20160`, strict, no exception planned.
- Install/build execution: inside the repository DevPod, not on the host.
- Existing TypeScript peer override for JSON generator 3.6.0 is removed when generator 5.1.0 lands.
- Existing `onlyBuiltDependencies` and `allowBuilds` entries for Prisma are retained only if the Prisma 7 lock graph still uses them.
- Lockfile changes ship with their manifest slice.

## Local Development Design

- Use `devrouter ensure .` from the project-local worktree. The persisted
  workspace identity is `prisma-7-upgrade`; do not use bare `devpod up` or a
  manually supplied workspace token.
- Run pnpm, Prisma, database, test, and build commands inside the DevPod.
- Use the committed devcontainer PostgreSQL and Redis services; never point verification at production.
- Use existing Infisical wrappers for dev/staging/production command parsing, but execute data-changing checks only against local devcontainer variables.
- Browser targets after startup:
  - `https://auth.klicker.prisma-7-upgrade.localhost`
  - `https://manage.klicker.prisma-7-upgrade.localhost`
  - `https://pwa.klicker.prisma-7-upgrade.localhost`
  - `https://control.klicker.prisma-7-upgrade.localhost`
  - `https://chat.klicker.prisma-7-upgrade.localhost`
- Delegated lecturer login: existing local seeded credentials.

## Deployment and Migration Findings

- Repository scripts expose dev, staging, and production migrate/deploy/diff/resolve/Studio commands.
- Devcontainer and test workflows reset and push directly against ephemeral PostgreSQL.
- No checked-in GitOps migration job or production migration hook is mapped.
- Analytics has two image jobs, both skipped while a PR is draft.
- This branch does not execute staging or production migrations.
- Verification uses local command parity, command parsing for wrapped environments, local Docker builds, and GitHub CI.
- After the user marks the PR ready, both Analytics image jobs must run rather than remain draft-skipped.

## Client Construction Design

Add one small factory in `@klicker-uzh/prisma`:

- creates `PrismaPg` from `DATABASE_URL`
- creates a generated `PrismaClient` with the adapter
- accepts only options required by proven callers
- backs the existing global development singleton
- is used by standalone seeds and maintenance scripts
- keeps raw generated types and enums under `@klicker-uzh/prisma/client`

Do not add a general connection framework, new environment abstraction, or pool configuration.

## Auth Compatibility Gate

Problem:

- current and latest `@auth/prisma-adapter` peer metadata ends at Prisma 6
- Auth actively passes the shared generated client to `PrismaAdapter`

Recommended path:

1. Move to release-age-eligible 2.11.2.
2. Add the narrowest pnpm package extension that admits only Prisma 7 for that exact adapter version.
3. Record package, version, upstream limitation, verification, and removal trigger next to the extension.
4. Add a local-only, fail-closed adapter smoke that calls `getUserByEmail`, `createUser`, `linkAccount`, `getUserByAccount`, and cleanup methods against a disposable identity.
5. Require cleanup in `finally` and refuse non-local database hosts.
6. Require frozen install, Auth typecheck, production build, adapter smoke, delegated sign-in, session persistence, and sign-out.
7. Treat delegated credentials login as proof of direct shared-client behavior, not proof of Auth adapter methods.
8. Stop and revert the Prisma 7 upgrade if any adapter operation or type contract fails.

Rejected:

- legacy `@next-auth/prisma-adapter`: unused and stale
- Auth.js major migration: unrelated blast radius
- ignoring the peer warning globally: hides unrelated dependency defects

## Generated-Code Patch Gate

1. Install Prisma 7 and JSON generator 5.1.0.
2. Run raw `prisma generate` without the namespace patch.
3. Run declaration build and the exact TS2742 reproduction.
4. If clean, delete patch script, tests, and package wiring.
5. If failing, update exact expected Prisma 7 source strings and fixed generated path.
6. Keep fail-closed behavior, fixture tests, idempotence, and removal criteria.
7. Generate twice and require identical tracked hashes.

## Verification Baseline

Before implementation changes, inside the DevPod:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @klicker-uzh/prisma generate`
- `pnpm --filter @klicker-uzh/prisma check`
- `pnpm --filter @klicker-uzh/prisma build`
- `pnpm --filter @klicker-uzh/prisma test:patch-namespace`
- `pnpm run check:prisma-sync`
- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/graphql check`
- record the current Prisma 6 `migrate diff` failure and wrong path
- record 47 unsafe no-argument constructors and all direct adapter imports
- confirm current `v3` GitHub checks

Baseline result on 2026-07-19:

- `origin/v3` remained at
  `15fededdb78a69b09eb80f81b522ef6bc024f18e`, the merged TypeScript 6 PR.
- `trees/` was already ignored; the implementing worktree was clean except
  for this plan.
- `devrouter ensure .` created and proved the
  `prisma-7-upgrade` workspace with Node 24.16.0, pnpm 11.5.0, an isolated
  PostgreSQL service, all migrations, the complete local test seed, and the
  namespaced application routes.
- Frozen install and the devcontainer package/backend build passed. The
  focused Prisma build generated Prisma Client 6.16.1, Pothos, and JSON types.
- `pnpm --filter @klicker-uzh/prisma check` passed generation, strict
  TypeScript checking, and all four namespace-patch tests.
- `pnpm run check:prisma-sync` reported that Prisma schemas are in sync.
- The GraphQL build generated its artifacts during container setup, and
  `pnpm --filter @klicker-uzh/graphql check` passed.
- The unqualified full lint hook selected Python 3.14 because Analytics allows
  `>=3.12,<4.0`; pandas 2.2.2 then fell back to an sdist in the slim
  devcontainer and failed without a compiler. Local full checks therefore use
  `UV_PYTHON=3.12` with a disposable `UV_PROJECT_ENVIRONMENT` and Turborepo's
  loose environment pass-through, matching the repository's supported
  Analytics runtime without modifying the checkout. This is a pre-existing
  local runtime-selection gap, not a Prisma regression.
- GitHub build, architecture build, typecheck, GraphQL, OLAT, grading, and all
  eight Playwright shards passed on the base SHA. Existing external
  `SonarCloud Code Analysis` and `Dependabot` checks were red; neither is a
  Prisma baseline failure and the PR containing this base was merged.
- Static baseline findings remain: the Prisma 6 diff wrapper uses removed
  flags and the wrong migration path, 47 active no-argument clients lack an
  adapter, and adapter construction is duplicated across consumers.

## Risk Register

| Risk | Early signal | Control | Fallback |
| --- | --- | --- | --- |
| Auth adapter is not Prisma 7 compatible | peer/type/build/login failure | exact package extension plus full Auth smoke | stop upgrade and wait for upstream |
| maintenance scripts fail at runtime | constructor/type/runtime error | shared factory on Prisma 6 first | revert affected preparation slice |
| generated null types still fail TS6 | TS2742 declaration error | raw probe plus exact fail-closed patch | retain adapted patch with removal trigger |
| JSON annotations drift | generated client diff or GraphQL errors | compare output and run GraphQL generation/tests | stop before consumer edits |
| Analytics loses datasource | sync, Python generate, or image failure | owned datasource in sync and Docker | revert datasource split |
| CLI behavior changes | reset/seed/diff/deploy mismatch | ephemeral command matrix | revert lifecycle slice |
| hidden auto-generation assumption | stale generated hash after migrate/push | explicit generate contract | restore explicit wrapper sequence |
| pool or SSL regression | connection timeout or TLS failure | preserve current adapter options and smoke | revert Prisma 7 slice |
| release-age install block | pnpm refusal | use 5.1.0; no exception | wait for policy window |
| draft CI hides Analytics image failure | image jobs skipped | local Docker build before PR; ready-state CI later | keep PR draft/block readiness |

## Execution Cadence

For every implementation slice:

1. update plan `Progress`
2. make only the slice change
3. run fastest meaningful check, then full slice checks
4. send exact diff to a separate review agent using the review rubric
5. send exact diff to a separate simplification agent
6. integrate accepted findings one at a time
7. rerun checks and verification-before-completion
8. update progress with evidence
9. run staged data-hygiene review
10. commit the slice with its lockfile and plan progress

## Implementation Slices

### Slice 0: Establish reviewed baseline

Files:

- final `project/2026-07-19-prisma-7-upgrade-plan.md` only

Do:

- after approval, fetch `v3` and verify base SHA
- verify `trees/` is ignored
- create `trees/prisma-7-upgrade` on `codex/upgrade-prisma-7`
- copy this reviewed plan into `project/`
- run baseline commands and record exact outcomes
- keep unrelated outer-worktree files untouched

Check:

- clean implementing worktree
- plan matches reviewed draft and merged base
- Prisma 6 generate/check/build baseline
- current GitHub base checks

Review:

- main-agent plan/readiness check

Commit:

- `docs(project): add Prisma 7 upgrade plan`

Fallback:

- stop before dependency changes if the merged base baseline is red for a relevant reason

### Slice 1: Make Prisma data entry points adapter-safe on Prisma 6

Files:

- `packages/prisma/src/index.ts`
- `packages/prisma-data/package.json`
- `packages/prisma-data/tsconfig.json`
- `packages/prisma-data/src/data/*.ts` with active raw constructors
- `packages/prisma-data/src/scripts/*.ts` with raw constructors
- affected Prisma package exports and tests
- plan progress

Do:

- add the minimal shared `createPrismaClient` factory
- make the existing singleton use the same factory path without behavior drift
- expose the existing strict Prisma Data TypeScript config through a package `check` script
- convert all Prisma Data raw constructors
- retain raw generated `PrismaClient` imports only where needed for types
- do not change queries, data transformations, or script arguments

Check:

- Prisma generate/check/build
- `pnpm --filter @klicker-uzh/prisma-data check`
- note that two historical files use `@ts-nocheck`; verify their imports by syntax/build parsing and focused review
- repository search shows zero raw no-argument constructors in Prisma Data
- local reset plus `@klicker-uzh/prisma-data seed:raw`
- run one converted read-only historical script, such as the lowercase-email check, against local seeded data
- representative fixture query verifies seeded lecturer and participant data

Review:

- correctness review focused on singleton behavior and script imports
- simplification review focused on factory API size

Commit:

- `refactor(prisma): centralize client creation for data scripts`

Fallback:

- keep singleton unchanged and expose a standalone factory if shared construction changes global caching

### Slice 2: Make maintenance scripts adapter-safe on Prisma 6

Files:

- `packages/graphql/src/scripts/**/*.ts` with direct construction
- `apps/backend-docker/scripts/checkRedisConsistency.ts`
- GraphQL and backend package manifests
- any other verified direct adapter consumer
- `pnpm-lock.yaml`
- plan progress

Do:

- convert raw and locally adapted script clients to the shared factory
- remove redundant direct adapter dependencies after repository-wide proof
- preserve script behavior and explicit disconnect handling
- leave type-only client imports under the generated-client export

Check:

- repository-wide zero active `new PrismaClient()` without adapter
- repository-wide `PrismaPg` ownership limited to `packages/prisma`
- GraphQL generate/check/build/test
- backend check/build
- run one current read-only maintenance script against local seeded data where safe

Review:

- mechanical-diff correctness review
- simplification review for duplicate imports and connection cleanup

Commit:

- `refactor(prisma): centralize client creation for maintenance scripts`

Fallback:

- split GraphQL and backend conversions if the diff becomes too large to review safely

### Slice 3: Upgrade the generated-client boundary to Prisma 7

Files:

- Prisma-family manifests across apps, packages, and Cypress
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/prisma/prisma.config.ts`
- `packages/prisma/src/prisma/schema/datasource.prisma`
- `apps/analytics/prisma/schema/datasource.prisma`
- `util/sync-schema.sh`
- `util/check-prisma-sync.sh`
- `apps/analytics/Dockerfile`
- namespace patch script/tests if retained
- Auth package manifest and pnpm compatibility rule
- plan progress

Do:

- upgrade `prisma`, `@prisma/client`, and `@prisma/adapter-pg` owner packages to 7.8.0
- upgrade JSON generator to 5.1.0 and remove its TypeScript override
- remove unused Prisma CLI, client, adapter, Optimize, instrumentation, and legacy Auth adapter dependencies
- upgrade `@auth/prisma-adapter` to 2.11.2 and add the exact gated peer correction
- move JavaScript datasource URLs into config using secret-free-safe environment access
- give Analytics its own datasource and preserve it in sync/check/Docker assembly
- run the raw namespace-patch gate and remove or adapt it from evidence
- compare generated exports, JSON annotations, Pothos output, and schema

Check:

- `pnpm install --frozen-lockfile` after lock creation
- Syncpack and lock policy
- secret-free Prisma generate
- generate twice with identical tracked hashes
- Prisma check, declaration build, patch tests if retained
- Prisma sync check
- Analytics `uv run prisma generate`
- local Analytics Docker image build
- GraphQL generate/check and generated schema diff
- Auth check and production build

Review:

- generated-boundary correctness review
- simplification review for obsolete dependency/build allowances

Commit:

- `build(prisma): upgrade generated client to Prisma 7`

Fallback:

- revert this single slice to Prisma 6; the adapter-safe preparation slices remain valid

### Slice 4: Preserve database lifecycle commands

Files:

- `packages/prisma/package.json`
- `packages/prisma/prisma.config.ts`
- root package scripts when required
- `.devcontainer/post-create.sh`
- `.devcontainer/README.md`
- GraphQL, Cypress, Playwright, and OLAT test command callers
- relevant GitHub workflows
- plan progress

Do:

- configure the real seed command for `@klicker-uzh/prisma-data`
- make reset-plus-seed explicit
- preserve or explicitly redefine generation after migrate/create/push
- remove redundant or rejected `--skip-seed` usage
- translate `migrate diff` to config datasource semantics
- correct migrations path to `src/prisma/schema/migrations`
- preserve Infisical environment names and wrappers
- avoid starting Studio during automated checks

Check:

- local PostgreSQL: validate, generate, reset without seed, push, explicit seed, fixture query
- migrate deploy on a fresh database
- migrate dev/create-only behavior on disposable local schema state
- representative diff from config datasource to migrations
- resolve and Studio help/parse smoke without mutation/browser
- devcontainer post-create database phase
- test workflow command parity

Review:

- command-contract review with exact old/new semantics
- simplification review for duplicated wrappers

Commit:

- `fix(prisma): preserve database lifecycle commands`

Fallback:

- keep commands explicit and separate rather than hiding multi-step behavior in a complex shell wrapper

### Slice 5: Verify Auth and all application consumers

Files:

- only consumer source required by verified Prisma 7 errors
- Auth compatibility rule, package script, and local-only adapter smoke
- plan progress

Do:

- fix only reproducible Prisma 7 consumer failures
- prove Auth adapter behavior instead of relying on peer metadata alone
- run a disposable adapter create/link/get/unlink/delete round-trip with guaranteed cleanup and a local-host guard
- separately prove the delegated credentials path, which queries the shared client directly under JWT sessions
- preserve application behavior and public GraphQL schema

Check:

- `pnpm run check:all`
- production and test builds
- Prisma, GraphQL, grading, util, OLAT, Cypress, and Playwright tests
- backend and worker startup against local PostgreSQL
- direct Auth adapter method round-trip succeeds and leaves no disposable rows
- delegated Auth login, session persistence, and logout
- Manage loads authenticated course data
- PWA participant login and course load
- Control connects to a local session
- Chat loads a database-backed route
- before/after screenshots at relevant desktop and mobile viewports

Review:

- consumer regression review
- simplification review for any compatibility edits

Commit:

- `fix(prisma): restore Prisma 7 consumer compatibility` only if source fixes are needed

Fallback:

- if Auth fails, revert Slice 3 and stop; do not broaden into Auth.js migration

### Slice 6: Document, finish, and publish the draft PR

Files:

- `docs/data-and-migrations.md`
- `docs/testing.md`
- `docs/log.md`
- `AGENTS.md`
- `.agents/skills/klicker-data-model/SKILL.md`
- `.agents/skills/klicker-environment-doctor/SKILL.md`
- `.agents/skills/klicker-testing-verification/SKILL.md` when commands change
- current plan progress

Do:

- document Prisma 7 generation, adapter ownership, Analytics ownership, seed/generate semantics, Auth peer treatment, and namespace patch status
- update contradictory datasource-sync instructions
- run fresh full verification
- run final code-level security review
- run independent whole-branch review
- run strict thermo-nuclear maintainability review last
- resolve or explicitly defer findings
- create a draft PR targeting `v3` with whole-branch evidence
- rename the current plan to include the PR number in a separate metadata commit

Check:

- fresh full relevant local suite
- local Analytics image build
- current-head GitHub checks
- no unresolved review threads
- Office Add-in unchanged
- after user marks ready, both Analytics image jobs execute and pass

Review:

- `$security-review`
- independent branch review using a different model
- `$thermo-nuclear-code-quality-review`

Commit:

- `docs(prisma): document Prisma 7 workflows`
- separate plan metadata commit after PR ID exists
- review-fix commits only when required

Fallback:

- keep PR draft with explicit blocker; never mark ready from partial CI

## External Plan Review

Requested route:

- tool: OpenCode CLI
- provider/model: `opencode-go/kimi-k3`
- repository classification: OSS; user approved external sharing
- scope: this plan plus read-only merged repository evidence
- rubric: confidence anchors, quote-the-line gate, autofix class, three closing questions

Review status: `DONE_WITH_CONCERNS` on 2026-07-19.

Accepted findings:

1. Delegated credentials login uses JWT sessions and direct Prisma queries, so it does not exercise `PrismaAdapter` methods. Added a direct local adapter-method round-trip with cleanup and non-local database refusal.
2. Prisma Data has an existing strict `tsconfig.json` but no `check` script. Added a persistent package check, a representative converted read-only script run, and explicit review of the two `@ts-nocheck` files.

Verified without changes:

- constructor and adapter counts
- dependency and peer inventory
- Analytics draft-job behavior
- slice order, rollback containment, and finish gates

## Progress

- [x] TypeScript 6 PR merged into `v3`
- [x] official Prisma 7 guide reviewed in detail
- [x] dependency, constructor, config, CLI, Analytics, Auth, CI, and Docker surfaces inventoried
- [x] initial independent local plan review integrated
- [x] detailed execution draft written
- [x] OpenCode Go / Kimi K3 review
- [x] integrate accepted external findings
- [x] user approval
- [x] create implementing worktree and establish the clean Prisma 6 baseline
- [ ] commit final plan
- [ ] execute slices
- [ ] draft PR

## Approval Record

On 2026-07-19, the user approved:

1. the exact, temporary Auth adapter peer correction subject to all defined compatibility gates
2. JSON generator 5.1.0 under the repository release-age policy
3. preservation and adapter-safe conversion of all historical scripts

## Next Steps

1. Commit this plan alone on the implementing branch.
2. Make Prisma Data entry points adapter-safe on Prisma 6.
3. Execute each remaining reviewed and simplified slice.
