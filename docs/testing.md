---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
timestamp: '2026-08-28'
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
| Auth adapter against shared Prisma client                            | disposable local PostgreSQL through the guarded Auth round-trip                            | `pnpm --filter @klicker-uzh/auth test:prisma-adapter`                                              |
| UI / user flows                                                      | Playwright e2e (new specs); Cypress only for legacy maintenance                            | see routing below                                                                                  |
| Office Add-in URL validation                                         | Node's built-in test runner — safe without services                                        | `pnpm --filter @klicker-uzh/office-addin test`                                                     |

CODE contract, policy, and sandbox-client stabilization have three fast service-free suites:

```bash
pnpm --filter @klicker-uzh/util exec vitest run \
  test/codeElements.test.ts \
  test/codeApi.test.ts
pnpm --filter @klicker-uzh/graphql exec vitest run \
  test/codeElementPolicy.test.ts \
  test/codeGraphqlContract.test.ts \
  test/validateCodeOptions.test.ts
```

These protect public-versus-hidden projection, option validation, the shared 128-character test-ID and finite-total-weight constraints, shared JSON limits, supported activity types, CODE-only stack rules, asymmetric CodeAPI claims, invocation-only public/hidden requests, hostile response parsing, output caps, one shared public/hidden grading deadline, and exact JSON grading. When `python3` is available, `codeApi.test.ts` also executes the generated runner and verifies pass/error/timeout behavior, direct file-descriptor flooding, descendant cleanup, and process-group termination; Vitest marks those two tests skipped when Python is absent. These checks do not replace the database-backed submission lifecycle tests, the gated live CodeAPI smoke, or browser/e2e flows required by later slices.

The CODE receipt and finalization integration suite needs the GraphQL test database but not a live CodeAPI because it injects the already-sanitized grading result at the server boundary:

```bash
pnpm --filter @klicker-uzh/graphql exec vitest run \
  test/codeSubmissions.test.ts
```

It covers active-receipt convergence, durable pending state after an enqueue failure, observationally equivalent rejection of absent/wrong-type/foreign/unavailable instances, foreign persistent-instance rejection without movement, duplicate delivery, retry after failure and commit, repeated `429` deferral without attempt-budget consumption, expired and unexpired claim behavior, exhausted retries, a new attempt after `FAILED`, microlearning closure, a bounded 20-submission concurrent burst, separate global/participant aggregates, and exactly-once response, statistics, spaced-repetition, points, XP, leaderboard, and timeline writes. The LiveQuiz cases additionally require execution binding, completed-receipt reuse, one `LiveQuizResponse`, an immutable first-finalized-correct bonus anchor under out-of-order grading, expected points/test aggregates, one cache projection, and recovery from failed or stale projection without a second grading call. It also asserts that participant readback contains only public tests while an instructor-authorized full element snapshot and aggregate contain public and hidden tests; an unrelated user receives neither. Keep the executor mocked in this suite; the service-free CodeAPI tests own runner, output caps, and hostile-response behavior, while the gated live smoke owns the deployed integration.

The shared Analytics correctness mapping for persisted CODE details has a service-free Python regression:

```bash
cd apps/analytics
uv run python -m unittest discover -s tests -v
```

This mapping is used by both daily and course participant analytics. It reads only the server-computed correctness persisted during finalization; it does not execute or inspect the submitted code.

For Manage CODE browser proof, exercise the type transition itself: select CODE through `select-question-type`, require `code-options` to render without a CodeMirror console error, and verify `student-element-preview` contains public test names but no hidden test names. In the practice-quiz, microlearning, or LiveQuiz wizard, CODE must remain the only element in its stack/block. A LiveQuiz containing CODE must require a course.

For participant CODE browser proof, `playwright/tests/Q-code-practice-quiz.spec.ts` seeds real published practice-quiz and microlearning activities and uses the real PWA activity queries. Practice-quiz cases replace the external grading receipt transition so pending, reload recovery, completion, stale-active-result rejection, submitted-code recovery, cross-participant isolation, hidden-test omission, failure, and retry are deterministic. The microlearning case executes the real GraphQL mutation in-process with only Hatchet enqueueing replaced, runs the production finalizer against a deterministic sanitized executor result, and then requires the real `getPreviousStackEvaluation` readback and participant-scoped evaluation storage before advancing. It also forces one readback error and proves the explicit retry. Its separate lecturer scenario uses the real Manage GraphQL evaluation and asserts exact public/hidden pass and total cells, including a failed hidden test. `Q-code-live-quiz.spec.ts` likewise executes the real receipt mutation and production finalizer at the server boundary, closes the active block through the lecturer cockpit before delayed finalization, and requires the execution-scoped pending/completed participant UI without any `/AddResponse` request.

When Playwright runs inside the self-contained devcontainer, Chromium reaches linked-worktree routes through `PLAYWRIGHT_HOST_RESOLVER_RULES` mapped to `host.docker.internal`, while unmatched GraphQL operations are forwarded to the container-local backend with the original query string, method, body, and headers. Set `COOKIE_DOMAIN` to the linked-worktree suffix for lecturer fixtures. Do not broaden these transport workarounds into mocked activity data or instructor evaluation.

**Never run root `pnpm run test:run` blind** — the turbo fan-out includes Cypress, which needs a running, seeded stack. The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

The Office Add-in has a separate host boundary. Its pure URL contract runs under Node, while `check`, `lint`, `build:docs`, `verify:docs`, and `validate` cover compilation, source quality, the production bundle, exact deployment parity, and manifest acceptance. A browser run with a stubbed Office API verifies UI states only. Persistence, multiple content-add-in instances, and embedded evaluation rendering require a real PowerPoint sideload before release.

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

**Git hooks run no application test suites** (pre-commit = `check:all`, pre-push = `build`). The Prisma package check regenerates the raw Prisma 7 client before typechecking; no generated-source patch remains. Clean CI jobs therefore do not depend on generated files left by an earlier build or cache restore. The Auth adapter round-trip is intentionally separate because it writes and removes disposable local rows. The expectation before a PR: `check:all` + build + targeted tests for touched logic + browser evidence for UI changes; CI is the real e2e gate.

Root typecheck includes the Cypress and Playwright compiler surfaces through their package `check` scripts. Compiler/toolchain upgrades also cover the test build and Docs production build; the exact commands live in `klicker-testing-verification`. Cypress uses the workspace TypeScript 6 dependency but explicitly preserves its non-strict compiler contract in `cypress/tsconfig.json`; Playwright remains strict. This is legacy-suite compatibility, not a precedent for new TypeScript packages.

Check-only configs must state their no-output role with `noEmit`. When they extend a declaration-emitting config, `noEmit` alone does not disable declaration portability analysis: GraphQL and Prisma therefore also set `declaration: false` and `declarationMap: false`. Incremental checks use `tsconfig.check.tsbuildinfo` rather than overwriting the emitting compiler's state. The full compiler-role matrix lives in [Getting Started](./getting-started.md#toolchain-verified-2026-07-07).

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. All five Next builds use their canonical `tsconfig.json`; the three PWA apps reserve `tsconfig.check.json` for raw package checks that must exclude stale development validators. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.

Inside the devcontainer, prefer the root build because it forces `NODE_ENV=production`. If a direct Next package build is needed while the background dev process is stopped, set `NODE_ENV=production` explicitly and remove only that app's generated `.next/dev` cache before retrying; otherwise live dev validators can collide with production validators. A Google Fonts fetch failure is an external build dependency and must be reported separately from compilation results.
