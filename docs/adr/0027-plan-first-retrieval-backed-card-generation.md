# 27. Student card generation is plan-first and retrieval-backed per card

## Status

Accepted — 2026-08-21

## Context

The value of student-generated cards depends on citations: a card a student
cannot trace to course material is worse than no card. The chat route runs
an AI SDK tool loop with a capped step count; asking the model to retrieve
once per card inside that loop makes grounding a prompt instruction, makes
latency sequential, and collides with the per-message citation cap. The
later Catalyst content-generation engine (ADR 0006) must be able to replace
the v1 implementation without changing the chat surface.

## Decision

Generation is a two-tool contract inside the tutoring conversation:

1. `propose_card_plan` is available only after at least one retrieval call in
   the turn and returns a plan (titles, intents, retrieval queries), never
   cards. The student approves the plan explicitly; approval is a visible
   user message plus a request field naming the persisted plan, and the route
   forces the generation tool on the first step of that turn.
2. `generate_cards` performs, per planned card, one retrieval call and one
   structured model call whose output schema requires cited chunk ids from
   that retrieval. The retrieval adapter exposes stable chunk IDs and bounded
   source metadata; every cited ID must be a non-empty subset of that card's
   retrieved IDs. Missing, malformed, or evidence-free output fails closed.
   Grounding is enforced by the pipeline, not by the prompt. Cards stream as
   preliminary results; the final result carries bounded card-local sources
   in the retrieval result shape.

The tool input and output shapes are the public generation contract. The
implementation behind `generate_cards` may be the in-route pipeline (v1) or a
Catalyst engine; either does no database work and knows nothing about the UI.
Saving, revising, and deleting are deterministic actions outside the model.
Neither tool is offered when the selected mode has no retrieval tool or the
student has no credits left.

## Consequences

- The chat app gains its first local (non-MCP) tools and its first
  interactive tool card; `ToolFallback` stays the default for all other tools.
- Nested model usage inside the tool must be added to credit accounting at
  every site that already adds image-description cost.
- A deployment without a retrieval server has no generation feature; ADR 0006
  records this as the working-simple-version floor for student-initiated
  practice candidates.
- Revision reuses the same per-card pipeline, so a corrected card is
  re-grounded, not patched.
