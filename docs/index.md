---
okf_version: '0.1'
---

# KlickerUZH Engineering Wiki (agent-facing)

Ground truth for engineers and coding agents working **on** this codebase. Read the relevant pages before changing a system — they capture what the code alone doesn't tell you. Not to be confused with [apps/docs](../apps/docs), the user-facing documentation site published at www.klicker.uzh.ch.

Conventions: one concept per file (OKF v0.1), claims cite `path:Symbol`, commands are marked **verified** (executed with recorded output) or **config-derived** (read from config, not executed — verify on your machine before relying on them).

## Reading order

- [Getting Started](./getting-started.md) - Toolchain, first-time setup, infrastructure, dev-server paths, and the failure signatures you will hit on a fresh clone.
- [Architecture Overview](./architecture-overview.md) - System map, request flow from browser to resolver, the async response pipeline, and where business logic lives.

Further pages (backend domain, API layer, data, workers, auth, frontend, chat, testing, CI/deploy, feature lifecycle) are being added — missing links mark knowledge not yet written.

## Skill routing

Task-shaped procedures live in [.agents/skills/](../.agents/skills/); the wiki holds facts, skills hold workflows.

- Cypress e2e work → `klicker-cypress-e2e`
- Playwright e2e work → `klicker-playwright-e2e`
- Browser-based verification of UI changes → `agent-browser` (invoke via `npx agent-browser`)

## Maintenance

Any PR that changes documented behavior updates the affected pages in the same PR. Find affected pages by grepping this directory for the symbol that changed. Record changes in [log.md](./log.md).
