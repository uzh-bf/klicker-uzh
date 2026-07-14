# Log

## 2026-07-14

- **Creation**: [import-export-packages](./import-export-packages.md), [import-export-error-contract](./import-export-error-contract.md), and [import-export-production-runbook](./import-export-production-runbook.md), indexed from [index](./index.md), document the final version-3 package boundary, server-owned error and telemetry contract, and operator-controlled dark migration, backfill, canary, rotation, and rollback sequence. Tags and psychometric history remain excluded; target owners, protected evidence, and soak decisions remain external release blockers.
- **Update**: [architecture-overview](./architecture-overview.md), [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [frontend-conventions](./frontend-conventions.md), [async-and-workers](./async-and-workers.md), [data-and-migrations](./data-and-migrations.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) now reflect shared all-nine element canonicalization, durable artifact/receipt/media staging, private package storage, CLI-only historical backfills, deployed refresh/cleanup maintenance, fail-closed runtime gates, current Playwright and app-unit CI ownership, and reviewed v3 deployment requirements.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
