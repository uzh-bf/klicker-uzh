---
type: ADR
title: Canonical ingestion input ownership
description: Resource versions own parsed inputs shared by indexing and graph generation.
timestamp: '2026-10-09'
tags:
  - knowledge-base
  - graph
  - ingestion
---

# Canonical ingestion input ownership

Status: Accepted (2026-10-09).

Fetching a dynamic URL again for graph generation can produce different bytes
from those indexed for retrieval. Ingestion therefore owns an immutable
`canonical-document/v1` envelope for the active serving resource version.
Indexing consumes that envelope's parsed text and page map. The graph worker
reads the same bytes through a separately authenticated, scoped ingestion API.

Klicker stores content-free references and freezes them into graph build
sources. Original-byte and canonical-input digests remain distinct. A parser
change can invalidate a graph even when original bytes remain identical.
Publication checks current source tuples under the KB and resource locks;
Student map and retrieval consumers repeat the current-source check before
returning a graph, extending [ADR 0009](0009-kb-owns-two-derived-projections.md)
to parsed-input lineage. Lecturer views retain their existing stale label.

The active version retains its canonical envelope. Raw download and parse
scratch remain temporary. Failed replacement preserves the prior serving
input. Successful replacement and deletion revoke old reads immediately;
existing workflow reconciliation removes retired artifacts. The source package
must prove physical cleanup convergence before deployment. Existing graph
archives retain their separate lifecycle.

The reader has explicit producer, project and KB allowlists and cannot mutate
resources. Empty scopes deny access. Its credentials are runtime configuration,
never build fields or artifact URLs. Original source locators remain citation
identity; artifact transport is not a student source link.

`KB_CANONICAL_INPUT_ENABLED` defaults off. Once a resource or graph build uses
the canonical contract, disabling the control prevents new admission or graph
dispatch for it; it cannot trigger legacy origin downloads. Existing serving
retrieval remains available. Legacy v1 admission and terminal contracts remain
unchanged. Historical resources require an explicitly authorized refresh.

Deployment proceeds ingestion reader first, graph consumer second, and Klicker
dispatch last. Reader provisioning, migration application, activation, resource
refresh and graph rebuild require their own rollout authority. The independent
GrowthBook GraphRAG admission and lecturer policies remain in force.
