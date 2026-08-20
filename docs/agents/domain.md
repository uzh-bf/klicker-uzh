---
type: Domain Docs
title: Domain Docs
description: How the engineering skills consume this repo's domain documentation, and how the lazily-created CONTEXT.md and ADRs relate to the existing engineering wiki.
timestamp: '2026-07-31'
tags:
  - agents
  - process
---

# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `CONTEXT.md` at the repo root and one `docs/adr/` directory. Despite the pnpm workspace, `apps/*` and `packages/*` are layers of one product rather than separate bounded contexts with their own vocabularies, so the multi-context `CONTEXT-MAP.md` layout does not fit.

## Before exploring, read these

- **[The engineering wiki](../index.md)** — this repo's existing ground truth, and the first stop for anything about how a system actually works. [Domain Model](../domain-model.md) already carries the core entities, status lifecycles, and the two-track gamification system.
- **`CONTEXT.md`** at the repo root, once it exists — the glossary of domain terms.
- **`docs/adr/`**, once it exists — read ADRs that touch the area you are about to work in.

Neither `CONTEXT.md` nor `docs/adr/` exists yet. **Proceed silently when they are absent.** Don't flag it, don't suggest creating them upfront. `/domain-modeling` (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily, when a term or a decision actually gets resolved.

## The wiki and CONTEXT.md are not the same thing

The wiki answers _how does this work_ — request flow, the codegen ritual, which cookie the backend reads on which origin. `CONTEXT.md` answers _what do we call this and what does it mean_ — the vocabulary the code and the conversation share. A term belongs in `CONTEXT.md`; a mechanism belongs in the wiki page that owns it. When in doubt, the wiki already has a page for it.

## Use the glossary's vocabulary

When your output names a domain concept — in an issue title, a refactor proposal, a hypothesis, a test name — use the term as defined in `CONTEXT.md`, falling back to [Domain Model](../domain-model.md) until the glossary exists. Don't drift to synonyms the glossary explicitly avoids. `User` and `Participant` are distinct entities here and are not interchangeable.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

Retrospective fixes and incident-derived lessons are not ADRs; they live in [docs/solutions/](../solutions/).
