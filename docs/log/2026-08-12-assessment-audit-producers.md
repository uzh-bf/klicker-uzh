---
type: Change Log
title: Assessment audit lecturer and system producers
description: Transactional producer coverage for assessment lifecycle, content, access, corrections, reports, resets, and media changes.
timestamp: '2026-08-12'
tags:
  - audit
  - assessment
  - graphql
  - hatchet
---

## 2026-08-12

- **Update**: [assessment-audit-evidence](../assessment-audit-evidence.md)
  documents typed lecturer/system producers, exact before/after evidence,
  effective access changes, deterministic participant resets, and
  post-activation media capture.
- **Update**: [async-and-workers](../async-and-workers.md) records scheduled
  assessment actor attribution and the remaining Layer 5 boundary for legacy
  response-pipeline audit events.
- **Update**: the stable launch registry removes placeholder event names for
  platform mutations that do not exist; future administration operations must
  add contract and producer together.
- **Update**: participant invitation auto-acceptance and the semester-start
  import repair paths share one audited transaction for the effective
  participation activation.
- **Verify**: producer coverage maps every GraphQL-owned launch event to its
  production family and durability point, with focused snapshot, media,
  permission, reset, registry, and retention-index tests.
