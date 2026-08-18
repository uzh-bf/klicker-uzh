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

Derived pipelines follow the same key. The question-generation stack drops its
`KBGraphVersion` entities and its own `KBGraphBuild` shape, keys
`QuestionGenerationBuild` on the ledger's build id so it inherits the source
content digest and provenance, points its cost block at the same
`KBGraphQuota` row with a spend-class discriminator, and models review and
generated drafts as children of the generation build. A generated set that must
outlive its graph build is settled through artifact retention, not through a
second version identity.
