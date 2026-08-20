---
type: Change Log
title: Hatchet API endpoint corrections
description: Align Klicker's staging and production HTTP API endpoints with their active Hatchet installations.
timestamp: '2026-08-20'
tags:
  - hatchet
  - deployment
---

## 2026-08-20

- **Fix:** Staging and production `HATCHET_API_URL` values now target their
  active shared Hatchet services instead of the retired installations.
- **Update:** [`async-and-workers`](../async-and-workers.md) and
  [`ci-and-deployment`](../ci-and-deployment.md) now document Hatchet's separate
  HTTP and gRPC client paths and the requirement that both target the same
  installation.
- **Update:** The
  [`klicker-testing-verification`](../../.agents/skills/klicker-testing-verification/SKILL.md)
  procedure now requires rendered HTTP endpoint inspection and a same-installation
  check for Hatchet deployment endpoint changes.
