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

- **Standard modes** (`tutor`, `explainer`) always exist and are maintained by
  the platform. Lecturers freely edit a small set of constrained persona
  fields — course name, subject domain, language of instruction, optional
  scope note — that the server compiles into the standard prompts. No
  approval, because these fields can only aim the bot, not disarm it.
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
