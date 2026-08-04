# Log

## 2026-08-03

- **Update**: PR #5109 integrated the current `v3-ai` base (TypeScript 6, Prisma
  7, Biome/Knip/Gitleaks quality gates). Under TypeScript 6, `apps/mcp-lecturer`
  and `apps/mcp-student` needed `baseUrl` dropped and `"types": ["node"]` set
  explicitly — the emitting build config no longer picks up `@types/node`
  automatically, and only the check config was masking it via `vitest.config.ts`.
  `apps/mcp-student` also needed a `with { type: 'json' }` import attribute for
  `@klicker-uzh/graphql/dist/client.json` under `module: NodeNext`.
  `@assistant-ui/react-ai-sdk` stays pinned at `1.3.7`: `1.3.26` moved its runtime
  types to `@assistant-ui/core`/`@assistant-ui/store` and no longer depends on
  `@assistant-ui/react` at all, so `useChatRuntime`'s `AssistantRuntime` stops
  matching the provider from `@assistant-ui/react@0.12.10`. That version also has
  an undeclared `assistant-stream` dependency, which only resolves through pnpm's
  hoisted store — an incremental `pnpm add` can leave it unhoisted and break the
  Turbopack build until a `pnpm install --force`.
  The PR's earlier 148/148 evaluator pass and green CI predate this base merge.

- **Update**: [data-and-migrations](./data-and-migrations.md) gains a failed-migration-hook runbook (log capture before the next sync deletes the Job, `P3009` partial-DDL recovery and why `migrate resolve` is not a rollback, the `migrator.enabled: false` unblock lever, lock contention) plus the hook's scope limit (assessment DB may not be covered) and the prd bootstrap/rollback rule: no migrator image exists for pre-hook release tags, so prd keeps the hook disabled until its tags reach a migrator-bearing release. Same constraint recorded in [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md) and the expand-contract rule in the `klicker-data-model` skill.

- **Update**: [data-and-migrations](./data-and-migrations.md) and [ci-and-deployment](./ci-and-deployment.md) document automatic deployment migrations: `prisma migrate deploy` runs as an ArgoCD PreSync hook Job from a dedicated Prisma 7 migrator image (local `prisma` install + `prisma.config.ts`), with manual deploy demoted to break-glass. Decision record: [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md), including the materialised version-drift lesson now guarded by `util/check-prisma-sync.sh`.

## 2026-08-01

- **Update**: [chat-platform](./chat-platform.md) records the Manage assistant's
  scoped single-element lookup and SC/MC option-feedback consistency guardrails.
  The upgraded DeepEval 4.1.5 evaluator using direct `gpt-5.6-luna` now has a
  measured 148/148 `OVERALL: PASS` baseline; details remain in
  `evaluation/manage-assistant/README.md`.

## 2026-07-29

- **Update**: [testing](./testing.md) and the `klicker-playwright-e2e` skill document the opt-in Firefox/WebKit assistant release matrix. Ordinary Playwright CI remains Chromium-only; cross-browser release evidence must use production builds and matching Playwright browser binaries.

- **Update**: [chat-platform](./chat-platform.md) records the Manage route's Next-middleware bypass, one-request per-pod memory guard and retryable 503 contract, explicit request deadlines, server-side UI-message trust boundary, production-standalone memory evidence, and 200 MiB request / 400 MiB limit for staging and production Chat pods.

## 2026-07-28

- **Update**: [chat-platform](./chat-platform.md) documents the Manage assistant's 16 MiB streamed request boundary, generic 413/400 behavior, auth/rate-limit-before-read order, and Manage-only two-image cap; participant chat remains at three images.

- **Update**: [frontend-conventions](./frontend-conventions.md) records that both assistant drawers implement the shared portalled-modal, focus-containment, and page-isolation contract. [testing](./testing.md) records the dedicated PWA course-chat drawer and entry-fallback Playwright coverage.

- **Update**: [testing](./testing.md) and the Manage-assistant eval README now define E7 through explicit assistant-text and transport/UI channels. Route-level 401/429 checks require the exact safe public response and visible recoverable generic UI; silence or merely leak-free malformed output no longer passes.

## 2026-07-27

- **Update**: [auth-model](./auth-model.md) records the Manage-assistant system prompt's new no-disclosure rule for the tool-output fence markers and sentinel, why it is not redundant with the fencing itself, and the before/after E6 measurement that motivated it.

- **New**: [solutions/best-practice/dev-seed-is-not-idempotent-reset-first](./solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md) — `seed:raw` fails `P2002` on `Account` against an already-seeded DB _after_ its delete phase, leaving a half-seeded database; reset first, and seed harness-owned elements after the base seed, never before.

## 2026-07-26

- **Update**: [testing](./testing.md) documents the lecturer MCP's `smoke:negative` authZ/negative-path script alongside the existing `smoke:local` happy path, and the new `test-mcp-lecturer` CI workflow (Postgres-only: unit tests, migrate + `seed:test`, boot the built server, run both smokes).

## 2026-07-25

- **Update**: [frontend-conventions](./frontend-conventions.md) and [chat-platform](./chat-platform.md) document the Manage assistant's portalled modal boundary: the dialog stays outside the inert, assistive-technology-hidden page root.

- **Update**: [auth-model](./auth-model.md) documents the lecturer MCP's current internal JWT trust chain, confirms that it is not OAuth-exposed, and records the boundaries that an external MCP authorization design must address.

## 2026-07-23

- **Update**: [getting-started](./getting-started.md) documents that the devcontainer stack now also starts the lecturer MCP server (`apps/mcp-lecturer`, port 7081, no route) so the manage assistant always finds its tools without a manual step.

## 2026-07-20

- **Update**: [getting-started](./getting-started.md) now records that the vanilla Office Add-in follows the TypeScript 6 workspace baseline with explicit Office global types. [testing](./testing.md) and the `klicker-testing-verification` procedure cover its URL tests, build, deployment parity, manifest, browser, and PowerPoint host checks.
- **Update**: [getting-started](./getting-started.md) and [ci-and-deployment](./ci-and-deployment.md) document the repo-quality tooling migration — Biome as code formatter+linter (Prettier retained for Markdown/YAML and the `playwright/`+`cypress/` e2e trees), Knip for unused code/deps, and Gitleaks secret scanning (local husky hook + blocking CI). Biome lint and Knip are advisory in CI during the migration; formatting/types/syncpack/Gitleaks are blocking. Plan: `project/2026-07-19-biome-knip-repo-quality.md`.

## 2026-07-19

- **Update**: [data-and-migrations](./data-and-migrations.md) and [testing](./testing.md) document Prisma 7 adapter ownership, split JavaScript/Analytics datasource ownership, explicit generation and seeding, removal of the TypeScript namespace patch, and the guarded Auth adapter compatibility check. Matching data-model, environment-doctor, and verification procedures were updated in the same change.

- **Update**: [getting-started](./getting-started.md), [frontend-conventions](./frontend-conventions.md), and [testing](./testing.md) document the runtime-owned TypeScript compiler matrix, explicit Next.js build-validation config, isolated incremental-cache ownership, and check-only declaration trap. The matching verification procedure and solution notes preserve the required checks.

## 2026-07-18

- **Update**: [getting-started](./getting-started.md) pins released devrouter `0.0.35`; the managed-process fingerprint now includes the exact adapter bytes and declared non-secret origin environment as well as workspace and command identity.

- **Update**: [getting-started](./getting-started.md) now uses checkout-agnostic `devrouter ensure .`, runtime-delivered process supervision, durable exact-worktree ownership, and a self-contained uv/Python lint toolchain for both primary and linked devcontainers.

- **Update**: [frontend-conventions](./frontend-conventions.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) document the mixed Next.js bundler contract: Turbopack for all development/test builds and auth/chat production, with Webpack retained only for PWA production builds until the planned Serwist migration.

## 2026-07-16

- **Update**: [data-and-migrations](./data-and-migrations.md) documents the safe production batch-seed workflow and the isolated Summer School portfolio command.

## 2026-07-15

- **Update**: [frontend-conventions](./frontend-conventions.md) and [testing](./testing.md) document valid-DOM video-link rendering, the supported YouTube/Kaltura forms, and editor/mobile overflow coverage.

## 2026-07-14

- **Update**: [getting-started](./getting-started.md) now delegates generic devcontainer process supervision to the packaged devrouter `0.0.30` helper. Klicker retains only its application command and environment setup; cold and warm exact-worktree startup, all ten routes, and delegated login were verified.

- **Update**: [getting-started](./getting-started.md) now pins published devrouter `0.0.29` and records the live fault-recovery proof: an HTTP 500 from stale Next.js development output triggers one bounded DevPod recreate, restores all ten routes, and returns to stable warm reuse.

## 2026-07-13

- **Update**: [getting-started](./getting-started.md) now pins published devrouter `0.0.28`, records the ten-route linked-worktree proof, documents the single `turbo dev` task set that prevents duplicate backend/PWA starts, and distinguishes static base-Compose doctor warnings from merged-overlay runtime proof. Devrouter's generated repository skill and refreshable AGENTS section were updated in the same change.

- **Update**: [getting-started](./getting-started.md) and the environment-doctor skill now make `devrouter workspace ensure .` the canonical linked-worktree startup path. The devcontainer overlay preserves host Git metadata, and `post-start.sh` reconciles only its fingerprinted process group.

## 2026-07-11

- **Update**: [getting-started](./getting-started.md), [data-and-migrations](./data-and-migrations.md), [frontend-conventions](./frontend-conventions.md), and [testing](./testing.md) document the TypeScript 6 workspace baseline, the separate Office Add-in exception, Prisma generation compatibility guard, explicit path mapping, and compiler-upgrade verification surfaces. Matching procedure was added to `klicker-data-model` and `klicker-testing-verification`.

## 2026-07-10

- **Update**: [chat-platform](./chat-platform.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) documented the initial Next 16 single-Webpack strategy, superseded by the mixed-bundler update on 2026-07-18. They also cover the standalone image contract, generated PWA artifacts, and framework-upgrade verification boundary. The testing-verification skill now matches the eight Playwright CI shards.

- **Update**: [auth-model](./auth-model.md) documents validated login return targets for manage, PWA, and chat. Manage accepts only its configured origin. PWA accepts its configured origin plus the configured chat origin. Malformed and untrusted targets fall back to the application root.

- **Update**: [frontend-conventions](./frontend-conventions.md) and [getting-started](./getting-started.md) document deterministic Next.js route-type generation: app checks run `next typegen`, generated `next-env.d.ts` stays ignored, both route-type directories stay in the Next-owned config, and PWA app check configs omit duplicate dev validators from raw `tsc`. Matching procedure added to `klicker-testing-verification`.

## 2026-07-08

- **Update**: [frontend-conventions](./frontend-conventions.md) updated with Markdown link interception behavior and Kaltura PlaykitJs bypass player details.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
