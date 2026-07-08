# Log

## 2026-07-08

- **Update**: [getting-started](./getting-started.md) documents parallel devrouter worktrees. The base devcontainer compose file no longer publishes host ports; devrouter mode uses `${WORKSPACE}`-scoped app/DB aliases, while fixed localhost ports moved to a dedicated fallback overlay.

- **Update**: devcontainer docs now call out direct Azure Blob media uploads as a storage-account CORS concern. Parallel devrouter worktrees need the dev Blob service to allow local origins such as `https://manage.klicker.<workspace>.localhost`; production accounts should keep exact origin rules.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
