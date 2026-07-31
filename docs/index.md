---
okf_version: '0.1'
---

# KlickerUZH Engineering Wiki (agent-facing)

Ground truth for engineers and coding agents working **on** this codebase. Read the relevant pages before changing a system — they capture what the code alone doesn't tell you. Not to be confused with [apps/docs](../apps/docs), the user-facing documentation site published at www.klicker.uzh.ch.

Conventions: one concept per file (OKF v0.1), claims cite `path:Symbol`, commands are marked **verified** (executed with recorded output) or **config-derived** (read from config, not executed — verify on your machine before relying on them).

## Reading order

- [Getting Started](./getting-started.md) - Toolchain, first-time setup, infrastructure, dev-server paths, and the failure signatures you will hit on a fresh clone.
- [Architecture Overview](./architecture-overview.md) - System map, request flow from browser to resolver, the async response pipeline, and where business logic lives.
- [Domain Model](./domain-model.md) - Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
- [GraphQL API Layer](./graphql-api-layer.md) - Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
- [Data & Migrations](./data-and-migrations.md) - Split Prisma schema, the migrate→sync→generate ritual, seeding paths, typed Json fields, and schema-level gotchas.
- [Async & Workers](./async-and-workers.md) - The Hatchet-based response pipeline, worker task catalog, scheduled jobs, and what silently breaks without workers.
- [Auth Model](./auth-model.md) - Login flows for lecturers and participants, origin-based cookie selection in the backend, JWT scopes, and LTI launch rules.
- [Frontend Conventions](./frontend-conventions.md) - Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
- [Course Discussions](./course-discussions.md) - Course-scoped Q&A data, access, contextual UI surfaces, embeds, and verification.
- [Chat Platform](./chat-platform.md) - The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
- [Testing](./testing.md) - Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
- [CI & Deployment](./ci-and-deployment.md) - PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
- [Developing a Feature](./developing-a-feature.md) - The full-stack feature lifecycle step by step, with a real commit as the worked example and routing to the page or skill for each step.

## Skill routing

Task-shaped procedures live in [.agents/skills/](../.agents/skills/); the wiki holds facts, skills hold workflows.

- Environment broken / fresh clone / ports / stale codegen → `klicker-environment-doctor`
- Designing a feature before coding → `klicker-feature-design`
- GraphQL endpoint work (schema, service, ops, auth) → `klicker-graphql-api`
- Prisma schema, migrations, seeds → `klicker-data-model`
- Safe production database scripting and migrations → `df-safe-database-scripting`
- UI in manage/pwa/control/auth → `klicker-frontend-ui`
- Choosing test level + pre-PR verification → `klicker-testing-verification`
- New e2e specs → `klicker-playwright-e2e` (primary suite); legacy Cypress maintenance only → `klicker-cypress-e2e`
- Browser-based verification of UI changes → `agent-browser` (invoke via `npx agent-browser`)
- Updating this wiki → `klicker-wiki-maintenance`

## Maintenance

Any PR that changes documented behavior updates the affected pages in the same PR. Find affected pages by grepping this directory for the symbol that changed. Record changes in [log.md](./log.md).
