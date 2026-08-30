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

Source references remain system-managed after Save. Manual card updates cannot
submit reference data and preserve the current snapshot. A generated revision
is first persisted as a terminal assistant tool result. The participant-facing
GraphQL mutation accepts only that message and tool-call linkage, reconstructs
the complete revision server-side, and atomically replaces content and
references. The saved row records the latest generated-message linkage so a
retry is idempotent without retaining a second content copy.

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
- Chat generation records are trusted workflow inputs, not durable citation
  owners; the saved PersonalElement remains usable after those records expire.
- Lecturer generation later owns the Element migration, atomic transfer,
  accounting separation, exact retention duration, and cleanup job.
- Deleting an unavailable source disables its open action but does not erase
  the saved title and locators from an element source reference.
