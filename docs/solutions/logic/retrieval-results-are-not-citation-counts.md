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

Evaluation receipts must use the same source normalizer and citation-index
projection as the application. Deduplicating by title/reference alone loses
page and video-position identity; truncating each tool call separately diverges
from the message-wide sequence. The trajectory evaluator records original
per-call source positions, nullable indices and hashed normalized identities.
This reconstructs citation membership from persisted tools, rather than proving
what evidence the historical model actually received.

The visible card preview must also remain separate from citation admission.
Sharing a 12-item limit let the first broad search consume every citation slot,
so even a useful first result from a later refined search received a null index.
The full text still reached the model: this was unavailable citation capacity,
not missing retrieval content. The registry now admits up to 99 stable identities,
within the existing two-digit parser, while the initial cited-card preview stays
at 12. Citation navigation opens the disclosure before focusing a hidden card.
See [the citation contract](../../chat-platform.md#sources-and-citations).

## Prevention

Keep synthetic tests for unnamed chunks, multiple tool calls, capped citation
lists, and persisted reload. These tests establish consumer reconstruction and
display behavior, not upstream retrieval quality or deployed corpus provenance.
Include a useful source after the preview limit, a refined second search, the
highest admitted index, and the first overflow entry. Neither retrieved presence
nor an assigned citation number establishes that the passage supports a claim.
