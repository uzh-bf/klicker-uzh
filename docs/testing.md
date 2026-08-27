---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the Playwright e2e stack and its seeds, and the CI test matrix.
timestamp: '2026-08-20'
tags:
  - testing
  - ci
---

# Testing

**There is no component-test layer.** Coverage is pure-function vitest at the bottom and full-stack e2e at the top — nothing in between (no @testing-library/react). Don't look for one, and don't assume a React component is covered unless an e2e spec exercises it.

## Which level for which change

| Change                                                                            | Test level                                                                                 | Command                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Pure logic (grading, util, export, word-cloud, markdown, feature-flags core/Node) | package vitest — **safe without any services**                                             | `pnpm --filter @klicker-uzh/grading test` (etc.); chat is the exception: `pnpm --filter @klicker-uzh/chat test:run` |
| Learning analytics engine contract                                                | package contract suite — **safe without services, Hatchet, or a database**                 | `pnpm --filter @klicker-uzh/analytics-engine-contract test`                                                         |
| React/browser feature-flag behavior                                               | browser verification; use e2e when a user flow covers it                                   | `npx agent-browser@0.32.2` against the adopting app                                                                 |
| GraphQL services/resolvers                                                        | `packages/graphql` vitest — needs REAL Postgres + Redis + Hatchet + `HATCHET_CLIENT_TOKEN` | `pnpm --filter @klicker-uzh/graphql test:local` (one-command bootstrap: `test/run-tests-local.sh`)                  |
| Auth adapter against shared Prisma client                                         | disposable local PostgreSQL through the guarded Auth round-trip                            | `pnpm --filter @klicker-uzh/auth test:prisma-adapter`                                                               |
| UI / user flows                                                                   | Playwright e2e                                                                             | see routing below                                                                                                   |
| Office Add-in URL validation                                                      | Node's built-in test runner — safe without services                                        | `pnpm --filter @klicker-uzh/office-addin test`                                                                      |

For server-paginated manage lists, browser coverage must exercise finite page
sizes, the opt-in `All` transition, the reset back to 50, and explicit
selection after `All`. When the fixture contains 200 eligible records, the
focused batch flow must verify that all 200 records remain usable and that the
mutation's returned count is reported without silent truncation. Runtime
failures after earlier per-record commits are not an atomicity guarantee of
the existing batch contract.

Assessment participant invitations are a bounded exception: the Manage page
offers only finite `10`, `20`, and `50` sizes, rejects CSV files above 1 MiB or
200 data rows before submission, and must verify page totals and page-one reset
after import or deletion.

**Never run root `pnpm run test:run` blind.** The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

For OpenAI-compatible chat stream changes, run
`apps/chat/test/openai-chat-streaming.test.ts` first. It injects an
OpenAI-compatible SSE response whose first tool call uses a sparse provider
index, so it proves provider conversion without a database, MCP server, or
model key. It is a local regression gate, not evidence that a real upstream
first turn works in staging.

For OpenAI-compatible request-policy or prompt-cache changes, also run
`apps/chat/test/openai-cache-policy.test.ts` and
`apps/chat/test/prompt-cache-identity.test.ts`. These fixtures capture the
final synthetic Chat Completions and Responses JSON bodies, verify the default
exact-response bypass and custom-provider boundary, and assert public
`usage.inputTokenDetails` values for uncached input, cache reads, and cache
writes. They use no database, credentials, gateway, Redis, or paid model.
A passing fixture proves local AI SDK serialization and response conversion;
it does not prove a LiteLLM/provider cache hit, router resolution, production
behavior, latency, or cost impact. This is server-side request policy, so it
does not require browser evidence; add the normal browser path if the change
also affects UI, auth, redirect, cookie, or user-visible chat behavior.

For chat conversation-rendering changes, `playwright/util/chat.ts` also supports
`textChunks` and `chunkDelayMs` to deliver separate deltas through a browser
`ReadableStream`; `pauseAfterTextChunk` holds the stream at a deterministic
intermediate state until the test releases it. Use that seam to test the assistant
row while it is still streaming, and capture DOM identity around feedback clicks
when the bug concerns remounts or flicker. A passing final-text assertion alone
does not prove that the conversation stayed mounted.

The Office Add-in has a separate host boundary. Its pure URL contract runs under Node, while `check`, `lint`, `build:docs`, `verify:docs`, and `validate` cover compilation, source quality, the production bundle, exact deployment parity, and manifest acceptance. A browser run with a stubbed Office API verifies UI states only. Persistence, multiple content-add-in instances, and embedded evaluation rendering require a real PowerPoint sideload before release.

## E2E stack and selector convention

**Playwright is the sole e2e test suite.** All e2e specs live under `playwright/`.

Specs click `data-cy` attributes ([Frontend Conventions](./frontend-conventions.md)). Specs are letter-prefixed for run order (`A-login-workflow` … `Z-credential-verification`).

|               | Playwright (`playwright/`)                                 |
| ------------- | ---------------------------------------------------------- |
| Stack scripts | `dev:playwright` / `start:playwright`                      |
| Infisical env | `dev-playwright`                                           |
| Seed          | own `seedDatabase()` in `global-setup.ts` (once, wipes DB) |
| CI            | official Playwright container, 8-way shard, all PRs        |

The seed paths (dev `seedTEST.ts` and Playwright `global-setup.ts`) are **independent** — a fixture added to one does not exist in the other ([Data & Migrations](./data-and-migrations.md)). `*:raw` script variants skip Infisical. `_run_app_dependencies.sh` applies the schema with `prisma:push` without forcing a reset.

For authoring specifics, helper patterns, and failure triage, use the `klicker-playwright-e2e` skill ([.agents/skills/](../.agents/skills/)).

## E2E environment dependencies

- The local Chat model simulation includes LiteLLM's `auto-router` and
  the GPT-5.6 Luna/Sol target aliases. After `devrouter ensure .`, verify the
  LiteLLM liveness endpoint, direct embedding/model probes, expected Auto V2
  routing decisions in LiteLLM logs, and the chat credits response before
  browser testing the `Auto Mode`/`GPT-5.6 Luna` picker. A real
  `UPSTREAM_OPENAI_API_KEY` is required for these calls; service health alone is
  not classification or answer-stream evidence.
- Tests that **publish, schedule, or end activities** need the Hatchet **general worker** running on top of the test stack — otherwise mutations fail with `workflow not found`. The worker needs `DATABASE_URL` pointed at the test DB ([Async & Workers](./async-and-workers.md)).
- **Live-quiz response tests** additionally need `response-api` + the response processor with the same `APP_SECRET`/Redis/Postgres settings — otherwise the UI accepts answers that never reach cockpit/evaluation.
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, and the absence of horizontal overflow.

## CI matrix

Path-filtered unit workflows: `test-grading`, `test-util`, `test-markdown`, and `test-analytics-engine-contract` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack). The consolidated `test-unit` workflow builds shared dependencies and runs the chat, grading, markdown, and util suites after relevant package or workspace-manifest changes; its pull-request job intentionally waits until the PR leaves draft. The analytics contract workflow runs on draft PR changes and verifies its tests, typecheck, and build because Catalyst consumes an immutable public commit before the public PR becomes ready. `test-chat` runs the `apps/chat` vitest suite (path filter: `apps/chat/` + `packages/{i18n,prisma,graphql}/` + workspace manifests; it builds `packages/prisma` first because the model-registry parity test imports the backend registry, which imports the prisma client at runtime). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. The workflow tars the five `.next` trees before artifact upload and extracts them in each shard so Turbopack's runtime dependency symlinks survive the cross-job handoff. Dedicated `-status` fail-open gates exist for the multi-job workflows (`test-graphql`, `test-playwright`); the single-job filtered workflows (`test-grading`, `test-util`, `test-markdown`, `test-chat`, `test-analytics-engine-contract`) always run their one job and report directly, so they need no companion gate.

**Hatchet tokens differ per workflow, because `test-playwright` is the only one that runs inside a `container:`.** `test-graphql` runs straight on the runner, so it reaches Hatchet at `localhost` and reads its boot-minted token with `docker exec`. Inside a container job neither works: service containers resolve by service **name** (`hatchet:8888` / `hatchet:7077`, exactly like the `postgres:5432` the same job already uses), and the Playwright image ships no Docker CLI. So `test-playwright` shares `/config` with the Hatchet service through the `hatchet_lite_config` volume and reads `/config/authdisabled-token` directly. Do not "simplify" those hostnames to `localhost` — every shard then fails in `Prepare .env files` before a single test runs. The HTTP token API is not a fallback: `hatchet-lite-dev` disables auth and answers `POST /api/v1/tenants/{id}/api-tokens` with 401 for every caller. The token's own claims always say `localhost`, which is harmless — `packages/hatchet/src/client.ts` passes `host_port`/`api_url` explicitly, and process env beats the `.env` templates for both `node --env-file` and `dotenv`.

**Git hooks run no application test suites** (pre-commit = `check:all`, pre-push = `build`). The Prisma package check regenerates the raw Prisma 7 client before typechecking; no generated-source patch remains. Clean CI jobs therefore do not depend on generated files left by an earlier build or cache restore. The Auth adapter round-trip is intentionally separate because it writes and removes disposable local rows. The expectation before a PR: `check:all` + build + targeted tests for touched logic + browser evidence for UI changes; CI is the real e2e gate.

Root typecheck includes the Playwright compiler surface through its package `check` script. Compiler/toolchain upgrades also cover the test build and Docs production build; the exact commands live in `klicker-testing-verification`. Playwright uses strict TypeScript compilation.

Check-only configs must state their no-output role with `noEmit`. When they extend a declaration-emitting config, `noEmit` alone does not disable declaration portability analysis: GraphQL and Prisma therefore also set `declaration: false` and `declarationMap: false`. Incremental checks use `tsconfig.check.tsbuildinfo` rather than overwriting the emitting compiler's state. The full compiler-role matrix lives in [Getting Started](./getting-started.md#toolchain-verified-2026-07-07).

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. All five Next builds use their canonical `tsconfig.json`; the three PWA apps reserve `tsconfig.check.json` for raw package checks that must exclude stale development validators. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.
