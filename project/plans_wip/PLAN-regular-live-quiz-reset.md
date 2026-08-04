# Regular Live Quiz Reset

## Goal

Allow an activity owner or activity administrator to reset an ended regular
Live Quiz to a reusable draft while deleting only data that belongs to the
completed run.

## Data boundary

- Delete responses, aggregate and anonymous results, feedback, confusion
  feedback, quiz-linked persistent `SESSION` leaderboard entries, temporary
  leaderboard entries, and stale execution cache.
- Reset block lifecycle state, clear execution timestamps, and increment each
  block's execution counter.
- Preserve the Live Quiz ID, PIN, definition, course assignment, sharing, and
  permissions.
- Never read, recalculate, update, or delete `COURSE` leaderboard entries,
  participant XP, timeline entries, achievements, awards, participations, or
  cumulative performance records.
- Keep assessment reset separate with its existing course-owner/course-admin
  policy.

## Design

- **Authorization:** full lecturer access plus activity `ADMIN`; the activity
  owner and derived activity `ADMIN`/`OWNER` users qualify.
- **Transaction:** lock the quiz row, revalidate authorization and the ended
  regular-quiz lifecycle, delete run data, and return the same activity as a
  draft.
- **API:** the summary reports response, feedback, confusion-feedback, and
  per-quiz leaderboard counts plus eligibility/reason. The mutation returns
  `SUCCESS` or `INVALID_STATE`.
- **Async:** generation-fenced Redis cleanup runs after commit, with an
  idempotent three-retry Hatchet fallback whose payload carries only quiz
  identity, Redis realm, and generation.
- **UI:** the manage frontend exposes the action for ended regular quizzes and
  explicitly states that cumulative rewards remain unchanged.
- **Evidence:** real PostgreSQL/Redis GraphQL tests, the complete serial Live
  Quiz Playwright workflow, delegated-login browser screenshots, typechecks,
  builds, formatting, linting, and static analysis.

## Slices

1. Rewrite fixtures and integration tests around cumulative-reward
   preservation.
2. Simplify the reset service, API, audit envelope, and cache cleanup.
3. Remove the reward ledger and restore the ordinary Live Quiz end flow.
4. Simplify GraphQL operations, manage UI, i18n, and Playwright coverage.
5. Align the engineering wiki and progress documents.
6. Run full verification, capture browser evidence, and update draft PR #5258.

## Source documents

- Approved design:
  `docs/superpowers/specs/2026-07-30-regular-live-quiz-reset-design.md`
- Current implementation plan:
  `docs/superpowers/plans/2026-08-04-regular-live-quiz-reset-preserve-rewards.md`

## Progress

- 2026-07-30: The original reward-reversal implementation was completed but
  was later superseded.
- 2026-08-04: Supervisor-approved redesign established that cumulative rewards
  are permanent and that reset deletes only per-run quiz data and per-quiz
  leaderboards. The redesign removes the reward ledger, reward reconstruction,
  reversal, and weekly-recomputation paths.
- 2026-08-04: Backend, API, UI, integration, and browser-test changes were
  aligned with the new boundary. Final whole-branch verification, browser
  evidence, and draft PR updates remain.
