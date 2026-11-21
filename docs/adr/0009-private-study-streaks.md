# 9. Private Study streaks on Participation

- **Status:** Accepted — 2026-08-23

## Context

Students asked for lightweight progress feedback that is visible only to them,
unlike course leaderboards which are an explicit opt-in. The approved
gamification roadmap therefore defines a private "Study streak": a count of
consecutive active weekdays (Europe/Zurich) on which a student completed at
least five eligible responses in PracticeQuiz or MicroLearning activities.
Live quizzes, content elements, and flashcards do not qualify because they are
either synchronous or non-evaluable. The streak must respect course start and
end dates, keep weekends neutral while treating holidays like ordinary
weekdays, and survive server restarts and concurrent submissions without
corrupting state.

## Decision

Store the streak state directly on the existing `Participation` row as seven
additive columns (current, longest, freeze balance, qualified-days counter,
tracking-start timestamp, last qualified date, last processed date). No new
tables are introduced; the streak is derived from `QuestionResponseDetail`
rows that already exist for every tracked response, so no response-path write
changes are needed beyond a missing `await` fix on the flashcard detail write.

A pure state machine (`applyQualifiedDate`) advances the streak one qualified
day at a time: weekend dates are neutral, the first missed active weekday in a
gap consumes one available freeze (initial balance two, maximum three), a
second consecutive missed weekday or a miss without a freeze resets the
current streak without consuming another freeze, and every seventh further
qualified day completes one freeze-earning cycle. The cycle resets even at the
maximum balance so students cannot bank a deferred refill. A reconciliation
service (`reconcileStudyStreak`) reads the existing response details through
Prisma, groups them by Zurich date, and applies all qualifying dates since
tracking start exactly once in a serializable transaction. The transaction is
separate from the main response transaction and retries serialization
conflicts. Any reconciliation error is logged and swallowed so a streak
failure never affects grading, XP, or leaderboard updates.

The streak is self-only: GraphQL exposes its display and daily-progress fields
through the existing `Participation` type, but every field resolver returns
null unless the authenticated participant owns that `Participation`. The PWA
renders the private card above the leaderboards. It shows exact remaining
progress on eligible weekdays and neutral copy when no daily goal applies.
Joining the leaderboard starts tracking; leaving resets current,
today-qualified flag, and freeze-progress while preserving longest and freeze
balance; rejoining after a leave restarts tracking from zero without backfill.

## Consequences

- Streak state is denormalized but bounded (seven columns) and repairable by
  replaying qualifying dates, so crashes between response commit and streak
  update self-heal on the next qualifying submission, course overview, or
  participation read.
- Fail-open means a streak can remain stale until the next qualifying response
  or streak-bearing read reconciles it; this is acceptable for motivational
  feedback.
- Because tracking begins at join (or rollout), historical responses never
  backfill a streak; students start fresh, matching the roadmap contract.
- The only off switch is an image rollback. All streak and receipt migrations
  are additive, so the previous image runs against the newer schema; per-course
  `isGamificationEnabled` hides streaks only together with leaderboards and
  points. No dedicated feature flag is added because the feature is additive
  and fail-open.
- The achievement-receipt migration backfills `receiptAcknowledgedAt` with the
  deploy timestamp for every existing instance. This is a one-way door: a
  backfilled value cannot be told apart from a genuine acknowledgement, so the
  column must not be read as student-generated activity. Nothing pre-existing
  is lost, because the column is new.
- Reversal path, should the feature be withdrawn: a compensating migration
  drops the seven `studyStreak*` columns on `Participation`, the
  `QuestionResponse_participationId_idx` and
  `QuestionResponseDetail_participationId_createdAt_idx` indexes,
  `Achievement.isDiscoverable`, and
  `ParticipantAchievementInstance.receiptAcknowledgedAt`. Only the feature's
  own state is lost.
