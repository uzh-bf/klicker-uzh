# 19. Chatbot configuration is PostgreSQL-authoritative; runtimes compile it per request

## Status

Accepted

## Context

The lecturer-facing chatbot configuration surface (modes, persona fields,
few-shot examples, model policy, credit policy, knowledge bindings, publication
state) is growing just as the chat runtime is expected to migrate (currently a
Next.js route, later possibly Mastra). A runtime migration that also migrates
configuration into runtime-native storage would force every HITL feature to be
rebuilt and would couple the lecturer workflow to the runtime choice.

## Decision

The `Chatbot` model and its satellites in PostgreSQL are the single
authoritative store for all chatbot configuration. Any runtime — the current
chat route or a future Mastra agent — reads that configuration and compiles it
into prompts and policies per request. Configuration is never migrated into or
duplicated in runtime-native storage; a new runtime reimplements the compile
step, not the store.

## Consequences

- The manage UI, approval workflow, and analytics never change when the
  runtime does.
- Each runtime must implement the same compile semantics (see ADR 0021);
  drift between compile implementations is the risk to test for during a
  runtime migration.
