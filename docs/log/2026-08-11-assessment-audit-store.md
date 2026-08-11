---
type: Change Log
title: Assessment audit evidence store
description: Append-only Azure delivery, owner verification/export, dedicated worker, and launch monitoring foundation.
timestamp: '2026-08-11'
tags:
  - audit
  - assessment
  - azure
  - hatchet
---

## 2026-08-11

- **Update**: [assessment-audit-evidence](../assessment-audit-evidence.md)
  documents deterministic Azure Table mapping, create-only delivery,
  verification/export semantics, immutable Blob primitives, retry/quarantine,
  and the remaining dormant producer boundary.
- **Update**: [async-and-workers](../async-and-workers.md) records the isolated
  audit worker, explicit workflow selection, one-minute tasks, workload identity,
  and aggregate metrics endpoint.
- **Add**: the v3 Helm chart can render a dedicated audit deployment,
  ServiceMonitor, and PrometheusRule, but keeps both environments disabled until
  the staging identity, endpoints, permissions, and owner alert path are proven.
- **Verify**: the Azure Table adapter runs provider-conformance tests through the
  real SDK against pinned Azurite, including chunk reconstruction, replay,
  partial-write recovery, and conflict detection.
