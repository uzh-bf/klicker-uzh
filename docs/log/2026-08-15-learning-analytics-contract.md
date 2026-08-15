---
type: Change Log
title: Learning analytics engine contract
description: Document the inert public v1 course and platform workflow boundary.
timestamp: '2026-08-15'
tags:
  - analytics
  - hatchet
  - testing
---

## 2026-08-15

- **Update:** [`architecture-overview`](../architecture-overview.md) now lists the
  server-side analytics engine contract package and its intentionally inert scope.
- **Update:** [`async-and-workers`](../async-and-workers.md) records the two reserved
  `v1` workflow names, rejected failure/cancellation semantics, and the absence of a
  public registration or worker.
- **Update:** [`testing`](../testing.md) records the service-free package checks and
  the draft-capable path-filtered CI workflow.
- **Update:** The KlickerUZH testing skill routes analytics contract changes to the
  package test, typecheck, and build.
