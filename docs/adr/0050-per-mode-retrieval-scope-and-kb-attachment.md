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
  time with the existing `503 REQUIRED_MCP_UNAVAILABLE` response. Quizzer keeps
  its capability gate: it appears only with a provably restricted course
  `doc_query` binding. An unsupported or typed-disabled mode is still rejected
  before any thread or provider work.
- Retrieval scope is resolved for the selected mode. An approved custom mode
  inherits a required Tutor or Explainer `doc_query` binding for the same
  server, retagged to the selected mode key, so a mode approved after the
  attachment is grounded without another attachment; an enabled exact binding
  for the mode itself takes precedence. A selected mode with no enabled `KB`
  configuration returns no scope instead of a scope violation, so an unbound
  mode serves without grounding rather than being hidden. Scope isolation is
  unchanged: enabled `KB` configurations must agree on one server ID and one
  normalized KB ID set across the chatbot, and a selected mode that does resolve a
  binding must match it exactly.
- Attaching a knowledge base upserts the required `doc_query` row for Tutor and
  Explainer only, and derives the eligible exact custom-mode keys from the
  chatbot's approved `customModeConfig` — never from the legacy `systemPrompts`
  map or a pending revision. It disables enabled `KB` rows whose mode is not
  Tutor, Explainer, an approved custom mode, or Quizzer, and it repoints an
  already-enabled exact custom or Quizzer row to the new knowledge base. It
  never creates a custom or Quizzer row and never re-enables a disabled exact
  override. Approved custom modes inherit the standard binding at request time,
  so a mode approved after the attachment needs no re-attachment and no stored
  row of its own. The shared standard-mode key list is asserted against the
  runtime prompt registry by a test, so provisioning and resolution cannot
  drift.
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
  superseded visibility rule and the Quizzer capability gate this decision keeps.
- [ADR 0019](./0019-chatbot-config-postgresql-authoritative.md) — chatbot
  configuration is PostgreSQL-authoritative and compiled per request.
