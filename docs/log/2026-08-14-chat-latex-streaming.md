---
type: Change Log
title: Chat streamed LaTeX rendering
description: Hide incomplete streamed formulas and flush closed formulas atomically.
timestamp: '2026-08-14'
tags:
  - chat
  - frontend
  - testing
---

## 2026-08-14

- **Update:** [`chat-platform`](../chat-platform.md) now records the streamed
  math masking, atomic KaTeX flush, and standalone display-fence contract.
- **Update:** [`klicker-testing-verification`](../../.agents/skills/klicker-testing-verification/SKILL.md)
  now requires paused-stream assertions for raw, partial, and malformed math
  states as well as persisted display-math coverage.
