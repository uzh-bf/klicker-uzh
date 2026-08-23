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
- The PWA course-chat drawer is covered in `playwright/tests/Y-course-chat-drawer.spec.ts`: modal relationships and focus containment, root isolation and restoration, multiple-chatbot selection, new-tab and iframe targets, desktop and embedded-mobile close controls, and both missing-participation and no-chatbot entry fallbacks.
- The Manage lecturer assistant is covered in `playwright/tests/Y-manage-assistant.spec.ts`. Its route-error cases prove that 401 and 429 responses render only the generic `chat-assistant-message-error` UI, do not leak the raw status/body or stack details into the transcript, and leave the composer able to complete a retry.
- Ordinary Playwright runs and CI shards stay Chromium-only. Set `PLAYWRIGHT_RELEASE_MATRIX=true` to make the named `firefox` and `webkit` projects available for targeted release checks. Those projects must pass against production builds before release; a development-server result or browser-startup failure is environment evidence, not product compatibility evidence.
- `evaluation/manage-assistant` keeps the matching E7 readiness contract. Each case declares `assistant_text` or `transport_ui`: model-mediated faults must prove the expected zero-tool or `FORBIDDEN` tool-output condition and require a non-empty assistant message before the judge runs; assistant text, reasoning, tool outputs, route bodies, and the `Retry-After` header are all scanned for internal-detail leaks with payload-redacted diagnostics. Route-level 401/429 faults must match the exact public JSON/status/header contract. The 429 case exhausts a fresh dummy subject with invalid request bodies that return before model invocation, then captures the real limiter response. Run the deterministic contract suite with `cd evaluation/manage-assistant && uv run pytest -m offline -q`; live judged evidence remains a separate paid release gate.
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, and the absence of horizontal overflow.

## Lecturer MCP smoke tests

`apps/mcp-lecturer` has two smoke scripts on top of its mocked vitest unit tests (`pnpm --filter @klicker-uzh/mcp-lecturer run test:run`), both built on shared helpers in `util/mcpSmokeClient.mts`:

- `smoke:local` (`scripts/smoke.ts`) — happy path: initialize, list tools, walk every read/draft tool against the seeded lecturer (`USER_ID_TEST`/`COURSE_ID_TEST` from `packages/prisma-data/src/data/constants.ts`, created by `seedTEST.ts`).
- `smoke:negative` (`scripts/smoke-negative.ts`) — authZ/negative paths: garbage/wrong-secret/wrong-issuer/wrong-purpose/wrong-role/expired/no-lecturer-scope bearer tokens (all rejected with HTTP 401 at `initialize`, since FastMCP authenticates once per session and never re-checks the token on `tools/call`), a `manage:read`-only token (read tool succeeds; the draft tools are absent from `tools/list` and calling one by name comes back as an unknown tool, because scope is enforced by each tool's `canAccess` predicate at session creation), an unknown-but-well-formed course UUID (non-enumerating `FORBIDDEN`), a malformed course id (schema-validation rejection), a foreign `sub` (zero courses, not an error), and a leak check that none of the captured error messages expose a stack trace, `node_modules` path, or `DATABASE_URL`.

Both scripts need a migrated + seeded Postgres and a running `apps/mcp-lecturer` on the configured URL, with `APP_SECRET`/`APP_ORIGIN_AUTH` matching what the server booted with (`--help` on either script documents the env vars and defaults).

In the devcontainer, `APP_ORIGIN_AUTH` is the trap. The scripts default to the plain value in `.devcontainer/devcontainer.env`, but `post-start.sh` namespaces every origin per workspace before starting the services, so the running server's JWT issuer is `https://auth.klicker.<workspace>.localhost`. Export the namespaced value before running either script — read it off the live process with `tr '\0' '\n' < /proc/$(pgrep -f mcp-student | head -1)/environ | grep APP_ORIGIN_AUTH`. A mismatch does not fail loudly: every negative case still passes (the token is rejected, just for the wrong reason) and only the cases needing a _valid_ token fail, so treat those cases as the run's positive control and never read an all-negative pass as success on its own.

`apps/mcp-student` has mocked vitest units (`pnpm --filter @klicker-uzh/mcp-student test`) plus its own `smoke:local` (`scripts/smoke.ts`), which additionally needs a reachable GraphQL API because the server reads elements through the persisted client rather than Prisma. Its `smoke:negative` (`scripts/smoke-negative.ts`) mirrors the lecturer's: empty/garbage/wrong-secret/wrong-issuer/wrong-role/expired tokens, a plain participant session token (no `purpose`, `scope`, or `actor` claims — the case the purpose claim exists to reject), a lecturer MCP token, an unknown `actor` value, a token with no student scope, a `student:practice:read`-only token (`submit_practice_stack_answer` neither advertised nor callable), a forged `questionRef`, an unenrolled participant (no candidates), and the same leak check. **There is no `test-mcp-student` CI workflow** — only `test-mcp-lecturer` exists — so student-MCP changes get no automated service-level signal; run the smoke script locally before merging.

## CI matrix

Path-filtered unit workflows: `test-grading`, `test-util`, `test-markdown` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack), `test-mcp-lecturer` (Postgres only: unit tests, then migrate + `seed:test`, then boots the built server and runs `smoke:local` + `smoke:negative` against it). `test-chat` runs the `apps/chat` vitest suite (path filter: `apps/chat/` + `packages/{i18n,prisma,graphql}/` + workspace manifests; it builds `packages/prisma` first because the model-registry parity test imports the backend registry, which imports the prisma client at runtime). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. The workflow tars the five `.next` trees before artifact upload and extracts them in each shard so Turbopack's runtime dependency symlinks survive the cross-job handoff. Dedicated `-status` fail-open gates exist for the multi-job workflows (`test-graphql`, `test-playwright`, `test-mcp-lecturer`); the single-job filtered workflows (`test-grading`, `test-util`, `test-markdown`, `test-chat`) always run their one job and report directly, so they need no companion gate.

**Hatchet tokens differ per workflow, because `test-playwright` is the only one that runs inside a `container:`.** `test-graphql` runs straight on the runner, so it reaches Hatchet at `localhost` and reads its boot-minted token with `docker exec`. Inside a container job neither works: service containers resolve by service **name** (`hatchet:8888` / `hatchet:7077`, exactly like the `postgres:5432` the same job already uses), and the Playwright image ships no Docker CLI. So `test-playwright` shares `/config` with the Hatchet service through the `hatchet_lite_config` volume and reads `/config/authdisabled-token` directly. Do not "simplify" those hostnames to `localhost` — every shard then fails in `Prepare .env files` before a single test runs. The HTTP token API is not a fallback: `hatchet-lite-dev` disables auth and answers `POST /api/v1/tenants/{id}/api-tokens` with 401 for every caller. The token's own claims always say `localhost`, which is harmless — `packages/hatchet/src/client.ts` passes `host_port`/`api_url` explicitly, and process env beats the `.env` templates for both `node --env-file` and `dotenv`.

**Git hooks run no application test suites** (pre-commit = `check:all`, pre-push = `build`). The Prisma package check regenerates the raw Prisma 7 client before typechecking; no generated-source patch remains. Clean CI jobs therefore do not depend on generated files left by an earlier build or cache restore. The Auth adapter round-trip is intentionally separate because it writes and removes disposable local rows. The expectation before a PR: `check:all` + build + targeted tests for touched logic + browser evidence for UI changes; CI is the real e2e gate.

For the assistant release matrix, run the two targeted specs explicitly:

```bash
PLAYWRIGHT_RELEASE_MATRIX=true \
pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-manage-assistant.spec.ts \
  tests/Y-course-chat-drawer.spec.ts \
  --project=firefox --project=webkit
```

Keep this separate from the ordinary eight-shard Chromium matrix so normal PR cost does not triple. Use the official Playwright 1.58.2 runtime or another environment with matching browser binaries and record the browser versions.

Root typecheck includes the Playwright compiler surface through its package `check` script. Compiler/toolchain upgrades also cover the test build and Docs production build; the exact commands live in `klicker-testing-verification`. Playwright uses strict TypeScript compilation.

Check-only configs must state their no-output role with `noEmit`. When they extend a declaration-emitting config, `noEmit` alone does not disable declaration portability analysis: GraphQL and Prisma therefore also set `declaration: false` and `declarationMap: false`. Incremental checks use `tsconfig.check.tsbuildinfo` rather than overwriting the emitting compiler's state. The full compiler-role matrix lives in [Getting Started](./getting-started.md#toolchain-verified-2026-07-07).

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. All five Next builds use their canonical `tsconfig.json`; the three PWA apps reserve `tsconfig.check.json` for raw package checks that must exclude stale development validators. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.
