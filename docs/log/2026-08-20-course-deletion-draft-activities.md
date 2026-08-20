---
type: Change Log
title: Optional draft-activity cleanup during course deletion
description: Allow lecturers to delete linked draft live quizzes together with a course while preserving the existing default.
timestamp: '2026-08-20'
tags:
  - backend
  - frontend
  - graphql
---

## 2026-08-20

- **Update:** [Domain Model](../domain-model.md) documents which activity types
  are cascaded, disconnected, or optionally deleted with a course, including
  why the lecturer-facing option uses activity-level terminology.
- **Update:** [GraphQL API Layer](../graphql-api-layer.md) records the optional
  boolean argument pattern used by the `deleteCourse` mutation.
