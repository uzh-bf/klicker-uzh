# 21. Standard modes are templated, custom modes are reviewed; both layer over fixed scaffolding

## Status

Accepted

## Context

Today a chatbot's `systemPrompts[mode].prompt` fully replaces the built-in
default prompt, so exposing prompt editing to lecturers would silently drop
the platform scaffolding (citation behavior, source grounding, safety, tutoring
stance). Raw prompt access is also the knob most likely to degrade answer
quality and the main liability surface, yet lecturers legitimately need to aim
a bot at their course and, in advanced cases, define their own interaction
styles.

## Decision

Prompt influence is two-tier, and prompt compilation is layered, not
replacing:

- **Standard modes** (`tutor`, `explainer`, `quizzer`) are maintained by the
  platform and compose additively with stored modes. A stored standard-mode
  prompt overrides only that mode's persona; a missing entry uses the platform
  default. The platform owns standard-mode labels and descriptions. A stored
  `enabled: false` explicitly opts a chatbot out of one mode without a schema
  migration.
- Tutor and Explainer are general standard candidates. Quizzer is
  capability-gated: it appears only when the server can resolve a restricted
  course `doc_query` binding. An exact Quizzer MCP configuration takes
  precedence per server. Otherwise Quizzer may inherit only a Tutor binding
  that exposes an exact `doc_query` tool or a required single-tool alias named
  `doc_query`; unrestricted and wildcard configurations are never inherited.
  A disabled exact Quizzer row blocks inheritance from that server.
- The server may hide any mode that cannot satisfy the chatbot's required-MCP
  policy. The same effective-mode resolver drives participant presentation,
  settings data, request validation, and request-time MCP selection, so a
  hidden mode cannot be selected with a crafted request.
- Lecturers may later edit a small set of constrained persona fields — course
  name, subject domain, language of instruction, optional scope note — that
  the server compiles into standard prompts. No approval is needed because
  these fields can only aim the bot, not disarm it.
- **Custom modes** let a lecturer author a name, description, and free persona
  text. That text is compiled as the persona section on top of the same
  scaffolding; publication of a new or edited custom mode requires team
  review (per ADR 0020).
- In both tiers the platform scaffolding is non-removable: lecturer-authored
  content is layered onto it by the compile step, replacing the current
  replace-semantics.
- The raw compiled prompt is not displayed to lecturers in the first version.

## Consequences

- Custom-mode review checks pedagogy and scope, not whether scaffolding
  survived — the compile step guarantees that.
- The compile step becomes the contract every runtime must honor (ADR 0019).
- Few-shot examples, not prompt text, are the primary self-service steering
  lever for behavior.
- Existing chatbots receive changed standard defaults automatically without a
  data migration unless they store an override or explicit opt-out. Stage 1
  Quizzer asks AI-generated questions grounded in course material; it does not
  imply access to lecturer-authored questions, personal practice cards, or an
  exam-equivalent question bank.
