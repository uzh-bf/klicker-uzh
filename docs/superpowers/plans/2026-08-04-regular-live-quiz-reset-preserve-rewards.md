# Regular Live Quiz Reset: Preserve Cumulative Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the existing ended-regular-Live-Quiz reset so it deletes only per-run quiz data and per-quiz leaderboards while permanently preserving cumulative rewards.

**Architecture:** Keep the existing owner/admin action, row-locked reset transaction, activity mapper, cache-generation fencing, audit envelope, and UI flow. Remove the reward ledger and all rollback/reconstruction logic, restore the ordinary Live Quiz end flow, and make the reset transaction delete responses, feedback, aggregate results, `SESSION` leaderboard rows, and temporary leaderboard rows without reading or mutating cumulative reward models.

**Tech Stack:** TypeScript 6, Prisma 7/PostgreSQL, Pothos GraphQL, Redis/ioredis, Hatchet, React 19/Next.js 16, Apollo Client, Vitest, Playwright, next-intl.

## Global Constraints

- Only ended regular Live Quizzes are eligible for `resetLiveQuiz`.
- Only the activity owner or an activity `ADMIN`/`OWNER` may reset a regular quiz.
- The quiz ID, PIN, definition, course assignment, sharing, and permissions must remain unchanged.
- Delete `LiveQuizResponse`, feedback, confusion feedback, aggregate results, quiz-scoped `SESSION` leaderboard entries, temporary leaderboard entries, and stale execution cache.
- Never update or delete `COURSE` leaderboard entries, participant XP, timeline entries, achievements, awards, participations, or cumulative performance records.
- Preserve the existing assessment reset mutation and its course-owner/course-admin policy.
- Add no database tables, migrations, dependencies, or execution-versioning abstractions.
- Keep draft PR #5258 as draft and target `v3`.

---

### Task 1: Rewrite Reset Fixtures and Regression Tests Around Reward Preservation

**Files:**

- Modify: `packages/graphql/test/helpers.ts:912`
- Modify: `packages/graphql/test/liveQuizReset.test.ts:1`

**Interfaces:**

- Consumes: existing `seedCourse`, `seedLiveQuiz`, Prisma test context, and Redis test context.
- Produces: `seedEndedRegularLiveQuizForReset({ gamified, withCourse? }, ctx): Promise<LiveQuizResetFixture>` with no reward-run fields.
- Produces: integration coverage that snapshots cumulative rows before reset and requires byte-for-byte equality afterward.

- [ ] **Step 1: Remove reward-ledger concepts from the synthetic fixture**

Replace the fixture signature and result shape with:

```ts
export interface LiveQuizResetFixture {
  liveQuizId: string
  courseId: string | null
  participantId: string
  participationId: number | null
  achievementId: number | null
  instanceId: number
  timelineDate: Date
  awardedCoursePoints: number
  awardedParticipantXp: number
}

export interface LiveQuizResetFixtureOptions {
  gamified: boolean
  withCourse?: boolean
}
```

Change `seedEndedRegularLiveQuizForReset` to accept `LiveQuizResetFixtureOptions`, default `withCourse` to `gamified`, and return `Promise<LiveQuizResetFixture>`. Keep the existing synthetic quiz, participant, response, aggregate, feedback, confusion, `SESSION` leaderboard, `COURSE` leaderboard, timeline, and achievement creation. Delete the `withRewardRun` branch, `rewardRunId`, reward-run creation, `activeRewardRunId` update, and Redis reward seeding. The gamified course case must still have non-zero course points, participant XP, one timeline entry, one achievement instance, and one quiz-scoped `SESSION` leaderboard entry. Also seed a participant award so preservation is non-vacuous:

```ts
await ctx.prisma.awardEntry.create({
  data: {
    order: 999,
    type: 'PARTICIPANT',
    name: `synthetic-reset-award-${liveQuiz.id}`,
    displayName: 'Synthetic reset award',
    description: 'Synthetic cumulative reward',
    courseId: course!.id,
    participantId: participant.id,
  },
})
```

- [ ] **Step 2: Add an exact cumulative-reward snapshot helper**

Add inside `packages/graphql/test/liveQuizReset.test.ts`:

```ts
async function readCumulativeRewardSnapshot(fixture: LiveQuizResetFixture) {
  const [
    courseLeaderboard,
    participant,
    participation,
    timelineEntries,
    achievement,
    awards,
  ] = await Promise.all([
    fixture.courseId
      ? prisma.leaderboardEntry.findUnique({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              participantId: fixture.participantId,
              courseId: fixture.courseId,
            },
          },
        })
      : null,
    prisma.participant.findUniqueOrThrow({
      where: { id: fixture.participantId },
      include: { titles: true },
    }),
    fixture.participationId
      ? prisma.participation.findUniqueOrThrow({
          where: { id: fixture.participationId },
        })
      : null,
    fixture.participationId && fixture.courseId
      ? prisma.timelineEntry.findMany({
          where: {
            participationId: fixture.participationId,
            courseId: fixture.courseId,
          },
          orderBy: { id: 'asc' },
        })
      : [],
    fixture.achievementId
      ? prisma.participantAchievementInstance.findUnique({
          where: {
            participantId_achievementId: {
              participantId: fixture.participantId,
              achievementId: fixture.achievementId,
            },
          },
        })
      : null,
    prisma.awardEntry.findMany({
      where: { participantId: fixture.participantId },
      orderBy: { id: 'asc' },
    }),
  ])

  return {
    courseLeaderboard,
    participant,
    participation,
    timelineEntries,
    achievement,
    awards,
  }
}
```

- [ ] **Step 3: Replace reversal and reconstruction tests with the preservation contract**

Keep authorization, lifecycle, activity mapping, audit, cache, and clean-start cases. Delete cases whose only purpose is reward-run validation, legacy reconstruction, reward underflow, weekly recomputation, or `REWARD_DATA_UNAVAILABLE`.

Replace the main success case with:

```ts
it('deletes run data and preserves cumulative rewards exactly', async () => {
  const fixture = await seedEndedRegularLiveQuizForReset(
    { gamified: true },
    userOneCtx
  )
  await makeFixtureInstanceResettable(fixture.instanceId)
  await prisma.temporaryLeaderboardEntry.create({
    data: {
      id: uuidv4(),
      quizId: fixture.liveQuizId,
      username: 'Synthetic temporary participant',
      score: 3,
    },
  })
  const cumulativeBefore = await readCumulativeRewardSnapshot(fixture)

  await expect(
    resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
  ).resolves.toMatchObject({
    outcome: 'SUCCESS',
    activity: { id: fixture.liveQuizId, status: PublicationStatus.DRAFT },
  })

  expect(await readCumulativeRewardSnapshot(fixture)).toEqual(cumulativeBefore)
  await expect(
    prisma.liveQuizResponse.count({
      where: {
        instance: { elementBlock: { liveQuizId: fixture.liveQuizId } },
      },
    })
  ).resolves.toBe(0)
  await expect(
    prisma.leaderboardEntry.count({
      where: { liveQuizId: fixture.liveQuizId, type: 'SESSION' },
    })
  ).resolves.toBe(0)
  await expect(
    prisma.temporaryLeaderboardEntry.count({
      where: { quizId: fixture.liveQuizId },
    })
  ).resolves.toBe(0)
})
```

Change concurrent service and GraphQL expectations from one `SUCCESS` plus one `CONFLICT` to one `SUCCESS` plus one `INVALID_STATE`.

- [ ] **Step 4: Simplify summary and GraphQL expectations**

The eligible summary must be:

```ts
expect(summary).toEqual({
  eligible: true,
  reason: 'ELIGIBLE',
  numOfResponses: 1,
  numOfFeedbacks: 1,
  numOfConfusionFeedbacks: 1,
  numOfLeaderboardEntries: 1,
})
```

The canonical mutation exposes only `SUCCESS` and `INVALID_STATE`; assessment quizzes remain handled by `resetAssessmentLiveQuiz`.

- [ ] **Step 5: Run the focused suite and verify it fails against rollback behavior**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: FAIL because the current implementation reverses cumulative rewards and returns reward-specific fields.

- [ ] **Step 6: Commit the failing contract tests**

```bash
git add packages/graphql/test/helpers.ts packages/graphql/test/liveQuizReset.test.ts
git commit -m "test(live-quiz): preserve cumulative rewards on reset"
```

---

### Task 2: Simplify the Reset Service, API Types, Audit, and Cache Cleanup

**Files:**

- Modify: `packages/graphql/src/services/liveQuizResetSummary.ts`
- Modify: `packages/graphql/src/services/liveQuizResetTransaction.ts`
- Modify: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/src/services/liveQuizResetCleanup.ts`
- Modify: `packages/graphql/src/schema/liveQuiz.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/schema/query.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`

**Interfaces:**

- Produces: `LiveQuizResetOutcome = 'SUCCESS' | 'INVALID_STATE'`.
- Produces: `LiveQuizResetEligibilityReason = 'ELIGIBLE' | 'INVALID_STATE' | 'ASSESSMENT_POLICY'`.
- Produces: `CleanupLiveQuizResetCacheInput` without weekly timeline work.
- Preserves: `resetAssessmentLiveQuiz({ id }, ctx)` returning `ActivityInfo | null` under assessment authorization.

- [ ] **Step 1: Replace the reward-aware summary types and query**

Use:

```ts
export type LiveQuizResetOutcome = 'SUCCESS' | 'INVALID_STATE'

export type LiveQuizResetEligibilityReason =
  | 'ELIGIBLE'
  | 'INVALID_STATE'
  | 'ASSESSMENT_POLICY'

export interface LiveQuizResetSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
  eligible: boolean
  reason: LiveQuizResetEligibilityReason
}
```

Load only permissions, block instances/results/counts, feedback counts, and leaderboard counts. Calculate `numOfLeaderboardEntries` as the count of quiz-linked rows filtered to `type = SESSION` plus the quiz's `TemporaryLeaderboardEntry` count. Do not include reward runs, Redis reward hashes, timelines, or achievements. An assessment quiz returns counts with `eligible: false` and `reason: 'ASSESSMENT_POLICY'`; a missing or unauthorized quiz returns `null`.

- [ ] **Step 2: Make the regular transaction row-lock deterministic**

At the start of the transaction:

```ts
const lockedRows = await tx.$queryRaw<{ id: string }[]>`
  SELECT "id"
  FROM "LiveQuiz"
  WHERE "id" = ${id}::uuid
  FOR UPDATE
`
if (lockedRows.length === 0) {
  return { outcome: 'INVALID_STATE' as const, activity: null }
}
```

Rename `loadResettableQuiz` to `loadResettableRegularQuiz`, remove all reward-run includes, and retain only the activity permissions required for the internal authorization check. Return `INVALID_STATE` when the quiz is deleted, not `ENDED`, or an assessment. Keep the owner/activity-admin check and standard `FORBIDDEN` error.

Delete reward resolution, validation, reconstruction, reversal, totals, and conflict mapping. Return only:

```ts
export type ResetLiveQuizServiceResult =
  | { outcome: 'SUCCESS'; activity: LiveQuizActivityInfo }
  | { outcome: 'INVALID_STATE'; activity: null }
```

Use the row lock with a timeout and no serializable override, so the second reset waits and observes `DRAFT`:

```ts
return ctx.prisma.$transaction(
  async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "LiveQuiz" WHERE "id" = ${id}::uuid FOR UPDATE
    `
    if (lockedRows.length === 0) {
      return { outcome: 'INVALID_STATE', activity: null }
    }
    const quiz = await loadResettableRegularQuiz({
      id,
      userId: ctx.user.sub,
      tx,
    })
    if (
      !quiz ||
      quiz.isDeleted ||
      quiz.isAssessmentEnabled ||
      quiz.status !== DB.PublicationStatus.ENDED
    ) {
      return { outcome: 'INVALID_STATE', activity: null }
    }
    const activity = await resetLiveQuizExecutionState({
      liveQuizId: id,
      userId: ctx.user.sub,
      tx,
    })
    return {
      outcome: 'SUCCESS',
      activity: formatResetActivityInfo(activity),
    }
  },
  { timeout: 60_000 }
)
```

- [ ] **Step 3: Restrict leaderboard deletion and remove reward-run state writes**

The quiz update must not mention `activeRewardRunId`. Use:

```ts
const updatedQuiz = await tx.liveQuiz.update({
  where: { id: liveQuizId },
  data: {
    feedbacks: { deleteMany: {} },
    confusionFeedbacks: { deleteMany: {} },
    leaderboard: {
      deleteMany: { type: DB.LeaderboardType.SESSION },
    },
    temporaryLeaderboard: { deleteMany: {} },
  },
  include: resetActivityInfoInclude(userId),
})
```

Retain response deletion, result initialization, block reset/execution increment, quiz timestamp clearing, ID/PIN preservation, and activity formatting.

- [ ] **Step 4: Simplify audit events and cleanup input**

The completion event contains no reward values:

```ts
type LiveQuizResetAuditDetails =
  | {
      event: 'LIVE_QUIZ_RESET_INITIATED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 1
    }
  | {
      event: 'LIVE_QUIZ_RESET_COMPLETED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      outcome: 'SUCCESS'
    }
  | {
      event: 'LIVE_QUIZ_RESET_BLOCKED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      outcome: 'INVALID_STATE'
    }
  | {
      event: 'LIVE_QUIZ_RESET_FAILED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      failureCode: 'UNEXPECTED_RESET_FAILURE'
    }
```

Change the Hatchet input to:

```ts
export type CleanupLiveQuizResetCacheInput = {
  liveQuizId: string
  isAssessmentEnabled: boolean
  cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
}
```

Remove every `weeklyTimelineRecomputations` map/loop and `recomputeWeeklyTimelineEntry` import. Retain generation-fenced clearing, unavailable-snapshot recovery, fallback scheduling, and entity invalidation.

- [ ] **Step 5: Restore assessment compatibility separately from the regular entry point**

Restore the `origin/v3` implementation of `resetAssessmentLiveQuiz` in `packages/graphql/src/services/liveQuizzes.ts` and delete the assessment façade from `liveQuizReset.ts`. In `schema/mutation.ts`, route `resetAssessmentLiveQuiz` back to `LiveQuizService.resetAssessmentLiveQuiz`; retain its activity `ADMIN` wrapper and its internal assessment-course `OWNER`/`ADMIN` filter.

Keep the current regular `resetLiveQuiz` resolver wrapper unchanged. It continues to call `LiveQuizResetService.resetLiveQuiz` and apply activity `ADMIN` permission before the service's authoritative regular-only validation.

- [ ] **Step 6: Simplify Pothos enums and fields**

Use:

```ts
export const ResetLiveQuizOutcome = builder.enumType('ResetLiveQuizOutcome', {
  values: ['SUCCESS', 'INVALID_STATE'] as const,
})

export const LiveQuizResetEligibilityReason = builder.enumType(
  'LiveQuizResetEligibilityReason',
  { values: ['ELIGIBLE', 'INVALID_STATE', 'ASSESSMENT_POLICY'] as const }
)
```

Expose only the four counts, `eligible`, and `reason`. Delete `LiveQuizLegacyReconstructionStatus` and every reward-summary field.

- [ ] **Step 7: Run the reset suite and package checks**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/types check
devrouter exec . -- pnpm --filter @klicker-uzh/hatchet check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
```

Expected: all pass, including exact cumulative snapshot preservation.

- [ ] **Step 8: Commit the simplified reset core**

```bash
git add packages/graphql/src/services/liveQuizResetSummary.ts packages/graphql/src/services/liveQuizResetTransaction.ts packages/graphql/src/services/liveQuizReset.ts packages/graphql/src/services/liveQuizResetCleanup.ts packages/graphql/src/schema/liveQuiz.ts packages/graphql/src/schema/mutation.ts packages/graphql/src/schema/query.ts packages/types/src/hatchet.ts packages/graphql/test/liveQuizReset.test.ts
git commit -m "refactor(live-quiz): preserve rewards during reset"
```

---

### Task 3: Remove the Reward Ledger and Restore the Ordinary End Flow

**Files:**

- Modify: `packages/prisma/src/prisma/schema/{course,gamification,participant,quiz,user}.prisma`
- Modify: `apps/analytics/prisma/schema/{course,gamification,participant,quiz,user}.prisma`
- Delete: `packages/prisma/src/prisma/schema/migrations/20260730120000_regular_live_quiz_reward_ledger/migration.sql`
- Delete: `packages/graphql/src/services/liveQuizRewardCalculation.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardLedger.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardLegacy.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardState.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardTypes.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardUtils.ts`
- Delete: `packages/graphql/src/services/liveQuizRewardValidation.ts`
- Delete: `packages/graphql/src/services/liveQuizRewards.ts`
- Delete: `packages/graphql/test/liveQuizRewards.test.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/services/participants.ts`
- Modify: `packages/graphql/src/index.ts`
- Modify: `packages/graphql/test/helpers.ts`

**Interfaces:**

- Preserves: existing `endLiveQuiz({ id }, ctx)` reward behavior from `origin/v3`.
- Removes: every reward-run, active reward pointer, reconstruction, and reversal symbol.
- Retains: serialized cache initialization and `formatLiveQuizActivityInfo` changes.

- [ ] **Step 1: Remove schema additions and the unmerged migration**

Delete `LiveQuizRewardRunStatus`, both reward models, `LiveQuiz.activeRewardRun`, `activeRewardRunId`, `rewardRuns`, and added reverse relations on `Course`, `Achievement`, `Participant`, `Participation`, and `User` from both schema trees. Restore surrounding relation-list formatting to `origin/v3`.

Delete the migration instead of adding a down migration because it has not landed on `v3`.

- [ ] **Step 2: Generate Prisma and prove schema synchronization**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/prisma generate
devrouter exec . -- bash ./util/check-prisma-sync.sh
```

Expected: generation succeeds and the sync check reports `Prisma schemas are in sync.`

- [ ] **Step 3: Delete reward services/tests and ledger-only helpers**

Delete the eight reward service files and `liveQuizRewards.test.ts`. Remove their imports/exports from `index.ts`, reset services, tests, and helpers.

Remove from `participants.ts`:

```ts
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
export function getTimelineWeekBounds(date: Date): {
  weekStart: Date
  weekEnd: Date
}
```

- [ ] **Step 4: Restore regular quiz ending without undoing cache safety**

Use the `origin/v3` `endLiveQuiz` reward-awarding and `ENDED` transition body as the exact source:

```bash
git show origin/v3:packages/graphql/src/services/liveQuizzes.ts
```

Remove `LiveQuizForEnding`, `loadRegularLiveQuizRewardParticipants`, `endRegularLiveQuiz`, and `liveQuizRewards.js` imports. Restore the common standard/assessment end path, including its existing leaderboard, XP, timeline, achievement, temporary-zero-entry cleanup, notification, and status-update behavior.

Do not restore the whole file. Retain `claimAndStartLiveQuiz`, `initializeLiveQuizExecutionCache`, serialized scheduled/manual starts, `formatLiveQuizActivityInfo`, and the restored original assessment reset implementation from Task 2.

- [ ] **Step 5: Re-run preservation and build checks**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/prisma check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
```

Expected: all pass.

- [ ] **Step 6: Scan for executable/schema ledger remnants**

```bash
rg -n "LiveQuizReward|activeRewardRun|REWARD_DATA_UNAVAILABLE|legacyReconstruction|coursePointsToReverse|xpToReverse|weeklyTimelineRecomput" packages apps/analytics
```

Expected: no Prisma or executable TypeScript matches; generated GraphQL artifacts are updated in Task 4.

- [ ] **Step 7: Commit the schema/end-flow simplification**

```bash
git add packages/prisma/src/prisma/schema apps/analytics/prisma/schema packages/graphql/src/services packages/graphql/src/index.ts packages/graphql/test packages/types/src packages/hatchet/src
git commit -m "refactor(live-quiz): remove reset reward ledger"
```

---

### Task 4: Update GraphQL Operations, Manage UI, Copy, and Playwright

**Files:**

- Modify: `packages/graphql/src/graphql/ops/QGetLiveQuizResetSummary.graphql`
- Regenerate: `packages/graphql/src/ops.ts`
- Regenerate: `packages/graphql/src/ops.schema.json`
- Regenerate: `packages/graphql/src/public/{schema.graphql,client.json,server.json}`
- Restore assessment behavior: `apps/frontend-manage/src/components/courses/modals/LiveQuizResetModal.tsx`
- Create: `apps/frontend-manage/src/components/courses/modals/RegularLiveQuizResetModal.tsx`
- Modify: `apps/frontend-manage/src/components/activities/overview/LiveQuizActions.tsx`
- Retain: `apps/frontend-manage/src/components/courses/modals/ActivityConfirmationModal.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Modify: `playwright/tests/O-live-quiz.spec.ts`
- Modify: `playwright/util/workflow.ts`

**Interfaces:**

- Produces: regular summary query with four counts, eligibility, and reason.
- Produces: one regular destructive acknowledgment `confirm-reset-run-data`.
- Preserves: assessment modal using `GetLiveQuizSummaryDocument` and `ResetAssessmentLiveQuizDocument`.

- [ ] **Step 1: Reduce the regular summary operation**

```graphql
query GetLiveQuizResetSummary($quizId: String!) {
  getLiveQuizResetSummary(quizId: $quizId) {
    numOfResponses
    numOfFeedbacks
    numOfConfusionFeedbacks
    numOfLeaderboardEntries
    eligible
    reason
  }
}
```

Keep `MResetLiveQuiz.graphql` unchanged because it already selects only `outcome` and `activity`.

- [ ] **Step 2: Preserve assessment UI and split out regular UI**

Restore `LiveQuizResetModal.tsx` to the assessment behavior using `GetLiveQuizSummaryDocument` and `ResetAssessmentLiveQuizDocument`.

Create `RegularLiveQuizResetModal.tsx` with:

```ts
const [confirmations, setConfirmations] = useState({ deleteRunData: false })
const [outcome, setOutcome] = useState<ResetLiveQuizOutcome | null>(null)
```

and one confirmation:

```tsx
<ConfirmationItem
  label={t('manage.liveQuizzes.resetRegularRunData', {
    responses: summary.numOfResponses,
    feedbacks: summary.numOfFeedbacks,
    confusion: summary.numOfConfusionFeedbacks,
    leaderboard: summary.numOfLeaderboardEntries,
  })}
  onClick={() => setConfirmations({ deleteRunData: true })}
  confirmed={confirmations.deleteRunData}
  confirmationType="delete"
  data={{ cy: 'confirm-reset-run-data' }}
/>
```

Show preserved-reward copy below it. Close only after `SUCCESS`, update `GetSingleCourseDocument`, and leave the modal open for `INVALID_STATE` or network failure.

- [ ] **Step 3: Route assessment and regular actions correctly**

In `LiveQuizActions.tsx` render the assessment modal for assessment quizzes and `RegularLiveQuizResetModal` otherwise:

```tsx
{
  resetModal && liveQuiz.isAssessmentEnabled ? (
    <LiveQuizResetModal
      quizId={liveQuiz.id}
      courseId={liveQuiz.courseId}
      isGamificationEnabled={liveQuiz.isGamificationEnabled}
      onClose={() => setResetModal(false)}
      onSuccess={async () => refetchActivities?.()}
    />
  ) : null
}
{
  resetModal && !liveQuiz.isAssessmentEnabled ? (
    <RegularLiveQuizResetModal
      quizId={liveQuiz.id}
      courseId={liveQuiz.courseId}
      onClose={() => setResetModal(false)}
      onSuccess={async () => refetchActivities?.()}
    />
  ) : null
}
```

- [ ] **Step 4: Replace reward-reversal copy in both locales**

Add the following English copy:

```ts
resetRegularLiveQuizMessage:
  'The same live quiz will return to draft. Its responses, results, feedback, and session leaderboard will be permanently deleted.',
resetRegularRunData:
  '{responses} responses, {feedbacks} feedback entries, {confusion} confusion entries, and {leaderboard} session leaderboard entries will be deleted.',
resetPreservedRewards:
  'Previously awarded course points, XP, timeline rewards, achievements, and awards remain unchanged.',
```

Add the following German copy:

```ts
resetRegularLiveQuizMessage:
  'Dasselbe Live Quiz wird in den Entwurfsstatus zurückgesetzt. Seine Antworten, Resultate, Rückmeldungen und die Sitzungsrangliste werden dauerhaft gelöscht.',
resetRegularRunData:
  '{responses} Antworten, {feedbacks} Q&A-Rückmeldungen, {confusion} Verwirrungsrückmeldungen und {leaderboard} Einträge der Sitzungsrangliste werden gelöscht.',
resetPreservedRewards:
  'Bereits vergebene Kurspunkte, XP, Zeitleistenbelohnungen, Achievements und Auszeichnungen bleiben unverändert.',
```

Remove `resetRewards`, `noRewardsToReset`, `resetBlockedRewardData`, and `resetConflict`. Retain `resetInvalidState` and the generic error. Restore `resetLiveQuizMessage` to assessment wording.

- [ ] **Step 5: Regenerate GraphQL artifacts**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql generate
```

Expected: all generated artifacts update; enums contain only `SUCCESS`/`INVALID_STATE`, and reward summary fields disappear.

- [ ] **Step 6: Update Playwright**

Replace the four regular-reset clicks with:

```ts
await expect(page.getByTestId('confirm-reset-run-data')).toBeVisible()
await expect(
  page.getByText(messages.manage.liveQuizzes.resetPreservedRewards, {
    exact: true,
  })
).toBeVisible()
await page.getByTestId('confirm-reset-run-data').click()
await expect(confirmReset).toBeEnabled()
await confirmReset.click()
```

Delete the legacy reward-data blocking test and remove `seedLegacyGamifiedLiveQuizResetBlock`, `restoreLegacyGamifiedLiveQuizResetBlock`, and the unused `PARTICIPANT_IDS` import. Keep permission visibility, same-ID/PIN, draft result, and `INVALID_STATE` tests.

- [ ] **Step 7: Run static checks**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm --filter @klicker-uzh/playwright check
pnpm exec prettier --check packages/graphql/src/graphql/ops/QGetLiveQuizResetSummary.graphql apps/frontend-manage/src/components/courses/modals/LiveQuizResetModal.tsx apps/frontend-manage/src/components/courses/modals/RegularLiveQuizResetModal.tsx apps/frontend-manage/src/components/activities/overview/LiveQuizActions.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts playwright/tests/O-live-quiz.spec.ts playwright/util/workflow.ts
```

Expected: all pass.

- [ ] **Step 8: Commit the API/UI contract**

```bash
git add packages/graphql/src/graphql/ops packages/graphql/src/ops.ts packages/graphql/src/ops.schema.json packages/graphql/src/public apps/frontend-manage/src/components packages/i18n/messages playwright/tests/O-live-quiz.spec.ts playwright/util/workflow.ts
git commit -m "feat(manage): confirm destructive live quiz reset"
```

---

### Task 5: Align Wiki, Skills, and Progress Documents

**Files:**

- Modify: `docs/domain-model.md`
- Modify: `docs/graphql-api-layer.md`
- Modify: `docs/async-and-workers.md`
- Modify: `docs/testing.md`
- Modify: `docs/log.md`
- Modify: `project/plans_wip/PLAN-regular-live-quiz-reset.md`
- Review/retain if still general: `.agents/skills/klicker-graphql-api/SKILL.md`
- Review/retain if still general: `.agents/skills/klicker-playwright-e2e/SKILL.md`
- Delete: `docs/superpowers/plans/2026-07-30-regular-live-quiz-reset.md`
- Delete: `docs/superpowers/plans/2026-07-31-regular-live-quiz-reset-review-cleanup.md`

**Interfaces:**

- Produces: one consistent description of disposable run data versus permanent cumulative rewards.

- [ ] **Step 1: Replace reward-ledger documentation**

Use this domain description:

```md
### Resetting an ended regular Live Quiz

An activity owner or activity administrator can return an ended regular Live Quiz to draft. Reset preserves the quiz definition and identity but deletes responses, aggregate results, feedback, confusion feedback, and its permanent and temporary session leaderboards. Blocks return to their initial lifecycle state with incremented execution counters.

Cumulative rewards are immutable: course leaderboard points, participant XP, timeline entries, achievements, awards, and participations are not read or changed by reset. Running the quiz again can award additional cumulative rewards through the ordinary end flow.
```

Delete reward-ledger/reconstruction/reversal descriptions from GraphQL and async-worker pages. Keep generation-fenced cache cleanup, but document that its payload has only quiz identity, Redis realm, and generation—no historical-week work.

- [ ] **Step 2: Update API and testing guidance**

Document the four summary counts, `SUCCESS | INVALID_STATE`, nullable unauthorized summary, regular-only mutation, separate assessment mutation, and owner/activity-admin authorization. Keep the full serial Playwright warning if the workflow still depends on preceding state; remove the legacy reward-blocking scenario.

- [ ] **Step 3: Replace obsolete plan history**

Delete the two superseded implementation plans. Rewrite the WIP plan to point to:

```text
docs/superpowers/specs/2026-07-30-regular-live-quiz-reset-design.md
docs/superpowers/plans/2026-08-04-regular-live-quiz-reset-preserve-rewards.md
```

Record that the supervisor-approved redesign removes the reward ledger and preserves cumulative rewards.

- [ ] **Step 4: Verify documentation consistency**

```bash
rg -n "LiveQuizReward|activeRewardRun|reward reversal|REWARD_DATA_UNAVAILABLE|legacy reconstruction|weekly timeline recomputation" docs .agents project
pnpm exec prettier --check docs .agents/skills/klicker-graphql-api/SKILL.md .agents/skills/klicker-playwright-e2e/SKILL.md project/plans_wip/PLAN-regular-live-quiz-reset.md
git diff --check
```

Expected: no current-behavior documentation claims reward reversal or a reward ledger.

- [ ] **Step 5: Commit documentation cleanup**

```bash
git add docs .agents/skills project/plans_wip/PLAN-regular-live-quiz-reset.md
git commit -m "docs(live-quiz): document reset data boundary"
```

---

### Task 6: Full Verification, Browser Evidence, and Draft PR Update

**Files:**

- Verify: whole branch against `origin/v3`
- Update externally: draft PR #5258 body and screenshots

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces: a green, reviewable draft PR with accurate whole-branch summary, test evidence, and screenshots.

- [ ] **Step 1: Prove no ledger implementation remains**

```bash
rg -n "LiveQuizReward|activeRewardRun|REWARD_DATA_UNAVAILABLE|legacyReconstruction|coursePointsToReverse|xpToReverse|weeklyTimelineRecomput" packages apps docs project
git diff --name-status origin/v3...HEAD
git diff --check origin/v3...HEAD
```

Expected: no executable/schema/generated ledger references; only explicit design statements that the removed concepts are non-goals may remain.

- [ ] **Step 2: Run backend verification**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/prisma check
devrouter exec . -- pnpm --filter @klicker-uzh/types check
devrouter exec . -- pnpm --filter @klicker-uzh/hatchet check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
```

Expected: all commands exit zero.

- [ ] **Step 3: Run frontend/repository checks and static analysis**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage build
devrouter exec . -- pnpm --filter @klicker-uzh/playwright check
pnpm run format:check
pnpm run lint
pnpm run check
opengrep scan --config auto
```

Expected: all exit zero. Record any pre-existing unrelated warning with file/line evidence and confirm it is unchanged from `v3`.

- [ ] **Step 4: Run the full serial browser workflow**

```bash
devrouter ensure .
devrouter exec . -- pnpm --filter @klicker-uzh/playwright test:run:raw -- tests/O-live-quiz.spec.ts --project=chromium
```

Expected: the complete spec passes, including owner/admin visibility, same-ID/PIN reset, single confirmation, preserved-reward copy, draft result, and stale-state handling.

- [ ] **Step 5: Capture mandatory browser evidence**

Using delegated lecturer login (`lecturer` / `abcd`) in the real devrouter manage app:

1. Capture the ended regular quiz action menu with Reset visible.
2. Capture the English confirmation with deleted run data and preserved rewards.
3. Confirm and capture the resulting draft action state.
4. Capture the German confirmation.
5. Capture the confirmation at 390-by-844.

Store only screenshots without participant names, emails, IDs, or response content.

- [ ] **Step 6: Review the whole branch and current PR feedback**

```bash
git status --short
git diff --stat origin/v3...HEAD
git log --oneline origin/v3..HEAD
gh pr view 5258 --json title,body,isDraft,reviewDecision,comments,reviews,statusCheckRollup
```

Confirm that the PR remains draft and that the body covers the whole branch.

- [ ] **Step 7: Push and update the draft PR**

```bash
git push origin feat/regular-live-quiz-reset-design
```

Update PR #5258 with the deletion/preservation decision, removal of schema and rollback logic, authorization, assessment compatibility, exact verification results, screenshots, and any still-running or externally blocked checks. Keep it as draft.
