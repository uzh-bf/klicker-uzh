---
type: Change Log
title: Editable course duplication deadline
description: Allow lecturers to adjust the group creation deadline while duplicating a course.
timestamp: '2026-08-10'
tags:
  - courses
  - frontend
  - testing
---

## 2026-08-10

- **Update**: [domain-model](../domain-model.md) now records that course
  duplication derives the initial group creation deadline from the source
  course but allows lecturers to override it before creating the copy.
- **Update**: The lecturer course-management tutorial now describes the
  editable deadline and its automatic recalculation when course dates change.
- **Verification**: The course duplication browser test edits the deadline and
  checks the persisted date on the copied course.
