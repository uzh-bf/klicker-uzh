# 50. Retrieval availability is per mode, and attaching a knowledge base reconciles the mode rows

## Status

Accepted. Supersedes the required-MCP visibility rule in
[ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md).

## Context

ADR 0021 let the server hide any mode that could not satisfy the chatbot's
required-MCP policy. The effective-mode resolver applied that check
chatbot-wide: if a chatbot declared a required MCP configuration anywhere, the
resolver suppressed **every** mode that did not resolve a required binding. A
custom-mode-only chatbot that had a knowledge base attached — and therefore a
required `doc_query` row for its own custom mode — still resolved zero available
modes, because the standard-mode rows it checked did not match the selected
custom mode. Participants saw the localized "no chat mode available" notice and
could not use the bot at all, even though its knowledge base was bound and
serving.

Attaching a knowledge base also wired only Tutor and Explainer. A chatbot whose
custom modes needed retrieval had no rows for those modes, and rows left over
from an earlier attachment could keep an enabled binding for a mode the chatbot
no longer declared.

## Decision

Mode availability is per mode, and knowledge-base attachment reconciles the
stored rows with the declared modes.

- The effective-mode resolver does not suppress a mode on account of another
  mode's binding. A mode with no retrieval binding of its own stays offered, and
  a mode whose declared required binding is unavailable fails closed at request
  time with the existing `503 REQUIRED_MCP_UNAVAILABLE` response. Quizzer keeps
  its capability gate: it appears only with a provably restricted course
  `doc_query` binding. An unsupported or typed-disabled mode is still rejected
  before any thread or provider work.
- Retrieval scope is resolved for the selected mode. A selected mode with no
  enabled `KB` configuration returns no scope instead of a scope violation, so a
  custom-mode-only bot serves without grounding rather than being hidden. Scope
  isolation is unchanged: enabled `KB` configurations must agree on one server
  ID and one normalized UUID across the chatbot, and a selected mode that does
  resolve a binding must match it exactly.
- Attaching a knowledge base upserts one required `doc_query` row per declared
  mode key — Tutor, Explainer, and each non-blank, non-standard
  `systemPrompts` key — disables enabled `KB` rows for modes outside that set
  except Quizzer, and never creates a Quizzer row. Re-attaching repoints an
  enabled exact Quizzer row to the new knowledge base and leaves a disabled one
  untouched, so an explicit Quizzer opt-out survives. The shared standard-mode
  key list is asserted against the runtime prompt registry by a test, so
  provisioning and resolution cannot drift.
- The lecturer-facing concept is only "knowledge base". `Chatbot.mcpConfigurations`
  is deprecated and no longer projected: the service stops loading the rows, so
  the field resolves to an empty list, and the Manage usage view no longer
  exposes an MCP technical-integrations panel. MCP configuration remains
  internal plumbing.

## Considered options

- **Keep hiding unbound modes chatbot-wide.** Simplest, but it makes a
  custom-mode-only bot with a bound knowledge base unusable, which is the
  reported failure.
- **Bind every declared mode at request time instead of storing rows.** This
  would remove the empty-scope case entirely, and with it the tolerant scope
  resolution below, but it also over-grounds modes the lecturer never
  aimed at course material and leaves no way to express "this mode does not
  retrieve". Stored rows keep the binding visible and reviewable, at the cost of
  a mode added later staying unbound until the next attachment.
- **Remove the deprecated field outright.** Cleaner schema, but an unnecessary
  breaking change for clients that still read it; deprecation keeps them working
  while the projection goes away.

## Consequences

A mode with no retrieval binding serves ungrounded instead of being hidden. A
mode whose declared binding is unavailable keeps failing closed at request time,
so a broken binding surfaces as an actionable error rather than a missing mode.
Attaching a knowledge base is now a reconciliation over all declared modes
rather than a two-mode patch, so a stale custom-mode row cannot keep an enabled
binding the chatbot no longer declares.

Re-arm trigger: reintroducing a chatbot-wide retrieval requirement, removing the
deprecated `mcpConfigurations` field, or restoring its populated projection
changes this decision and needs its own ADR update.

## References

- [ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md) — the
  superseded visibility rule and the Quizzer capability gate this decision keeps.
- [ADR 0019](./0019-chatbot-config-postgresql-authoritative.md) — chatbot
  configuration is PostgreSQL-authoritative and compiled per request.
