---
type: Change Log
title: Chat conversation stability
description: Render ownership and regression coverage for streamed messages and feedback.
timestamp: '2026-08-10'
tags:
  - chat
  - frontend
  - testing
---

## 2026-08-10

- **Update**: [chat-platform](../chat-platform.md) records the narrow Zustand
  subscriptions, stable assistant-ui message component map, memoized runtime
  adapters, and direct store-owned rating buttons used to prevent conversation
  remounts during streaming and feedback.
- **Update**: [testing](../testing.md) documents the delayed multi-delta
  browser-stream fixture, its deterministic intermediate pause, and the
  DOM-identity assertion used for this regression.
- **Update**: [klicker-testing-verification](../../.agents/skills/klicker-testing-verification/SKILL.md)
  routes future chat-rendering regressions through the same fixture instead of
  treating a final answer as evidence that the conversation stayed mounted.
