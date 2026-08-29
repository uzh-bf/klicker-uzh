---
type: Architecture Decision Record
title: Generated elements own their source-reference snapshots
description: Saved elements retain copied source references so generation records can expire.
timestamp: '2026-08-29'
status: accepted
tags:
  - elements
  - citations
  - ai
---

# Generated elements own their source-reference snapshots

## Context

Generated-element drafts, build records, and source-bearing generation
artifacts are workflow state. Keeping participant-facing citations only through
that workflow would force content-bearing generation records to remain forever
and would couple saved Elements to one generation mechanism.

## Decision

When a generated element is saved, the element receives its own copy of the
shared element source references in the same transaction as its content.
Personal elements prototype this ownership in their existing typed source JSON;
lecturer elements receive equivalent Element-owned storage in a later slice.

The snapshot retains source identity, display title, exact locator spans, and
internal lineage identifiers, but never source bodies or excerpts. It records
the materials used during generation and does not assert correctness, current
availability, or lecturer review.

Content-bearing `GeneratedElementDraft` rows, generation-build records, and
source-bearing artifacts must follow a bounded retention policy once every
durable output has transferred successfully. Before lecturer generation ships,
its cleanup design must preserve required cost facts in the existing accounting
ledger without retaining generation content. There is no new generation-audit
receipt: rejected, failed, and abstained workflow detail may expire, and only
content-free aggregate operational metrics remain.

## Consequences

- PersonalElement proves the source-reference value without adding a physical
  migration or changing lecturer generation lifecycle.
- Lecturer generation later owns the Element migration, atomic transfer,
  accounting separation, exact retention duration, and cleanup job.
- Deleting an unavailable source disables its open action but does not erase
  the saved title and locators from an element source reference.
