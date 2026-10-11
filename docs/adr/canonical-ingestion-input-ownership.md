---
type: ADR
title: Independent ingestion and graph input ownership
description: The knowledge base supplies source identities to independently operated RAG and graph workflows.
timestamp: '2026-10-11'
tags:
  - knowledge-base
  - graph
  - ingestion
---

# Independent ingestion and graph input ownership

Status: Accepted (2026-10-11). Supersedes the October 9 canonical-ingestion design.

The KB owns its source set and both derived projections, following
[ADR 0009](0009-kb-owns-two-derived-projections.md). Vector ingestion and KG
operate independently. KG does not consume ingestion operation IDs, reader
credentials, parsed artifacts or serving-artifact lifecycle. Shared document
processing is a separate service and does not impose an ingestion prerequisite.

Klicker dispatches original source references and expected raw hashes through the
existing graph contract. KG owns extraction and rejects mismatched source bytes
before graph generation. Source locators retain citation identity. Publication
rechecks the current KB source digest and pending deletion under KB/resource
locks. A superseded success retains measured provider cost and cannot publish;
existing failure charging and idempotent settlement policies still apply.

The active serving source set remains Klicker's consistency policy for the two
projections. Sharing resource identity and a freshness digest does not require a
live ingestion API call during KG dispatch. It also does not make a never-ingested
resource eligible for graph generation; separate eligibility would be a product
change. Graph failure must never block ordinary retrieval.

No database changes, new contract version or coordinated ingestion-reader rollout
are required. GraphRAG admission remains controlled by GrowthBook and lecturer
policy. Automatic parser-only freshness remains deferred; parser changes require
an explicit rebuild.

Digest-verified URL rereads can reject changed content but cannot guarantee access
to earlier bytes. Independent parsers may also produce different text from the
same raw bytes, and extraction costs may precede digest rejection. If retained,
reproducible input is required, design producer-owned immutable raw snapshots
consumed independently by both workflows. Define replacement, revocation, retry
and physical deletion before implementation. Do not make ingestion's serving
artifacts the snapshot owner. That work and parser-only freshness remain deferred.
