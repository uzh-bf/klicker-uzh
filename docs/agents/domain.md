---
type: Agent Configuration
title: Domain Docs
description: Source-of-truth and reading rules for domain documentation consumed by engineering skills.
timestamp: '2026-08-05'
tags:
  - agents
  - domain
  - workflow
---

# Domain Docs

The engineering wiki under `docs/` is the canonical source for durable domain and architectural knowledge. ADRs under `docs/adr/` record significant decisions, while `docs/solutions/` records retrospective fixes and durable lessons.

## Before exploring, read these

- `docs/index.md` for routing to the relevant engineering wiki pages.
- `docs/domain-model.md` for core entities and vocabulary.
- Other relevant pages under `docs/` for the system being changed.
- Relevant ADRs under `docs/adr/`.
- Relevant prior solutions under `docs/solutions/`.

For this repository, `docs/domain-model.md` is the glossary consumed and maintained by the `domain-modeling` skill. It replaces that generic skill's default `CONTEXT.md` location; do not create `CONTEXT.md` or `CONTEXT-MAP.md` unless the repository intentionally migrates its documentation layout.

## Layout

This repository uses a single-context layout:

```
/
├── docs/
│   ├── index.md                     ← canonical documentation map
│   ├── domain-model.md              ← canonical domain model
│   ├── <area>.md                    ← system-specific knowledge
│   ├── adr/                         ← significant decisions
│   └── solutions/                   ← durable fixes and lessons
├── apps/
├── packages/
└── project/
    ├── plans_wip/                   ← active plans
    ├── plans_future/                ← deferred or future plans
    └── plans_archive/               ← historical plans
```

Do not introduce root, per-app, or per-package context files unless the repository intentionally migrates to the generic context-file layout.

## Use established vocabulary

Use terminology from `docs/domain-model.md` and the relevant wiki pages in issue titles, plans, proposals, hypotheses, and test names.

If required terminology is missing, reconsider whether the proposed language matches the project. Record genuine gaps through the `domain-modeling` workflow in `docs/domain-model.md`.

## Keep plans and durable documentation distinct

Plans under `project/` describe intended or ongoing work. They do not supersede the engineering wiki, ADRs, or documented solutions.

When implemented behavior changes, update the relevant pages under `docs/` in the same change.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.
