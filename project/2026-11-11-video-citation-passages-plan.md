# Align video citation cards with cited passages

## Approval summary

A grouped video result can contain several passages under one citation index.
The answer may cite a later passage while the card uses the first passage's
position and excerpt. Carry an explicit video locator through the existing
citation marker, validate it against the retrieved passages, and show the
matching position and excerpt on the card and hover preview.

Reuse the existing source identity, numbering, stored tool results and document
page grammar. Keep old messages readable through the existing fallback. Original
course links keep their access controls and navigation behavior. No processing,
reimport, database migration, model selection or new dependency is needed.

Acceptance requires a later-passage marker to select a supported timestamp and
its excerpt, identical card/hover output, multiple cited positions without an
invented interval, stable numbering across queries, and equivalent replay from
persisted message parts. Malformed or unsupported locators cannot change the
card. Browser evidence is required before UI verification is complete.

## Execution details

Main owns design, integration, external effects and final verification. A bounded
executor may implement the settled citation seam and tests in this worktree.
The previous citation worktree is preserved without modification.

Primitive impact: extend the existing citation locator with a video position;
reuse source identity and retrieval evidence. This is a compatible presentation
extension. A distinct product primitive or ADR is unnecessary.

Implementation uses existing modules: source types/normalization/display, the
citation-marker parser, the message-source hook and citation prompt. Extend
existing focused tests. Avoid new abstractions, files or unrelated cleanup.

- Normalize all valid video passage bounds/excerpts. Merge passage evidence when
  repeated source candidates deduplicate, preserving first-appearance indices.
- Accept single-source labelled video clocks in [h:]mm:ss form. Preserve the
  document-page grammar, code masking and partial-marker streaming behavior.
  A complete marker renders the numeric chip. Raw Markdown copy/export may retain
  the meaningful locator, consistent with existing page details.
- Validate positions against the source's retrieved passage intervals. Account
  for integer clock display of fractional bounds. Unknown end permits only the
  matching displayed start. Reject nonfinite, negative, malformed and unsupported
  positions; do not associate timestamps by guessing adjacent prose.
- The hook applies validated positions to normalized sources for both consumers.
  Show all distinct cited positions in stable ascending order. Use the excerpt
  for the earliest cited position, breaking overlapping bounds by retrieval order.
  Missing or invalid locators preserve the historical fallback. Never alter URLs
  to invent playback seeking.
- Prompt guidance requests the specific passage locator and avoids a competing
  timestamp in prose. Keep every retrieved chunk available to the model.

## Verification

Extend existing parser tests for clocks, hours, code, partial/ranged/malformed
markers and page noninterference. Extend source tests for later-passage selection,
unsupported positions, multiple cited times, repeated query dedupe and old-message
fallback. Replay the stored tool-result representation through normalization and
selection; do not rely only on live React state. Existing model-projection tests
continue to protect the complete chunk payload and assigned citation indices.

Run repo-native focused tests, formatting and type checks in a container. Capture
real UI evidence using synthetic data; no production content enters source,
fixtures, commits or PR descriptions. Main inspects the exact diff, then one
independent integrated review covers correctness, maintainability and data flow.

## Verification outcome

The chat type check and test suite passed. Following the citation chip in a
synthetic browser fixture focused the course link. The source card and hover
preview showed the later passage's timestamp and excerpt. An exact displayed
start wins at a shared boundary. Saved examples keep a single lineage record
only when every citation to that index identifies the same retrieved chunk.
