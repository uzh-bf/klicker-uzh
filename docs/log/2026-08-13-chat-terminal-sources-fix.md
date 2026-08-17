## 2026-08-13

- **Update**: [chat-platform](../chat-platform.md) now documents the precise
  source-card lifecycle: hidden during active pre-answer generation, visible
  for valid sources on terminal tool-only turns, and still empty when source
  normalization finds no qualifying result.
- **Update**: [klicker-testing-verification](../../.agents/skills/klicker-testing-verification/SKILL.md)
  records the terminal tool-only source regression alongside the existing
  paused-stream check.
- **Update**: The chat route preserves completed tool results and only the
  current unfinished text/reasoning when an abort occurs, so source provenance
  survives mixed partial turns without duplicating finished output.
