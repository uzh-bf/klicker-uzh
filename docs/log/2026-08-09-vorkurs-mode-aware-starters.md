---
type: Change Log
title: Vorkurs mode-aware chat starters
description: Mode-specific welcome prompts for Tutor and Explainer.
timestamp: '2026-08-09'
tags:
  - chat
  - ai
  - ux
---

## 2026-08-09

- **Update**: [chat-platform](../chat-platform.md) now documents mode-aware
  welcome starters: Tutor starts interactive practice and Explainer starts
  focused, source-based explanations or comparisons.
- **Update**: Starters now fill the composer without sending. Their prompts use
  bracketed placeholders for a specific topic, concept, or problem so students
  can focus the retrieval query before submitting it.
- **Update**: The broad whole-course study-plan starter was removed from the
  welcome view. A structured study-planner flow remains a separate follow-up.
- **Update**: Welcome starters now wait for the current chatbot's mode options,
  so a persisted mode from another chatbot cannot trigger the wrong prompt.
