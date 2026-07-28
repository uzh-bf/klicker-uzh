# Log

## 2026-07-27

- **Update**: [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [async-and-workers](./async-and-workers.md), and [frontend-conventions](./frontend-conventions.md) document owner-hidden KB tombstones, canonical external deletion, persisted upload tickets, bounded retention cleanup, and the lecturer-visible background-cleanup contract.

- **Update**: [domain-model](./domain-model.md), [data-and-migrations](./data-and-migrations.md), [graphql-api-layer](./graphql-api-layer.md), [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), and [ci-and-deployment](./ci-and-deployment.md) document one-enabled-KB chatbot binding, atomic MCP configuration, ES256 retrieval scope tokens, citation rendering, browser states, and external secret ownership.

- **Update**: [frontend-conventions](./frontend-conventions.md), [graphql-api-layer](./graphql-api-layer.md), and [testing](./testing.md) document the request-time KB detail route, separate latest-operation/active-serving presentation, contextual ingestion actions, lazy bounded attempt history, and browser plus PostgreSQL verification.

- **Update**: [domain-model](./domain-model.md), [async-and-workers](./async-and-workers.md), [graphql-api-layer](./graphql-api-layer.md), and [testing](./testing.md) document the resource-scoped ingestion ledger, separate operation/serving state, atomic transitions, bounded owner-facing history, and token-independent focused KB integration suites.

## 2026-07-26

- **Update**: [domain-model](./domain-model.md), [async-and-workers](./async-and-workers.md), [frontend-conventions](./frontend-conventions.md), and [ci-and-deployment](./ci-and-deployment.md) document the KB resource model, synchronous ingestion API dispatch, polling plus strict signed-event reconciliation, source-gateway boundary, lecturer routes, reusable UI package, and deployment configuration split.

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
