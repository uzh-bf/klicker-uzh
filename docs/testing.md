---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
timestamp: '2026-07-28'
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
- The PWA course-chat drawer is covered in `playwright/tests/Y-course-chat-drawer.spec.ts`: modal relationships and focus containment, root isolation and restoration, multiple-chatbot selection, new-tab and iframe targets, desktop and embedded-mobile close controls, and both missing-participation and no-chatbot entry fallbacks.
- The Manage lecturer assistant is covered in `playwright/tests/Y-manage-assistant.spec.ts`. Its route-error cases prove that 401 and 429 responses render only the generic `chat-assistant-message-error` UI, do not leak the raw status/body or stack details into the transcript, and leave the composer able to complete a retry.
- Ordinary Playwright runs and CI shards stay Chromium-only. Set `PLAYWRIGHT_RELEASE_MATRIX=true` to make the named `firefox` and `webkit` projects available for targeted release checks. Those projects must pass against production builds before release; a development-server result or browser-startup failure is environment evidence, not product compatibility evidence.
- `evaluation/manage-assistant` keeps the matching E7 readiness contract. Each case declares `assistant_text` or `transport_ui`: model-mediated faults must prove the expected zero-tool or `FORBIDDEN` tool-output condition and require a non-empty assistant message before the judge runs; assistant text, reasoning, tool outputs, route bodies, and the `Retry-After` header are all scanned for internal-detail leaks with payload-redacted diagnostics. Route-level 401/429 faults must match the exact public JSON/status/header contract. The 429 case exhausts a fresh dummy subject with invalid request bodies that return before model invocation, then captures the real limiter response. Run the deterministic contract suite with `cd evaluation/manage-assistant && uv run pytest -m offline -q`; live judged evidence remains a separate paid release gate.
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, and the absence of horizontal overflow.
- Cypress `cy.loginStudent()`/`cy.loginStudentPassword()` clear localforage by default; continuation tests that rely on stored answers pass `{ preserveClientState: true }`.

## Lecturer MCP smoke tests

`apps/mcp-lecturer` has two smoke scripts on top of its mocked vitest unit tests (`pnpm --filter @klicker-uzh/mcp-lecturer run test:run`), both built on shared helpers in `util/mcpSmokeClient.mts`:

- `smoke:local` (`scripts/smoke.ts`) — happy path: initialize, list tools, walk every read/draft tool against the seeded lecturer (`USER_ID_TEST`/`COURSE_ID_TEST` from `packages/prisma-data/src/data/constants.ts`, created by `seedTEST.ts`).
- `smoke:negative` (`scripts/smoke-negative.ts`) — authZ/negative paths: garbage/wrong-secret/wrong-issuer/wrong-purpose/wrong-role/expired bearer tokens (all rejected with HTTP 401 at `initialize`, since FastMCP authenticates once per session and never re-checks the token on `tools/call`), a `manage:read`-only token (read tool succeeds, draft tool fails `MISSING_SCOPE`), an unknown-but-well-formed course UUID (non-enumerating `FORBIDDEN`), a malformed course id (schema-validation rejection), a foreign `sub` (zero courses, not an error), and a leak check that none of the captured error messages expose a stack trace, `node_modules` path, or `DATABASE_URL`.

Both scripts need a migrated + seeded Postgres and a running `apps/mcp-lecturer` on the configured URL, with `APP_SECRET`/`APP_ORIGIN_AUTH` matching what the server booted with (`--help` on either script documents the env vars and defaults).

## CI matrix

Path-filtered unit workflows: `test-grading`, `test-util`, `test-markdown` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack), `test-mcp-lecturer` (Postgres only: unit tests, then migrate + `seed:test`, then boots the built server and runs `smoke:local` + `smoke:negative` against it). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. The workflow tars the five `.next` trees before artifact upload and extracts them in each shard so Turbopack's runtime dependency symlinks survive the cross-job handoff. All path-skipped workflows report through `-status` gates to satisfy branch protection. Cypress CI signal quirk: the merge-group check can show a rising failed count while `cypress-run-cloud` is still in progress — wait for cloud completion before reading logs.

**Git hooks run no tests** (pre-commit = `check:all`, pre-push = `build`). The expectation before a PR: `check:all` + build + targeted vitest for touched logic + browser evidence for UI changes; CI is the real e2e gate.

For the assistant release matrix, run the two targeted specs explicitly:

```bash
PLAYWRIGHT_RELEASE_MATRIX=true \
pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-manage-assistant.spec.ts \
  tests/Y-course-chat-drawer.spec.ts \
  --project=firefox --project=webkit
```

Keep this separate from the ordinary eight-shard Chromium matrix so normal PR cost does not triple. Use the official Playwright 1.58.2 runtime or another environment with matching browser binaries and record the browser versions.

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.
