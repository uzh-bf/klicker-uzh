---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
timestamp: '2026-07-13'
tags:
  - testing
  - ci
---

# Testing

**There is no component-test layer.** Coverage is pure-function vitest at the bottom and full-stack e2e at the top — nothing in between (no @testing-library/react, no Cypress component testing). Don't look for one, and don't assume a React component is covered unless an e2e spec exercises it.

## Which level for which change

| Change                                                     | Test level                                                                                 | Command                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Pure logic (grading, util, export, word-cloud, chat logic) | package vitest — **safe without any services**                                             | `pnpm --filter @klicker-uzh/grading test` (etc.)                                                   |
| GraphQL services/resolvers                                 | `packages/graphql` vitest — needs REAL Postgres + Redis + Hatchet + `HATCHET_CLIENT_TOKEN` | `pnpm --filter @klicker-uzh/graphql test:local` (one-command bootstrap: `test/run-tests-local.sh`) |
| UI / user flows                                            | Playwright e2e (new specs); Cypress only for legacy maintenance                            | see routing below                                                                                  |

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

### Adaptive PracticeQuiz workflow

`playwright/tests/Z-adaptive-learning.spec.ts` is the focused cross-layer rollout suite. It verifies the default-off course gate, UI authoring and two-course reuse of a depth-5 competence tree, READY element mapping, adaptive-mode PracticeQuiz creation and immediate publication of four distinct items, five four-response participant completions, the visible question timer, exact agreement between the persisted final level and the student headline, and the anonymous lecturer cohort view at the five-participant release boundary.

Run it only against the dedicated Playwright stack because global setup wipes and reseeds the configured database:

```bash
pnpm --filter @klicker-uzh/playwright test -- \
  tests/Z-adaptive-learning.spec.ts --project=chromium
```

Use `test:run:raw` instead when the complete Playwright environment is already exported without Infisical. The browser journey intentionally creates its tree through Manage and completes the published quiz through PWA; Prisma is used only for deterministic fixture setup and persistence assertions. The spec is retry-safe: setup deletes its fixed-name fixtures, persistence checks reject stale success, and teardown restores the original rollout state of every affected course.

When Playwright runs inside the all-in-one devcontainer, point the public
`.klicker.localhost` names at the shared devrouter container (replace the IP if
`docker inspect devrouter-traefik` reports another `devnet` address):

```bash
URL_MANAGE=https://manage.klicker.localhost \
URL_STUDENT=https://pwa.klicker.localhost \
URL_STUDENT_LOGIN=https://pwa.klicker.localhost/login \
PLAYWRIGHT_HOST_RESOLVER_RULES='MAP *.klicker.localhost 192.168.156.2' \
pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Z-adaptive-learning.spec.ts --project=chromium
```

For authoring specifics, helper patterns, and failure triage, use the skills — `klicker-cypress-e2e` and `klicker-playwright-e2e` ([.agents/skills/](../.agents/skills/)) — rather than duplicating their content here.

## E2E environment dependencies

- Tests that **publish, schedule, or end activities** need the Hatchet **general worker** running on top of the test stack — otherwise mutations fail with `workflow not found`. The worker needs `DATABASE_URL` pointed at the test DB ([Async & Workers](./async-and-workers.md)).
- **Live-quiz response tests** additionally need `response-api` + the response processor with the same `APP_SECRET`/Redis/Postgres settings — otherwise the UI accepts answers that never reach cockpit/evaluation.
- Cypress `cy.loginStudent()`/`cy.loginStudentPassword()` clear localforage by default; continuation tests that rely on stored answers pass `{ preserveClientState: true }`.

## CI matrix

Path-filtered unit workflows: `test-adaptive-learning`, `test-grading`, `test-util` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. All path-skipped workflows report through `-status` gates to satisfy branch protection. Cypress CI signal quirk: the merge-group check can show a rising failed count while `cypress-run-cloud` is still in progress — wait for cloud completion before reading logs.

**Git hooks run no tests** (pre-commit = `check:all`, pre-push = `build`). The expectation before a PR: `check:all` + build + targeted vitest for touched logic + browser evidence for UI changes; CI is the real e2e gate.
