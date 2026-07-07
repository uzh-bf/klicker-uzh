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

Further pages (frontend, chat, testing, CI/deploy, feature lifecycle) are being added — missing links mark knowledge not yet written.

## Skill routing

Task-shaped procedures live in [.agents/skills/](../.agents/skills/); the wiki holds facts, skills hold workflows.

- Cypress e2e work → `klicker-cypress-e2e`
- Playwright e2e work → `klicker-playwright-e2e`
- Browser-based verification of UI changes → `agent-browser` (invoke via `npx agent-browser`)

## Maintenance

Any PR that changes documented behavior updates the affected pages in the same PR. Find affected pages by grepping this directory for the symbol that changed. Record changes in [log.md](./log.md).
