# 53. One status-driven setup page replaces the tabbed chatbot workspace

## Status

Accepted. Builds on the revision lifecycle in
[ADR 0043](./0043-review-chatbot-revisions-before-activation.md) and the
optional knowledge base attachment in
[ADR 0050](./0050-per-mode-retrieval-scope-and-kb-attachment.md).

## Context

Manage showed a chatbot through two different layouts. Draft and rejected
chatbots used a single page of setup steps, while pending, published and
paused chatbots used a tabbed workspace (overview, knowledge, behavior,
disclaimer, usage). Each tab carried its own save buttons, success messages
and read-only panels. Lecturers had to learn both layouts, and the same
setting looked and saved differently depending on the chatbot's status. The
published workspace also mixed live values, saved revision values and usage
figures on one overview, so it was hard to tell what students currently get
and what still waits for review.

## Decision

Every chatbot status renders the same page of collapsible sections:
Materials, Student information, Learning modes and framing, Model, Usage
limits and, for advanced management, Knowledge graph. Each section shows a
status and a short summary when closed, has one Save button, and collapses
after saving. The status changes what the sections allow, not which layout
appears:

- Draft and rejected chatbots edit every section and end with the
  publication request.
- A pending request locks every section except Materials and shows the
  request with Withdraw. Knowledge base changes still take effect without
  review, so Materials stays editable.
- A published chatbot edits every section. Materials applies immediately;
  the other sections save a revision that applies after review, and each
  section says which. The final card appears only while a saved revision
  exists, names the sections not yet submitted, and submits them for review.
  A usage strip summarizes activity, and the Usage limits section shows the
  live credit policy while it differs from the saved one.
- A paused chatbot shows the same sections read-only, with a notice and the
  usage strip, and offers no action.

Links into the former workspace views stay valid: `view` and `step` query
parameters open the matching section.

## Consequences

- One component tree serves every status, so a setting is edited, saved and
  summarized the same way everywhere. The tabbed workspace, its navigation
  and its per-tab save states are removed.
- The page derives "saved, not yet submitted" by comparing the saved revision
  with the live values per section. A new revision field needs a matching
  comparison, or its section will not report unsubmitted changes.
- Status-specific behavior lives in a few flags on the page (editable,
  pending, paused, apply labels), so a new status must be placed among them
  rather than given its own layout.
- End-to-end tests address sections by test ID instead of tabs.

## Considered options

- **Keep the tabbed workspace for live chatbots.** It separates live and
  draft concerns, but keeps two layouts for the same settings and the
  confusion that motivated this change.
- **Move drafts into the tabbed workspace.** One layout, but tabs hide what
  is still missing before a request and spread one setting's save state
  across views.
- **Label every field with when it applies.** More precise, but noisy. All
  fields of a section share the same rule, so a per-section label carries the
  same information.
