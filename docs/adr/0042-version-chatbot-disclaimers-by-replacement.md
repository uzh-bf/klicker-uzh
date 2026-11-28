# 42. Version chatbot disclaimers by replacement

## Status

Accepted

Lecturer setup editing after publication is superseded by
[ADR 0043](./0043-review-chatbot-revisions-before-activation.md). Its saved
revision and approval contract leaves unrelated runtime dependencies unchanged.

## Context

A participant accepts a chatbot disclaimer by storing its disclaimer ID in
`ChatUsageCredits.acceptedDisclaimerId`. Editing that disclaimer row in place
would change the text behind an existing acceptance without requiring the
participant to accept the revised content. Draft authoring also needs stale
browser tabs to fail safely instead of overwriting a newer edit.

## Decision

The lecturer authoring path replaces a changed disclaimer instead of updating
the linked row:

- `saveChatbotRevision` receives the disclaimer section and the expected
  revision version. An optional expected disclaimer ID provides an additional
  identity check, with `null` representing no disclaimer.
- The service normalizes and validates the lecturer-editable title and
  introduction, then creates a replacement and saves its ID in the revision
  in one transaction.
- The save compares the revision version, optional disclaimer ID, and editable
  status. A stale or concurrent save rolls back the replacement row.
- A normalized no-op keeps the existing row and ID.
- Replacement rows preserve the existing management name, description, and
  media fields. The first row receives a generated management name.
- Owner-facing acceptance counts include only participants whose accepted ID
  equals the chatbot's currently linked disclaimer ID.

Published chatbot edits retain the live disclaimer until the submitted
revision is approved. Approval links the replacement while retaining the same
acceptance-to-version invariant.

## Consequences

- A material draft disclaimer change gets a new ID, so existing participants
  must accept the current text before continuing.
- Old disclaimer rows remain as the historical identity referenced by prior
  acceptances.
- The existing schema already represents the required identity and link, so
  this decision needs no database migration.
- Concurrent edits fail with a stable conflict error instead of creating an
  orphan row or silently winning.
