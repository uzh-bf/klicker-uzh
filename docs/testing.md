---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the Playwright e2e stack and its seeds, and the CI test matrix.
timestamp: '2026-09-03'
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

**Never run root `pnpm run test:run` blind.** The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

For OpenAI-compatible chat stream changes, run
`apps/chat/test/openai-chat-streaming.test.ts` first. It injects an
OpenAI-compatible SSE response whose first tool call uses a sparse provider
index, so it proves provider conversion without a database, MCP server, or
model key. It is a local regression gate, not evidence that a real upstream
first turn works in staging.

For the local Klicker target evaluation adapter, run

    bash util/test-klicker-eval-wrapper.sh

before any credentialed run. Start the exact worktree with the developer
Foundry values mapped to `UPSTREAM_OPENAI_API_KEY` and
`UPSTREAM_OPENAI_BASE_URL` by the approved secret manager. The repository
wrapper does not require a personal operator or fetch secrets itself. Native
Infisical and CI examples are documented in
[`evaluation/README.md`](../evaluation/README.md).

The VPN must be active. If the worktree runtime already exists with different
upstream values, stop that exact checkout and run the command again; ensure
does not replace environment values in an existing service container. The
target adapter reads only namespaced local API/Chat origins and seeded
participant credentials from the invoking shell, then removes those variables
from the evaluator child. The wrapper pins a loopback Chat Completions target,
one in-flight request, direct gpt-5.6-luna, and cleanup on every exit.

The local KB_doc_query canary is a transport check for authentication, thread
and message persistence, mode handling, and expected-tool evidence. It is not
FineCo quality evidence. Run the 20-case query only when
EXPERT_df_fineco_expert is already available through an authorized synthetic
binding with a finite response bound; otherwise record delivery_pending and
do not substitute the canary or establish a tunnel. Keep the existing
judge-only path separate: caller-provided `LITELLM_API_BASE` and
`LITELLM_API_KEY` are not the developer-Foundry values injected into the local
Chat container.

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
- Markdown video integration is covered on genuine Manage element-editor and mobile PWA live-quiz surfaces in `playwright/tests/0-video-embed.spec.ts`. The spec verifies immediate YouTube/Kaltura iframes, ordinary-link behavior, the absence of horizontal overflow, and a rendered player ratio of 16:9 within tolerance on both surfaces.

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

**Git hooks run no application test suites** (pre-commit = identity guard +
`check:all` + identity guard, pre-push = outgoing-commit identity guard +
`build`). `util/check-git-identity.sh` rejects the exact selector fixture
identity in repository configuration, effective author/committer state, or
outgoing commit authors, committers, or co-author trailers. The pull-request
check repeats the commit-range guard on GitHub, where local hooks cannot be
assumed. The second pre-commit check catches any test that mutates Git
configuration while `check:all` runs. The Prisma package check regenerates the
raw Prisma 7 client before typechecking; no generated-source patch remains.
Clean CI jobs therefore do not depend on generated files left by an earlier
build or cache restore. The Auth adapter round-trip is intentionally separate
because it writes and removes disposable local rows. The expectation before a
PR: `check:all` + build + targeted tests for touched logic + browser evidence
for UI changes; CI is the real e2e gate.

Root typecheck includes the Playwright compiler surface through its package `check` script. Compiler/toolchain upgrades also cover the test build and Docs production build; the exact commands live in `klicker-testing-verification`. Playwright uses strict TypeScript compilation.

Check-only configs must state their no-output role with `noEmit`. When they extend a declaration-emitting config, `noEmit` alone does not disable declaration portability analysis: GraphQL and Prisma therefore also set `declaration: false` and `declarationMap: false`. Incremental checks use `tsconfig.check.tsbuildinfo` rather than overwriting the emitting compiler's state. The full compiler-role matrix lives in [Getting Started](./getting-started.md#toolchain-verified-2026-07-07).

For framework upgrades, run both bundler paths: `pnpm run build:test` must exercise Turbopack in all five Next apps, while `pnpm run build` must exercise production Turbopack for auth/chat and production Webpack for control/manage/PWA. All five Next builds use their canonical `tsconfig.json`; the three PWA apps reserve `tsconfig.check.json` for raw package checks that must exclude stale development validators. Inspect `.next/standalone` for all five apps and the service worker, Workbox, and custom worker outputs for control/manage/PWA. Treat configuration inspection as **config-derived**; call the artifacts verified only when the command, date, and tested SHA are recorded.
