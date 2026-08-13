---
type: Change Log
title: Biome Tier 1 Maintainability Fixes
description: Follow-up fixes for update loops, repeated wizard rows, and advisory diagnostic visibility found by the maintainability review.
timestamp: '2026-08-10'
tags:
  - frontend
  - ci
  - tooling
---

## 2026-08-10

**Update**

- Case-study solution reconciliation now preserves unchanged Formik item references and updates the field only when a solution is removed.
- Activity-filter callbacks now remain stable across renders so route-driven filters do not retrigger their synchronization effect.
- Activity-wizard rows use a client-only occurrence ID, so repeated drops or pastes of the same element retain independent React identity.
- Biome's default diagnostic output is visible again: error diagnostics block locally and in CI, while warnings and infos remain advisory.
