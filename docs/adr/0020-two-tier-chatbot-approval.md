# 20. Two-tier approval: account AI capability plus per-chatbot publication

## Status

Accepted

## Context

The tutoring chatbot public beta lets any lecturer request access via a form
(use case, expected student count, cost center). Chatbot usage is billable, so
uncontrolled go-live is not acceptable; at the same time, a per-change approval
queue would make the operating team the bottleneck for every configuration
tweak and kill the beta feedback loop.

## Decision

Approval is two-tier and both tiers are account- or artifact-level, never
per-edit:

1. **Account AI capability**: the team approves a lecturer's account and cost
   center once and enables a feature flag. Lecturers with Catalyst can already
   see and use the chatbot creation and configuration features beforehand;
   the flag gates publication, not creation.
2. **Per-chatbot publication**: each chatbot is created and configured
   self-service in a non-published state, in which only the owning lecturer
   can use it. Going live requires an in-app publication request on the bot
   (use case, expected student count, proposed credit configuration) that the
   team approves or rejects with a comment.

Configuration edits are free within caps and apply immediately. Only a short
explicit list of gated changes re-enters review on an already-published bot:
custom-mode prompt text and the credit/model cost class. Before publication,
everything is freely editable — the unpublished bot is the draft, so no
draft/publish snapshot machinery exists.

## Consequences

- The team reviews each bot exactly once before it meets students, at the
  moment its real configuration and stated use case are visible together.
- Post-publication edits to non-gated knobs (examples, knowledge, standard-mode
  fields) take effect without review; this bounded risk is accepted.
- Draft-config machinery for live bots is deliberately deferred until editing
  live bots proves painful.
