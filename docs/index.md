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
- [Chat Platform](./chat-platform.md) - The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
- [Testing](./testing.md) - Which test level to use when, what runs safely without services, the Playwright e2e stack and its seeds, and the CI test matrix.
- [CI & Deployment](./ci-and-deployment.md) - PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
- [Developing a Feature](./developing-a-feature.md) - The full-stack feature lifecycle step by step, with a real commit as the worked example and routing to the page or skill for each step.
- [Architecture Decisions](./adr/) - Numbered ADRs recording why a structural choice was made and what it rules out. Pages above cite them instead of restating the rationale; superseded records are marked, never rewritten.

## Decision records

Architectural decisions live in [docs/adr/](./adr/README.md) as numbered ADRs — the durable record of _why_, kept separate from the concept pages above (which explain _what_ and _how_). The wiki links the relevant ADR for the rationale; it is not itself the decision record. Record a new ADR when a choice is hard to reverse, surprising without context, and a real trade-off.

## Agent workflow configuration

- [Work Tracking](./agents/issue-tracker.md) - ClickUp as the task source of truth and `project/` conventions for active, future, and archived plans.
- [Triage Labels](./agents/triage-labels.md) - Mapping from the five canonical engineering-skill triage roles to ClickUp labels.
- [Domain Docs](./agents/domain.md) - Reading and maintenance rules that keep the engineering wiki, ADRs, and documented solutions authoritative for domain work.

## Skill routing

Task-shaped procedures live in [.agents/skills/](../.agents/skills/); the wiki holds facts, skills hold workflows.

- Environment broken / fresh clone / ports / stale codegen → `klicker-environment-doctor`
- Designing a feature before coding → `klicker-feature-design`
- GraphQL endpoint work (schema, service, ops, auth) → `klicker-graphql-api`
- Prisma schema, migrations, seeds → `klicker-data-model`
- Safe production database scripting and migrations → `df-safe-database-scripting`
- UI in manage/pwa/control/auth → `klicker-frontend-ui`
- Choosing test level + pre-PR verification → `klicker-testing-verification`
- E2E testing → `klicker-playwright-e2e`
- Browser-based verification of UI changes → `agent-browser` (invoke via `npx agent-browser`)
- Updating this wiki → `klicker-wiki-maintenance`

## Maintenance

Any PR that changes documented behavior updates the affected pages in the same PR. Find affected pages by grepping this directory for the symbol that changed. Record changes as a new dated file in [log/](./log/) (`YYYY-MM-DD-<slug>.md` — one file per change batch; never append to an existing log file, so concurrent branches cannot conflict).
