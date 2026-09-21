import * as DB from '@klicker-uzh/prisma/client'
import {
  accumulateAdaptiveCohortAttempt,
  createAdaptiveCohortAccumulator,
  finalizeAdaptiveCohort,
  type AdaptiveCohortAccumulator,
  type AdaptiveCohortResults,
  type AdaptiveCohortRuntime,
} from './adaptivePracticeQuizCohortAggregation.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'

export type {
  AdaptiveCohortAttemptSummary,
  AdaptiveCohortLevelBucket,
  AdaptiveCohortNodeDistribution,
  AdaptiveCohortResults,
  AdaptiveCohortRuntime,
} from './adaptivePracticeQuizCohortAggregation.js'
export type {
  AdaptiveItemDiagnostic,
  AdaptivePilotMetrics,
} from './adaptivePracticeQuizDiagnostics.js'

const COHORT_BATCH_SIZE = 250
const COHORT_SNAPSHOT_POLICY_VERSION = 3 as const
const COHORT_SNAPSHOT_SCHEMA_VERSION = 2 as const

type CanonicalAttemptReference = {
  id: string
  completedAt: Date
}

type ReleaseBoundary = {
  releaseSize: number
  releaseWatermark: Date | null
}

const cohortAttemptSelect = {
  id: true,
  stopReason: true,
  resultStatus: true,
  measurementVersion: true,
  elapsedSeconds: true,
  estimates: {
    select: {
      nodeKind: true,
      nodeId: true,
      theta: true,
      standardError: true,
      responseCount: true,
      levelId: true,
      resultStatus: true,
    },
  },
} satisfies DB.Prisma.AdaptivePracticeQuizAttemptSelect

const cohortResponseSelect = {
  attemptId: true,
  order: true,
  correct: true,
  poolItemId: true,
} satisfies DB.Prisma.AdaptivePracticeQuizResponseSelect

type CohortResponseRecord = DB.Prisma.AdaptivePracticeQuizResponseGetPayload<{
  select: typeof cohortResponseSelect
}>

// Called inside withSerializableRetry so the boundary and batches share one snapshot.
export async function getOrCreateAdaptiveCohortSnapshot(
  prisma: DB.Prisma.TransactionClient,
  runtime: AdaptiveCohortRuntime
): Promise<AdaptiveCohortResults> {
  const boundary = await loadReleaseBoundary(prisma, runtime.publication.id)
  if (boundary.releaseSize === 0 || boundary.releaseWatermark === null) {
    return finalizeAdaptiveCohort(
      runtime,
      createAdaptiveCohortAccumulator(runtime)
    )
  }

  const key = {
    publicationId: runtime.publication.id,
    releaseSize: boundary.releaseSize,
    policyVersion: COHORT_SNAPSHOT_POLICY_VERSION,
    attemptSelectionPolicy: runtime.publication.retakePolicy,
  }
  const existing = await prisma.adaptivePracticeQuizCohortSnapshot.findUnique({
    where: {
      publicationId_releaseSize_policyVersion_attemptSelectionPolicy: key,
    },
  })
  if (
    existing &&
    existing.invalidatedAt === null &&
    existing.releaseWatermark.getTime() === boundary.releaseWatermark.getTime()
  ) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_cohort_snapshot',
      outcome: 'CACHE_HIT',
      practiceQuizId: runtime.quiz.id,
      releaseSize: boundary.releaseSize,
    })
    return readSnapshotResult(existing.aggregate, runtime.quiz.id)
  }

  const startedAt = Date.now()
  const result = await materializeSnapshot(
    prisma,
    runtime,
    { ...boundary, releaseWatermark: boundary.releaseWatermark },
    key
  )
  emitAdaptiveOperationalEvent({
    name: 'adaptive_cohort_snapshot',
    outcome: 'GENERATED',
    practiceQuizId: runtime.quiz.id,
    releaseSize: boundary.releaseSize,
    generationDurationMs: Date.now() - startedAt,
  })
  emitCohortReleaseMetrics(runtime.quiz.id, result)
  return result
}

function emitCohortReleaseMetrics(
  practiceQuizId: string,
  result: AdaptiveCohortResults
) {
  const statusCounts = [
    result.attemptSummary.betweenLevels,
    result.attemptSummary.insufficientEvidence,
    result.attemptSummary.poolLimited,
    result.attemptSummary.researchOnly,
  ]
  const abstained = statusCounts.every(
    (value): value is number => typeof value === 'number'
  )
    ? statusCounts.reduce((sum, value) => sum + value, 0)
    : null
  const releasedExposureRates = result.itemDiagnostics.flatMap((item) =>
    typeof item.exposureRate === 'number' ? [item.exposureRate] : []
  )

  emitAdaptiveOperationalEvent({
    name: 'adaptive_cohort_release_metrics',
    practiceQuizId,
    releaseSize: result.cohortSize ?? 0,
    classified: result.attemptSummary.classified,
    abstained,
    betweenLevels: result.attemptSummary.betweenLevels,
    insufficientEvidence: result.attemptSummary.insufficientEvidence,
    poolLimited: result.attemptSummary.poolLimited,
    researchOnly: result.attemptSummary.researchOnly,
    medianQuestionCount: result.pilotMetrics.medianQuestionCount,
    p95QuestionCount: result.pilotMetrics.p95QuestionCount,
    maxExposureRate:
      releasedExposureRates.length === 0
        ? null
        : Math.max(...releasedExposureRates),
  })
}

async function materializeSnapshot(
  prisma: DB.Prisma.TransactionClient,
  runtime: AdaptiveCohortRuntime,
  boundary: ReleaseBoundary & { releaseWatermark: Date },
  key: {
    publicationId: string
    releaseSize: number
    policyVersion: number
    attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  }
) {
  const accumulator = createAdaptiveCohortAccumulator(runtime)
  let cursor: CanonicalAttemptReference | null = null
  while (accumulator.total < boundary.releaseSize) {
    const references = await loadCanonicalAttemptBatch({
      prisma,
      practiceQuizId: runtime.quiz.id,
      publicationId: runtime.publication.id,
      policy: runtime.publication.retakePolicy,
      cursor,
    })
    if (references.length === 0) {
      throw new Error(
        'Adaptive cohort selection ended before the release boundary.'
      )
    }
    await accumulateBatch(prisma, runtime, accumulator, references)
    cursor = references.at(-1)!
  }

  if (accumulator.total !== boundary.releaseSize) {
    throw new Error('Adaptive cohort selection exceeded its release boundary.')
  }
  const result = finalizeAdaptiveCohort(runtime, accumulator)
  const aggregate: PrismaJson.PrismaAdaptivePracticeQuizCohortSnapshot = {
    schemaVersion: COHORT_SNAPSHOT_SCHEMA_VERSION,
    result,
  }
  await prisma.adaptivePracticeQuizCohortSnapshot.upsert({
    where: {
      publicationId_releaseSize_policyVersion_attemptSelectionPolicy: key,
    },
    create: {
      ...key,
      configId: runtime.config.id,
      practiceQuizId: runtime.quiz.id,
      scaleVersionId: runtime.publication.scaleVersionId,
      measurementVersion: runtime.publication.measurementVersion,
      releaseWatermark: boundary.releaseWatermark,
      aggregate,
    },
    update: {
      releaseWatermark: boundary.releaseWatermark,
      aggregate,
      invalidatedAt: null,
    },
  })
  return result
}

async function loadReleaseBoundary(
  prisma: DB.Prisma.TransactionClient,
  publicationId: string
): Promise<ReleaseBoundary> {
  const rows = await prisma.$queryRaw<ReleaseBoundary[]>`
    SELECT
      COUNT(DISTINCT "participantId")::int AS "releaseSize",
      MAX("completedAt") AS "releaseWatermark"
    FROM "AdaptivePracticeQuizAttempt"
    WHERE "publicationId" = ${publicationId}::uuid
      AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
      AND "completedAt" IS NOT NULL
  `
  return rows[0] ?? { releaseSize: 0, releaseWatermark: null }
}

async function loadCanonicalAttemptBatch({
  prisma,
  practiceQuizId,
  publicationId,
  policy,
  cursor,
}: {
  prisma: DB.Prisma.TransactionClient
  practiceQuizId: string
  publicationId: string
  policy: DB.AdaptiveAttemptSelectionPolicy
  cursor: CanonicalAttemptReference | null
}): Promise<CanonicalAttemptReference[]> {
  const cursorFilter = cursor
    ? DB.Prisma
        .sql`AND (canonical."completedAt", canonical."id") > (${cursor.completedAt}, ${cursor.id}::uuid)`
    : DB.Prisma.sql``

  return prisma.$queryRaw<CanonicalAttemptReference[]>`
    WITH ranked AS (
      SELECT
        attempt."id",
        attempt."completedAt",
        ROW_NUMBER() OVER (
          PARTITION BY attempt."participantId"
          ORDER BY
            CASE WHEN ${policy}::"AdaptiveAttemptSelectionPolicy" = 'FIRST_COMPLETED'::"AdaptiveAttemptSelectionPolicy" THEN attempt."completedAt" END ASC,
            CASE WHEN ${policy}::"AdaptiveAttemptSelectionPolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy" THEN attempt."completedAt" END DESC,
            CASE WHEN ${policy}::"AdaptiveAttemptSelectionPolicy" = 'FIRST_COMPLETED'::"AdaptiveAttemptSelectionPolicy" THEN attempt."id" END ASC,
            CASE WHEN ${policy}::"AdaptiveAttemptSelectionPolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy" THEN attempt."id" END DESC
        ) AS attempt_rank
      FROM "AdaptivePracticeQuizAttempt" attempt
      WHERE attempt."practiceQuizId" = ${practiceQuizId}::uuid
        AND attempt."publicationId" = ${publicationId}::uuid
        AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
        AND attempt."completedAt" IS NOT NULL
    ), canonical AS (
      SELECT "id", "completedAt"
      FROM ranked
      WHERE attempt_rank = 1
    )
    SELECT "id", "completedAt"
    FROM canonical
    WHERE TRUE ${cursorFilter}
    ORDER BY "completedAt", "id"
    LIMIT ${COHORT_BATCH_SIZE}
  `
}

async function accumulateBatch(
  prisma: DB.Prisma.TransactionClient,
  runtime: AdaptiveCohortRuntime,
  accumulator: AdaptiveCohortAccumulator,
  references: CanonicalAttemptReference[]
) {
  const attemptIds = references.map(({ id }) => id)
  const attempts = await prisma.adaptivePracticeQuizAttempt.findMany({
    where: { id: { in: attemptIds } },
    select: cohortAttemptSelect,
  })
  const responses = await prisma.adaptivePracticeQuizResponse.findMany({
    where: { attemptId: { in: attemptIds } },
    select: cohortResponseSelect,
    orderBy: [{ attemptId: 'asc' }, { order: 'asc' }],
  })
  const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]))
  const responsesByAttempt = new Map<string, CohortResponseRecord[]>()
  for (const response of responses) {
    const entries = responsesByAttempt.get(response.attemptId) ?? []
    entries.push(response)
    responsesByAttempt.set(response.attemptId, entries)
  }

  for (const reference of references) {
    const attempt = attemptsById.get(reference.id)
    if (!attempt) {
      throw new Error('A canonical adaptive cohort attempt disappeared.')
    }
    accumulateAdaptiveCohortAttempt(
      runtime,
      accumulator,
      attempt,
      responsesByAttempt.get(reference.id) ?? []
    )
  }
}

function readSnapshotResult(
  aggregate: PrismaJson.PrismaAdaptivePracticeQuizCohortSnapshot,
  practiceQuizId: string
): AdaptiveCohortResults {
  if (aggregate.schemaVersion !== COHORT_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error('Adaptive cohort snapshot metadata is inconsistent.')
  }
  if (aggregate.result.practiceQuizId !== practiceQuizId) {
    throw new Error('Adaptive cohort snapshot metadata is inconsistent.')
  }
  return aggregate.result
}
