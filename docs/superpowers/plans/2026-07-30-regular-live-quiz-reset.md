# Regular Live Quiz Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let activity owners and administrators reset an ended regular Live Quiz to draft while deleting its run data and reversing every gamification reward exactly once.

**Architecture:** Persist the exact reward deltas for every newly ended regular quiz in a per-run Prisma ledger, then make the generic reset service reverse that ledger and clear quiz-local execution state in one serializable transaction. Keep assessment reset as a compatibility wrapper over the shared reset core, expose structured GraphQL summary and mutation results, and reuse the existing manage-frontend confirmation flow with explicit destructive acknowledgements. Redis cleanup runs synchronously after commit and falls back to an idempotent Hatchet retry task.

**Tech Stack:** TypeScript, Node.js 24, pnpm 11, Prisma 6/PostgreSQL, Pothos GraphQL, Apollo Client, Next.js 15/React, Redis/ioredis, Hatchet TypeScript SDK 1.9.4, Vitest, Playwright, next-intl, Prettier

## Global Constraints

- Reset only an `ENDED`, non-deleted regular Live Quiz; draft, scheduled, running, and deleted quizzes remain ineligible.
- Regular reset requires activity `OWNER` or `ADMIN`; `READ`, `EXECUTE`, and `WRITE` permissions remain insufficient.
- Preserve the existing assessment-course owner/administrator reset policy and the `resetAssessmentLiveQuiz` compatibility field.
- Preserve activity ID, namespace, links, PIN, definition, settings, course assignment, sharing, catalog assignments, and review metadata.
- Delete responses, aggregated results, Q&A, confusion feedback, session and temporary leaderboards, timestamps, active-block state, and execution cache.
- Reverse course points, participant XP, timeline contributions, and achievement increments from exact per-run deltas.
- Legacy gamified reset is exact-or-reject; incomplete or inconsistent source data returns `REWARD_DATA_UNAVAILABLE` without changing state.
- Run reward application and ledger creation in the same database transaction that ends a regular quiz.
- Run reward reversal and quiz reset in one serializable database transaction; no partial reset or partial reward rollback is allowed.
- Retain reversed reward runs with actor and timestamp; each later execution creates a new reward run.
- Audit events contain aggregate deltas and identifiers for the actor, quiz, and reward run, but no participant IDs, names, answers, or response payloads.
- English and German copy and stable `data-cy` identifiers are required.
- Add no dependencies and do not change public assessment behavior.
- Use the official Hatchet retry pattern already pinned in the repository: `retries: 3`.
- Use `pnpm`, Prisma code generation, GraphQL code generation, Prettier, TypeScript checks, Playwright, and browser verification through `npx agent-browser`.

---

## File Map

### Create

- `packages/prisma/src/prisma/schema/migrations/20260730120000_regular_live_quiz_reward_ledger/migration.sql` — creates the reward-run status enum, reward-run and reward-entry tables, active-run pointer, indexes, and foreign keys.
- `packages/graphql/src/services/liveQuizRewards.ts` — owns pure reward calculation, ledger application, legacy reconstruction, reversal, and historical timeline reconciliation.
- `packages/graphql/src/services/liveQuizReset.ts` — owns reset eligibility, summary construction, shared execution-state reset, serializable reset orchestration, audit scheduling, and cache cleanup.
- `packages/graphql/src/graphql/ops/QGetLiveQuizResetSummary.graphql` — frontend reset-preview operation.
- `packages/graphql/src/graphql/ops/MResetLiveQuiz.graphql` — canonical generic reset mutation.
- `packages/graphql/test/liveQuizRewards.test.ts` — reward calculation, ledger application, legacy reconstruction, and timeline reversal integration tests.
- `packages/graphql/test/liveQuizReset.test.ts` — authorization, state transition, data deletion, idempotency, concurrency, failure, assessment compatibility, cache, and audit integration tests.

### Modify

- `packages/prisma/src/prisma/schema/quiz.prisma` — adds reward-run models and the active reward-run relation.
- `packages/prisma/src/prisma/schema/user.prisma` — adds the reversal-actor relation.
- `packages/prisma/src/prisma/schema/participant.prisma` — adds participant and participation reward-entry relations.
- `packages/prisma/src/prisma/schema/course.prisma` — adds course reward-entry relation.
- `packages/prisma/src/prisma/schema/gamification.prisma` — adds achievement reward-entry relation.
- `apps/analytics/prisma/schema/quiz.prisma` — generated schema mirror.
- `apps/analytics/prisma/schema/user.prisma` — generated schema mirror.
- `apps/analytics/prisma/schema/participant.prisma` — generated schema mirror.
- `apps/analytics/prisma/schema/course.prisma` — generated schema mirror.
- `apps/analytics/prisma/schema/gamification.prisma` — generated schema mirror.
- `packages/graphql/src/services/liveQuizzes.ts` — delegates regular reward application to the ledger service, includes reward-run creation in the end transaction, clears stale cache before starting a draft, and re-exports the assessment compatibility service.
- `packages/graphql/src/services/participants.ts` — exposes exact-week timeline boundaries used by reset instead of limiting reconciliation to the current cron window.
- `packages/graphql/src/schema/liveQuiz.ts` — defines reset outcome, eligibility, legacy-state enums, summary, and payload.
- `packages/graphql/src/schema/query.ts` — registers the administrator-protected reset-summary query.
- `packages/graphql/src/schema/mutation.ts` — registers canonical `resetLiveQuiz` and delegates the assessment field.
- `packages/graphql/src/graphql/ops/MResetAssessmentLiveQuiz.graphql` — remains compatible and requests the existing activity fields.
- `packages/graphql/src/ops.ts` — generated GraphQL operation types.
- `packages/graphql/src/ops.schema.json` — generated operation schema.
- `packages/graphql/src/public/schema.graphql` — generated public schema.
- `packages/graphql/src/public/client.json` — generated client operation allowlist.
- `packages/graphql/src/public/server.json` — generated server operation allowlist.
- `packages/types/src/hatchet.ts` — declares the reset-cache cleanup handler and prepared task.
- `packages/hatchet/src/index.ts` — registers the retrying reset cache and timeline-derived-data cleanup task.
- `packages/graphql/src/index.ts` — exports the cleanup handler to the general worker.
- `packages/graphql/test/helpers.ts` — registers the cleanup task in test contexts and adds focused live-quiz reset fixtures.
- `apps/frontend-manage/src/components/courses/modals/ActivityConfirmationModal.tsx` — lets submit handlers keep a modal open and accepts an explicit disabled state.
- `apps/frontend-manage/src/components/courses/modals/LiveQuizResetModal.tsx` — consumes reset summary/outcomes and renders the complete destructive confirmation.
- `apps/frontend-manage/src/components/activities/overview/LiveQuizActions.tsx` — exposes regular reset to owners/admins and supplies quiz type to the modal.
- `apps/frontend-manage/src/components/activities/actions/useLiveQuizActions.ts` — uses a non-assessment-specific reset selector.
- `packages/i18n/messages/en.ts` — adds English summary, eligibility, reward, outcome, and preservation copy.
- `packages/i18n/messages/de.ts` — adds equivalent German copy.
- `playwright/util/workflow.ts` — exposes a narrow synthetic quiz-identity lookup to the Playwright scenario.
- `playwright/tests/O-live-quiz.spec.ts` — verifies ended regular reset and permission visibility in the real manage frontend.
- `docs/domain-model.md` — documents the reward-run invariant and historical timeline reversal.
- `docs/graphql-api-layer.md` — documents the canonical reset API and structured outcomes.
- `docs/async-and-workers.md` — documents idempotent post-commit Redis cleanup.
- `docs/testing.md` — records the targeted reset verification commands and fixture behavior.

---

### Task 1: Add the Durable Reward Ledger

**Files:**

- Modify: `packages/prisma/src/prisma/schema/quiz.prisma`
- Modify: `packages/prisma/src/prisma/schema/user.prisma`
- Modify: `packages/prisma/src/prisma/schema/participant.prisma`
- Modify: `packages/prisma/src/prisma/schema/course.prisma`
- Modify: `packages/prisma/src/prisma/schema/gamification.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/20260730120000_regular_live_quiz_reward_ledger/migration.sql`
- Modify generated mirrors under: `apps/analytics/prisma/schema/`

**Interfaces:**

- Consumes: existing `LiveQuiz`, `User`, `Participant`, `Participation`, `Course`, and `Achievement` models.
- Produces: Prisma models `LiveQuizRewardRun` and `LiveQuizRewardEntry`, enum `LiveQuizRewardRunStatus`, `LiveQuiz.activeRewardRunId`, and generated Prisma client types used by Tasks 2–5.

- [ ] **Step 1: Add the schema contract**

Add the enum before `LiveQuiz`, add the active/applied-run relations to `LiveQuiz`, and add the two models after `LiveQuiz`:

```prisma
enum LiveQuizRewardRunStatus {
  APPLIED
  REVERSED
}

model LiveQuiz {
  id String @id @default(uuid()) @db.Uuid

  activeRewardRun   LiveQuizRewardRun? @relation("ActiveLiveQuizRewardRun", fields: [activeRewardRunId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  activeRewardRunId String?            @unique @db.Uuid
  rewardRuns        LiveQuizRewardRun[] @relation("LiveQuizRewardRuns")
}

model LiveQuizRewardRun {
  id                    String                  @id @default(uuid()) @db.Uuid
  status                LiveQuizRewardRunStatus @default(APPLIED)
  isLegacyReconstructed Boolean                 @default(false)
  endedAt               DateTime
  reversedAt            DateTime?

  liveQuiz   LiveQuiz @relation("LiveQuizRewardRuns", fields: [liveQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  liveQuizId String   @db.Uuid

  activeForLiveQuiz LiveQuiz? @relation("ActiveLiveQuizRewardRun")

  reversedBy   User?   @relation("LiveQuizRewardRunReversedBy", fields: [reversedById], references: [id], onDelete: SetNull, onUpdate: Cascade)
  reversedById String? @db.Uuid

  entries LiveQuizRewardEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([liveQuizId, status])
}

model LiveQuizRewardEntry {
  id Int @id @default(autoincrement())

  rewardRun   LiveQuizRewardRun @relation(fields: [rewardRunId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  rewardRunId String            @db.Uuid

  participant   Participant? @relation(fields: [participantId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  participantId String?      @db.Uuid
  participation   Participation? @relation(fields: [participationId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  participationId Int?
  course   Course? @relation(fields: [courseId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  courseId String? @db.Uuid
  achievement   Achievement? @relation(fields: [achievementId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  achievementId Int?

  coursePointsAwarded    Int   @default(0)
  participantXpAwarded   Int   @default(0)
  timelineDate           DateTime? @db.Date
  timelinePointsAwarded  Float @default(0)
  timelineXpAwarded      Float @default(0)
  achievementCountAwarded Int  @default(0)

  createdAt DateTime @default(now())

  @@unique([rewardRunId, participantId])
  @@index([participantId])
  @@index([participationId, courseId, timelineDate])
}
```

Keep every pre-existing `LiveQuiz` field and relation unchanged; the abbreviated `LiveQuiz` block above identifies only the new fields.

Add these reverse relations to their named models:

```prisma
// User
reversedLiveQuizRewardRuns LiveQuizRewardRun[] @relation("LiveQuizRewardRunReversedBy")

// Participant
liveQuizRewardEntries LiveQuizRewardEntry[]

// Participation
liveQuizRewardEntries LiveQuizRewardEntry[]

// Course
liveQuizRewardEntries LiveQuizRewardEntry[]

// Achievement
liveQuizRewardEntries LiveQuizRewardEntry[]
```

- [ ] **Step 2: Validate that client generation detects the new contract**

Run:

```bash
pnpm --filter @klicker-uzh/prisma generate
pnpm --filter @klicker-uzh/prisma check
```

Expected: Prisma generation succeeds; TypeScript succeeds with no diagnostics.

- [ ] **Step 3: Add the migration**

Create the migration with the following SQL:

```sql
CREATE TYPE "LiveQuizRewardRunStatus" AS ENUM ('APPLIED', 'REVERSED');

ALTER TABLE "LiveQuiz"
ADD COLUMN "activeRewardRunId" UUID;

CREATE TABLE "LiveQuizRewardRun" (
    "id" UUID NOT NULL,
    "status" "LiveQuizRewardRunStatus" NOT NULL DEFAULT 'APPLIED',
    "isLegacyReconstructed" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "liveQuizId" UUID NOT NULL,
    "reversedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveQuizRewardRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveQuizRewardEntry" (
    "id" SERIAL NOT NULL,
    "rewardRunId" UUID NOT NULL,
    "participantId" UUID,
    "participationId" INTEGER,
    "courseId" UUID,
    "achievementId" INTEGER,
    "coursePointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "participantXpAwarded" INTEGER NOT NULL DEFAULT 0,
    "timelineDate" DATE,
    "timelinePointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timelineXpAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievementCountAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveQuizRewardEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveQuiz_activeRewardRunId_key"
ON "LiveQuiz"("activeRewardRunId");

CREATE INDEX "LiveQuizRewardRun_liveQuizId_status_idx"
ON "LiveQuizRewardRun"("liveQuizId", "status");

CREATE UNIQUE INDEX "LiveQuizRewardRun_one_applied_per_quiz"
ON "LiveQuizRewardRun"("liveQuizId")
WHERE "status" = 'APPLIED';

CREATE UNIQUE INDEX "LiveQuizRewardEntry_rewardRunId_participantId_key"
ON "LiveQuizRewardEntry"("rewardRunId", "participantId");

CREATE INDEX "LiveQuizRewardEntry_participantId_idx"
ON "LiveQuizRewardEntry"("participantId");

CREATE INDEX "LiveQuizRewardEntry_participationId_courseId_timelineDate_idx"
ON "LiveQuizRewardEntry"("participationId", "courseId", "timelineDate");

ALTER TABLE "LiveQuizRewardRun"
ADD CONSTRAINT "LiveQuizRewardRun_liveQuizId_fkey"
FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardRun"
ADD CONSTRAINT "LiveQuizRewardRun_reversedById_fkey"
FOREIGN KEY ("reversedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveQuiz"
ADD CONSTRAINT "LiveQuiz_activeRewardRunId_fkey"
FOREIGN KEY ("activeRewardRunId") REFERENCES "LiveQuizRewardRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardEntry"
ADD CONSTRAINT "LiveQuizRewardEntry_rewardRunId_fkey"
FOREIGN KEY ("rewardRunId") REFERENCES "LiveQuizRewardRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardEntry"
ADD CONSTRAINT "LiveQuizRewardEntry_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardEntry"
ADD CONSTRAINT "LiveQuizRewardEntry_participationId_fkey"
FOREIGN KEY ("participationId") REFERENCES "Participation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardEntry"
ADD CONSTRAINT "LiveQuizRewardEntry_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LiveQuizRewardEntry"
ADD CONSTRAINT "LiveQuizRewardEntry_achievementId_fkey"
FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Synchronize the analytics schema**

Run:

```bash
pnpm run prisma:sync
pnpm run check:prisma-sync
```

Expected: the five modified `.prisma` files are mirrored under
`apps/analytics/prisma/schema/`; migrations remain only in the primary Prisma
package; sync check exits 0.

- [ ] **Step 5: Commit the data model**

```bash
git add packages/prisma/src/prisma/schema apps/analytics/prisma/schema
git commit -m "feat(prisma): add live quiz reward ledger"
```

Expected: pre-commit checks pass and the commit contains only the ledger schema, migration, and generated analytics mirror.

---

### Task 2: Calculate Rewards Once and Persist Them When a Regular Quiz Ends

**Files:**

- Create: `packages/graphql/src/services/liveQuizRewards.ts`
- Create: `packages/graphql/test/liveQuizRewards.test.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`

**Interfaces:**

- Consumes: `LiveQuizRewardRun`, `LiveQuizRewardEntry`, existing Redis hashes `lq:${id}:lb` and `lq:${id}:xp`, rank achievements, participant/course/timeline models.
- Produces:

  - `calculateLiveQuizRewardPlan(input: CalculateLiveQuizRewardPlanInput): LiveQuizRewardPlan`
  - `persistLiveQuizRewardRun(input: PersistLiveQuizRewardRunInput): Promise<string>`
  - `applyRegularLiveQuizRewardPlan(input: ApplyRegularLiveQuizRewardPlanInput): Promise<string>`
  - `LiveQuizRewardPlan` with exact participant deltas and `endedAt`
  - one active reward run for every newly ended regular quiz, including an empty run for non-gamified quizzes.

- [ ] **Step 1: Write failing pure reward-calculation tests**

Create `packages/graphql/test/liveQuizRewards.test.ts` with a pure test section:

```ts
import {
  calculateLiveQuizRewardPlan,
  type LiveQuizRewardParticipant,
} from '../src/services/liveQuizRewards.js'

describe('calculateLiveQuizRewardPlan', () => {
  const achievements = {
    first: { id: 1, rewardedPoints: 30, rewardedXP: 15 },
    second: { id: 2, rewardedPoints: 20, rewardedXP: 10 },
    third: { id: 3, rewardedPoints: 10, rewardedXP: 5 },
  }
  const endedAt = new Date('2026-07-30T10:00:00.000Z')

  it('records base and rank rewards as the exact applied totals', () => {
    const participants: LiveQuizRewardParticipant[] = [
      {
        participantId: '00000000-0000-0000-0000-000000000001',
        participationId: 11,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 40,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000002',
        participationId: 12,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 80,
        xp: 30,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000003',
        participationId: 13,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 60,
        xp: 20,
      },
    ]

    expect(
      calculateLiveQuizRewardPlan({
        participants,
        achievements,
        awardAchievements: true,
        endedAt,
      })
    ).toEqual({
      endedAt,
      isLegacyReconstructed: false,
      entries: [
        expect.objectContaining({
          participantId: participants[0]!.participantId,
          coursePointsAwarded: 130,
          participantXpAwarded: 55,
          achievementId: 1,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[1]!.participantId,
          coursePointsAwarded: 100,
          participantXpAwarded: 40,
          achievementId: 2,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[2]!.participantId,
          coursePointsAwarded: 70,
          participantXpAwarded: 25,
          achievementId: 3,
          achievementCountAwarded: 1,
        }),
      ],
    })
  })

  it('awards tied ranks once and does not create an achievement for missing XP', () => {
    const participants: LiveQuizRewardParticipant[] = [
      {
        participantId: '00000000-0000-0000-0000-000000000001',
        participationId: 11,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 40,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000002',
        participationId: 12,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 20,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000003',
        participationId: 13,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 80,
      },
    ]

    const plan = calculateLiveQuizRewardPlan({
      participants,
      achievements,
      awardAchievements: true,
      endedAt,
    })

    expect(plan.entries.map((entry) => entry.achievementId)).toEqual([
      1,
      1,
      null,
    ])
  })
})
```

- [ ] **Step 2: Run the pure tests and verify the expected failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test -- liveQuizRewards.test.ts
```

Expected: FAIL because `liveQuizRewards.ts` and `calculateLiveQuizRewardPlan` do not exist.

- [ ] **Step 3: Implement the pure reward contract and calculation**

Add these exported contracts and implement tie-aware rank calculation without database access:

```ts
import type { Prisma } from '@klicker-uzh/prisma/client'

export interface RankAchievementReward {
  id: number
  rewardedPoints: number | null
  rewardedXP: number | null
}

export interface LiveQuizRewardParticipant {
  participantId: string
  participationId: number | null
  courseId: string | null
  hasActiveParticipation: boolean
  isCourseGamificationEnabled: boolean
  score?: number
  xp?: number
}

export interface LiveQuizRewardDelta {
  participantId: string
  participationId: number | null
  courseId: string | null
  coursePointsAwarded: number
  participantXpAwarded: number
  timelineDate: Date | null
  timelinePointsAwarded: number
  timelineXpAwarded: number
  achievementId: number | null
  achievementCountAwarded: number
}

export interface LiveQuizRewardPlan {
  endedAt: Date
  entries: LiveQuizRewardDelta[]
  isLegacyReconstructed: boolean
}

export interface CalculateLiveQuizRewardPlanInput {
  participants: LiveQuizRewardParticipant[]
  achievements: {
    first: RankAchievementReward
    second: RankAchievementReward
    third: RankAchievementReward
  }
  awardAchievements: boolean
  endedAt: Date
  isLegacyReconstructed?: boolean
}

export interface ApplyRegularLiveQuizRewardPlanInput {
  liveQuizId: string
  plan: LiveQuizRewardPlan
  tx: Prisma.TransactionClient
}

export type PersistLiveQuizRewardRunInput = ApplyRegularLiveQuizRewardPlanInput

export function calculateLiveQuizRewardPlan({
  participants,
  achievements,
  awardAchievements,
  endedAt,
  isLegacyReconstructed = false,
}: CalculateLiveQuizRewardPlanInput): LiveQuizRewardPlan {
  const rankedScores = participants
    .filter((participant) => participant.score !== undefined)
    .map((participant) => participant.score as number)
    .sort((left, right) => right - left)
    .slice(0, 3)

  const goldScore = rankedScores[0]
  const silverScore = rankedScores[1]
  const bronzeScore = rankedScores[2]

  return {
    endedAt,
    isLegacyReconstructed,
    entries: participants.map((participant) => {
      let achievement: RankAchievementReward | null = null
      if (
        awardAchievements &&
        participant.score !== undefined &&
        participant.xp !== undefined
      ) {
        if (participant.score === goldScore) {
          achievement = achievements.first
        } else if (
          participant.score === silverScore &&
          silverScore !== goldScore
        ) {
          achievement = achievements.second
        } else if (
          participant.score === bronzeScore &&
          bronzeScore !== silverScore
        ) {
          achievement = achievements.third
        }
      }

      const rankPoints = achievement?.rewardedPoints ?? 0
      const rankXp = achievement?.rewardedXP ?? 0
      const coursePoints =
        participant.hasActiveParticipation &&
        participant.isCourseGamificationEnabled &&
        participant.score !== undefined
          ? participant.score + rankPoints
          : 0
      const participantXp =
        participant.xp === undefined ? 0 : participant.xp + rankXp
      const timelineDate =
        participant.participationId !== null &&
        participant.courseId !== null &&
        (coursePoints !== 0 || participantXp !== 0)
          ? endedAt
          : null
      const achievementCountAwarded =
        achievement && participant.courseId !== null ? 1 : 0

      return {
        participantId: participant.participantId,
        participationId: participant.participationId,
        courseId: participant.courseId,
        coursePointsAwarded: coursePoints,
        participantXpAwarded: participantXp,
        timelineDate,
        timelinePointsAwarded: coursePoints,
        timelineXpAwarded: timelineDate ? participantXp : 0,
        achievementId: achievementCountAwarded === 1 ? achievement!.id : null,
        achievementCountAwarded,
      }
    }),
  }
}
```

Define the shared rank inputs in the same file so current and legacy runs use
one source:

```ts
import type { ElementData } from '@klicker-uzh/types'

export const RANK_ACHIEVEMENT_IDS = {
  first: 5,
  second: 6,
  third: 7,
} as const

export function hasSampleSolutionQuestion(
  blocks: Array<{
    elements: Array<{
      elementType: DB.ElementType
      elementData: ElementData
    }>
  }>
): boolean {
  return blocks.some((block) =>
    block.elements.some(
      (instance) =>
        instance.elementType !== DB.ElementType.CONTENT &&
        (instance.elementData.options.hasSampleSolution ?? false)
    )
  )
}

export function shouldAwardRankAchievements({
  hasSampleSolution,
  participants,
}: {
  hasSampleSolution: boolean
  participants: LiveQuizRewardParticipant[]
}): boolean {
  return (
    hasSampleSolution &&
    participants.filter((participant) => participant.score !== undefined)
      .length >= 3
  )
}

export async function loadRankAchievementRewards(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<CalculateLiveQuizRewardPlanInput['achievements']> {
  const [first, second, third] = await Promise.all([
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.first },
    }),
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.second },
    }),
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.third },
    }),
  ])
  return { first, second, third }
}
```

- [ ] **Step 4: Run the pure tests**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test -- liveQuizRewards.test.ts
```

Expected: both `calculateLiveQuizRewardPlan` tests PASS.

- [ ] **Step 5: Add failing integration tests for ledgered quiz ending**

Extend `liveQuizRewards.test.ts` using the existing `initializePrisma`, `testInitialization`, `seedCourse`, and `seedLiveQuiz` helpers. Seed three participants, active course participations, Redis `lb`/`xp` hashes, and rank achievements. Assert:

```ts
const expectedPoints = 130
const expectedXp = 55
const endedQuiz = await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
const persistedQuiz = await prisma.liveQuiz.findUniqueOrThrow({
  where: { id: liveQuiz.id },
  include: {
    activeRewardRun: { include: { entries: true } },
  },
})

expect(endedQuiz?.status).toBe(PublicationStatus.ENDED)
expect(persistedQuiz.activeRewardRun).toMatchObject({
  status: LiveQuizRewardRunStatus.APPLIED,
  isLegacyReconstructed: false,
})
expect(persistedQuiz.activeRewardRun?.entries).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      participantId: participant.id,
      coursePointsAwarded: expectedPoints,
      participantXpAwarded: expectedXp,
    }),
  ])
)
```

Add a second test that ends a non-gamified regular quiz and asserts an applied run with `entries: []`. Add a repeated-end assertion:

```ts
await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)

expect(
  await prisma.liveQuizRewardRun.count({
    where: { liveQuizId: liveQuiz.id, status: 'APPLIED' },
  })
).toBe(1)
```

- [ ] **Step 6: Run the targeted integration test and verify it fails**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
```

Expected: FAIL because `endLiveQuiz` applies rewards separately and creates no reward run.

- [ ] **Step 7: Apply rewards and create the ledger in one end transaction**

Implement `applyRegularLiveQuizRewardPlan` so the supplied transaction:

```ts
export async function applyRegularLiveQuizRewardPlan({
  liveQuizId,
  plan,
  tx,
}: ApplyRegularLiveQuizRewardPlanInput): Promise<string> {
  for (const entry of plan.entries) {
    if (entry.participantXpAwarded !== 0) {
      await tx.participant.update({
        where: { id: entry.participantId },
        data: { xp: { increment: entry.participantXpAwarded } },
      })
    }
    if (
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.coursePointsAwarded !== 0
    ) {
      await tx.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: entry.participantId,
            courseId: entry.courseId!,
          },
        },
        create: {
          type: 'COURSE',
          participantId: entry.participantId,
          courseId: entry.courseId!,
          participation: { connect: { id: entry.participationId } },
          score: entry.coursePointsAwarded,
        },
        update: { score: { increment: entry.coursePointsAwarded } },
      })
    }
    if (
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.timelineDate !== null
    ) {
      await applyDailyTimelineDelta({ entry, tx })
    }
    if (entry.achievementId !== null && entry.achievementCountAwarded !== 0) {
      await tx.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: entry.participantId,
            achievementId: entry.achievementId,
          },
        },
        create: {
          participantId: entry.participantId,
          achievementId: entry.achievementId,
          achievedAt: plan.endedAt,
          achievedCount: entry.achievementCountAwarded,
        },
        update: {
          achievedCount: { increment: entry.achievementCountAwarded },
        },
      })
    }
  }

  return createRewardRunRecord({ liveQuizId, plan, tx })
}

async function createRewardRunRecord({
  liveQuizId,
  plan,
  tx,
}: PersistLiveQuizRewardRunInput): Promise<string> {
  const rewardRun = await tx.liveQuizRewardRun.create({
    data: {
      liveQuizId,
      endedAt: plan.endedAt,
      isLegacyReconstructed: plan.isLegacyReconstructed,
      entries: { create: plan.entries },
    },
  })
  await tx.liveQuiz.update({
    where: { id: liveQuizId },
    data: { activeRewardRunId: rewardRun.id },
  })
  return rewardRun.id
}

export async function persistLiveQuizRewardRun(
  input: PersistLiveQuizRewardRunInput
): Promise<string> {
  return createRewardRunRecord(input)
}
```

`applyRegularLiveQuizRewardPlan` performs all four external mutations before
calling `createRewardRunRecord`; `persistLiveQuizRewardRun` calls only
`createRewardRunRecord`. This distinction is mandatory: legacy reconstruction
persists already-applied deltas and must never apply them a second time.

Define `applyDailyTimelineDelta` in the same file with the repository's exact timeline fields:

```ts
async function applyDailyTimelineDelta({
  entry,
  tx,
}: {
  entry: LiveQuizRewardDelta
  tx: Prisma.TransactionClient
}): Promise<void> {
  await tx.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: entry.participationId!,
        courseId: entry.courseId!,
        timestamp: entry.timelineDate!,
        type: 'DAILY',
      },
    },
    create: {
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      timestamp: entry.timelineDate!,
      type: 'DAILY',
      collectedPoints: entry.timelinePointsAwarded,
      collectedXp: entry.timelineXpAwarded,
      computedAt: new Date(),
    },
    update: {
      collectedPoints: { increment: entry.timelinePointsAwarded },
      collectedXp: { increment: entry.timelineXpAwarded },
      computedAt: new Date(),
    },
  })
}
```

Do not schedule weekly reconciliation from inside the transaction.

Refactor the regular branch of `endLiveQuiz` to:

1. retain `participationId`, `courseId`, `hasActiveParticipation`, and
   `isCourseGamificationEnabled` while loading participants;
2. load the three rank achievement definitions once;
3. build one `LiveQuizRewardPlan`;
4. call `applyRegularLiveQuizRewardPlan` inside the same interactive transaction that conditionally updates `LiveQuiz` from `PUBLISHED` to `ENDED`;
5. create an empty plan for a non-gamified run;
6. leave the assessment branch unchanged.

Use the conditional end update:

```ts
const endedAt = new Date()
await ctx.prisma.$transaction(
  async (tx) => {
    const transitioned = await tx.liveQuiz.updateMany({
      where: {
        id,
        status: DB.PublicationStatus.PUBLISHED,
        activeRewardRunId: null,
      },
      data: {
        status: DB.PublicationStatus.ENDED,
        finishedAt: endedAt,
      },
    })
    if (transitioned.count !== 1) {
      throw new Error('LIVE_QUIZ_END_CONFLICT')
    }

    await applyRegularLiveQuizRewardPlan({
      liveQuizId: id,
      plan,
      tx,
    })
  },
  {
    isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
    timeout: 60000,
  }
)
```

- [ ] **Step 8: Run reward tests and checks**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql build
```

Expected: reward tests PASS; TypeScript and build exit 0.

- [ ] **Step 9: Commit ledgered reward application**

```bash
git add packages/graphql/src/services/liveQuizRewards.ts packages/graphql/src/services/liveQuizzes.ts packages/graphql/test/liveQuizRewards.test.ts
git commit -m "feat(graphql): ledger live quiz rewards"
```

---

### Task 3: Build Reset Eligibility, Summary, and Exact Legacy Reconstruction

**Files:**

- Modify: `packages/graphql/src/services/liveQuizRewards.ts`
- Create: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/test/liveQuizRewards.test.ts`
- Create: `packages/graphql/test/liveQuizReset.test.ts`
- Modify: `packages/graphql/test/helpers.ts`

**Interfaces:**

- Consumes: active reward-run relation from Task 1, pure rank calculator and reward types from Task 2, persisted leaderboard rows, Redis XP hash, quiz/course/participant data.
- Produces:

  - `LiveQuizResetOutcome = 'SUCCESS' | 'INVALID_STATE' | 'REWARD_DATA_UNAVAILABLE' | 'CONFLICT'`
  - `LiveQuizResetEligibilityReason = 'ELIGIBLE' | 'INVALID_STATE' | 'ASSESSMENT_POLICY' | 'REWARD_DATA_UNAVAILABLE'`
  - `LiveQuizLegacyReconstructionStatus = 'NOT_REQUIRED' | 'AVAILABLE' | 'UNAVAILABLE'`
  - `inspectLegacyRegularLiveQuizRewards(input): Promise<LegacyRewardInspection>`
  - `getLiveQuizResetSummary({ quizId }, ctx): Promise<LiveQuizResetSummary | null>`.

- [ ] **Step 1: Add reset fixture support**

Extend `packages/graphql/test/helpers.ts` with an explicit fixture return type and helper:

```ts
export interface LiveQuizResetFixture {
  liveQuizId: string
  courseId: string | null
  participantId: string | null
  participationId: number | null
  rewardRunId: string | null
  achievementId: number | null
  timelineDate: Date
  awardedCoursePoints: number
  awardedParticipantXp: number
  awardedTimelinePoints: number
  awardedTimelineXp: number
  awardedAchievementCount: number
}

export async function seedEndedRegularLiveQuizForReset(
  {
    gamified,
    withRewardRun,
    withCourse = gamified,
  }: {
    gamified: boolean
    withRewardRun: boolean
    withCourse?: boolean
  },
  ctx: ContextWithUser
): Promise<LiveQuizResetFixture> {
  const course = withCourse
    ? await seedCourse({ isGamificationEnabled: gamified }, ctx)
    : null
  const liveQuiz = await seedLiveQuiz(
    {
      elements: [],
      courseId: course?.id,
      status: PublicationStatus.ENDED,
    },
    ctx
  )

  const timelineDate = new Date('2026-07-30T00:00:00.000Z')
  const awardedCoursePoints = gamified && course ? 70 : 0
  const awardedParticipantXp = gamified ? 25 : 0
  const awardedTimelinePoints = awardedCoursePoints
  const awardedTimelineXp = gamified && course ? awardedParticipantXp : 0
  const awardedAchievementCount = gamified && withRewardRun ? 1 : 0

  const participant = gamified
    ? await ctx.prisma.participant.create({
        data: {
          username: uuidv4(),
          password: 'synthetic-test-password',
          xp: 100 + awardedParticipantXp,
        },
      })
    : null
  const participation =
    course && participant
      ? await ctx.prisma.participation.create({
          data: {
            courseId: course.id,
            participantId: participant.id,
            isActive: true,
          },
        })
      : null
  const achievement =
    awardedAchievementCount > 0
      ? await ctx.prisma.achievement.create({
          data: {
            nameEN: 'Synthetic live quiz rank',
            nameDE: 'Synthetischer Live-Quiz-Rang',
            icon: 'star',
            type: 'PARTICIPANT',
            scope: 'GLOBAL',
            rewardedPoints: 10,
            rewardedXP: 5,
          },
        })
      : null

  if (participant) {
    await ctx.prisma.leaderboardEntry.create({
      data: {
        type: 'SESSION',
        score: awardedCoursePoints,
        participantId: participant.id,
        liveQuizId: liveQuiz.id,
        sessionParticipationId: participation?.id,
      },
    })
    if (course && participation) {
      await ctx.prisma.leaderboardEntry.create({
        data: {
          type: 'COURSE',
          score: awardedCoursePoints,
          participantId: participant.id,
          courseId: course.id,
          participation: { connect: { id: participation.id } },
        },
      })
      await ctx.prisma.timelineEntry.create({
        data: {
          type: 'DAILY',
          timestamp: timelineDate,
          collectedPoints: awardedTimelinePoints,
          collectedXp: awardedTimelineXp,
          courseId: course.id,
          participationId: participation.id,
        },
      })
    }
    if (achievement) {
      await ctx.prisma.participantAchievementInstance.create({
        data: {
          participantId: participant.id,
          achievementId: achievement.id,
          achievedAt: timelineDate,
          achievedCount: awardedAchievementCount,
        },
      })
    }
  }

  const run =
    withRewardRun && participant
      ? await ctx.prisma.liveQuizRewardRun.create({
          data: {
            liveQuizId: liveQuiz.id,
            endedAt: timelineDate,
            entries: {
              create: {
                participantId: participant.id,
                participationId: participation?.id,
                courseId: course?.id,
                coursePointsAwarded: awardedCoursePoints,
                participantXpAwarded: awardedParticipantXp,
                timelineDate: course ? timelineDate : null,
                timelinePointsAwarded: awardedTimelinePoints,
                timelineXpAwarded: awardedTimelineXp,
                achievementId: achievement?.id,
                achievementCountAwarded: awardedAchievementCount,
              },
            },
          },
        })
      : withRewardRun
        ? await ctx.prisma.liveQuizRewardRun.create({
            data: {
              liveQuizId: liveQuiz.id,
              endedAt: timelineDate,
            },
          })
        : null

  if (run) {
    await ctx.prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { activeRewardRunId: run.id },
    })
  } else if (participant) {
    await ctx.redisExec.hset(
      `lq:${liveQuiz.id}:lb`,
      participant.id,
      awardedCoursePoints
    )
    await ctx.redisExec.hset(
      `lq:${liveQuiz.id}:xp`,
      participant.id,
      awardedParticipantXp
    )
  }

  return {
    liveQuizId: liveQuiz.id,
    courseId: course?.id ?? null,
    participantId: participant?.id ?? null,
    participationId: participation?.id ?? null,
    rewardRunId: run?.id ?? null,
    achievementId: achievement?.id ?? null,
    timelineDate,
    awardedCoursePoints,
    awardedParticipantXp,
    awardedTimelinePoints,
    awardedTimelineXp,
    awardedAchievementCount,
  }
}
```

Tests that exercise response/result clearing should extend this fixture with
`seedLiveQuizWithResponses` or create a synthetic block/instance through
`seedLiveQuiz`; reward tests use the exact numeric fields returned above.

- [ ] **Step 2: Write failing summary tests**

In `liveQuizReset.test.ts`, initialize the real Prisma, Redis, Hatchet, and user contexts with existing helpers. Add:

```ts
it('summarizes every destructive category for an eligible regular quiz', async () => {
  const fixture = await seedEndedRegularLiveQuizForReset(
    { gamified: true, withRewardRun: true },
    userOneCtx
  )

  const summary = await getLiveQuizResetSummary(
    { quizId: fixture.liveQuizId },
    userOneCtx
  )

  expect(summary).toEqual(
    expect.objectContaining({
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
      numOfResponses: expect.any(Number),
      numOfFeedbacks: expect.any(Number),
      numOfConfusionFeedbacks: expect.any(Number),
      numOfLeaderboardEntries: expect.any(Number),
      coursePointsToReverse: expect.any(Number),
      xpToReverse: expect.any(Number),
      numOfTimelineChanges: expect.any(Number),
      numOfAchievementChanges: expect.any(Number),
    })
  )
})

it.each([
  PublicationStatus.DRAFT,
  PublicationStatus.SCHEDULED,
  PublicationStatus.PUBLISHED,
])('marks %s quizzes ineligible', async (status) => {
  const quiz = await seedLiveQuiz({ elements: [], status }, userOneCtx)
  const summary = await getLiveQuizResetSummary({ quizId: quiz.id }, userOneCtx)
  expect(summary).toMatchObject({
    eligible: false,
    reason: 'INVALID_STATE',
  })
})
```

Add a deleted-quiz case and an unauthorized `userTwoCtx` case; unauthorized summary must return `null`, matching non-disclosure behavior.

- [ ] **Step 3: Run the summary tests and verify failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: FAIL because the reset service and summary types do not exist.

- [ ] **Step 4: Implement summary types and authoritative eligibility**

Create `liveQuizReset.ts` with:

```ts
export type LiveQuizResetOutcome =
  | 'SUCCESS'
  | 'INVALID_STATE'
  | 'REWARD_DATA_UNAVAILABLE'
  | 'CONFLICT'

export type LiveQuizResetEligibilityReason =
  | 'ELIGIBLE'
  | 'INVALID_STATE'
  | 'ASSESSMENT_POLICY'
  | 'REWARD_DATA_UNAVAILABLE'

export type LiveQuizLegacyReconstructionStatus =
  | 'NOT_REQUIRED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'

export interface LiveQuizResetSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
  coursePointsToReverse: number
  xpToReverse: number
  numOfTimelineChanges: number
  numOfAchievementChanges: number
  eligible: boolean
  reason: LiveQuizResetEligibilityReason
  legacyReconstructionStatus: LiveQuizLegacyReconstructionStatus
}
```

Query `LiveQuiz` with blocks/elements, counts, activity permission for `ctx.user.sub`, active reward run/entries, and course assessment permissions. Require:

```ts
const canResetRegular =
  liveQuiz.ownerId === ctx.user.sub ||
  liveQuiz.permissions.some(
    (permission) =>
      permission.userId === ctx.user.sub &&
      (permission.permissionLevel === DB.PermissionLevel.ADMIN ||
        permission.permissionLevel === DB.PermissionLevel.OWNER)
  )

const hasValidState =
  liveQuiz.status === DB.PublicationStatus.ENDED && !liveQuiz.isDeleted
```

For assessment quizzes, preserve the course permission check using `ADMIN` or
`OWNER`. Compute reward totals from the active ledger when present; for a
legacy gamified regular quiz, compute the same totals from the inspected plan
without persisting it. Count quiz-local categories from the database. Never use
the summary to authorize the later mutation.

- [ ] **Step 5: Write failing legacy exact-or-reject tests**

Add four `liveQuizRewards.test.ts` cases:

```ts
it('reconstructs a complete legacy gamified run from leaderboards and live XP', async () => {
  const inspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: fixture.liveQuizId },
    userOneCtx
  )
  expect(inspection.status).toBe('AVAILABLE')
  expect(inspection.plan).toMatchObject({
    isLegacyReconstructed: true,
    entries: expect.arrayContaining([
      expect.objectContaining({
        participantId: fixture.participantId,
        coursePointsAwarded: fixture.awardedCoursePoints,
        participantXpAwarded: fixture.awardedParticipantXp,
      }),
    ]),
  })
})

it('rejects legacy rewards when the XP hash has expired', async () => {
  await userOneCtx.redisExec.del(`lq:${fixture.liveQuizId}:xp`)
  const inspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: fixture.liveQuizId },
    userOneCtx
  )
  expect(inspection).toEqual({ status: 'UNAVAILABLE', plan: null })
})

it('rejects mismatched leaderboard and XP participant sets', async () => {
  await userOneCtx.redisExec.hdel(
    `lq:${fixture.liveQuizId}:xp`,
    fixture.participantId!
  )
  const inspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: fixture.liveQuizId },
    userOneCtx
  )
  expect(inspection.status).toBe('UNAVAILABLE')
})

it('does not require reconstruction for a legacy non-gamified quiz', async () => {
  const summary = await getLiveQuizResetSummary(
    { quizId: fixture.liveQuizId },
    userOneCtx
  )
  expect(summary).toMatchObject({
    eligible: true,
    legacyReconstructionStatus: 'NOT_REQUIRED',
  })
})
```

- [ ] **Step 6: Run the legacy tests and verify failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
```

Expected: FAIL because `inspectLegacyRegularLiveQuizRewards` is not implemented.

- [ ] **Step 7: Implement exact legacy inspection**

Add:

```ts
export type LegacyRewardInspection =
  | { status: 'AVAILABLE'; plan: LiveQuizRewardPlan }
  | { status: 'UNAVAILABLE'; plan: null }

export async function inspectLegacyRegularLiveQuizRewards(
  {
    liveQuizId,
    prisma = ctx.prisma,
  }: {
    liveQuizId: string
    prisma?: DB.PrismaClient | DB.Prisma.TransactionClient
  },
  ctx: ContextWithUser
): Promise<LegacyRewardInspection> {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: liveQuizId },
    include: {
      course: true,
      blocks: { include: { elements: true } },
      leaderboard: true,
      temporaryLeaderboard: true,
    },
  })
  if (
    !quiz ||
    quiz.isAssessmentEnabled ||
    !quiz.isGamificationEnabled ||
    quiz.status !== DB.PublicationStatus.ENDED
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const xpByParticipant = await ctx.redisExec.hgetall(`lq:${liveQuizId}:xp`)
  if (
    Object.values(xpByParticipant).some(
      (value) =>
        !Number.isFinite(Number(value)) || !Number.isInteger(Number(value))
    )
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const persistedScores = new Map<string, number>()
  const sessionParticipantIds = quiz.leaderboard.map(
    (entry) => entry.participantId
  )
  const temporaryPermanentIds: string[] = []
  for (const entry of quiz.leaderboard) {
    persistedScores.set(entry.participantId, entry.score)
  }
  for (const entry of quiz.temporaryLeaderboard) {
    const participant = await prisma.participant.findUnique({
      where: { id: entry.id },
      include: {
        participations: quiz.courseId
          ? { where: { courseId: quiz.courseId, isActive: true } }
          : false,
      },
    })
    if (participant) {
      temporaryPermanentIds.push(participant.id)
      persistedScores.set(participant.id, entry.score)
    }
  }
  if (
    temporaryPermanentIds.some((participantId) =>
      sessionParticipantIds.includes(participantId)
    ) ||
    new Set(sessionParticipantIds).size !== sessionParticipantIds.length ||
    new Set(temporaryPermanentIds).size !== temporaryPermanentIds.length
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const scoreIds = [...persistedScores.keys()].sort()
  const xpIds = Object.keys(xpByParticipant).sort()
  if (
    scoreIds.length > 0 &&
    (xpIds.length === 0 ||
      scoreIds.some((participantId) => !xpIds.includes(participantId)))
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const participantIds = [...new Set([...scoreIds, ...xpIds])].sort()
  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds } },
    include: {
      participations: quiz.courseId
        ? { where: { courseId: quiz.courseId } }
        : false,
    },
  })
  if (participants.length !== participantIds.length) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const rewardParticipants = participants.map((participant) => ({
    participantId: participant.id,
    participationId: participant.participations[0]?.id ?? null,
    courseId: quiz.courseId,
    hasActiveParticipation: participant.participations[0]?.isActive === true,
    isCourseGamificationEnabled: quiz.course?.isGamificationEnabled === true,
    score: persistedScores.get(participant.id),
    xp:
      xpByParticipant[participant.id] === undefined
        ? undefined
        : Number(xpByParticipant[participant.id]),
  }))

  let achievements: CalculateLiveQuizRewardPlanInput['achievements']
  try {
    achievements = await loadRankAchievementRewards(prisma)
  } catch {
    return { status: 'UNAVAILABLE', plan: null }
  }
  const plan = calculateLiveQuizRewardPlan({
    participants: rewardParticipants,
    achievements,
    awardAchievements: shouldAwardRankAchievements({
      hasSampleSolution: hasSampleSolutionQuestion(quiz.blocks),
      participants: rewardParticipants,
    }),
    endedAt: quiz.finishedAt ?? quiz.updatedAt,
    isLegacyReconstructed: true,
  })
  if (
    plan.entries.some((entry) => entry.timelineDate !== null) &&
    quiz.finishedAt === null
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }
  if (
    !(await legacyPlanMatchesCurrentRewards({
      plan,
      liveQuizId,
      prisma,
    }))
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }
  return { status: 'AVAILABLE', plan }
}
```

Implement the current-reward validation called above:

```ts
async function legacyPlanMatchesCurrentRewards({
  plan,
  liveQuizId,
  prisma,
}: {
  plan: LiveQuizRewardPlan
  liveQuizId: string
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}): Promise<boolean> {
  for (const entry of plan.entries) {
    const participant = await prisma.participant.findUnique({
      where: { id: entry.participantId },
      select: { xp: true },
    })
    if (!participant || participant.xp < entry.participantXpAwarded) {
      return false
    }
    if (entry.courseId && entry.coursePointsAwarded !== 0) {
      const courseLeaderboard = await prisma.leaderboardEntry.findUnique({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: entry.participantId,
            courseId: entry.courseId,
          },
        },
      })
      if (
        !courseLeaderboard ||
        courseLeaderboard.score < entry.coursePointsAwarded
      ) {
        return false
      }
    }
    if (entry.achievementId && entry.achievementCountAwarded !== 0) {
      const achievement =
        await prisma.participantAchievementInstance.findUnique({
          where: {
            participantId_achievementId: {
              participantId: entry.participantId,
              achievementId: entry.achievementId,
            },
          },
        })
      if (
        !achievement ||
        achievement.achievedCount < entry.achievementCountAwarded
      ) {
        return false
      }
    }
    if (
      entry.participationId &&
      entry.courseId &&
      entry.timelineDate &&
      (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
    ) {
      const daily = await prisma.timelineEntry.findUnique({
        where: {
          participationId_courseId_timestamp_type: {
            participationId: entry.participationId,
            courseId: entry.courseId,
            timestamp: entry.timelineDate,
            type: 'DAILY',
          },
        },
      })
      const weekStart = dayjs(entry.timelineDate)
        .utc()
        .startOf('isoWeek')
        .toDate()
      const weekly = daily
        ? null
        : await prisma.timelineEntry.findUnique({
            where: {
              participationId_courseId_timestamp_type: {
                participationId: entry.participationId,
                courseId: entry.courseId,
                timestamp: weekStart,
                type: 'WEEKLY',
              },
            },
          })
      const timeline = daily ?? weekly
      if (
        timeline &&
        (timeline.collectedPoints < entry.timelinePointsAwarded ||
          timeline.collectedXp < entry.timelineXpAwarded)
      ) {
        return false
      }
    }
  }

  const sessionParticipants = await prisma.leaderboardEntry.count({
    where: { liveQuizId, type: 'SESSION' },
  })
  return (
    sessionParticipants === 0 ||
    plan.entries.filter((entry) => entry.coursePointsAwarded !== 0).length <=
      sessionParticipants
  )
}
```

The participant-set check above enforces an XP hash entry for every
score-bearing permanent participant, while the guarded achievement load
returns `UNAVAILABLE` for a missing rank definition. Reuse the pure
`shouldAwardRankAchievements` helper from the regular end flow so legacy rank
attribution cannot drift.

- [ ] **Step 8: Run summary and legacy tests**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: summary and legacy reconstruction tests PASS.

- [ ] **Step 9: Commit eligibility and reconstruction**

```bash
git add packages/graphql/src/services/liveQuizRewards.ts packages/graphql/src/services/liveQuizReset.ts packages/graphql/test/liveQuizRewards.test.ts packages/graphql/test/liveQuizReset.test.ts packages/graphql/test/helpers.ts
git commit -m "feat(graphql): inspect live quiz reset eligibility"
```

---

### Task 4: Reverse Rewards and Reset Quiz State Atomically

**Files:**

- Modify: `packages/graphql/src/services/liveQuizRewards.ts`
- Modify: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/services/participants.ts`
- Modify: `packages/graphql/test/liveQuizRewards.test.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`

**Interfaces:**

- Consumes: `LiveQuizRewardPlan`, active reward run, legacy inspection, `getInitialInstanceResults`, Prisma serializable transactions.
- Produces:

  - `reverseLiveQuizRewardRun({ rewardRunId, actorId, tx }): Promise<RewardReversalResult>`
  - `recomputeWeeklyTimelineEntry({ participationId, courseId, weekStart, prisma }): Promise<void>`
  - `resetLiveQuizExecutionState({ liveQuizId, userId, tx }): Promise<ResetActivityInfoSource>`
  - `formatResetActivityInfo(activity: ResetActivityInfoSource): ResetActivityInfo`
  - `resetLiveQuiz({ id }, ctx): Promise<ResetLiveQuizServiceResult>`
  - compatibility `resetAssessmentLiveQuiz({ id }, ctx)`.

- [ ] **Step 1: Write failing reward-reversal tests**

Add this exact state reader:

```ts
async function readRewardState(fixture: LiveQuizResetFixture) {
  const courseLeaderboard =
    fixture.participantId && fixture.courseId
      ? await prisma.leaderboardEntry.findUnique({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              participantId: fixture.participantId,
              courseId: fixture.courseId,
            },
          },
        })
      : null
  const participant = fixture.participantId
    ? await prisma.participant.findUnique({
        where: { id: fixture.participantId },
      })
    : null
  const timeline =
    fixture.participationId && fixture.courseId
      ? await prisma.timelineEntry.findUnique({
          where: {
            participationId_courseId_timestamp_type: {
              participationId: fixture.participationId,
              courseId: fixture.courseId,
              timestamp: fixture.timelineDate,
              type: 'DAILY',
            },
          },
        })
      : null
  const achievement =
    fixture.participantId && fixture.achievementId
      ? await prisma.participantAchievementInstance.findUnique({
          where: {
            participantId_achievementId: {
              participantId: fixture.participantId,
              achievementId: fixture.achievementId,
            },
          },
        })
      : null
  const rewardRun = fixture.rewardRunId
    ? await prisma.liveQuizRewardRun.findUnique({
        where: { id: fixture.rewardRunId },
      })
    : null

  return {
    coursePoints: courseLeaderboard?.score ?? 0,
    participantXp: participant?.xp ?? 0,
    dailyPoints: timeline?.collectedPoints ?? 0,
    dailyXp: timeline?.collectedXp ?? 0,
    achievementCount: achievement?.achievedCount ?? 0,
    rewardRun,
  }
}
```

Add integration cases that snapshot every external value before and after reset:

```ts
const before = await readRewardState(fixture)
const result = await resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
const after = await readRewardState(fixture)

expect(result.outcome).toBe('SUCCESS')
expect(after.coursePoints).toBe(
  before.coursePoints - fixture.awardedCoursePoints
)
expect(after.participantXp).toBe(
  before.participantXp - fixture.awardedParticipantXp
)
expect(after.dailyPoints).toBe(
  before.dailyPoints - fixture.awardedTimelinePoints
)
expect(after.dailyXp).toBe(before.dailyXp - fixture.awardedTimelineXp)
expect(after.achievementCount).toBe(
  before.achievementCount - fixture.awardedAchievementCount
)
expect(after.rewardRun).toMatchObject({
  status: LiveQuizRewardRunStatus.REVERSED,
  reversedById: userOneCtx.user.sub,
  reversedAt: expect.any(Date),
})
```

Add:

- achievement count decrements but the instance remains above zero;
- achievement instance is deleted at zero;
- existing DAILY timeline entry is decremented and returns its exact
  `WeeklyTimelineRecomputation`; invoke `recomputeWeeklyTimelineEntry` with
  that value and assert the historical WEEKLY row is recomputed;
- missing DAILY plus existing WEEKLY is decremented directly;
- missing DAILY and WEEKLY is accepted because no timeline reward remains.

- [ ] **Step 2: Run reversal tests and verify failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
```

Expected: FAIL because reward reversal and arbitrary-week recomputation do not exist.

- [ ] **Step 3: Implement exact-week timeline reconciliation**

Export a reusable exact-week boundary helper from `participants.ts`:

```ts
export function getTimelineWeekBounds(date: Date): {
  weekStart: Date
  weekEnd: Date
} {
  const weekStart = dayjs(date).utc().startOf('isoWeek').toDate()
  return {
    weekStart,
    weekEnd: dayjs(weekStart).add(1, 'week').toDate(),
  }
}
```

In `liveQuizRewards.ts`, implement:

```ts
export async function recomputeWeeklyTimelineEntry({
  participationId,
  courseId,
  weekStart,
  prisma,
}: {
  participationId: number
  courseId: string
  weekStart: Date
  prisma: Prisma.TransactionClient | DB.PrismaClient
}): Promise<void> {
  const { weekEnd } = getTimelineWeekBounds(weekStart)
  const daily = await prisma.timelineEntry.aggregate({
    where: {
      participationId,
      courseId,
      type: DB.TimelineEntryType.DAILY,
      timestamp: { gte: weekStart, lt: weekEnd },
    },
    _sum: { collectedPoints: true, collectedXp: true },
  })
  const collectedPoints = daily._sum.collectedPoints ?? 0
  const collectedXp = daily._sum.collectedXp ?? 0

  if (collectedPoints === 0 && collectedXp === 0) {
    await prisma.timelineEntry.deleteMany({
      where: {
        participationId,
        courseId,
        type: DB.TimelineEntryType.WEEKLY,
        timestamp: weekStart,
      },
    })
    return
  }

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId,
        courseId,
        timestamp: weekStart,
        type: DB.TimelineEntryType.WEEKLY,
      },
    },
    create: {
      participationId,
      courseId,
      type: DB.TimelineEntryType.WEEKLY,
      timestamp: weekStart,
      collectedPoints,
      collectedXp,
      computedAt: new Date(),
    },
    update: {
      collectedPoints,
      collectedXp,
      computedAt: new Date(),
    },
  })
}
```

- [ ] **Step 4: Implement idempotent ledger reversal**

Add:

```ts
export interface RewardReversalTotals {
  coursePoints: number
  participantXp: number
  timelineChanges: number
  achievementChanges: number
}

export interface WeeklyTimelineRecomputation {
  participationId: number
  courseId: string
  weekStart: Date
}

export interface RewardReversalResult {
  totals: RewardReversalTotals
  weeklyTimelineRecomputations: WeeklyTimelineRecomputation[]
}

export async function reverseLiveQuizRewardRun({
  rewardRunId,
  actorId,
  tx,
}: {
  rewardRunId: string
  actorId: string
  tx: Prisma.TransactionClient
}): Promise<RewardReversalResult> {
  const transitioned = await tx.liveQuizRewardRun.updateMany({
    where: { id: rewardRunId, status: 'APPLIED' },
    data: {
      status: 'REVERSED',
      reversedAt: new Date(),
      reversedById: actorId,
    },
  })
  if (transitioned.count !== 1) throw new Error('REWARD_RUN_CONFLICT')

  const run = await tx.liveQuizRewardRun.findUniqueOrThrow({
    where: { id: rewardRunId },
    include: { entries: true },
  })
  const totals: RewardReversalTotals = {
    coursePoints: 0,
    participantXp: 0,
    timelineChanges: 0,
    achievementChanges: 0,
  }
  const weeklyTimelineRecomputations: WeeklyTimelineRecomputation[] = []

  for (const entry of run.entries) {
    if (entry.participantId && entry.participantXpAwarded !== 0) {
      const participant = await tx.participant.updateMany({
        where: {
          id: entry.participantId,
          xp: { gte: entry.participantXpAwarded },
        },
        data: { xp: { decrement: entry.participantXpAwarded } },
      })
      if (participant.count !== 1) {
        throw new Error('PARTICIPANT_XP_UNDERFLOW')
      }
      totals.participantXp += entry.participantXpAwarded
    }
    if (
      entry.participationId &&
      entry.courseId &&
      entry.coursePointsAwarded !== 0
    ) {
      await subtractCourseLeaderboardDelta({ entry, tx })
      totals.coursePoints += entry.coursePointsAwarded
    }
    if (
      entry.participationId &&
      entry.courseId &&
      entry.timelineDate &&
      (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
    ) {
      const recomputation = await reverseTimelineDelta({ entry, tx })
      if (recomputation) {
        weeklyTimelineRecomputations.push(recomputation)
      }
      totals.timelineChanges += 1
    }
    if (
      entry.participantId &&
      entry.achievementId &&
      entry.achievementCountAwarded !== 0
    ) {
      await reverseAchievementDelta({ entry, tx })
      totals.achievementChanges += entry.achievementCountAwarded
    }
  }
  return { totals, weeklyTimelineRecomputations }
}
```

Implement the three called helpers exactly:

```ts
async function subtractCourseLeaderboardDelta({
  entry,
  tx,
}: {
  entry: DB.LiveQuizRewardEntry
  tx: Prisma.TransactionClient
}): Promise<void> {
  const leaderboard = await tx.leaderboardEntry.findUnique({
    where: {
      type_participantId_courseId: {
        type: DB.LeaderboardType.COURSE,
        participantId: entry.participantId!,
        courseId: entry.courseId!,
      },
    },
  })
  if (!leaderboard || leaderboard.score < entry.coursePointsAwarded) {
    throw new Error('COURSE_REWARD_UNDERFLOW')
  }
  const score = leaderboard.score - entry.coursePointsAwarded
  if (score === 0) {
    await tx.leaderboardEntry.delete({ where: { id: leaderboard.id } })
  } else {
    await tx.leaderboardEntry.update({
      where: { id: leaderboard.id },
      data: { score },
    })
  }
}

async function reverseAchievementDelta({
  entry,
  tx,
}: {
  entry: DB.LiveQuizRewardEntry
  tx: Prisma.TransactionClient
}): Promise<void> {
  const instance = await tx.participantAchievementInstance.findUnique({
    where: {
      participantId_achievementId: {
        participantId: entry.participantId!,
        achievementId: entry.achievementId!,
      },
    },
  })
  if (!instance || instance.achievedCount < entry.achievementCountAwarded) {
    throw new Error('ACHIEVEMENT_REWARD_UNDERFLOW')
  }
  const achievedCount = instance.achievedCount - entry.achievementCountAwarded
  if (achievedCount === 0) {
    await tx.participantAchievementInstance.delete({
      where: { id: instance.id },
    })
  } else {
    await tx.participantAchievementInstance.update({
      where: { id: instance.id },
      data: { achievedCount },
    })
  }
}

async function reverseTimelineDelta({
  entry,
  tx,
}: {
  entry: DB.LiveQuizRewardEntry
  tx: Prisma.TransactionClient
}): Promise<WeeklyTimelineRecomputation | null> {
  const key = {
    participationId: entry.participationId!,
    courseId: entry.courseId!,
    timestamp: entry.timelineDate!,
    type: DB.TimelineEntryType.DAILY,
  }
  const daily = await tx.timelineEntry.findUnique({
    where: { participationId_courseId_timestamp_type: key },
  })

  if (daily) {
    const collectedPoints = daily.collectedPoints - entry.timelinePointsAwarded
    const collectedXp = daily.collectedXp - entry.timelineXpAwarded
    if (collectedPoints < 0 || collectedXp < 0) {
      throw new Error('TIMELINE_REWARD_UNDERFLOW')
    }
    if (collectedPoints === 0 && collectedXp === 0) {
      await tx.timelineEntry.delete({ where: { id: daily.id } })
    } else {
      await tx.timelineEntry.update({
        where: { id: daily.id },
        data: { collectedPoints, collectedXp, computedAt: new Date() },
      })
    }
    const { weekStart } = getTimelineWeekBounds(entry.timelineDate!)
    return {
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      weekStart,
    }
  }

  const { weekStart } = getTimelineWeekBounds(entry.timelineDate!)
  const weekly = await tx.timelineEntry.findUnique({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: entry.participationId!,
        courseId: entry.courseId!,
        timestamp: weekStart,
        type: DB.TimelineEntryType.WEEKLY,
      },
    },
  })
  if (!weekly) return null

  const collectedPoints = weekly.collectedPoints - entry.timelinePointsAwarded
  const collectedXp = weekly.collectedXp - entry.timelineXpAwarded
  if (collectedPoints < 0 || collectedXp < 0) {
    throw new Error('TIMELINE_REWARD_UNDERFLOW')
  }
  if (collectedPoints === 0 && collectedXp === 0) {
    await tx.timelineEntry.delete({ where: { id: weekly.id } })
  } else {
    await tx.timelineEntry.update({
      where: { id: weekly.id },
      data: { collectedPoints, collectedXp, computedAt: new Date() },
    })
  }
  return null
}
```

- [ ] **Step 5: Write failing reset-state, authorization, and concurrency tests**

In `liveQuizReset.test.ts`, cover owner and direct/derived activity `ADMIN` success, and reject unauthenticated, `READ`, `EXECUTE`, and `WRITE` callers with existing authorization behavior. Add:

```ts
const [first, second] = await Promise.all([
  resetLiveQuiz({ id: fixture.liveQuizId }, ownerCtx),
  resetLiveQuiz({ id: fixture.liveQuizId }, adminCtx),
])

expect([first.outcome, second.outcome].sort()).toEqual(['CONFLICT', 'SUCCESS'])
expect(
  await prisma.liveQuizRewardRun.count({
    where: {
      liveQuizId: fixture.liveQuizId,
      status: LiveQuizRewardRunStatus.REVERSED,
    },
  })
).toBe(1)
```

Assert the successful reset:

```ts
async function countQuizRunData(liveQuizId: string) {
  const [
    responses,
    feedbacks,
    feedbackResponses,
    confusionFeedbacks,
    leaderboardEntries,
    temporaryLeaderboardEntries,
  ] = await Promise.all([
    prisma.liveQuizResponse.count({
      where: { instance: { elementBlock: { liveQuizId } } },
    }),
    prisma.feedback.count({ where: { liveQuizId } }),
    prisma.feedbackResponse.count({
      where: { feedback: { liveQuizId } },
    }),
    prisma.confusionTimestep.count({ where: { liveQuizId } }),
    prisma.leaderboardEntry.count({
      where: { liveQuizId, type: 'SESSION' },
    }),
    prisma.temporaryLeaderboardEntry.count({
      where: { quizId: liveQuizId },
    }),
  ])
  return {
    responses,
    feedbacks,
    feedbackResponses,
    confusionFeedbacks,
    leaderboardEntries,
    temporaryLeaderboardEntries,
  }
}

expect(resetQuiz).toMatchObject({
  id: fixture.liveQuizId,
  status: PublicationStatus.DRAFT,
  startedAt: null,
  finishedAt: null,
  availableFrom: null,
  scheduledPublicationTaskId: null,
  activeBlockId: null,
  activeRewardRunId: null,
  namespace: original.namespace,
  pinCode: original.pinCode,
  courseId: original.courseId,
  name: original.name,
})
expect(resetQuiz.blocks).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      status: ElementBlockStatus.SCHEDULED,
      startedAt: null,
      closedAt: null,
      expiresAt: null,
      execution: originalExecution + 1,
    }),
  ])
)
expect(await countQuizRunData(fixture.liveQuizId)).toEqual({
  responses: 0,
  feedbacks: 0,
  feedbackResponses: 0,
  confusionFeedbacks: 0,
  leaderboardEntries: 0,
  temporaryLeaderboardEntries: 0,
})
```

Force `PARTICIPANT_XP_UNDERFLOW` by setting the fixture participant XP below
its ledger delta before reset. Assert the call rejects, the reward run remains
`APPLIED`, the quiz remains `ENDED`, and every course, timeline, achievement,
response, feedback, and leaderboard value matches the pre-call snapshot. This
failure occurs after the attempted reward-run transition and therefore proves
the transaction rolls that transition back.

- [ ] **Step 6: Run reset tests and verify failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: FAIL because `resetLiveQuiz` and shared reset-state logic are incomplete.

- [ ] **Step 7: Implement shared execution-state reset**

Import `ActivityType` from `@klicker-uzh/types`,
`getInitialInstanceResults` from `@klicker-uzh/util`, and
`getPermissionBooleans` from `./activities.js`, then implement:

```ts
function resetActivityInfoInclude(userId: string) {
  return {
    course: true,
    permissions: {
      where: { userId },
      include: { directPermission: true },
    },
    blocks: {
      include: { _count: { select: { elements: true } } },
      orderBy: { order: 'asc' },
    },
    templateInfo: true,
    _count: { select: { permissions: true } },
  } as const
}

export async function resetLiveQuizExecutionState({
  liveQuizId,
  userId,
  tx,
}: {
  liveQuizId: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUniqueOrThrow({
    where: { id: liveQuizId },
    include: {
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  for (const block of quiz.blocks) {
    await tx.elementBlock.update({
      where: { id: block.id },
      data: {
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
        expiresAt: null,
        execution: { increment: 1 },
      },
    })
    for (const instance of block.elements) {
      const initialResults = getInitialInstanceResults(instance.elementData)
      await tx.elementInstance.update({
        where: { id: instance.id },
        data: {
          liveQuizResponses: { deleteMany: {} },
          results: initialResults,
          anonymousResults: initialResults,
        },
      })
    }
  }

  const transitioned = await tx.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.ENDED,
    },
    data: {
      status: DB.PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      availableFrom: null,
      scheduledPublicationTaskId: null,
      activeBlockId: null,
      activeRewardRunId: null,
    },
  })
  if (transitioned.count !== 1) {
    throw new Error('LIVE_QUIZ_RESET_CONFLICT')
  }

  return tx.liveQuiz.update({
    where: { id: liveQuizId },
    data: {
      feedbacks: { deleteMany: {} },
      confusionFeedbacks: { deleteMany: {} },
      leaderboard: { deleteMany: {} },
      temporaryLeaderboard: { deleteMany: {} },
    },
    include: resetActivityInfoInclude(userId),
  })
}

export type ResetActivityInfoSource = Awaited<
  ReturnType<typeof resetLiveQuizExecutionState>
>

export function formatResetActivityInfo(activity: ResetActivityInfoSource) {
  const permission = activity.permissions[0]!
  const access = getPermissionBooleans({
    permissionLevel: permission.permissionLevel,
    derived: permission.derived,
    directGroupPermission:
      permission.directPermission?.userGroupId !== null &&
      permission.directPermission?.userGroupId !== undefined,
  })
  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.LIVE_QUIZ,
    status: activity.status,
    courseId: activity.courseId,
    courseName: activity.course?.name,
    courseStartDate: activity.course?.startDate,
    courseLanguage: activity.course?.language,
    numOfStacks: activity.blocks.length,
    numOfElements: activity.blocks.reduce(
      (total, block) => total + block._count.elements,
      0
    ),
    permissionLevel: permission.permissionLevel,
    derivedAccess: permission.derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: activity.pinCode,
    numSharedUsers: Math.max(0, activity._count.permissions - 1),
    ...access,
    isActivityReviewer: activity.isAssessmentEnabled,
    updatedAt: activity.updatedAt,
  }
}

export type ResetActivityInfo = ReturnType<typeof formatResetActivityInfo>
```

Delete nested `FeedbackResponse` rows through the existing cascading relation or explicitly before `feedbacks.deleteMany` if the schema does not cascade.

- [ ] **Step 8: Implement the serializable generic reset**

Use a result discriminated union:

```ts
export type ResetLiveQuizServiceResult =
  | {
      outcome: 'SUCCESS'
      activity: ResetActivityInfo
      rewardRunId: string | null
      totals: RewardReversalTotals
      weeklyTimelineRecomputations: WeeklyTimelineRecomputation[]
    }
  | {
      outcome: 'INVALID_STATE' | 'REWARD_DATA_UNAVAILABLE' | 'CONFLICT'
      activity: null
    }
```

Implement `resetLiveQuiz` so it rechecks object permission and state inside the serializable transaction, reconstructs and persists a legacy run in that same transaction when required, reverses the applied run, resets state, and returns structured outcomes:

```ts
export async function resetLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<ResetLiveQuizServiceResult> {
  try {
    return await ctx.prisma.$transaction(
      async (tx) => {
        const quiz = await loadResettableQuiz({ id, userId: ctx.user.sub, tx })
        if (
          !quiz ||
          quiz.isDeleted ||
          quiz.status !== DB.PublicationStatus.ENDED
        ) {
          return { outcome: 'INVALID_STATE', activity: null }
        }

        const rewardRunId = quiz.isAssessmentEnabled
          ? null
          : await resolveAppliedRewardRun({
              quiz,
              ctx,
              tx,
            })
        if (rewardRunId === 'REWARD_DATA_UNAVAILABLE') {
          return { outcome: 'REWARD_DATA_UNAVAILABLE', activity: null }
        }
        let totals: RewardReversalTotals = {
          coursePoints: 0,
          participantXp: 0,
          timelineChanges: 0,
          achievementChanges: 0,
        }
        let weeklyTimelineRecomputations: WeeklyTimelineRecomputation[] = []
        if (rewardRunId) {
          const reversal = await reverseLiveQuizRewardRun({
            rewardRunId,
            actorId: ctx.user.sub,
            tx,
          })
          totals = reversal.totals
          weeklyTimelineRecomputations = reversal.weeklyTimelineRecomputations
        }

        const updatedQuiz = await resetLiveQuizExecutionState({
          liveQuizId: id,
          userId: ctx.user.sub,
          tx,
        })
        return {
          outcome: 'SUCCESS',
          activity: formatResetActivityInfo(updatedQuiz),
          rewardRunId,
          totals,
          weeklyTimelineRecomputations,
        }
      },
      {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60000,
      }
    )
  } catch (error) {
    if (isPrismaSerializationConflict(error) || isRewardRunConflict(error)) {
      return { outcome: 'CONFLICT', activity: null }
    }
    throw error
  }
}
```

Define the called authorization, reward-run, and conflict helpers:

```ts
async function loadResettableQuiz({
  id,
  userId,
  tx,
}: {
  id: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUnique({
    where: { id },
    include: {
      activeRewardRun: true,
      permissions: { where: { userId } },
      course: {
        include: {
          permissions: { where: { userId } },
        },
      },
    },
  })
  if (!quiz) return null

  const regularAuthorized =
    quiz.ownerId === userId ||
    quiz.permissions.some((permission) =>
      [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER].includes(
        permission.permissionLevel
      )
    )
  const assessmentAuthorized =
    quiz.course?.permissions.some((permission) =>
      [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER].includes(
        permission.permissionLevel
      )
    ) === true
  if (
    (quiz.isAssessmentEnabled && !assessmentAuthorized) ||
    (!quiz.isAssessmentEnabled && !regularAuthorized)
  ) {
    throw new GraphQLError('LIVE_QUIZ_RESET_FORBIDDEN', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
  return quiz
}

async function resolveAppliedRewardRun({
  quiz,
  ctx,
  tx,
}: {
  quiz: NonNullable<Awaited<ReturnType<typeof loadResettableQuiz>>>
  actorId: string
  ctx: ContextWithUser
  tx: DB.Prisma.TransactionClient
}): Promise<string | 'REWARD_DATA_UNAVAILABLE' | null> {
  if (quiz.activeRewardRun) return quiz.activeRewardRun.id
  if (!quiz.isGamificationEnabled) return null

  const inspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: quiz.id, prisma: tx },
    ctx
  )
  if (inspection.status === 'UNAVAILABLE') {
    return 'REWARD_DATA_UNAVAILABLE'
  }
  return persistLiveQuizRewardRun({
    liveQuizId: quiz.id,
    plan: inspection.plan,
    tx,
  })
}

function isPrismaSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

function isRewardRunConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === 'REWARD_RUN_CONFLICT' ||
      error.message === 'LIVE_QUIZ_RESET_CONFLICT')
  )
}
```

Authorization failures use the explicit `FORBIDDEN` GraphQL error above rather
than returning a state-specific outcome.

Keep:

```ts
export async function resetAssessmentLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, isAssessmentEnabled: true },
  })
  if (!quiz) return null
  try {
    const result = await resetLiveQuiz({ id }, ctx)
    return result.outcome === 'SUCCESS' ? result.activity : null
  } catch {
    return null
  }
}
```

Re-export this compatibility function from `liveQuizzes.ts` so existing imports continue to compile.

- [ ] **Step 9: Run atomic reset and assessment compatibility tests**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- assessmentRestrictions.test.ts
```

Expected: reward reversal, reset, concurrency, failure rollback, and existing assessment tests PASS.

- [ ] **Step 10: Commit atomic reset**

```bash
git add packages/graphql/src/services/liveQuizRewards.ts packages/graphql/src/services/liveQuizReset.ts packages/graphql/src/services/liveQuizzes.ts packages/graphql/src/services/participants.ts packages/graphql/test/liveQuizRewards.test.ts packages/graphql/test/liveQuizReset.test.ts
git commit -m "feat(graphql): reset ended regular live quizzes"
```

---

### Task 5: Expose the GraphQL API and Add Reliable Cache/Audit Delivery

**Files:**

- Modify: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/schema/liveQuiz.ts`
- Modify: `packages/graphql/src/schema/query.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Create: `packages/graphql/src/graphql/ops/QGetLiveQuizResetSummary.graphql`
- Create: `packages/graphql/src/graphql/ops/MResetLiveQuiz.graphql`
- Modify: `packages/graphql/src/graphql/ops/MResetAssessmentLiveQuiz.graphql`
- Modify generated GraphQL artifacts under: `packages/graphql/src/`
- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/hatchet/src/index.ts`
- Modify: `packages/graphql/src/index.ts`
- Modify: `packages/graphql/test/helpers.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`

**Interfaces:**

- Consumes: services from Tasks 3–4, `ActivityInfo`, existing `createAuditLogEntry` task, Redis execution namespace.
- Produces:

  - GraphQL `getLiveQuizResetSummary(quizId: String!): LiveQuizResetSummary`
  - GraphQL `resetLiveQuiz(id: String!): ResetLiveQuizPayload!`
  - `handleCleanupLiveQuizResetCache({ liveQuizId, weeklyTimelineRecomputations }, globalCtx, executionCtx): Promise<boolean>`
  - prepared task `cleanupLiveQuizResetCache`.

- [ ] **Step 1: Write failing API and reliability tests**

Add service/API assertions:

```ts
import { graphql, print } from 'graphql'
import { schema } from '../src/index.js'

const auditSpy = vi.spyOn(ownerCtx.tasks.createAuditLogEntry, 'runNoWait')
const result = await graphql({
  schema,
  source: print(ResetLiveQuizDocument),
  variableValues: { id: fixture.liveQuizId },
  contextValue: ownerCtx,
})

expect(result.errors).toBeUndefined()
expect(result.data?.resetLiveQuiz).toMatchObject({
  outcome: 'SUCCESS',
  activity: {
    id: fixture.liveQuizId,
    status: PublicationStatus.DRAFT,
  },
})
```

Add structured `INVALID_STATE`, `REWARD_DATA_UNAVAILABLE`, and `CONFLICT` cases. Add spies for:

```ts
expect(auditSpy).toHaveBeenCalledWith([
  expect.objectContaining({
    message: expect.objectContaining({
      info: expect.stringContaining('"outcome":"SUCCESS"'),
    }),
  }),
])
const auditInfo = JSON.stringify(auditSpy.mock.calls)
expect(auditInfo).not.toContain(fixture.participantId!)
expect(auditInfo).not.toContain('synthetic response content')
```

Add a cache-cleanup failure case: synchronous Redis deletion throws,
`cleanupLiveQuizResetCache.runNoWait([{ liveQuizId,
weeklyTimelineRecomputations }])` is called, and the mutation still returns
`SUCCESS`. Add a historical-week recomputation failure case with the same
fallback. Add an initiation-audit failure case that asserts the database and
Redis remain unchanged.

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: FAIL because schema operations, cleanup task, and audit orchestration do not exist.

- [ ] **Step 3: Define Pothos reset types**

In `schema/liveQuiz.ts`, add:

```ts
import type {
  LiveQuizResetOutcome as LiveQuizResetOutcomeValue,
  LiveQuizResetSummary,
} from '../services/liveQuizReset.js'
import { ActivityInfoRef, type IActivityInfo } from './activities.js'

export const ResetLiveQuizOutcome = builder.enumType('ResetLiveQuizOutcome', {
  values: [
    'SUCCESS',
    'INVALID_STATE',
    'REWARD_DATA_UNAVAILABLE',
    'CONFLICT',
  ] as const,
})

export const LiveQuizResetEligibilityReason = builder.enumType(
  'LiveQuizResetEligibilityReason',
  {
    values: [
      'ELIGIBLE',
      'INVALID_STATE',
      'ASSESSMENT_POLICY',
      'REWARD_DATA_UNAVAILABLE',
    ] as const,
  }
)

export const LiveQuizLegacyReconstructionStatus = builder.enumType(
  'LiveQuizLegacyReconstructionStatus',
  {
    values: ['NOT_REQUIRED', 'AVAILABLE', 'UNAVAILABLE'] as const,
  }
)

export const LiveQuizResetSummaryRef = builder.objectRef<LiveQuizResetSummary>(
  'LiveQuizResetSummary'
)

export const LiveQuizResetSummaryType = LiveQuizResetSummaryRef.implement({
  fields: (t) => ({
    numOfResponses: t.exposeInt('numOfResponses'),
    numOfFeedbacks: t.exposeInt('numOfFeedbacks'),
    numOfConfusionFeedbacks: t.exposeInt('numOfConfusionFeedbacks'),
    numOfLeaderboardEntries: t.exposeInt('numOfLeaderboardEntries'),
    coursePointsToReverse: t.exposeInt('coursePointsToReverse'),
    xpToReverse: t.exposeInt('xpToReverse'),
    numOfTimelineChanges: t.exposeInt('numOfTimelineChanges'),
    numOfAchievementChanges: t.exposeInt('numOfAchievementChanges'),
    eligible: t.exposeBoolean('eligible'),
    reason: t.expose('reason', { type: LiveQuizResetEligibilityReason }),
    legacyReconstructionStatus: t.expose('legacyReconstructionStatus', {
      type: LiveQuizLegacyReconstructionStatus,
    }),
  }),
})

export interface IResetLiveQuizPayload {
  outcome: LiveQuizResetOutcomeValue
  activity: IActivityInfo | null
}

export const ResetLiveQuizPayloadRef = builder.objectRef<IResetLiveQuizPayload>(
  'ResetLiveQuizPayload'
)

export const ResetLiveQuizPayload = ResetLiveQuizPayloadRef.implement({
  fields: (t) => ({
    outcome: t.expose('outcome', { type: ResetLiveQuizOutcome }),
    activity: t.expose('activity', {
      type: ActivityInfoRef,
      nullable: true,
    }),
  }),
})
```

- [ ] **Step 4: Register query, mutations, and frontend operations**

Register the summary query with full-access authentication and activity `ADMIN` permission:

```ts
getLiveQuizResetSummary: t.withAuth(asUserFullAccess).field({
  type: LiveQuizResetSummaryRef,
  nullable: true,
  args: { quizId: t.arg.string({ required: true }) },
  resolve: withPermission(
    (args) => ({ liveQuizId: args.quizId }),
    DB.PermissionLevel.ADMIN,
    async (_root, args, ctx) =>
      LiveQuizResetService.getLiveQuizResetSummary(args, ctx)
  ),
}),
```

Register the canonical mutation:

```ts
resetLiveQuiz: t.withAuth(asUserFullAccess).field({
  type: ResetLiveQuizPayloadRef,
  args: { id: t.arg.string({ required: true }) },
  resolve: withPermission(
    (args) => ({ liveQuizId: args.id }),
    DB.PermissionLevel.ADMIN,
    async (_root, args, ctx) =>
      LiveQuizResetService.resetLiveQuiz(args, ctx)
  ),
}),
```

Keep the current `resetAssessmentLiveQuiz` field name, return type, and course-based policy, but delegate its resolver to `LiveQuizResetService.resetAssessmentLiveQuiz`.

Create:

```graphql
query GetLiveQuizResetSummary($quizId: String!) {
  getLiveQuizResetSummary(quizId: $quizId) {
    numOfResponses
    numOfFeedbacks
    numOfConfusionFeedbacks
    numOfLeaderboardEntries
    coursePointsToReverse
    xpToReverse
    numOfTimelineChanges
    numOfAchievementChanges
    eligible
    reason
    legacyReconstructionStatus
  }
}
```

```graphql
mutation ResetLiveQuiz($id: String!) {
  resetLiveQuiz(id: $id) {
    outcome
    activity {
      ...ActivityInfoData
    }
  }
}
```

- [ ] **Step 5: Generate GraphQL artifacts**

Run:

```bash
pnpm --filter @klicker-uzh/graphql generate
```

Expected: `ops.ts`, `ops.schema.json`, `public/schema.graphql`, `public/client.json`, and `public/server.json` change; generation exits 0.

- [ ] **Step 6: Implement idempotent cache cleanup and Hatchet retry**

In `liveQuizReset.ts`:

```ts
export async function clearLiveQuizExecutionCache({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<void> {
  const keys = await redis.keys(`lq:${liveQuizId}:*`)
  if (keys.length > 0) await redis.del(...keys)
}

export const handleCleanupLiveQuizResetCache: HatchetHandlers['handleCleanupLiveQuizResetCache'] =
  async ({ liveQuizId, weeklyTimelineRecomputations }, globalCtx) => {
    const quiz = await globalCtx.prisma.liveQuiz.findUnique({
      where: { id: liveQuizId },
      select: { isAssessmentEnabled: true },
    })
    if (!quiz) return true
    for (const recomputation of weeklyTimelineRecomputations) {
      await recomputeWeeklyTimelineEntry({
        participationId: recomputation.participationId,
        courseId: recomputation.courseId,
        weekStart: new Date(recomputation.weekStart),
        prisma: globalCtx.prisma,
      })
    }
    await clearLiveQuizExecutionCache({
      liveQuizId,
      redis: quiz.isAssessmentEnabled
        ? globalCtx.redisAssessmentExec
        : globalCtx.redisExec,
    })
    return true
  }
```

Add to `HatchetHandlers` and `PreparedHatchetTasks`:

```ts
handleCleanupLiveQuizResetCache: (
  input: {
    liveQuizId: string
    weeklyTimelineRecomputations: Array<{
      participationId: number
      courseId: string
      weekStart: string
    }>
  },
  ctx: HatchetHandlerGlobalContext,
  executionCtx: Context<unknown>
) => Promise<boolean>

cleanupLiveQuizResetCache: TaskWorkflowDeclaration<
  {
    liveQuizId: string
    weeklyTimelineRecomputations: Array<{
      participationId: number
      courseId: string
      weekStart: string
    }>
  },
  { success: boolean }
>
```

Register in `packages/hatchet/src/index.ts`:

```ts
const cleanupLiveQuizResetCache = hatchet.task({
  name: 'cleanup-live-quiz-reset-cache',
  retries: 3,
  fn: async (
    input: {
      liveQuizId: string
      weeklyTimelineRecomputations: Array<{
        participationId: number
        courseId: string
        weekStart: string
      }>
    },
    executionContext
  ) => ({
    success: await handlers.handleCleanupLiveQuizResetCache(
      input,
      globalContext,
      executionContext
    ),
  }),
})
```

Return it from `prepareHatchetTasks`, export the handler from `packages/graphql/src/index.ts`, and register the same task in `testInitialization`.

- [ ] **Step 7: Orchestrate privacy-safe audit and post-commit cleanup**

Before opening the reset transaction, require initiation scheduling:

```ts
await ctx.tasks.createAuditLogEntry.runNoWait([
  {
    message: {
      info: JSON.stringify({
        event: 'LIVE_QUIZ_RESET_INITIATED',
        actorId: ctx.user.sub,
        liveQuizId: id,
      }),
    },
  },
])
```

After a committed `SUCCESS`, prepare a serializable retry payload, recompute
the affected historical weeks from their remaining DAILY source entries, and
clear the correct Redis namespace:

```ts
const cleanupInput = {
  liveQuizId: id,
  weeklyTimelineRecomputations: committed.weeklyTimelineRecomputations.map(
    (entry) => ({
      ...entry,
      weekStart: entry.weekStart.toISOString(),
    })
  ),
}
try {
  for (const recomputation of committed.weeklyTimelineRecomputations) {
    await recomputeWeeklyTimelineEntry({
      ...recomputation,
      prisma: ctx.prisma,
    })
  }
  await clearLiveQuizExecutionCache({ liveQuizId: id, redis })
} catch {
  await ctx.tasks.cleanupLiveQuizResetCache.runNoWait([cleanupInput])
}
```

Schedule the outcome audit with aggregate reversal totals and reward-run ID only:

```ts
await ctx.tasks.createAuditLogEntry.runNoWait([
  {
    message: {
      info: JSON.stringify({
        event: 'LIVE_QUIZ_RESET_COMPLETED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        rewardRunId: committed.rewardRunId,
        outcome: committed.outcome,
        coursePoints: committed.totals.coursePoints,
        participantXp: committed.totals.participantXp,
        timelineChanges: committed.totals.timelineChanges,
        achievementChanges: committed.totals.achievementChanges,
      }),
    },
  },
])
```

For a structured blocked result, enqueue:

```ts
await ctx.tasks.createAuditLogEntry.runNoWait([
  {
    message: {
      info: JSON.stringify({
        event: 'LIVE_QUIZ_RESET_BLOCKED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        outcome: result.outcome,
      }),
    },
  },
])
```

For an unexpected exception, enqueue
`event: 'LIVE_QUIZ_RESET_FAILED'` with `actorId`, `liveQuizId`, and
`failureCode: 'UNEXPECTED_RESET_FAILURE'`, then rethrow. Do not include the
exception message, stack, or database payload in the audit message. The
existing `createAuditLogEntry` task already has `retries: 3`, so delivery
failures after enqueue retry without changing the committed reset.
If the post-commit enqueue call itself rejects, log the delivery failure
without changing the public `SUCCESS` result; the reward run's
`reversedById`/`reversedAt` remain the durable accounting record. Emit
`invalidate` for `LiveQuiz`.

At the start of a draft regular quiz in `liveQuizzes.ts`, call `clearLiveQuizExecutionCache` before writing new Redis metadata. This clean-start call must be safe when no keys exist.

- [ ] **Step 8: Run API, worker, type, and compatibility checks**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
pnpm --filter @klicker-uzh/types check
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql build
```

Expected: all tests and checks PASS, including cache fallback and audit privacy assertions.

- [ ] **Step 9: Commit the public API and reliability path**

```bash
git add packages/graphql packages/types/src/hatchet.ts packages/hatchet/src/index.ts
git commit -m "feat(graphql): expose reliable live quiz reset"
```

---

### Task 6: Generalize the Manage-Frontend Reset Experience

**Files:**

- Modify: `apps/frontend-manage/src/components/courses/modals/ActivityConfirmationModal.tsx`
- Modify: `apps/frontend-manage/src/components/courses/modals/LiveQuizResetModal.tsx`
- Modify: `apps/frontend-manage/src/components/activities/overview/LiveQuizActions.tsx`
- Modify: `apps/frontend-manage/src/components/activities/actions/useLiveQuizActions.ts`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: generated `GetLiveQuizResetSummaryDocument`, `ResetLiveQuizDocument`, reset enums and payload.
- Produces: owner/admin action visibility, modal confirmation gating, localized blocked/outcome guidance, non-assessment `data-cy` selectors, and refresh-on-success behavior.

- [ ] **Step 1: Change the shared modal contract without breaking existing callers**

Update the props:

```ts
interface ActivityConfirmationModalProps {
  onClose: () => void
  title: string
  message: string | React.ReactNode
  loading?: boolean
  onSubmit: () => Promise<boolean | void>
  submitting: boolean
  confirmations: Record<string, boolean>
  confirmationsInitializing: boolean
  primaryDisabled?: boolean
  confirmationType?: 'confirm' | 'delete'
  children: React.ReactNode
}
```

Combine disabled state and close only after a successful submit:

```ts
const disabled =
  primaryDisabled ||
  confirmationsInitializing ||
  Object.values(confirmations).some((confirmation) => !confirmation)

onPrimaryAction={async () => {
  const success = await onSubmit()
  if (success !== false) onClose()
}}
```

Existing callers that return `void` retain the current close behavior.

- [ ] **Step 2: Add exact English and German copy**

Add keys under `manage.liveQuizzes` for:

```ts
resetLiveQuizMessage:
  'The same live quiz will return to draft. The selected run data and rewards are permanently removed. Links, PIN, questions, settings, course assignment, and sharing remain unchanged. This audited action cannot be undone.',
resetRewards:
  '{points} course points, {xp} XP, {timeline} timeline changes, and {achievements} achievement changes will be reversed.',
noRewardsToReset: 'No leaderboard or external rewards need to be reversed.',
resetBlockedRewardData:
  'This legacy gamified live quiz cannot be reset because its complete reward history is no longer available. Duplicate the quiz instead.',
resetInvalidState:
  'This live quiz is no longer in an ended state. Refresh the activity list and try again.',
resetConflict:
  'Another reset changed this live quiz. Refresh the activity list to see its current state.',
resetOutcomeError:
  'The live quiz could not be reset. No reset was reported as successful.',
resetPreservedData:
  'The activity identity, PIN, questions, settings, course, and sharing are preserved.',
```

Add semantically equivalent German:

```ts
resetLiveQuizMessage:
  'Dasselbe Live Quiz wird in den Entwurfsstatus zurückgesetzt. Die ausgewählten Durchführungsdaten und Belohnungen werden dauerhaft entfernt. Links, PIN, Fragen, Einstellungen, Kurszuordnung und Freigaben bleiben unverändert. Diese protokollierte Aktion kann nicht rückgängig gemacht werden.',
resetRewards:
  '{points} Kurspunkte, {xp} XP, {timeline} Zeitleistenänderungen und {achievements} Achievement-Änderungen werden rückgängig gemacht.',
noRewardsToReset:
  'Es müssen keine Ranglisten- oder externen Belohnungen rückgängig gemacht werden.',
resetBlockedRewardData:
  'Dieses ältere gamifizierte Live Quiz kann nicht zurückgesetzt werden, weil die vollständige Belohnungshistorie nicht mehr verfügbar ist. Duplizieren Sie stattdessen das Quiz.',
resetInvalidState:
  'Dieses Live Quiz befindet sich nicht mehr im Status „beendet“. Aktualisieren Sie die Aktivitätenliste und versuchen Sie es erneut.',
resetConflict:
  'Eine andere Zurücksetzung hat dieses Live Quiz geändert. Aktualisieren Sie die Aktivitätenliste, um den aktuellen Status zu sehen.',
resetOutcomeError:
  'Das Live Quiz konnte nicht zurückgesetzt werden. Es wurde keine erfolgreiche Zurücksetzung gemeldet.',
resetPreservedData:
  'Aktivitätsidentität, PIN, Fragen, Einstellungen, Kurs und Freigaben bleiben erhalten.',
```

- [ ] **Step 3: Generalize the reset modal**

Replace assessment-specific imports with:

```ts
import { toast } from '@uzh-bf/design-system'
import {
  GetLiveQuizResetSummaryDocument,
  GetSingleCourseDocument,
  ResetLiveQuizDocument,
  ResetLiveQuizOutcome,
} from '@klicker-uzh/graphql/dist/ops'
```

Fetch with `network-only`, keep a local error outcome, and define confirmations:

```ts
const [outcome, setOutcome] = useState<ResetLiveQuizOutcome | null>(null)
const [confirmations, setConfirmations] = useState({
  deleteResponses: false,
  deleteFeedbacks: false,
  deleteConfusionFeedbacks: false,
  reverseRewards: false,
})

const summary = summaryData?.getLiveQuizResetSummary
const rewardsNotApplicable =
  summary != null &&
  summary.numOfLeaderboardEntries === 0 &&
  summary.coursePointsToReverse === 0 &&
  summary.xpToReverse === 0 &&
  summary.numOfTimelineChanges === 0 &&
  summary.numOfAchievementChanges === 0
```

Initialize empty categories as confirmed. Render four `ConfirmationItem`s with selectors:

```tsx
data={{ cy: 'confirm-reset-responses' }}
data={{ cy: 'confirm-reset-qa-feedbacks' }}
data={{ cy: 'confirm-reset-confusion-feedbacks' }}
data={{ cy: 'confirm-reset-rewards' }}
```

Use `primaryDisabled={!summary?.eligible}`. Show `resetBlockedRewardData` when `reason === 'REWARD_DATA_UNAVAILABLE'` and recommend duplication. The submit handler must interpret every outcome:

```ts
onSubmit={async () => {
  setOutcome(null)
  try {
    const { data } = await resetLiveQuiz({ variables: { id: quizId } })
    const result = data?.resetLiveQuiz
    if (!result || result.outcome !== ResetLiveQuizOutcome.Success) {
      setOutcome(result?.outcome ?? null)
      return false
    }
    await onSuccess?.()
    return true
  } catch {
    toast({
      type: 'error',
      message: t('manage.liveQuizzes.resetOutcomeError'),
      options: { duration: 4500 },
    })
    return false
  }
}}
```

Keep the modal open for `INVALID_STATE`, `REWARD_DATA_UNAVAILABLE`, `CONFLICT`, a missing payload, or a GraphQL/network error. Update the course cache only when `result.activity` is non-null.

- [ ] **Step 4: Expose regular reset only to owner/admin**

In `LiveQuizActions.tsx`, replace the assessment-only `resetLiveQuiz` entry in
the `isManager` action list with:

```ts
...(!liveQuiz.isAssessmentEnabled || liveQuiz.isActivityReviewer
  ? ['resetLiveQuiz']
  : []),
```

Because `isManager` is true only for `OWNER` and `ADMIN`, regular reset is not
added to `isEditor` or `isExecutor`. Keep `isActivityReviewer` as the additional
assessment condition.

In `useLiveQuizActions.ts`, replace:

```ts
data: {
  cy: `reset-assessment-live-quiz-${quiz.name}`
}
```

with:

```ts
data: {
  cy: `reset-live-quiz-${quiz.name}`
}
```

- [ ] **Step 5: Format and type-check the UI**

Run:

```bash
pnpm exec prettier --write apps/frontend-manage/src/components/courses/modals/ActivityConfirmationModal.tsx apps/frontend-manage/src/components/courses/modals/LiveQuizResetModal.tsx apps/frontend-manage/src/components/activities/overview/LiveQuizActions.tsx apps/frontend-manage/src/components/activities/actions/useLiveQuizActions.ts packages/i18n/messages/en.ts packages/i18n/messages/de.ts
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage build
```

Expected: Prettier changes no unrelated files; TypeScript and production build exit 0.

- [ ] **Step 6: Commit the manage UI**

```bash
git add apps/frontend-manage/src/components packages/i18n/messages/en.ts packages/i18n/messages/de.ts
git commit -m "feat(manage): confirm regular live quiz reset"
```

---

### Task 7: Verify Permissions and Reset Flow End to End

**Files:**

- Modify: `playwright/util/workflow.ts`
- Modify: `playwright/tests/O-live-quiz.spec.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`

**Interfaces:**

- Consumes: stable UI selectors and service/API behavior from Tasks 4–6.
- Produces: regression protection for the real owner/admin reset flow, forbidden permission levels, confirmation gating, blocked legacy behavior, structured errors, and preserved identity.

- [ ] **Step 1: Add a failing Playwright owner reset scenario**

In the existing serial Live Quiz workflow, create and end a regular quiz, retain its ID and PIN using `runTask`, then add:

```ts
test('Reset an ended regular live quiz as its owner', async ({
  page: testPage,
}, testInfo) => {
  page = testPage
  aliases.clear()
  testInfo.setTimeout(600_000)
  page.setDefaultNavigationTimeout(300_000)
  await loginLecturer(page)
  await openActivitiesListForQuiz(page, data.liveQuiz.name)
  const identityBefore = await runTask('getLiveQuizIdentity', {
    name: data.liveQuiz.name,
  })

  await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
  await page.getByTestId(`reset-live-quiz-${data.liveQuiz.name}`).click()

  await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
  await clickIfVisible(page, 'confirm-reset-responses')
  await clickIfVisible(page, 'confirm-reset-qa-feedbacks')
  await clickIfVisible(page, 'confirm-reset-confusion-feedbacks')
  await clickIfVisible(page, 'confirm-reset-rewards')
  await expect(page.getByTestId('confirmation-modal-confirm')).toBeEnabled()
  await page.getByTestId('confirmation-modal-confirm').click()

  await expect(
    page.getByTestId(`start-live-quiz-${data.liveQuiz.name}`)
  ).toBeVisible()
  const identityAfter = await runTask('getLiveQuizIdentity', {
    name: data.liveQuiz.name,
  })
  expect(identityAfter).toEqual({
    id: identityBefore.id,
    pinCode: identityBefore.pinCode,
    status: 'DRAFT',
  })
})
```

Add the narrow task beside `getLiveQuizPin` in
`playwright/util/workflow.ts`:

```ts
if (name === 'getLiveQuizIdentity') {
  const quiz = await prisma.liveQuiz.findFirstOrThrow({
    where: { name: args.name, isDeleted: false },
    select: { id: true, pinCode: true, status: true },
  })
  return {
    id: quiz.id,
    pinCode: quiz.pinCode,
    status: quiz.status,
  }
}
```

- [ ] **Step 2: Add permission-visibility assertions**

Extend `verifyLiveQuizOwnerPermissions` and `verifyLiveQuizADMINPermissions` so the ended fourth quiz exposes:

```ts
await expect(
  page.getByTestId(`reset-live-quiz-${data.sharing.quiz4}`)
).toBeVisible()
```

Extend `verifyLiveQuizREADPermissions`, `verifyLiveQuizEXECUTEPermissions`, and `verifyLiveQuizWRITEPermissions` so the action is absent:

```ts
await expect(
  page.getByTestId(`reset-live-quiz-${data.sharing.quiz4}`)
).toHaveCount(0)
```

Keep existing assessment permission assertions intact.

- [ ] **Step 3: Add blocked legacy and structured-failure browser cases**

Seed an ended gamified legacy quiz with leaderboard data and no XP hash. Assert:

```ts
await page.getByTestId(`reset-live-quiz-${legacyQuizName}`).click()
await expect(
  page.getByText(messages.manage.liveQuizzes.resetBlockedRewardData)
).toBeVisible()
await expect(page.getByTestId('confirmation-modal-confirm')).toBeDisabled()
```

For an `INVALID_STATE` test, open the summary, change the quiz to draft through `runTask('changeActivityStatus', ...)`, confirm, and assert the modal remains open with `resetInvalidState`. For `CONFLICT`, issue two direct GraphQL reset requests from the test fixture and assert one `SUCCESS`, one `CONFLICT`, and only one reward reversal.

- [ ] **Step 4: Run targeted GraphQL tests and the full serial Playwright workflow**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
pnpm --filter @klicker-uzh/playwright test:run:raw -- tests/O-live-quiz.spec.ts --project=chromium
```

Expected: targeted GraphQL tests PASS; the full serial Playwright workflow passes in Chromium against the real local stack. The reset scenarios intentionally reuse quizzes and permission states established by preceding tests in this workflow, so a focused `--grep` run does not provision their prerequisites.

- [ ] **Step 5: Perform mandatory browser verification**

Start the project through the repository’s real devcontainer/devrouter path if it is not already running. Then use `npx agent-browser` with delegated lecturer login and capture:

```bash
npx agent-browser open https://manage.klicker.localhost
npx agent-browser screenshot /tmp/live-quiz-reset-ended-en.png
npx agent-browser screenshot /tmp/live-quiz-reset-confirm-en.png
npx agent-browser screenshot /tmp/live-quiz-reset-draft-en.png
npx agent-browser screenshot /tmp/live-quiz-reset-confirm-de.png
npx agent-browser screenshot /tmp/live-quiz-reset-confirm-narrow.png
```

Expected visual checks:

- ended regular quiz exposes reset for owner/admin;
- all four destructive categories and preservation copy are readable;
- primary action is disabled until applicable categories are acknowledged;
- unavailable legacy reward data blocks reset and recommends duplication;
- successful reset returns the same quiz to draft;
- English and German copy fits;
- modal remains usable at a narrow viewport with no clipped primary control.

- [ ] **Step 6: Commit E2E coverage**

```bash
git add playwright/util/workflow.ts playwright/tests/O-live-quiz.spec.ts packages/graphql/test/liveQuizReset.test.ts
git commit -m "test: cover regular live quiz reset"
```

---

### Task 8: Update the Engineering Wiki and Run the Final Verification Gate

**Files:**

- Modify: `docs/domain-model.md`
- Modify: `docs/graphql-api-layer.md`
- Modify: `docs/async-and-workers.md`
- Modify: `docs/testing.md`
- Review: every file changed by Tasks 1–7

**Interfaces:**

- Consumes: completed behavior and verification evidence.
- Produces: durable engineering documentation and a clean, reviewable branch.

- [ ] **Step 1: Document the domain invariant**

Add this content to the Live Quiz/gamification section of `docs/domain-model.md`:

```markdown
### Live Quiz reward runs and reset

Every newly ended regular Live Quiz owns one active `LiveQuizRewardRun`.
Reward application, reward-entry creation, and the `ENDED` transition commit in
one transaction. Each entry stores the exact course-point, participant-XP,
timeline, and achievement deltas applied for one participant.

Reset transitions the active run from `APPLIED` to `REVERSED` in the same
serializable transaction that returns the quiz to `DRAFT` and deletes run data.
Reversed runs remain as accounting records; a later execution creates a new
run. Legacy gamified quizzes are reset only when the complete reward plan can
be reconstructed from persisted leaderboards and the unexpired Redis XP hash.

Timeline reversal targets the original daily entry and recomputes its exact
historical week. If daily compaction already removed that row, reset subtracts
the ledgered delta from the corresponding weekly entry. If neither row exists,
the timeline contribution has already disappeared and no subtraction is made.
```

- [ ] **Step 2: Document API and worker behavior**

Add to `docs/graphql-api-layer.md`:

```markdown
### Resetting an ended Live Quiz

`getLiveQuizResetSummary` and `resetLiveQuiz` require full lecturer access and
activity `ADMIN` authorization. The summary is informational; the mutation
reloads authorization, state, and reward data inside its transaction.
`resetLiveQuiz` returns `SUCCESS`, `INVALID_STATE`,
`REWARD_DATA_UNAVAILABLE`, or `CONFLICT`. Authorization failures use the
standard GraphQL error path. `resetAssessmentLiveQuiz` remains an
assessment-only compatibility field with its course owner/admin policy.
```

Add to `docs/async-and-workers.md`:

```markdown
### Live Quiz reset cache cleanup

After a committed reset, GraphQL synchronously removes `lq:<quizId>:*` keys
from the correct execution Redis and recomputes affected historical weekly
timeline entries. A failure schedules `cleanup-live-quiz-reset-cache`, an
idempotent Hatchet task with three retries that repeats both operations from
the serialized week list. The mutation still reports the committed reset as
successful. Starting a draft quiz also clears this namespace before writing
new execution metadata.
```

Record the two targeted test commands from Task 7 in `docs/testing.md`.

- [ ] **Step 3: Format and inspect the complete diff**

Run:

```bash
pnpm exec prettier --write packages/prisma/src/prisma/schema apps/analytics/prisma/schema packages/graphql/src packages/graphql/test packages/types/src/hatchet.ts packages/hatchet/src/index.ts apps/frontend-manage/src playwright/tests/O-live-quiz.spec.ts packages/i18n/messages docs .agents/skills/klicker-playwright-e2e/SKILL.md project/plans_wip/PLAN-regular-live-quiz-reset.md
git diff --check
git status --short
git diff --stat
```

Expected: Prettier succeeds; `git diff --check` prints nothing; status lists only feature files; no secrets, real participant data, response exports, or unrelated changes appear.

- [ ] **Step 4: Run generated-artifact and static checks**

Run:

```bash
pnpm run prisma:sync
pnpm run check:prisma-sync
pnpm --filter @klicker-uzh/graphql generate
pnpm run check
pnpm run format:check
pnpm run lint
opengrep scan --config auto
```

Expected: schema sync and GraphQL generation produce no unexpected diff; TypeScript, formatting, lint, and static analysis exit 0.

- [ ] **Step 5: Run targeted integration and full serial E2E verification**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- assessmentRestrictions.test.ts
pnpm --filter @klicker-uzh/playwright test:run:raw -- tests/O-live-quiz.spec.ts --project=chromium
```

Expected: all targeted integration tests and the full serial Playwright workflow PASS; no assessment authorization or behavior regression appears.

- [ ] **Step 6: Run production builds**

Run:

```bash
pnpm --filter @klicker-uzh/prisma build
pnpm --filter @klicker-uzh/types build
pnpm --filter @klicker-uzh/hatchet build
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/frontend-manage build
```

Expected: every affected package/app builds successfully.

- [ ] **Step 7: Review acceptance criteria against evidence**

Verify in the final diff and test output:

```text
owner/admin success; READ/EXECUTE/WRITE rejection
ended regular quiz only; assessment policy unchanged
same activity ID, namespace, PIN, definition, course, and sharing
quiz-local data deleted and execution state reset
exact reward ledger created on end and reversed once
legacy exact reconstruction or REWARD_DATA_UNAVAILABLE
serializable conflict protection and rollback on failure
four-category confirmation with English and German copy
privacy-safe initiation/outcome audit records
synchronous Redis cleanup plus three-retry Hatchet fallback
```

Expected: each line maps to a passing test or browser screenshot and a specific implementation diff.

- [ ] **Step 8: Commit documentation and final formatting**

```bash
git add docs packages apps playwright .agents/skills/klicker-playwright-e2e/SKILL.md project/plans_wip/PLAN-regular-live-quiz-reset.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs: describe regular live quiz reset"
```

Expected: pre-commit checks pass, staged data contains no secret or real personal information, and `git status --short` is empty after the commit.
