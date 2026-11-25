# 50. Retrieval availability is per mode, and attaching a knowledge base reconciles the mode rows

## Status

Accepted. Supersedes the required-MCP visibility rule in
[ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md).

## Context

ADR 0021 let the server hide any mode that could not satisfy the chatbot's
required-MCP policy. The effective-mode resolver applied that check
chatbot-wide: if a chatbot declared a required MCP configuration anywhere, the
resolver suppressed **every** mode that did not resolve a required binding. A
custom-mode-only chatbot that had a knowledge base attached resolved zero
available modes: attachment had provisioned required `doc_query` rows for Tutor
and Explainer only, the custom mode had no binding of its own, and those two
standard rows were enough to trigger the chatbot-wide suppression. Participants
saw the localized "no chat mode available" notice and could not use the bot at
all, even though its knowledge base was bound and serving.

Attaching a knowledge base provisioned retrieval only for Tutor and Explainer,
and the resolver gave a custom mode no way to inherit that binding. Rows left
over from an earlier attachment could also keep an enabled binding for a mode
the chatbot no longer declared.

## Decision

Mode availability is per mode, and knowledge-base attachment reconciles the
stored rows with the chatbot's approved modes.

- The effective-mode resolver does not suppress a mode on account of another
  mode's binding. A mode with no retrieval binding of its own stays offered, and
  a mode whose declared required binding is unavailable fails closed at request
  time with the existing `503 REQUIRED_MCP_UNAVAILABLE` response. An enabled Quizzer also serves without a KB. When configured for
  document retrieval it uses only its authorized restricted binding. An unsupported or typed-disabled mode is still rejected
  before any thread or provider work.
- A chatbot can have several active KB links and at most one default. Linking
  a KB makes it available for selection. The lecturer can change or clear the
  default independently. The compatibility attach mutation sets the default.
  Before enabling plural writes, it preserves the legacy singleton replacement
  behavior and refuses changes that would flatten an existing plural configuration.
- A custom mode can select one link by its immutable ID. An omitted assignment
  follows the default. Saved revisions govern owner preview and approved
  revisions govern learners. Changing the default affects inheriting modes on
  their next search. Renaming a mode or KB preserves its assignment. A revoked
  explicit link makes that source unavailable until the lecturer reassigns it.
- The server validates ownership and the effective link before issuing a
  single-KB Doc Query credential. Existing tool restrictions and disabled
  exact overrides continue to apply. Legacy MCP-only bots keep the existing
  validation of one consistent server and scope.
- Modes serve the same learners. Switching keeps the conversation and model
  history. New searches use the selected mode’s source. Historical text remains
  visible. Reopening protected media or reusing source-backed evidence checks
  its origin and current entitlement. Merely linking a source to the chatbot
  does not make it browsable by learners.
- The lecturer-facing concept is only "knowledge base". `Chatbot.mcpConfigurations`
  is deprecated and no longer projected: the service stops loading the rows, so
  the field resolves to an empty list, and the Manage usage view no longer
  exposes an MCP technical-integrations panel. MCP configuration remains
  internal plumbing.

## Considered options

- **Keep hiding unbound modes chatbot-wide.** Simplest, but it makes a
  custom-mode-only bot with a bound knowledge base unusable, which is the
  reported failure.
- **Store one required row per declared custom mode key.** This was the
  superseded provisioning design: it upserted a row for every non-blank
  `systemPrompts` key and kept each mode's binding visible and reviewable. But
  the row set followed the legacy prompt map rather than the approved
  configuration, and a custom mode approved after the attachment stayed
  ungrounded until someone re-attached the knowledge base. Deriving eligibility
  from the approved configuration and letting approved modes inherit the
  standard binding keeps a new mode grounded without a re-attachment.
- **Remove the deprecated field outright.** Cleaner schema, but an unnecessary
  breaking change for clients that still read it; deprecation keeps them working
  while the projection goes away.

## Consequences

A mode with no retrieval binding serves ungrounded instead of being hidden. A
mode whose declared binding is unavailable keeps failing closed at request time,
so a broken binding surfaces as an actionable error rather than a missing mode.
Attaching a knowledge base is a reconciliation over the approved mode set
rather than a two-mode patch, so a stale custom-mode row cannot keep an enabled
binding the chatbot no longer declares, and a custom mode approved later stays
grounded without another attachment.

Re-arm trigger: reintroducing a chatbot-wide retrieval requirement, removing the
deprecated `mcpConfigurations` field, or restoring its populated projection
changes this decision and needs its own ADR update.

## References

- [ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md) — the
  mode publication, visibility and Quizzer binding rules.
- [ADR 0019](./0019-chatbot-config-postgresql-authoritative.md) — chatbot
  configuration is PostgreSQL-authoritative and compiled per request.
