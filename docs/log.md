# Log

## 2026-07-18

- **Update**: [frontend-conventions](./frontend-conventions.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) document the mixed Next.js bundler contract: Turbopack for all development/test builds and auth/chat production, with Webpack retained only for PWA production builds until the planned Serwist migration.

## 2026-07-16

- **Update**: [data-and-migrations](./data-and-migrations.md) documents the safe production batch-seed workflow and the isolated Summer School portfolio command.

## 2026-07-15

- **Update**: [frontend-conventions](./frontend-conventions.md) and [testing](./testing.md) document valid-DOM video-link rendering, the supported YouTube/Kaltura forms, and editor/mobile overflow coverage.

## 2026-07-10

- **Update**: [chat-platform](./chat-platform.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) document the Next 16 single-Webpack strategy, standalone image contract, generated PWA artifacts, and framework-upgrade verification boundary. The testing-verification skill now matches the eight Playwright CI shards.

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
