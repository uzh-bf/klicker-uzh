---
type: Decision Record
title: The graph-build ledger is the canonical version record
description: One append-only KBGraphBuild table answers which graph is live; derived pipelines key off its build id.
timestamp: '2026-08-18'
tags:
  - backend
  - knowledge-base
---

# 17. The graph-build ledger is the canonical version record

Status: Accepted (2026-08-18)

Every `KBGraphBuild` row is one build attempt and, when it succeeds, the
immutable version record of the graph it produced. The Klicker-minted build id
is the external idempotency and correlation key toward the graph runtime, and
the build history is the ledger ordered by `createdAt`. Which graph is active
or published is expressed only through the conditional-update pointers
`activeGraphBuildId` and `publishedGraphBuildId` on the knowledge base. There
is no separate graph-version table and no second version-number sequence.

A second version entity would answer "which graph is live" independently of the
pointers and the ledger, and keeping the three consistent would become a
permanent obligation. With the ledger alone, rollback repoints
`publishedGraphBuildId` to an earlier succeeded build whose GraphML the
archive still retains (ADRs 0010 and 0015), while cost, quality tier, and
provenance stay on the same row the quota settles against (ADR 0013).
Superseding a build marks its status; it never rewrites the row.

Derived pipelines follow the same key. Unified SC, MC, KPRIM, and flashcard
generation drops its own graph-version entity and keys `ElementGenerationBuild`
on the ledger's build id so it inherits the source digest and provenance. Each
external generation or retry attempt is an append-only `ElementGenerationSpend`
against the same `KBGraphQuota`, keyed by the durable provider dispatch attempt;
reviews and incomplete-publication events do not invent graph versions or new
spend. Generated elements, review state, and artifacts remain children of the
element-generation build. A generated set that must outlive its graph build is
settled through artifact retention, not through a second version identity.
