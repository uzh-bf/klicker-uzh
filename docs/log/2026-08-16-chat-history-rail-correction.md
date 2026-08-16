---
type: Change Log
title: Chat history rail turn projection correction
description: Record the turn-based rail projection and stable navigation contract.
timestamp: '2026-08-16'
tags:
  - chat
  - frontend
  - accessibility
---

## 2026-08-16

- **Correction:** The history rail now shows one landmark per adjacent
  user/assistant turn. User-only and assistant-only messages remain standalone
  landmarks.
- **Correction:** Complete user and assistant text is available in the
  landmark popover. Reasoning, tool calls, and client errors remain in the
  transcript and no longer create rail landmarks.
- **Correction:** Navigation targets message roots without expanding collapsed
  tool groups, and a short programmatic-scroll lock prevents the scroll spy
  from jumping between landmarks during navigation.
- **Correction:** The responsive rail uses the bounded tick layout for short and
  long histories alike on desktop. Mobile uses one 44px history trigger and the
  shared history dialog rather than precision tick targets; complete turn
  details are shown only by the hover/focus popover or focused dialog row.
- **Documentation:** `chat-platform` and the chat testing skill now describe
  the paired-turn contract and its browser verification requirements.
