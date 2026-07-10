# Log

## 2026-07-10

- **Implementation**: [adaptive-learning](./adaptive-learning.md) now documents the hardened Phase 2 adaptive PracticeQuiz contract: persisted presets and attempt policy, shared-cap/common-theta readiness, permission-protected owner preview, participant hiding before Phase 3, gamification isolation, deleted-source rejection, transactional immutable pools, immediate-only publication, cross-config database integrity, and post-attempt locking. [data-and-migrations](./data-and-migrations.md) and [graphql-api-layer](./graphql-api-layer.md) record the matching migration and API rules.

- **Update**: [adaptive-learning](./adaptive-learning.md), [graphql-api-layer](./graphql-api-layer.md), and [data-and-migrations](./data-and-migrations.md) now document the transactional competence-tree contract, cross-course access policy, structural lock, adaptive integrity migration, reviewed numerical normalization, and verified service tests.

- **Creation**: `pa-adaptive-feature-planning` packages the review/prototype-to-production-plan workflow for competence-tree adaptive learning, with a reusable audit checklist, plan template, and generic hierarchy/result-trajectory example. Skill routing is documented in [index](./index.md) and [developing-a-feature](./developing-a-feature.md).

## 2026-07-09

- **Creation**: [adaptive-learning](./adaptive-learning.md) added as the stable engineering page for competence-tree based adaptive practice quizzes, including item parameters, readiness gates, permissions/privacy boundaries, and legacy cleanup policy.

- **Update**: [testing](./testing.md) CI matrix now includes the path-filtered `test-adaptive-learning` workflow for the pure adaptive package.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
