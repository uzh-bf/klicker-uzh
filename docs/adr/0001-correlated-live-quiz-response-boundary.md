# Correlated Live Quiz Response Boundary

## Status

Accepted

## Context

Standard live quizzes need two intentionally different privacy behaviors. Aggregate mode must not create participant-level response records, while an opt-in correlated mode must persist quiz-scoped response rows for a pseudonymous self-service CSV export. Assessment remains a separate, identifiable response flow.

## Decision

`AGGREGATED_ANONYMOUS` keeps standard responses in aggregate Redis state and exposes no participant-level response export. `CORRELATED_EXPORT` admits every respondent through a quiz-scoped identity, atomically records an encrypted PostgreSQL outbox event under shared lifecycle locks, persists one durable response per question execution, and derives aggregate Redis effects idempotently. The lecturer export uses stable random labels and never exposes account, temporary-pseudonym, or respondent identifiers.

Correlated publication is disabled by default during the first deployment phase. The database migration, response API, PWA, backend, and worker must all be upgraded before a second configuration rollout enables publication. The accepted event metadata contract is discriminated by question type and is validated at the response API and encrypted outbox boundary.

## Consequences

Aggregate and correlated live quizzes cannot share one persistence path, and correlated mode remains incompatible with gamification because leaderboard state can reidentify response rows. Assessment continues to require identifiable tracing. The v3.5 correlated teaching export excludes free-text answers; differential privacy and broader PII controls remain future research-export work.
