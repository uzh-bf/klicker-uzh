# Regular Live Quiz Reset

## Goal

Allow activity owners and activity administrators to reset an ended regular
Live Quiz to draft while deleting the completed run and reversing its exact
gamification rewards once.

## Non-goals

- Resetting a draft, scheduled, or running Live Quiz.
- Partial deletion or partial reward rollback.
- Weakening assessment reset authorization.
- Force-resetting legacy gamified quizzes with incomplete reward evidence.

## Design

- **Domain:** `LiveQuiz`, `ElementBlock`, `ElementInstance`,
  `LiveQuizRewardRun`, `LiveQuizRewardEntry`, `Participant`,
  `Participation`, course/session `LeaderboardEntry`, `TimelineEntry`, and
  `ParticipantAchievementInstance`.
- **Layers:** split Prisma schema and migration, analytics schema mirror,
  GraphQL services/schema/ops/codegen, Hatchet/types, manage frontend, English
  and German i18n, Vitest integration tests, Playwright, and engineering wiki.
- **Authorization:** `asUserFullAccess` plus activity `ADMIN`; activity owners
  satisfy the permission hierarchy. Assessment retains its course
  owner/administrator check.
- **Gamification:** course points require active participation; XP is
  independent. Per-run ledger entries store the exact course-point, XP,
  timeline, and achievement-count deltas.
- **Async:** post-commit Redis and historical-week cleanup is synchronous with
  an idempotent three-retry Hatchet fallback.
- **UI:** `frontend-manage` ended-quiz action and destructive confirmation with
  stable `data-cy` selectors and de/en copy.
- **Evidence:** real PostgreSQL/Redis GraphQL tests, targeted Playwright,
  delegated-login browser screenshots in both locales and a narrow viewport,
  typecheck/lint/format/static analysis, and affected production builds.
- **Fixtures:** focused GraphQL synthetic fixtures and Playwright workflow
  tasks; no real participant or response data.

## Slices

1. Durable Prisma reward ledger.
2. Ledgered reward application on regular quiz end.
3. Reset summary and exact legacy reconstruction.
4. Atomic reward reversal and execution-state reset.
5. GraphQL API, audit, and retrying derived-data cleanup.
6. Manage-frontend reset UX.
7. E2E and browser verification.
8. Wiki updates and final verification.

## Source Documents

- Design: `docs/superpowers/specs/2026-07-30-regular-live-quiz-reset-design.md`
- Implementation plan:
  `docs/superpowers/plans/2026-07-30-regular-live-quiz-reset.md`

## Progress

- 2026-07-30: Design approved and implementation plan self-reviewed.
- 2026-07-30: Approach 1 selected; Task 1 started with an implementation agent.
- 2026-07-30: Task 1 completed in `c238ee723`; the real migration,
  generated client, analytics mirror, and repository checks passed. Independent
  specification and data-model reviews both passed with no blocking findings.
- 2026-07-30: Task 2 completed in `8fea83955`, `b9b2a968f`, and
  `fd938b218`. The 21-case real Postgres/Redis/Hatchet suite, GraphQL
  check/build, and full repository checks passed. Independent specification and
  reliability reviews passed after transaction, race, cache-snapshot,
  validation, and batching hardening.
- 2026-07-30: Task 3 completed in `4fc2417ba`, `7865a058d`, `41c12fe48`,
  and `e956ec75b`. Final serialized suites passed with 46 reward and 14 reset
  summary cases. Independent specification and quality reviews passed after
  responder-set, leaderboard-placement, timeline, response-count, cache-value,
  rank-dependency, and ledger-coherence corrections.
