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

Status: Accepted (2026-10-09), revised (2026-10-10).

Fetching a dynamic URL again for graph generation can produce different bytes
from those indexed for retrieval. Ingestion therefore owns an immutable
`canonical-document/v1` envelope for the active serving resource version.
Indexing consumes that envelope's parsed text and page map. The graph worker
reads the same bytes through a separately authenticated, scoped ingestion API.

Klicker resolves content-free references from ingestion immediately before a
fresh graph dispatch. The existing resource ID, serving version and raw source
hash must match that reference. The provider freezes the canonical reference
in its durable workflow input and checks the delivered artifact bytes.
Klicker adds no schema columns or migration for this adapter.

Original-byte and canonical-input digests remain distinct. Klicker's existing
source-set digest owns freshness and current-publication checks, following
[ADR 0009](0009-kb-owns-two-derived-projections.md). Parser-only drift detection
and canonical pinning at the lecturer request are deferred. Rebuild graphs
deliberately after a parser change. Successful settlement checks current raw
source identity under the existing KB and resource locks.

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

`KB_CANONICAL_INPUT_ENABLED` defaults off and selects new ingestion admission
and fresh graph dispatch. Enabled dispatch requires an admitted canonical
reference and never falls back to downloading the origin. Accepted provider
runs retain their pinned workflow input when the flag changes; Klicker can
still reconcile their results. Disabling the control selects legacy admission
and dispatch for new work. Existing serving retrieval and resource deletion
remain available. Polling and signed reconciliation can finish already accepted
v2 ingestion without a stored discriminator. Historical resources require an
explicitly authorized refresh before canonical graph dispatch.

Deployment proceeds ingestion reader first, graph consumer second, and Klicker
dispatch last. Reader provisioning, activation, resource
refresh and graph rebuild require their own rollout authority. The independent
GrowthBook GraphRAG admission and lecturer policies remain in force.
