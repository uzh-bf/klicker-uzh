# Gamification Streaks Implementation Plan

## Context

KlickerUZH has an existing gamification system with XP, points, levels, achievements, and leaderboards. Students earn XP (10 per perfect answer) and points (with multiplier support) for responding to questions in practice quizzes, micro-learnings, live quizzes, and group activities. Daily activity is already tracked via `TimelineEntry` records (upserted by `upsertDailyTimelineEntry()`).

**Problem**: There is no mechanism to reward consistent daily engagement across a semester. Students who cram before exams get the same treatment as those who practice daily.

**Goal**: Introduce daily activity streaks per course to motivate regular learning. A streak increments when a student performs enough question responses on a given day (meets a configurable threshold). Streaks unlock benefits: XP multipliers (simple step function, e.g. 1.5x after 14 days) and streak freezes (earned at streak milestones, e.g. at 7, 14, 21, 28 day streaks). The streak state is computed incrementally and independently of response details.

### Design Decisions

- **Action scope**: Question responses only (practice quiz, micro-learning, live quiz). Group activities excluded.
- **Freeze earning**: Milestone-based (e.g., 1 freeze at 7-day streak, another at 14, 21, 28). Configured per course.
- **XP multiplier**: Simple step function — 1.0x below threshold, configured multiplier at/above threshold.
- **Frontend scope**: Backend + minimal UI (streak display on student course page).

## Anti-Cheating Measures

### Threat model

Students could try to game the streak system by:

1. **Spamming wrong answers** to 3 questions quickly (minimum-effort threshold met)
2. **Answering the same question repeatedly** on the same day
3. **Botting responses** via automated scripts

### Defenses

1. **Distinct element instances only**: `updateStreakOnAction` receives an `elementInstanceId` parameter. The function tracks which element instances have already been counted today (using a `Set` stored in a new `streakDailyCountedInstances` JSON field on `Participation`). Answering the same question twice in a day only counts as one action toward the threshold.

2. **Minimum correctness requirement**: Only responses where the student got at least partial credit (`pointsPercentage > 0` or `correctness !== WRONG`) count toward the streak. Purely wrong answers are ignored. This is enforced at the call site — `updateStreakOnAction` is only called when the response has some correctness.

3. **Existing rate limiting**: The system already enforces `XP_AWARD_TIMEFRAME_DAYS = 1` (one XP award per question per day) and `POINTS_AWARD_TIMEFRAME_DAYS = 6`, so repeated responses to the same question yield diminishing returns. Combined with the distinct-instance check, this makes rapid-fire gaming ineffective.

4. **Configurable threshold**: Lecturers can set `streakDailyActionThreshold` to a value that requires meaningful engagement (default 3, adjustable per course). Setting it to 5+ makes it harder to game.

### What we deliberately don't do

- No captchas or behavioral analysis (would hurt UX for legitimate students)
- No minimum time-per-question requirement (could penalize fast learners)
- No IP/device fingerprinting (privacy concerns, overkill for a learning platform)

The philosophy: make casual cheating unrewarding (you still need to find and answer 3+ distinct questions with at least partial correctness) while keeping the system frictionless for legitimate users. A determined cheater could still game it, but the reward (maintaining a streak) is self-motivating, not grade-affecting.

## Streak Reset for Inactive Students

### The problem with lazy-only evaluation

If we only check streaks when a student takes an action, then a student who stops interacting entirely still shows their last streak in the database and UI. This is misleading for dashboards, leaderboards, and analytics.

### Solution: Two-layer approach

1. **Lazy evaluation on action (primary)**: The `updateStreakOnAction` function handles all state transitions when a student interacts. This is the authoritative state machine.

2. **GraphQL computed field (display correctness)**: When serving streak data via GraphQL, the `streakCurrentLength` resolver checks `streakLastActiveDate` against today. If the date gap is too large (and no freeze would cover it), the resolver returns `0` instead of the DB value. This ensures the UI always shows the correct streak without needing a cronjob.

3. **Daily cleanup cronjob (DB cleanliness)**: Extend the existing `handleUpdateWeeklyTimelineEntries` Hatchet cronjob to also reset streaks for participations where `streakLastActiveDate` is stale (more than 2 days old with no freezes, or more than 3 days old regardless). This keeps the DB honest for analytics queries that read directly from the DB. The cronjob is non-critical — the system works correctly without it due to lazy evaluation + computed GraphQL fields.

### Why not cronjob-only?

A cronjob runs once per day. Between runs, stale data would be served. The computed GraphQL field provides real-time accuracy. The cronjob only ensures DB values are clean for direct queries and analytics.

## Step 1: Prisma Schema Changes

### `packages/prisma/src/prisma/schema/participant.prisma` — Add fields to `Participation`

```prisma
// streak state — updated incrementally on each qualifying action
streakDailyActionCount      Int       @default(0)    // qualifying actions taken today
streakDailyThresholdMet     Boolean   @default(false) // true once daily threshold met
streakDailyCountedInstances Json      @default("[]")  // JSON array of elementInstanceIds counted today
streakCurrentLength         Int       @default(0)    // current consecutive-day streak
streakLongestLength         Int       @default(0)    // all-time longest streak
streakLastActiveDate        DateTime? @db.Date        // last date threshold was met
streakFreezeCount           Int       @default(0)    // available streak freeze credits
```

**Note**: `streakDailyCountedInstances` is a JSON array of `elementInstanceId` integers. It resets daily (when `streakLastActiveDate` changes). This prevents the same question from counting multiple times. A JSON field is simpler than a separate table for a daily-reset set.

### `packages/prisma/src/prisma/schema/course.prisma` — Add fields to `Course`

```prisma
// streak configuration (active when isGamificationEnabled is true)
streakDailyActionThreshold Int   @default(3)             // actions per day to qualify
streakXpMultiplierDays     Int   @default(14)            // streak length to unlock XP multiplier
streakXpMultiplier         Float @default(1.5)           // XP multiplier value
streakFreezeMilestones     Int[] @default([7,14,21,28])  // streak lengths that grant a freeze
streakFreezeMaxCount       Int   @default(3)             // max freeze credits
```

### Migration file: `packages/prisma/src/prisma/schema/migrations/20260210120000_gamification_streaks/migration.sql`

All fields have defaults — zero-downtime migration, existing data unaffected.

## Step 2: Core Streak Logic

### `packages/graphql/src/services/participants.ts` — `updateStreakOnAction()` and `getStreakXpMultiplier()`

**`updateStreakOnAction(prisma, participationId, courseId, elementInstanceId)`**:

Called inside the same Prisma transaction as XP/points awards. Takes `elementInstanceId` for deduplication.

Algorithm:

1. Read participation streak state + course streak config.
2. Skip if gamification not enabled.
3. **Deduplicate**: Parse `streakDailyCountedInstances`. If `elementInstanceId` is already in the set for today, return early (no-op) — same question doesn't count twice.
4. Compare `streakLastActiveDate` to today:
   - **Same day**: Add `elementInstanceId` to the set. Increment `streakDailyActionCount`. If threshold now met (first time today), increment `streakCurrentLength`, update `streakLongestLength`, check for freeze milestone awards.
   - **Yesterday**: Clear the instance set, start fresh with this `elementInstanceId`. Reset daily counters. Keep streak. Set `streakLastActiveDate = today`.
   - **2 days ago + freeze available**: Consume 1 freeze. Clear instance set, start fresh. Keep streak. Set `streakLastActiveDate = today`.
   - **Older / no freeze**: Reset `streakCurrentLength = 0`. Clear instance set, start fresh. Set `streakLastActiveDate = today`.
5. Write updated state back to `Participation` in single `update` call.
6. Return `{ streakCurrentLength, thresholdJustMet, xpMultiplier }`.

**`getStreakXpMultiplier(streakLength, thresholdDays, multiplier)`** — pure function:

- Returns `multiplier` (e.g. 1.5) if `streakLength >= thresholdDays`
- Returns `1` otherwise

**`computeDisplayStreakLength(streakCurrentLength, streakLastActiveDate, streakFreezeCount)`** — pure helper for GraphQL resolver:

- If `streakLastActiveDate` is today or yesterday, return `streakCurrentLength`
- If `streakLastActiveDate` is 2 days ago and `streakFreezeCount > 0`, return `streakCurrentLength` (freeze could cover it)
- Otherwise, return `0` (streak is effectively broken)

## Step 3: Hook Points (Question Response Flows)

### `packages/graphql/src/services/stacks.ts` — Practice quiz / micro-learning

In `respondToQuestion()` (inside the `$transaction`, after `computeAwardedPointsAndXP` and before `incrementParticipantXp`):

1. Only call `updateStreakOnAction` if the response has at least partial correctness (`pointsPercentage > 0` or if `pointsPercentage` is null, which means no sample solution exists — still counts as engagement)
2. Pass `elementInstanceId: id` for deduplication
3. Compute `multipliedXpAwarded = Math.round(xpAwarded * streakResult.xpMultiplier)`
4. Use `multipliedXpAwarded` for `incrementParticipantXp()` and `upsertDailyTimelineEntry()`
5. Keep original `xpAwarded` in response detail records (base value)

### `packages/graphql/src/services/liveQuizzes.ts` — Live quiz session end

In the `$transaction` at `deactivateLiveQuiz()`:

1. Extend `existingParticipants` type to include `participationId?: number`
2. Extract `participationId` from the existing `participations` join query
3. For each participant with XP: call `updateStreakOnAction`, apply multiplier to XP before `participant.update`
4. For live quizzes, pass `elementInstanceId: 0` as a sentinel (live quiz counts as one action per session, not per question — individual responses already happened in Redis)

### `packages/graphql/src/services/groups.ts` — NOT modified

Group activities award achievement-based XP, not per-response XP. "Question responses only" was chosen.

## Step 4: Daily Cleanup Cronjob

### Extend `handleUpdateWeeklyTimelineEntries` in `participants.ts`

Add a streak cleanup step at the end of the existing weekly timeline cronjob:

```typescript
// Reset streaks for participations where the student has been inactive too long
const staleDate = dayjs().subtract(2, 'days').toDate()
await globalCtx.prisma.participation.updateMany({
  where: {
    streakCurrentLength: { gt: 0 },
    streakLastActiveDate: { lt: staleDate },
    streakFreezeCount: 0,
  },
  data: {
    streakCurrentLength: 0,
    streakDailyActionCount: 0,
    streakDailyThresholdMet: false,
    streakDailyCountedInstances: '[]',
  },
})
// Also reset for those with freezes but more than 3 days inactive
const veryStaleDate = dayjs().subtract(3, 'days').toDate()
await globalCtx.prisma.participation.updateMany({
  where: {
    streakCurrentLength: { gt: 0 },
    streakLastActiveDate: { lt: veryStaleDate },
  },
  data: {
    streakCurrentLength: 0,
    streakDailyActionCount: 0,
    streakDailyThresholdMet: false,
    streakDailyCountedInstances: '[]',
  },
})
```

This is a safety net. The primary streak reset happens lazily in `updateStreakOnAction` and the display is corrected in the GraphQL computed field.

## Step 5: GraphQL Schema (Pothos)

### Participation type — Add fields

- `streakCurrentLength: Int!` — **computed** via `computeDisplayStreakLength()` to handle stale streaks
- `streakLongestLength: Int!` (from DB)
- `streakDailyActionCount: Int!` (from DB, reset check against date)
- `streakDailyThresholdMet: Boolean!` (from DB)
- `streakFreezeCount: Int!` (from DB)
- `streakXpMultiplierActive: Boolean!` (computed: `displayStreakLength >= course.streakXpMultiplierDays`)
- `streakXpMultiplier: Float!` (computed: returns current multiplier value)

### Course type — Add fields

- `streakDailyActionThreshold: Int!`
- `streakXpMultiplierDays: Int!`
- `streakXpMultiplier: Float!`
- `streakFreezeMilestones: [Int!]!`
- `streakFreezeMaxCount: Int!`

### GraphQL Operations

Update `.graphql` operation files in `packages/graphql/src/graphql/ops/` that query participation data to include streak fields.

## Step 6: Minimal Student PWA UI

### `apps/frontend-pwa/` — Course page streak display

Add a small streak indicator component to the student course page showing:

- Current streak length (with fire/flame icon)
- Freeze count remaining
- XP multiplier status (active/inactive, days until activation)
- Daily progress (X/Y actions today)

Use existing TailwindCSS patterns and `@uzh-bf/design-system` components.

## Step 7: Unit Tests

### `packages/graphql/src/services/__tests__/streaks.test.ts` (new file)

Test `updateStreakOnAction()` with mocked Prisma:

- First action of the day (below threshold)
- Action that meets threshold (streak increments)
- Same-day action after threshold already met (no extra increment)
- **Same element instance answered twice in same day** (deduplication — count stays at 1)
- Next-day action (streak continues, daily counters reset)
- Skipped 1 day with freeze (freeze consumed, streak preserved)
- Skipped 1 day without freeze (streak reset)
- Multiple days skipped (streak reset regardless of freezes)
- Freeze milestone unlocked (freeze count increments when streak hits milestone)
- XP multiplier activation (returns multiplier when streak >= threshold)
- **Wrong answer** (response with `pointsPercentage = 0` — should not count toward streak)

Test `getStreakXpMultiplier()`:

- Below threshold: returns 1.0
- At threshold: returns multiplier value
- Above threshold: returns multiplier value

Test `computeDisplayStreakLength()`:

- Active today: returns current length
- Active yesterday: returns current length
- 2 days ago with freeze: returns current length
- 2 days ago without freeze: returns 0
- 3+ days ago: returns 0

## Files to Modify

| File                                                                                             | Changes                                                                                                        |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `packages/prisma/src/prisma/schema/participant.prisma`                                           | Add 7 streak fields to `Participation`                                                                         |
| `packages/prisma/src/prisma/schema/course.prisma`                                                | Add 5 streak config fields to `Course`                                                                         |
| `packages/prisma/src/prisma/schema/migrations/20260210120000_gamification_streaks/migration.sql` | New migration                                                                                                  |
| `packages/graphql/src/services/participants.ts`                                                  | Add `updateStreakOnAction()`, `getStreakXpMultiplier()`, `computeDisplayStreakLength()`, extend weekly cronjob |
| `packages/graphql/src/services/stacks.ts`                                                        | Hook streak update + XP multiplier in `respondToQuestion()` with correctness check                             |
| `packages/graphql/src/services/liveQuizzes.ts`                                                   | Hook streak update + XP multiplier at session end                                                              |
| `packages/graphql/src/graphql/` (Pothos types)                                                   | Add streak fields to Participation and Course types                                                            |
| `packages/graphql/src/graphql/ops/`                                                              | Add streak fields to relevant operation files                                                                  |
| `apps/frontend-pwa/` (course page)                                                               | Minimal streak display component                                                                               |
| `packages/graphql/src/services/__tests__/streaks.test.ts`                                        | New test file for streak logic                                                                                 |

## Verification

1. `pnpm run check` — typecheck all packages
2. `pnpm run lint` — lint all packages
3. `pnpm run build` — build all packages
4. `pnpm --filter @klicker-uzh/graphql test` — run graphql package tests (requires HATCHET_CLIENT_TOKEN)
5. Run codegen: `pnpm --filter @klicker-uzh/graphql generate` after GraphQL schema changes
6. Verify migration applies cleanly against local DB if available

## Review Feedback (2026-02-10)

1. [P0] Streak state transitions currently allow streak preservation without meeting the daily threshold.
   Evidence: `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:75` defines `streakLastActiveDate` as “last date threshold was met”, but `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:111` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:113` sets it to today on first action in non-same-day paths.
   Impact: a student can keep a streak alive with one non-qualifying action per day.
   Recommendation: split semantics into two fields (`streakDailyDate` for daily counters, `streakLastQualifiedDate` for threshold-met days). Only advance streak/update qualified date when threshold is crossed.

2. [P1] Live quiz deduplication key design will suppress valid same-day live-quiz activity.
   Evidence: dedupe is based on counted `elementInstanceId` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:30`), and live quiz proposes sentinel `elementInstanceId: 0` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:147`).
   Impact: after the first live quiz action on a day, later live quiz sessions that day won’t count.
   Recommendation: use namespaced action keys (e.g. `q:<instanceId>`, `lq:<quizId>:<executionOrFinishDate>`) instead of a single numeric sentinel.

3. [P1] XP accounting will become internally inconsistent if only participant XP/timeline are multiplied.
   Evidence: concept explicitly keeps base `xpAwarded` in detail records (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:136` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:139`). Current code persists awarded XP in response aggregates and details (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/stacks.ts:2396`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/stacks.ts:2459`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/stacks.ts:2505`) and past timeline recomputation sums detail XP (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/scripts/2025-02-18_compute_past_timeline_entries.ts:80`).
   Impact: participant XP, timeline XP, and response-level XP histories diverge.
   Recommendation: persist multiplied XP as the awarded value everywhere, or introduce explicit dual fields (`baseXpAwarded`, `finalXpAwarded`) and update readers accordingly.

4. [P1] Live quiz multiplier plan risks multiplying achievement XP, not only activity XP.
   Evidence: concept says to apply multiplier at live quiz end (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:146` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:147`). Current flow mutates `participant.xp` with rank achievements before persistence (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts:1778` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts:1793`) and then writes that total (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts:1805` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts:1810`).
   Impact: achievement rewards get unintentionally amplified.
   Recommendation: split live-quiz XP into `activityXp` and `achievementXp`; apply streak multiplier only to `activityXp`.

5. [P2] “Configurable per course” is underspecified in implementation steps.
   Evidence: concept introduces course config fields (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:84` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:90`), but current course settings mutation does not include them (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/schema/mutation.ts:1352` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/schema/mutation.ts:1371`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/graphql/ops/MUpdateCourseSettings.graphql:1`).
   Impact: values remain effectively hardcoded defaults.
   Recommendation: add streak fields to create/update course inputs, corresponding ops, and lecturer-side settings UI.

6. [P2] JSON set update strategy is race-prone under concurrent responses.
   Evidence: proposed design keeps a mutable per-day set in `Participation` JSON (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:30`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:72`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:106` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:115`).
   Impact: double-counts or dropped increments are possible with parallel submissions/retries.
   Recommendation: enforce row-level lock/serializable retry on streak row updates, or move dedupe to a keyed table with a uniqueness constraint.

7. [P2] Daily boundary/timezone behavior is not explicitly defined and likely inconsistent.
   Evidence: concept uses “today/yesterday” semantics (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:109` to `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:126`), cleanup dates are relative wall-clock (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:161`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:176`), and existing timeline cron is UTC midnight (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/hatchet/src/index.ts:264`) while daily upserts use raw `new Date()` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/participants.ts:890`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/participants.ts:896`).
   Impact: off-by-one-day streak behavior near midnight/timezone boundaries.
   Recommendation: define one canonical timezone for streak logic (UTC or course timezone) and normalize all day comparisons to start-of-day in that timezone.

8. [P2] Cron pseudocode assigns a JSON string instead of a JSON array.
   Evidence: cleanup sets `streakDailyCountedInstances: '[]'` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:172`, `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:186`).
   Impact: value may be stored as JSON string rather than array, breaking dedupe parsing.
   Recommendation: write `[]` (JSON array), not `'[]'` (string literal).

9. [P3] Test plan should align with existing package conventions and cover integration edges.
   Evidence: proposed path is `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:232`, while current GraphQL tests are primarily in `/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/test/*.test.ts`.
   Impact: lower maintainability and possible missed integration regressions.
   Recommendation: add service-level unit tests plus integration tests around `respondToQuestion` and `endLiveQuiz`, and include day-boundary/freeze-consumption cases.

10. [P3] Hook-point naming is outdated for live quiz finalization.
    Evidence: concept references `deactivateLiveQuiz()` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/GAMIFICATION_STREAKS.md:142`), while current flow uses `endLiveQuiz` (`/Users/rolandschlaefli/.codex/worktrees/7759/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts:1637`).
    Impact: implementation confusion and wrong integration target.
    Recommendation: update concept text to target `endLiveQuiz` transaction path explicitly.
