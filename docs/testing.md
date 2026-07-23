---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
timestamp: '2026-07-19'
tags:
  - testing
  - ci
---

# Testing

**There is no component-test layer.** Coverage is pure-function vitest at the bottom and full-stack e2e at the top — nothing in between (no @testing-library/react, no Cypress component testing). Don't look for one, and don't assume a React component is covered unless an e2e spec exercises it.

## Which level for which change

| Change                                                               | Test level                                                                                 | Command                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Pure logic (grading, util, export, word-cloud, markdown, chat logic) | package vitest — **safe without any services**                                             | `pnpm --filter @klicker-uzh/grading test` (etc.)                                                   |
| GraphQL services/resolvers                                           | `packages/graphql` vitest — needs REAL Postgres + Redis + Hatchet + `HATCHET_CLIENT_TOKEN` | `pnpm --filter @klicker-uzh/graphql test:local` (one-command bootstrap: `test/run-tests-local.sh`) |
| UI / user flows                                                      | Playwright e2e (new specs); Cypress only for legacy maintenance                            | see routing below                                                                                  |

**Never run root `pnpm run test:run` blind** — the turbo fan-out includes Cypress, which needs a running, seeded stack. The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

## Two e2e stacks, one selector convention

**Playwright is the primary suite — all new e2e specs land there.** The Cypress suite is a frozen parity suite pending removal: touch it only to keep existing specs green, never to add coverage. Both still run in CI until the removal actually happens, so both stacks stay documented below.

Both frameworks click the same `data-cy` attributes ([Frontend Conventions](./frontend-conventions.md)). Specs are letter-prefixed for run order (`A-login-workflow` … `X-review-workflow`; Playwright adds `Y-chat` with no Cypress counterpart).

|               | Cypress (`cypress/`)                                               | Playwright (`playwright/`)                                 |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Stack scripts | root `dev:test` / `start:test`                                     | `dev:playwright` / `start:playwright`                      |
| Infisical env | `dev-cypress`                                                      | `dev-playwright`                                           |
| Seed          | own `seedDatabase()` task in `cypress.config.ts`                   | own `seedDatabase()` in `global-setup.ts` (once, wipes DB) |
| CI            | 8-way `cypress-split` (draft PRs) / Cypress Cloud (non-draft + v3) | official Playwright container, 8-way shard, all PRs        |

The three seed paths (dev `seedTEST.ts`, Cypress, Playwright) are **independent** — a fixture added to one does not exist in the others ([Data & Migrations](./data-and-migrations.md)). `*:raw` script variants skip Infisical on both sides. `_run_app_dependencies.sh` with no args (or `local`/`dev`/`playwright`) applies the schema with `prisma:push` without forcing a reset; the `test`/`cypress` argument is the Cypress-specific **reset** path.

For authoring specifics, helper patterns, and failure triage, use the skills — `klicker-cypress-e2e` and `klicker-playwright-e2e` ([.agents/skills/](../.agents/skills/)) — rather than duplicating their content here.

## E2E environment dependencies

- Tests that **publish, schedule, or end activities** need the Hatchet **general worker** running on top of the test stack — otherwise mutations fail with `workflow not found`. The worker needs `DATABASE_URL` pointed at the test DB ([Async & Workers](./async-and-workers.md)).
- **Live-quiz response tests** additionally need `response-api` + the response processor with the same `APP_SECRET`/Redis/Postgres settings — otherwise the UI accepts answers that never reach cockpit/evaluation.
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, and the absence of horizontal overflow.
- Cypress `cy.loginStudent()`/`cy.loginStudentPassword()` clear localforage by default; continuation tests that rely on stored answers pass `{ preserveClientState: true }`.

## CI matrix

Path-filtered unit workflows: `test-grading`, `test-util`, `test-markdown` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. The workflow tars the five `.next` trees before artifact upload and extracts them in each shard so Turbopack's runtime dependency symlinks survive the cross-job handoff. All path-skipped workflows report through `-status` gates to satisfy branch protection. Cypress CI signal quirk: the merge-group check can show a rising failed count while `cypress-run-cloud` is still in progress — wait for cloud completion before reading logs.

**Git hooks run no application test suites** (pre-commit = `check:all`, pre-push = `build`). The Prisma package check regenerates its client before typechecking and then runs the namespace patch invariants, so clean CI jobs do not depend on generated files left by an earlier build or cache restore. The expectation before a PR: `check:all` + build + targeted vitest for touched logic + browser evidence for UI changes; CI is the real e2e gate.

Root typecheck includes the Cypress and Playwright compiler surfaces through their package `check` scripts. Compiler/toolchain upgrades also cover the test build and Docs production build; the exact commands live in `klicker-testing-verification`. Cypress explicitly preserves its TypeScript 5 non-strict baseline in `cypress/tsconfig.json`; Playwright remains strict. This is legacy-suite compatibility, not a precedent for new TypeScript packages.

Check-only configs must state their no-output role with `noEmit`. When they extend a declaration-emitting config, `noEmit` alone does not disable declaration portability analysis: GraphQL and Prisma therefore also set `declaration: false` and `declarationMap: false`. Incremental checks use `tsconfig.check.tsbuildinfo` rather than overwriting the emitting compiler's state. The full compiler-role matrix lives in [Getting Started](./getting-started.md#toolchain-verified-2026-07-07).

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. All five Next builds use their canonical `tsconfig.json`; the three PWA apps reserve `tsconfig.check.json` for raw package checks that must exclude stale development validators. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.
