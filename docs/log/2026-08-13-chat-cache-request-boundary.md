---
type: Change Log
title: Chat cache request boundary
description: Documentation updates for the default/custom cache boundary and synthetic transport proof.
timestamp: '2026-08-13'
tags:
  - chat
  - testing
---

## 2026-08-13

- **Update**: [chat-platform](../chat-platform.md) documents the separate
  default/custom exact-response boundary, the stable prompt-prefix identity,
  privacy exclusions, provider-managed implicit caching, and local synthetic
  proof limits.
- **Update**: [testing](../testing.md) names the focused cache-policy and
  prompt-identity fixtures, their public usage-bucket assertions, and the
  unchanged browser boundary.
- **Update**: the
  [Klicker testing-verification skill](../../.agents/skills/klicker-testing-verification/SKILL.md)
  adds the focused request-policy checks and their evidence boundary.
- **Decision**: removed the redundant GPT-5.6 deployment allow-list and
  `promptCacheOptions.mode: 'implicit'` override. Provider-managed implicit
  caching remains enabled by default; the stable prompt-cache key and exact
  response-cache bypass remain separate concerns.

## 2026-08-14

- **Correction**: prompt-cache transport identity now follows
  `usesResponsesApi`, matching the actual provider transport for Auto routing.
- **Clarification**: [chat-platform](../chat-platform.md) documents the
  key-only custom-routing residual and the current undefined-context contract
  for function-valued tool descriptions.
