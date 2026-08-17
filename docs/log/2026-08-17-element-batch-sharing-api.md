---
type: Change Log
title: Element batch sharing API
description: Document the authorization, transaction, and UI coordination boundaries for sharing multiple Elements.
timestamp: '2026-08-17'
tags:
  - backend
  - graphql
  - sharing
---

## 2026-08-17

- **Update:** The [GraphQL API layer](../graphql-api-layer.md) now documents the
  multi-object permission-check exception, per-Element transaction boundary,
  and non-atomic UI coordination for Element batch sharing.
- **Update:** The
  [`klicker-graphql-api`](../../.agents/skills/klicker-graphql-api/SKILL.md)
  workflow now distinguishes single-object `withPermission` fields from
  multi-object batch fields with per-object service authorization.
