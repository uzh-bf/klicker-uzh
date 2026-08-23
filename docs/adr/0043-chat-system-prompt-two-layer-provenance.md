# 0043 — Chat system prompts get two-layer provenance

## Status

Accepted (2026-08-23)

## Context

Chat turns are generated from a system prompt that is compiled per request:
authored mode text plus runtime contracts (citation, language style). Today the
platform stores only the lecturer-authored JSON projection
(`Chatbot.systemPrompts`) and keeps no durable record of which exact authored
text or final instruction string produced a given assistant message. Usage,
analytics, and evaluation work therefore cannot answer "which prompt version
generated this message?" without storing large prompt text on every request.

Two distinct identities matter:

1. **Authored version** — the instruction/persona text a lecturer (or the
   platform default) accepted for one chatbot mode. Lecturer-visible changes
   create new versions.
2. **Effective system prompt** — the exact final text sent to the model:
   authored text plus runtime contracts. The same authored version can produce
   several effective texts as contracts change, and identical effective texts
   recur across messages.

Response examples and tool/model configuration do not change the authored
identity. They affect provenance only when physically compiled into the system
instructions.

## Decision

- Introduce an immutable catalog: `ChatbotMode` (stable key + lifecycle),
  `ChatbotModePromptVersion` (append-only authored text, dense per-mode
  version numbers), and `ChatbotEffectiveSystemPrompt` (exact final text keyed
  by SHA-256). Database triggers reject updates to immutable fields and direct
  deletes; lineage disappears only with the owning chatbot cascade.
- Every assistant message records a nullable `effectiveSystemPromptId`.
  Null means unknown (historical messages) and is never inferred. New assistant
  writes resolve provenance before generation and persist it with the turn
  (fail closed).
- Accepted authored changes atomically create the next version, move the
  active pointer, and update the legacy JSON projection during the
  compatibility release.
- The tutor default text moves to a shared server module owned by
  `@klicker-uzh/prisma`. The introducing migration embeds a frozen copy;
  future default changes require explicit new versions.
- Internal analytics/evaluation may join messages to catalog rows to avoid
  duplicating prompt content. No participant- or lecturer-facing API exposes
  versions in this phase.

## Consequences

- Historical messages keep unknown provenance; no backfill is attempted.
- Mixed-version deployments keep the legacy JSON projection authoritative for
  old pods; a catch-up migration initializes catalogs for chatbots created by
  old pods and fails on disagreement.
- Mode enable/disable/retire changes never create versions and never delete
  lineage while the chatbot exists.
- Removing `systemPrompts` requires a later contract migration after all
  consumers read the catalog.
