---
type: Decision Record
title: Catalyst owns the knowledge-graph runtime, not AI ingestion
description: Klicker owns the product, Catalyst owns the KG system, and AI infrastructure owns ingestion.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 11. Catalyst owns the knowledge-graph runtime, not AI ingestion

Status: Accepted (2026-08-10)

Klicker owns KB product state, authorization, graph lifecycle, quota
enforcement, and the lecturer/student experience. Catalyst owns graph
generation, FalkorDB operation, the GraphML archive, graph-quality evaluation,
and KG-system end-to-end testing. AI infrastructure continues to own
data-ingestion, doc-processing, and pgvector; Catalyst consumes those services
through explicit contracts and does not import their code or operational
lifecycle.

This split keeps the knowledge-graph product under the Klicker team without
turning AI infrastructure into the product owner or duplicating its ingestion
platform. Cross-system KG tests belong to Catalyst, while each AI
infrastructure service remains responsible for its own provider-contract and
internal tests.
