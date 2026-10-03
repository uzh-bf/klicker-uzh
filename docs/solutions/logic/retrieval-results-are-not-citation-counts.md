---
module: chat
date: 2026-09-07
problem_type: logic
severity: medium
symptoms:
  - 'A retrieval badge reports no results beside an answer using retrieved material.'
root_cause: Retrieval status was inferred from filtered citation cards.
tags: [rag, citations, retrieval]
---

# Retrieved material can exist without a citation card

## Problem

Citation normalization intentionally filters sources without usable identifying
metadata, deduplicates them, and caps the message-wide list. Its output therefore
cannot establish whether retrieval returned material or how many chunks exist.

## What did not work

Counting normalized sources classified unnamed retrieved passages as an empty
search. Admitting those sources into the citation sequence would fix the count
but could shift historical numbered references when persisted messages reload.

## Solution

Interpret retrieval independently in
[docQueryResult.ts](../../../apps/chat/src/lib/sources/docQueryResult.ts).
Only an explicitly empty source collection means no results. Render returned
groups and chunks independently of the citation cap, associating eligible
groups with existing message-wide citation identities.

Navigation metadata is also separate from identity. A supplied public origin
can improve a link without changing deduplication or citation numbering.
Missing origins remain unavailable; chunk text is not trusted URL metadata.

## Prevention

Keep synthetic tests for unnamed chunks, multiple tool calls, capped citation
lists, and persisted reload. These tests establish consumer reconstruction and
display behavior, not upstream retrieval quality or deployed corpus provenance.
