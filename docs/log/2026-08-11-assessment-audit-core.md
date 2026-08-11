---
type: Change Log
title: Assessment audit core
description: Provider-neutral assessment evidence contract and transactional outbox foundation.
timestamp: '2026-08-11'
tags:
  - audit
  - assessment
  - backend
  - prisma
---

## 2026-08-11

- **Add**: [assessment-audit-evidence](../assessment-audit-evidence.md)
  documents the provider-neutral contract, deterministic event identity,
  transaction-only emission boundary, PostgreSQL outbox, and current dormant
  delivery boundary.
- **Update**: [data-and-migrations](../data-and-migrations.md) records the
  intentionally separate assessment-audit schema area, canonical text storage,
  and absence of business-data foreign keys.
- **Update**: [async-and-workers](../async-and-workers.md) distinguishes the
  legacy free-form Hatchet audit task from the new evidence system.
- **Update**: [testing](../testing.md) records the audit package's local
  PostgreSQL integration suite and `test-graphql` CI coverage.
- **Update**: [klicker-data-model](../../.agents/skills/klicker-data-model/SKILL.md)
  permits a new schema area only for a deliberately bounded and documented
  subsystem such as assessment audit.
- **Harden**: canonical entity scope and snapshot identities are cross-checked,
  rollout lifecycle/terminal combinations are explicit, and historical payload
  schemas remain available by event type and version.
