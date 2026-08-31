---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the Playwright e2e stack and its seeds, and the CI test matrix.
timestamp: '2026-08-30'
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
| UI / user flows                                                                   | Playwright e2e                                                                             | `pnpm playwright:host -- <args>` from the host; see routing below                                                   |
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

The focused KB CRUD, ingestion, and signed-webhook suites deliberately avoid a real Hatchet client: CRUD and ingestion use test-only task stubs, and webhook tests use Prisma directly. They still run against real PostgreSQL and cover owner-scoped bounded history, atomic resource/run transitions, retry races, serving cutover, terminal-event ordering, material-category defaults and filtering, complete-KB ingestion summaries, bulk freshness reconciliation, conditional claims, repeated calls, and per-resource queue-failure compensation.

KB quota coverage must use real PostgreSQL for parent-row lock serialization, exact count/byte boundaries, pending tickets, tombstones, confirmation conversion, and cleanup release. Hatchet unit coverage owns persisted KB-scope rejection plus URL-size replacement arithmetic and the no-dispatch `KB_STORAGE_LIMIT_REACHED` transition.

KB graph accounting coverage also uses real PostgreSQL: `packages/graphql/test/knowledgeGraphAccounting.test.ts` proves same-owner semester-quota lock serialization, one-time success settlement, metered non-success settlement without publication, dispatch-failure release, cleanup-fenced late success, matching/stale/newer-build late-success reconciliation, bounded actual token/request aggregation, publication only after contract validation, and reservation hold on an invalid result. The disposable migration applies the durable dispatch-claim column before these tests. Pure W1 terminal-result, database-integer-bound, cost-configuration, and quota-drift validation remains in `kbGraphContract.test.ts`, `knowledgeGraphCost.test.ts`, and `knowledgeGraphConfig.test.ts`; `packages/hatchet/test/kbGraphIngestion.test.ts` proves worker-side kill-switch/opt-in/complete-reservation gates, pre-accounting fencing, accepted-but-uncorrelated dispatch holds, provider-status-only reconciliation failure, abort-before-slot-reuse for eight concurrent provider calls, and versioned-result handoff to the settlement callback.

Element-generation accounting also runs against real PostgreSQL. `packages/graphql/test/elementGenerationAccounting.test.ts` proves owner-semester lock serialization, idempotent concurrent starts, one-time settlement, unclaimed and stale-claim release, graph/element shared-quota enforcement, complete price configuration, legacy-row fencing, and an independent spend for every flashcard retry. Focused dispatch and lifecycle tests cover accepted-but-not-yet-visible question/initial-flashcard/retry fencing, exact retry recovery, deterministic preflight before spend claim, terminal success-without-artifact handling, and bounded Blob downloads.

KB scale coverage uses real PostgreSQL for tied keyset traversal, cursor/filter binding, owner isolation, tombstone hiding, immutable resource-page order during status changes, exact derived metrics, and all-or-nothing bounded bulk deletion. UI appearance and interaction have no component-test layer in this repository: verify the generated-operation typechecks, then exercise catalog/detail search, filters, inspector, selection/confirmation, active polling, EN/DE, and desktop/390 px layouts through the real delegated-login browser path.

**Never run root `pnpm run test:run` blind.** The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

The response-example foundation test uses the GraphQL local database suite and
creates its candidate and evidence rows directly inside the test fixture.
The development seed and focused Playwright journey also add deterministic
synthetic chatbot/examples for local review; none of these paths mutate
production data. A green GraphQL test proves the owner lifecycle and cascade
contract without relying on the development seed.

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

Local Playwright has a strict host/container boundary. The canonical command is
`pnpm playwright:host -- <args>` from a host shell. It reconciles the exact
devrouter workspace, maps every browser origin, discovers the workspace's
random loopback PostgreSQL port, and runs Playwright with host dependencies and
browser binaries. Package scripts route to the same launcher, while
`playwright.config.ts` rejects direct local commands and every local container
before global setup can reset data. The devcontainer also sets a non-directory
browser path so browser installation fails there. GitHub Actions is explicitly
allowed and retains the direct official-container workflow.

Specs click `data-cy` attributes ([Frontend Conventions](./frontend-conventions.md)). Specs are letter-prefixed for run order (`A-login-workflow` … `Z-credential-verification`).

|               | Playwright (`playwright/`)                                 |
| ------------- | ---------------------------------------------------------- |
| Local command | `pnpm playwright:host -- <args>`                           |
| Infisical env | `dev-playwright`                                           |
| Seed          | own `seedDatabase()` in `global-setup.ts` (once, wipes DB) |
| CI            | official Playwright container, 8-way shard, all PRs        |

The seed paths (dev `seedTEST.ts` and Playwright `global-setup.ts`) are **independent** — a fixture added to one does not exist in the other ([Data & Migrations](./data-and-migrations.md)). `*:raw` script variants skip Infisical. `_run_app_dependencies.sh` applies the schema with `prisma:push` without forcing a reset.

The Playwright stack starts
`playwright/util/mockGrowthBookServer.mjs` alongside the applications. The
test-origin wrapper points backend SDK evaluation at this synthetic feature
endpoint, while each browser test still controls its own public SDK
response with Playwright routing. This separation lets the learning-analytics
allow and deny tests exercise the real browser → persisted GraphQL →
backend-entitlement path without a live GrowthBook deployment or management
credential. The test wrapper shortens backend polling to 250 ms; production
keeps the package's 30-second default.

For authoring specifics, helper patterns, and failure triage, use the `klicker-playwright-e2e` skill ([.agents/skills/](../.agents/skills/)).

## E2E environment dependencies

The self-contained devcontainer uses two independent cold-start guards:
`devcontainer.json` waits for `postCreateCommand`, and the managed post-start
adapter requires the exact completion marker written at the end of successful
bootstrap. `bash util/test-dev-runtime.sh` covers missing, malformed,
symlinked, invalidated, and valid marker states plus the script ordering. This
is static lifecycle evidence; cold DevPod and Devsy startup remain the
provider-level acceptance check.

- The local Chat model simulation includes LiteLLM's `auto-router` and
  the GPT-5.6 Luna/Sol target aliases. Start it with
  `devrouter ensure . --profile chat,ai`; add `mcp` for the seeded synthetic
  tool path. Then verify the
  LiteLLM liveness endpoint, direct embedding/model probes, expected Auto V2
  routing decisions in LiteLLM logs, and the chat credits response before
  browser testing the `Auto Mode`/`GPT-5.6 Luna` picker. A real
  `UPSTREAM_OPENAI_API_KEY` is required for these calls; service health alone is
  not classification or answer-stream evidence.
- Tests that **publish, schedule, or end activities** need the Hatchet **general worker** running on top of the test stack — otherwise mutations fail with `workflow not found`. Use `live-quiz`, `manage,live-quiz`, or `full`; the worker needs `DATABASE_URL` pointed at the test DB ([Async & Workers](./async-and-workers.md)).
- **Live-quiz response tests** use `devrouter ensure . --profile live-quiz`.
  Startup proves Response API's `/healthz` contract plus live general and
  response-processor worker descendants before reporting ready. Without those
  processes and matching `APP_SECRET`/Redis/Postgres settings, the UI can
  accept answers that never reach cockpit/evaluation.
- The PWA course-chat drawer is covered in `playwright/tests/Y-course-chat-drawer.spec.ts`: modal relationships and focus containment, root isolation and restoration, multiple-chatbot selection, new-tab and iframe targets, desktop and embedded-mobile close controls, and both missing-participation and no-chatbot entry fallbacks.
- The Manage lecturer assistant is covered in `playwright/tests/Y-manage-assistant.spec.ts`. The suite covers the non-modal page interaction contract, cross-origin Escape and focus restoration, persistent context and change announcements, short mobile viewports, desktop-only size persistence, readiness loading state, retained resizing, in-session reset without iframe reload, trusted proposal revisions, complete correctness/feedback review, localized draft confirmation and parent-owned editor navigation, and proposal clearance above the composer. Its route-error cases prove that 401 and 429 responses render only the generic `chat-assistant-message-error` UI, do not leak the raw status/body or stack details into the transcript, and leave the composer able to complete a retry.
- Ordinary Playwright runs and CI shards stay Chromium-only. Set `PLAYWRIGHT_RELEASE_MATRIX=true` to make the named `firefox` and `webkit` projects available for targeted release checks. Those projects must pass against production builds before release; a development-server result or browser-startup failure is environment evidence, not product compatibility evidence.
- `evaluation/manage-assistant` keeps the matching E7 readiness contract. Each case declares `assistant_text` or `transport_ui`: model-mediated faults must prove the expected zero-tool or `FORBIDDEN` tool-output condition and require a non-empty assistant message before the judge runs; assistant text, reasoning, tool outputs, route bodies, and the `Retry-After` header are all scanned for internal-detail leaks with payload-redacted diagnostics. Route-level 401/429 faults must match the exact public JSON/status/header contract. The 429 case exhausts a fresh dummy subject with invalid request bodies that return before model invocation, then captures the real limiter response. Run the deterministic contract suite with `cd evaluation/manage-assistant && uv run pytest -m offline -q`; live judged evidence remains a separate paid release gate.
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, the absence of horizontal overflow, and a rendered player ratio of 16:9 within tolerance on both surfaces.

## Lecturer MCP smoke tests

`apps/mcp-lecturer` has two smoke scripts on top of its mocked vitest unit tests (`pnpm --filter @klicker-uzh/mcp-lecturer run test:run`), both built on shared helpers in `util/mcpSmokeClient.mts`:

- `smoke:local` (`scripts/smoke.ts`) — happy path: initialize, list tools, walk every read/draft tool against the seeded lecturer (`USER_ID_TEST`/`COURSE_ID_TEST` from `packages/prisma-data/src/data/constants.ts`, created by `seedTEST.ts`).
- `smoke:negative` (`scripts/smoke-negative.ts`) — authZ/negative paths: garbage/wrong-secret/wrong-issuer/wrong-purpose/wrong-role/expired/no-lecturer-scope bearer tokens (all rejected with HTTP 401 at `initialize`, since FastMCP authenticates once per session and never re-checks the token on `tools/call`), a `manage:read`-only token (read tool succeeds; the draft tools are absent from `tools/list` and calling one by name comes back as an unknown tool, because scope is enforced by each tool's `canAccess` predicate at session creation), an unknown-but-well-formed course UUID (non-enumerating `FORBIDDEN`), a malformed course id (schema-validation rejection), a foreign `sub` (zero courses, not an error), and a leak check that none of the captured error messages expose a stack trace, `node_modules` path, or `DATABASE_URL`.

Both scripts need a migrated + seeded Postgres and a running `apps/mcp-lecturer` on the configured URL, with `APP_SECRET`/`APP_ORIGIN_AUTH` matching what the server booted with (`--help` on either script documents the env vars and defaults).

In the devcontainer, `APP_ORIGIN_AUTH` is the trap. The scripts default to the plain value in `.devcontainer/devcontainer.env`, but `post-start.sh` namespaces every origin per workspace before starting the services, so the running server's JWT issuer is `https://auth.klicker.<workspace>.localhost`. Export the namespaced value before running either script — read it off the live process with `tr '\0' '\n' < /proc/$(pgrep -f mcp-student | head -1)/environ | grep APP_ORIGIN_AUTH`. A mismatch does not fail loudly: every negative case still passes (the token is rejected, just for the wrong reason) and only the cases needing a _valid_ token fail, so treat those cases as the run's positive control and never read an all-negative pass as success on its own.

`apps/mcp-student` has mocked vitest units (`pnpm --filter @klicker-uzh/mcp-student test`) plus its own `smoke:local` (`scripts/smoke.ts`), which additionally needs a reachable GraphQL API because the server reads elements through the persisted client rather than Prisma. Its `smoke:negative` (`scripts/smoke-negative.ts`) mirrors the lecturer's: empty/garbage/wrong-secret/wrong-issuer/wrong-role/expired tokens, a plain participant session token (no `purpose`, `scope`, or `actor` claims — the case the purpose claim exists to reject), a lecturer MCP token, an unknown `actor` value, a token with no student scope, a `student:practice:read`-only token (`submit_practice_stack_answer` neither advertised nor callable), a forged `questionRef`, an unenrolled participant (no candidates), and the same leak check. **There is no `test-mcp-student` CI workflow** — only `test-mcp-lecturer` exists — so student-MCP changes get no automated service-level signal; run the smoke script locally before merging.

## CI matrix

The path-filtered `test-unit` workflow runs the chat, grading, markdown, and util
suites with one frozen install. It builds Prisma, types, grading, and util once,
then keeps each suite as a separately visible step. The chat suite runs against
a PostgreSQL 15 service; the workflow resets that disposable test database
before the suite and enables the account-usage integration cases. Later suites
still run after an earlier test failure, but not after setup or
dependency-build failure. Draft
PR updates skip this job; use its manual dispatch for exact-head proof without
marking a draft ready. This single-job workflow is not a required branch
protection context and needs no companion status gate.

`test-graphql` spins Postgres ×2, hatchet-lite, and Redis and retains a
path-filter job plus the required always-reporting `test-graphql-status` gate.
`test-olat-api` uses workflow-level path filters so irrelevant changes create no
job, while relevant changes still run its Docker Compose test stack. Playwright
uses a path-scoped filter and compiles once before running the 8 shards.
Eligible same-repository public PRs (non-draft, non-bot, rollout enabled or
canary) run the changed-path prepare and build in the Playwright container on
the `public-pr-arm64` runner group through the reusable
`public-pr-playwright-shards.yml` workflow, which runs eight concurrent shards
across the two-host public pool; pushes, fork PRs, drafts, bots, private
repositories, and
disabled rollouts keep all eight shards on GitHub-hosted runners. Both paths
preserve the same artifact names and feed the route-aware
`test-playwright-status` gate, which requires exactly one of the hosted or
public-PR routes to be selected. The workflow tars the five `.next` trees before
artifact upload and extracts them in each shard so Turbopack's runtime
dependency symlinks survive the cross-job handoff. Each shard also restores the
generated GraphQL client map from the built package because Turbo cache hits do
not restore generated source files. Dedicated `-status` fail-open gates remain
for the required multi-job workflows (`test-graphql`, `test-playwright`).
Playwright cancellation is job-scoped: hosted stages cancel only their matching
predecessors, while the public reusable-workflow call cancels the complete older
public route. The required status gate deliberately has no concurrency group,
so a stale reporter waiting for GitHub-hosted capacity cannot block current
filtering, builds, or shards. Public container jobs also trust the exact mounted
`GITHUB_WORKSPACE` after checkout because its host and container owners differ.

`test-mcp-lecturer` remains a separate path-filtered service workflow. It runs
unit tests, migrates and seeds Postgres, boots the built server, then executes
`smoke:local` and `smoke:negative`. Its required always-reporting
`test-mcp-lecturer-status` gate stays separate from the consolidated unit suites.
Each CI shard also carries an explicit runtime profile from
`playwright/profiles.json`. Every active spec must appear in that manifest
exactly once; missing, stale, or duplicate entries fail the shard-plan check.
The timing-aware sharder emits the sorted union of its specs' profiles, then
`devrouter profile plan` expands and validates that selection against
`playwright/runtime-contract.yml` without starting or inspecting a runtime. The
trusted planner assigns candidate-only specs to `full`. The runtime adapter
resolves a union containing `full` through the explicit `playwright` Devrouter
profile, which includes every CI-supported application but excludes local-only
MCP, LiteLLM, and MailHog resources.
The root dependency pins `@devrouter/cli` to exact version `0.0.51`; its reviewed
minimum-release-age exception is exact as well. The package's optional native
SSH helpers are explicitly denied build scripts because profile planning has no
Docker or SSH path.
The repository-owned contract maps app identities to literal Turbo filters and
loopback readiness endpoints, constrains managed services, and requires the
exact process marker. `util/playwright-profile-runtime.mjs` remains a thin
consumer: it checks the exact contract path and binding keys, rejects shell-like
filters and non-loopback endpoints, and passes filters as distinct arguments.
It waits for every selected app endpoint before Playwright runs, including apps
outside Devrouter's normal startup readiness subset. Contract, resolution, or
adapter failures stop the job; there is no full-stack fallback. GitHub's fixed
Postgres, Redis, and Hatchet service containers remain present because job
services are created before workflow steps run. Both the hosted and public ARM64
routes use this same contract.

The timing-aware sharder assigns whole spec files; it cannot divide one serial
spec across runners. Long workflows must therefore split only where each new
file can establish its own database and browser state. The live-quiz suite uses
`O1-live-quiz-core.spec.ts` for management, execution, and content, and
`O2-live-quiz-collaboration.spec.ts` for sharing, access, PIN, and word-cloud
flows. The second file deliberately repeats cleanup and common-question setup
because it may run in a different disposable shard. Do not remove that setup or
introduce cross-file ordering assumptions.

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
