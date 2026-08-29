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

Generation is a two-tool contract inside a configured course-chatbot mode:

1. After at least one retrieval call in the turn, the route forces the local
   `select_response_type` tool to choose between a normal answer and a card
   plan. This language-neutral model decision replaces phrase or locale
   allowlists. A `card_plan` decision forces `propose_card_plan`; the model
   cannot replace the interactive plan with prose. `propose_card_plan` returns
   a plan (titles, intents, retrieval queries), never cards. The route supplies
   the server-side tool with the participant's
   complete saved title list; raw participant-controlled titles are not copied
   into the model prompt. The tool applies a deterministic local similarity check to each
   proposed title, removes potential duplicates (including duplicates within
   the new plan), and reports the skipped titles. A plan containing only
   potential duplicates returns a localized, non-approvable result. The student approves the remaining plan
   explicitly; approval is a visible user message plus a request field naming
   the persisted plan, and the route forces the generation tool on the first
   step of that turn. The route repeats the title check at approval time so a
   card saved between proposal and approval cannot create a duplicate. The
   generated card name remains the approved plan title, so the deduplication
   key cannot drift during generation.
2. `generate_cards` performs, per planned card, one retrieval call and one
   structured model call whose output schema requires cited chunk ids from
   that retrieval. The nested MCP request uses the shared `doc_query` contract's
   single `question` field; strict servers may reject additional fields. The
   retrieval adapter exposes stable chunk IDs and bounded
   source metadata; every cited ID must be a non-empty subset of that card's
   retrieved IDs. Missing, malformed, or evidence-free output fails closed.
   Grounding is enforced by the pipeline, not by the prompt. The generated
   explanation must be a substantive, alphanumeric card back; validation is
   structural (non-empty, bounded, contains letters or digits) and never
   matches language-specific boilerplate. Cards stream as
   preliminary results; the final result carries bounded card-local sources
   in the retrieval result shape. The Chat surface exposes the running tool
   call and `completed/total` progress, and the generation turn ends with the
   tool result and candidate actions rather than duplicate assistant prose.

The tool input and output shapes are the public generation contract. The
implementation behind `generate_cards` may be the in-route pipeline (v1) or a
Catalyst engine; either does no database work and knows nothing about the UI.
Saving, discarding, revising, and deleting are deterministic actions outside
the model. Save creates a participant-owned `PersonalElement`; Discard writes
an idempotent participant-owned `PersonalElementDiscard` keyed by course and
candidate ID, so it survives reload without storing retrieved text or
mutating the immutable chat message. The source message and tool call remain
request-time linkage for validating the candidate, not durable discard
identity.
The candidate actions wait until the completed assistant message is present in
the active thread and retry a transient not-yet-persisted response. They remain
disabled if the durable decision state still cannot be read.
A retry of a partial generation excludes plan entries already saved or
discarded, so successful decisions are not regenerated or blocked by their own
titles.
Neither tool is offered when the selected mode has no retrieval tool or the
student has no credits left. When a selected mode has a retrieval tool, every
non-empty text or image turn first calls that named tool; there is no phrase
or locale allowlist, so greetings and short acknowledgements pay the same
retrieval call as substantive questions. If retrieval has no usable course
material, the assistant reports that limitation rather than answering from
uncited general knowledge.

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
- Every substantive turn now pays one retrieval call before any answer,
  adding latency and retrieval cost to ordinary conversation in modes that
  expose the generation tools.

## Amendment — 2026-08-26

The initial release bounds one plan and generation result to five cards. Every
boundary rejects larger input rather than truncating it. A card that cannot be
produced returns only its plan-scoped candidate ID and one of
`retrieval_unavailable`, `insufficient_evidence`, or `generation_failed`; raw
retrieval and provider diagnostics are not part of the persisted result. The
source contract remains membership-based: the card exposes only metadata for
chunks returned by its own retrieval, without claiming that the model's answer
is correct or reviewed. Creation tools are additionally behind the
fail-closed, participant-and-chatbot-targeted `personal-card-generation` flag;
saved-card practice and correction paths remain available while creation is
disabled.
