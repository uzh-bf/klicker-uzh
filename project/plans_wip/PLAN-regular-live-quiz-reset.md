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
- **Evidence:** real PostgreSQL/Redis GraphQL tests, the full serial Live Quiz
  Playwright workflow, delegated-login browser screenshots in both locales and
  a narrow viewport, typecheck/lint/format/static analysis, and affected
  production builds.
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
- 2026-07-30: Task 4 completed in `465bd1d9b`, `645aadcba`, `10db68c49`,
  and `9b2f298e4`. The atomic reset, reward reversal, legacy reconstruction,
  assessment compatibility, concurrency, and underflow suites passed against
  real PostgreSQL/Redis/Hatchet services. Independent specification and
  quality reviews passed after aligning the standard `FORBIDDEN` error contract
  and covering the implicit-owner activity metadata fallback.
- 2026-07-30: Task 5 completed in `fc17871d9`, `2b7fa9be0`, and
  `002e79473`. The canonical GraphQL API, privacy-safe audit delivery,
  historical-week retry, generation-fenced Redis cleanup, and fail-closed
  manual/scheduled start initialization passed 55 real integration cases.
  Independent specification and quality reviews passed after adding reset-time
  realm/generation fencing and serializing concurrent starts with a database
  row lock.
- 2026-07-30: Task 6 completed in `94e0f817b` and `c93cc89af`. The
  manage frontend now exposes ended regular Live Quiz reset only to owners and
  administrators, uses the canonical reset summary and mutation, requires
  explicit run-data and reward confirmations, and keeps structured failures
  actionable in the modal. English/German copy, Prettier, the
  `frontend-manage` typecheck and production build, and full repository checks
  passed. Independent specification and quality reviews passed after separating
  a successful reset from a later optional refresh failure.
- 2026-07-30: Task 7 completed in `d59898ed3` and `36a4a9cdc`. The
  serial Live Quiz workflow covers owner and administrator visibility,
  non-admin and non-ended-state exclusion, successful same-ID/PIN reset,
  explicit confirmation, deterministic `INVALID_STATE`, and legacy gamified
  rejection. Prettier, Playwright typechecking, 84-test discovery, and
  independent specification and quality reviews passed. Delegated-login
  browser verification passed in English, German, and a 390-by-844 viewport,
  including a successful ended-to-draft reset. A full serial container run
  passed its setup and first 13 legacy scenarios, then stopped before the new
  reset cases on the older student-answer assertion that an initially empty
  answer must disable the submit button; the current UI rendered it enabled.
- 2026-07-30: Task 8 documentation updated the domain, GraphQL, async-worker,
  testing, Playwright-skill, and engineering-log guidance. The optional external
  wiki validator was unavailable, while Prettier and `git diff --check` passed.
  Independent documentation review passed after clarifying regular versus
  assessment authorization and nullable summary-query denial behavior.
