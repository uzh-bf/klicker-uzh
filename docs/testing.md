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
`LITELLM_API_KEY` (the wrapper fetches the key from Infisical when unset) are
not the developer-Foundry values injected into the local Chat container.

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
The public route executes composite build and shard actions from trusted `v3`,
not from the pull-request checkout. A pull request therefore cannot make a new
runtime package available to its own shards merely by adding that package to
the artifact path. Bundle a new runtime dependency into an already transferred
service artifact, or land the trusted artifact-contract change on `v3` first;
inspect the downloaded artifact when a built package is missing at shard
startup.

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

## Import/export verification

The import/export app unit suites run in `test-graphql` after its dependency build. Import/export browser specs select `manage,live-quiz`, whose runtime contract waits for the general worker registration endpoint as well as Response API. The shared test wrapper selects the request-driven workflows, including course duplication/deletion, without import/export repair or cleanup crons.

Import/export tests must set `IMPORT_EXPORT_ENABLED=true` explicitly. Playwright CI passes the gate both while compiling the frontend and while running the browser shards; setting it only at runtime leaves the statically built Manage controls disabled. The shared local test wrapper also sets `IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY=true`, so Playwright's preview-flag matrix proves both visible and hidden entry points. Database-backed GraphQL suites use `useImportExportTestEnvironment()`, which installs and restores a deterministic test-only token secret instead of depending on an ambient deployment secret. Devcontainers set `IMPORT_EXPORT_PACKAGE_STORAGE=local` explicitly for clarity; development/test runtimes also default an omitted value to local storage. The Playwright service wrapper exports one shared local package directory for both Turbo services and the browser command, because Turbo's strict environment mode can otherwise strip a platform-specific `TMPDIR`. The isolation fixture rejects an explicit Azure selection so tests cannot delete non-local targets.

The package UI browser suite is split across the `playwright/tests/MA-import-export*.spec.ts` entry points so basic, workflow, didactic/performance, direct-media, and security/error groups are independently schedulable and each owns the required cleanup test. Shared setup, the focused fixture, support, and case modules live under `playwright/tests/import-export/`; request-isolation cleanup in `playwright/util/fixtures/importExportArtifacts.ts` removes leases for every preview, upload, validation, export, and import concurrency operation. The round-trip case exercises real SC, Selection, and Numerical export/upload/validate/import paths, selection-aware answer collections, bulk selection, full answer-pool and didactic review, then runs `AxeBuilder` against the import modal for WCAG 2 A/AA plus 2.1/2.2 AA rules and captures the English desktop review. Separate cases hold both import commit/refresh and export link/blob network phases open, prove that commit is locked while post-commit refresh can be dismissed without late UI effects, reject nullable import and export-preview results, cancel held validation/export requests to assert abort/stale-generation handling and focus return, assert live warning semantics, exercise type-specific student controls for all nine didactic renderers, prove answer-pool pagination resets between elements, and verify German import and export at 1280 px, 375 px, and 320 px without horizontal overflow. Mocked direct-media cases prove SAS → blob upload → authenticated finalization → editor insertion ordering, keep a post-finalization library-refetch failure nonfatal, recover a transient finalization failure with the same media ID, and exhaust the bounded retry policy without inserting the href. The focused GraphQL media-upload test proves that feature-enabled media-library reads exclude unresolved rows while the disabled gate preserves legacy visibility. The 100-element browser case replaces the preview five times with 5,000 top-level entries, including 100 elements sharing one 2,000-entry pool, asserts lazy closed pools plus duplicate bulk action, records response-to-interactive and bulk-toggle measurements as evidence rather than CI-load-sensitive pass/fail gates, and attaches the measured JSON. The backend maximum-shape benchmark likewise retains response/correctness assertions and records timing, heap, and RSS as evidence rather than enforcing runner-sensitive resource thresholds. `packages/graphql/test/importExportPreviewShape.test.ts` separately proves that the public schema and generated operation expose the pool once, selected IDs without repeated values, all nine option fragments, and no preview `any`. `packages/graphql/test/elementImportPreviewOptions.test.ts` executes the Pothos union for every concrete type, including nullable no-key choice correctness, feedback, nested case-study scoring, and a Unicode numerical placeholder.

The feature's pure trust-boundary suites are `packages/graphql/test/elementDomain.test.ts` (all-nine canonical valid/invalid matrix, including slider-reachable case-study solutions), `packages/graphql/test/importExportErrors.test.ts` (closed codes and redaction), `packages/graphql/test/importExportPackageContract.test.ts` (version-3 schemas, canonical paths, reserved refs, warnings, and per-resource counts), `packages/graphql/test/importExportMediaReferences.test.ts` (type-aware CommonMark image/link classification, non-loading omission, and plain scoring-string preservation), `packages/graphql/test/elementImportToken.test.ts` (strict artifact-token framing/binding), and `packages/graphql/test/zip.test.ts` (strict archive metadata plus deterministic mutation/truncation cases). Aggregate import/export limits, the 5,000-entry load boundary, exact media closure, and media alias rejection live in `packages/graphql/test/elementImportExportPackageBoundaries.test.ts`. `elementImportExactlyOnce.test.ts`, `elementImportDurableTransaction.test.ts`, `elementImportReceiptOrchestration.test.ts`, and `elementImportPackagedMedia.test.ts` own the receipt/replay/commit-final/transaction/media failure seams. Database-backed artifact, receipt, and media persistence live in `importExportArtifactPersistence.test.ts`, `elementImportReceiptPersistence.test.ts`, and `importExportMediaPersistence.test.ts`. Snapshot consistency, publication fencing, preview, and package storage behavior use the focused `elementExportSnapshot*.test.ts`, `elementExportPublicationGuard.test.ts`, `elementExportPreviewService.test.ts`, and `elementExportPackageService.test.ts` suites. Broader database authorization, import/export integration, and legacy-edit compatibility remain in the focused `elementImportExportDatabase*.test.ts` and `elementImportLegacyEdits.test.ts` suites; user-visible package workflow, HTTP boundaries, external-request blocking, and permissions belong to the split `playwright/tests/MA-import-export*.spec.ts` suite.

For authoring specifics, helper patterns, and failure triage, use the skills — `klicker-playwright-e2e` ([.agents/skills/](../.agents/skills/)) — rather than duplicating their content here.
