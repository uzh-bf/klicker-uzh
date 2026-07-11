# Log

## 2026-07-11

- **Update**: standardized empty Tiptap form content on `''`/`undefined`, documented why the legacy `'<br>'` sentinel suppresses editor placeholders, aligned frontend and Playwright skills with the empty-state contract in [frontend-conventions](./frontend-conventions.md), and corrected the wiki validator path.

## 2026-07-10

- **Update**: documented the Markdown-safe Tiptap boundary, including round-trippable table controls and the editor/preview syntax-highlighting contract, in [frontend-conventions](./frontend-conventions.md); aligned the frontend and Playwright skills with the same behavior.

## 2026-07-08

- **Update**: editor technology updated to Tiptap (v3) in Tech Stack overview ([AGENTS.md](../AGENTS.md)).
- **Update**: added Tiptap editor-testing guidelines and stabilization gotchas to [klicker-playwright-e2e](../.agents/skills/klicker-playwright-e2e/SKILL.md) skill.
- **Update**: simplified [AGENTS.md](../AGENTS.md) by removing duplicate technical workflows (Tech Stack, Code Conventions, Git Hooks) and the legacy host-based stack in favor of Devcontainer guidance and links to the engineering wiki.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
