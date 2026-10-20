# 42. Version chatbot disclaimers by replacement

## Status

Accepted

## Context

A participant accepts a chatbot disclaimer by storing its disclaimer ID in
`ChatUsageCredits.acceptedDisclaimerId`. Editing that disclaimer row in place
would change the text behind an existing acceptance without requiring the
participant to accept the revised content. Draft authoring also needs stale
browser tabs to fail safely instead of overwriting a newer edit.

## Decision

The lecturer authoring path replaces a changed disclaimer instead of updating
the linked row:

- `saveChatbotDisclaimer` receives the disclaimer ID the lecturer loaded, with
  `null` representing a chatbot that has no disclaimer yet.
- The service normalizes and validates the lecturer-editable title and
  introduction, then creates and links a replacement in one transaction.
- The link update compares the expected disclaimer ID and editable chatbot
  status. A stale or concurrent save rolls back the replacement row.
- A normalized no-op keeps the existing row and ID.
- Replacement rows preserve the existing management name, description, and
  media fields. The first row receives a generated management name.
- Owner-facing acceptance counts include only participants whose accepted ID
  equals the chatbot's currently linked disclaimer ID.

Published disclaimers remain read-only in this MVP. A later workflow may add
explicit published revisions and review, but it must retain the same
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
