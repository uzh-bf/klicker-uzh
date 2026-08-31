import { Prisma } from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'

export type FreeTextRetryAnalyticsData = {
  cycleCount: number
  totalAttempts: number
  averageAttempts: number
  successRate: number
  revealRate: number
  unavailableCount: number
  first: {
    correct: number
    partial: number
    incorrect: number
  }
  best: {
    correct: number
    partial: number
    incorrect: number
  }
}

type FreeTextRetryAnalyticsRow = {
  instanceId: number
  cycleCount: bigint
  totalAttempts: bigint
  successfulCycles: bigint
  revealedCycles: bigint
  unavailableCount: bigint
  firstCorrect: bigint
  firstPartial: bigint
  firstIncorrect: bigint
  bestCorrect: bigint
  bestPartial: bigint
  bestIncorrect: bigint
}

function safeAggregateCount(value: bigint) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(
      'Free-text retry analytics count exceeds safe integer range'
    )
  }
  return count
}

function emptyCategoryCounts() {
  return { correct: 0, partial: 0, incorrect: 0 }
}

function emptyFreeTextRetryAnalytics(): FreeTextRetryAnalyticsData {
  return {
    cycleCount: 0,
    totalAttempts: 0,
    averageAttempts: 0,
    successRate: 0,
    revealRate: 0,
    unavailableCount: 0,
    first: emptyCategoryCounts(),
    best: emptyCategoryCounts(),
  }
}

function mapFreeTextRetryAnalytics(
  row: FreeTextRetryAnalyticsRow
): FreeTextRetryAnalyticsData {
  const cycleCount = safeAggregateCount(row.cycleCount)
  const totalAttempts = safeAggregateCount(row.totalAttempts)

  return {
    cycleCount,
    totalAttempts,
    averageAttempts: cycleCount > 0 ? totalAttempts / cycleCount : 0,
    successRate:
      cycleCount > 0
        ? safeAggregateCount(row.successfulCycles) / cycleCount
        : 0,
    revealRate:
      cycleCount > 0 ? safeAggregateCount(row.revealedCycles) / cycleCount : 0,
    unavailableCount: safeAggregateCount(row.unavailableCount),
    first: {
      correct: safeAggregateCount(row.firstCorrect),
      partial: safeAggregateCount(row.firstPartial),
      incorrect: safeAggregateCount(row.firstIncorrect),
    },
    best: {
      correct: safeAggregateCount(row.bestCorrect),
      partial: safeAggregateCount(row.bestPartial),
      incorrect: safeAggregateCount(row.bestIncorrect),
    },
  }
}

export async function getFreeTextRetryAnalyticsByInstance(
  practiceQuizId: string,
  instanceIds: number[],
  ctx: ContextWithUser
) {
  const analyticsByInstance = new Map<number, FreeTextRetryAnalyticsData>(
    instanceIds.map((instanceId) => [instanceId, emptyFreeTextRetryAnalytics()])
  )
  if (instanceIds.length === 0) return analyticsByInstance

  const rows = await ctx.prisma.$queryRaw<FreeTextRetryAnalyticsRow[]>(
    Prisma.sql`
      WITH "semanticInstances" AS (
        SELECT UNNEST(ARRAY[${Prisma.join(instanceIds)}]::integer[]) AS "instanceId"
      ),
      "cycleMetrics" AS (
        SELECT
          cycle.id,
          cycle."elementInstanceId" AS "instanceId",
          cycle."solutionRevealedAt" IS NOT NULL AS "revealed",
          COUNT(attempt.id)::bigint AS "totalAttempts",
          COALESCE(
            SUM(
              attempt."evaluationRevision" +
              CASE
                WHEN attempt."evaluationStatus" = 'UNAVAILABLE'::"FreeTextEvaluationStatus"
                  THEN 1
                ELSE 0
              END
            ),
            0
          )::bigint AS "unavailableCount",
          (
            ARRAY_AGG(attempt.correctness ORDER BY attempt.ordinal) FILTER (
              WHERE attempt."evaluationStatus" = 'EVALUATED'::"FreeTextEvaluationStatus"
                AND attempt.correctness IS NOT NULL
            )
          )[1] AS "firstCategory",
          MAX(
            CASE attempt.correctness
              WHEN 'CORRECT'::"FreeTextCorrectnessCategory" THEN 2
              WHEN 'PARTIAL'::"FreeTextCorrectnessCategory" THEN 1
              WHEN 'INCORRECT'::"FreeTextCorrectnessCategory" THEN 0
              ELSE NULL
            END
          ) FILTER (
            WHERE attempt."evaluationStatus" = 'EVALUATED'::"FreeTextEvaluationStatus"
          ) AS "bestRank"
        FROM "FreeTextPracticeCycle" cycle
        JOIN "semanticInstances" instance
          ON instance."instanceId" = cycle."elementInstanceId"
        LEFT JOIN "FreeTextAttempt" attempt ON attempt."cycleId" = cycle.id
        WHERE cycle."practiceQuizId" = ${practiceQuizId}::uuid
        GROUP BY cycle.id
      )
      SELECT
        instance."instanceId",
        COUNT(cycle.id)::bigint AS "cycleCount",
        COALESCE(SUM(cycle."totalAttempts"), 0)::bigint AS "totalAttempts",
        COUNT(cycle.id) FILTER (WHERE cycle."bestRank" = 2)::bigint AS "successfulCycles",
        COUNT(cycle.id) FILTER (WHERE cycle."revealed")::bigint AS "revealedCycles",
        COALESCE(SUM(cycle."unavailableCount"), 0)::bigint AS "unavailableCount",
        COUNT(cycle.id) FILTER (
          WHERE cycle."firstCategory" = 'CORRECT'::"FreeTextCorrectnessCategory"
        )::bigint AS "firstCorrect",
        COUNT(cycle.id) FILTER (
          WHERE cycle."firstCategory" = 'PARTIAL'::"FreeTextCorrectnessCategory"
        )::bigint AS "firstPartial",
        COUNT(cycle.id) FILTER (
          WHERE cycle."firstCategory" = 'INCORRECT'::"FreeTextCorrectnessCategory"
        )::bigint AS "firstIncorrect",
        COUNT(cycle.id) FILTER (WHERE cycle."bestRank" = 2)::bigint AS "bestCorrect",
        COUNT(cycle.id) FILTER (WHERE cycle."bestRank" = 1)::bigint AS "bestPartial",
        COUNT(cycle.id) FILTER (WHERE cycle."bestRank" = 0)::bigint AS "bestIncorrect"
      FROM "semanticInstances" instance
      LEFT JOIN "cycleMetrics" cycle
        ON cycle."instanceId" = instance."instanceId"
      GROUP BY instance."instanceId"
    `
  )

  for (const row of rows) {
    analyticsByInstance.set(row.instanceId, mapFreeTextRetryAnalytics(row))
  }
  return analyticsByInstance
}
