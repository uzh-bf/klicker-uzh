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
end dates, tolerate weekends and holidays without punishment, and survive
server restarts and concurrent submissions without corrupting state.

## Decision

Store the streak state directly on the existing `Participation` row as seven
additive columns (current, longest, freeze balance, qualified-days counter,
tracking-start timestamp, last qualified date, last processed date). No new
tables are introduced; the streak is derived from `QuestionResponseDetail`
rows that already exist for every tracked response, so no response-path write
changes are needed beyond a missing `await` fix on the flashcard detail write.

A pure state machine (`applyQualifiedDate`) advances the streak one qualified
day at a time: weekend dates are neutral, each missed active weekday consumes
one available freeze (initial balance two, maximum three), uncovered breaks
reset the current streak before it advances again, and every seventh further
qualified day earns one freeze below the maximum. A reconciliation service
(`reconcileStudyStreak`) applies all qualifying dates since tracking start
exactly once under a `FOR UPDATE` lock on the participation row inside a
separate fail-open transaction fired after the main response transaction has
committed. Any reconciliation error is logged and swallowed so a streak failure
never affects grading, XP, or leaderboard updates.

The streak is self-only: GraphQL exposes the four display fields through the
existing `Participation` type in the course-overview query, gated by active
participation, and the PWA renders them as a private card next to the
leaderboard. Joining the leaderboard starts tracking; leaving resets current,
today-qualified flag, and freeze-progress while preserving longest and freeze
balance; rejoining after a leave restarts tracking from zero without backfill.

## Consequences

- Streak state is denormalized but bounded (seven columns) and repairable by
  replaying qualifying dates, so crashes between response commit and streak
  update self-heal on the next submission.
- Fail-open means a streak can lag behind reality until the next qualifying
  response reconciles it; this is acceptable for motivational feedback.
- Because tracking begins at join (or rollout), historical responses never
  backfill a streak; students start fresh, matching the roadmap contract.
