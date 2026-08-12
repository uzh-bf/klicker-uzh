---
type: Change Log
title: Correlated live-quiz identity lifecycle
description: Separate assessment attribution from finalizable pseudonymous teaching-response identities.
timestamp: '2026-08-12'
tags:
  - backend
  - privacy
  - live-quiz
---

# 2026-08-12

- **Creation:** [ADR-0005](../adr/0005-separate-live-quiz-response-identity-policies.md) assigns assessment and standard correlated responses to different durable identity policies.
- **Creation:** [ADR-0006](../adr/0006-finalize-correlated-identities-after-settlement.md) destroys temporary correlated identity bindings after settlement while retaining a minimal pseudonymous export dataset for a finite period.
- **Renumbering:** The correlated response boundary is [ADR-0007](../adr/0007-correlated-live-quiz-response-boundary.md), removing the earlier collision with the database-migration ADR.
- **Update:** [Domain Model](../domain-model.md) and [Data & Migrations](../data-and-migrations.md) distinguish leaderboard pseudonyms, generation-scoped active respondent bindings, assessment evidence, and quiz-lock-fenced irreversible finalization.
