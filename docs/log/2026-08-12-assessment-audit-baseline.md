---
type: Change Log
title: Assessment audit baseline and activation
description: Deterministic baselines, immutable media capture, rollout accounting, and split privileged workers.
timestamp: '2026-08-12'
tags:
  - audit
  - assessment
  - azure
  - hatchet
---

## 2026-08-12

- **Update**: [assessment-audit-evidence](../assessment-audit-evidence.md)
  documents deterministic assessment baselines, two-phase activation, sticky
  lifecycle coverage, resumable rollout inventory, and atomic reopening.
- **Update**: owned media is streamed to content-addressed immutable Blob
  versions, reverse-indexed by assessment scope, and renewed without shortening
  the locked retention horizon.
- **Update**: [async-and-workers](../async-and-workers.md) records separate
  dispatcher, media-policy, and GraphQL backend workload identities with
  fail-closed task selection and role-labeled metrics.
- **Verify**: database-backed tests cover activation commit/rollback, exact
  retry, concurrent-change rejection, rollout resumption and gaps, automatic
  all-mode activation, and reopening atomicity; Azure tests cover immutable
  media replay and policy extension.
