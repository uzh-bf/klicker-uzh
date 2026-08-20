---
type: Change Log
title: Pagination Show All
description: Records the management-list pagination change for showing all filtered Elements and Activities.
timestamp: '2026-08-20'
tags:
  - frontend
  - graphql
---

## 2026-08-20

**Update**

- Added an opt-in `All` page-size mode to the manage Elements and Activities
  lists. The mode omits server pagination arguments for the current filtered
  result, keeps verification records bounded, and preserves explicit batch
  selection. See [Frontend Conventions](../frontend-conventions.md),
  [GraphQL API Layer](../graphql-api-layer.md), and [Testing](../testing.md).
