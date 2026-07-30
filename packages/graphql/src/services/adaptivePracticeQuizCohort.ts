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
import { ADAPTIVE_PRIVACY_MIN_CELL_SIZE } from './adaptivePracticeQuizPrivacy.js'

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
const COHORT_SNAPSHOT_POLICY_VERSION = 1

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
  elapsedSeconds: true,
  estimates: {
    select: {
      nodeKind: true,
      nodeId: true,
      theta: true,
      standardError: true,
      responseCount: true,
      levelId: true,
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

export async function getOrCreateAdaptiveCohortSnapshot(
  prisma: DB.Prisma.TransactionClient,
  runtime: AdaptiveCohortRuntime
): Promise<AdaptiveCohortResults> {
  const boundary = await loadReleaseBoundary(prisma, runtime.quiz.id)
  if (boundary.releaseSize === 0 || boundary.releaseWatermark === null) {
    return finalizeAdaptiveCohort(
      runtime,
      createAdaptiveCohortAccumulator(runtime)
    )
  }

  const key = {
    configId: runtime.config.id,
    releaseSize: boundary.releaseSize,
    policyVersion: COHORT_SNAPSHOT_POLICY_VERSION,
    attemptSelectionPolicy: runtime.config.attemptSelectionPolicy,
  }
  const existing = await prisma.adaptivePracticeQuizCohortSnapshot.findUnique({
    where: {
      configId_releaseSize_policyVersion_attemptSelectionPolicy: key,
    },
  })
  if (existing && existing.invalidatedAt === null) {
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
  return result
}

async function materializeSnapshot(
  prisma: DB.Prisma.TransactionClient,
  runtime: AdaptiveCohortRuntime,
  boundary: ReleaseBoundary & { releaseWatermark: Date },
  key: {
    configId: string
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
      releaseSize: boundary.releaseSize,
      policy: runtime.config.attemptSelectionPolicy,
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
    schemaVersion: 1,
    result,
  }
  await prisma.adaptivePracticeQuizCohortSnapshot.upsert({
    where: {
      configId_releaseSize_policyVersion_attemptSelectionPolicy: key,
    },
    create: {
      ...key,
      practiceQuizId: runtime.quiz.id,
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
  practiceQuizId: string
): Promise<ReleaseBoundary> {
  const rows = await prisma.$queryRaw<ReleaseBoundary[]>`
    WITH first_completions AS (
      SELECT DISTINCT ON ("participantId")
        "participantId",
        "completedAt",
        "id"
      FROM "AdaptivePracticeQuizAttempt"
      WHERE "practiceQuizId" = ${practiceQuizId}::uuid
        AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
        AND "completedAt" IS NOT NULL
      ORDER BY "participantId", "completedAt", "id"
    ), ordered AS (
      SELECT
        "completedAt",
        ROW_NUMBER() OVER (ORDER BY "completedAt", "id") AS release_order
      FROM first_completions
    ), release AS (
      SELECT ((COUNT(*) / ${ADAPTIVE_PRIVACY_MIN_CELL_SIZE}) * ${ADAPTIVE_PRIVACY_MIN_CELL_SIZE})::int AS release_size
      FROM ordered
    )
    SELECT
      release.release_size AS "releaseSize",
      ordered."completedAt" AS "releaseWatermark"
    FROM release
    LEFT JOIN ordered ON ordered.release_order = release.release_size
  `
  return rows[0] ?? { releaseSize: 0, releaseWatermark: null }
}

async function loadCanonicalAttemptBatch({
  prisma,
  practiceQuizId,
  releaseSize,
  policy,
  cursor,
}: {
  prisma: DB.Prisma.TransactionClient
  practiceQuizId: string
  releaseSize: number
  policy: DB.AdaptiveAttemptSelectionPolicy
  cursor: CanonicalAttemptReference | null
}): Promise<CanonicalAttemptReference[]> {
  const cursorFilter = cursor
    ? DB.Prisma
        .sql`AND (canonical."completedAt", canonical."id") > (${cursor.completedAt}, ${cursor.id}::uuid)`
    : DB.Prisma.sql``

  return prisma.$queryRaw<CanonicalAttemptReference[]>`
    WITH first_completions AS (
      SELECT DISTINCT ON ("participantId")
        "participantId",
        "completedAt",
        "id"
      FROM "AdaptivePracticeQuizAttempt"
      WHERE "practiceQuizId" = ${practiceQuizId}::uuid
        AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
        AND "completedAt" IS NOT NULL
      ORDER BY "participantId", "completedAt", "id"
    ), release_participants AS (
      SELECT "participantId", "completedAt", "id"
      FROM first_completions
      ORDER BY "completedAt", "id"
      LIMIT ${releaseSize}
    ), release_boundary AS (
      SELECT "completedAt", "id"
      FROM release_participants
      ORDER BY "completedAt" DESC, "id" DESC
      LIMIT 1
    ), ranked AS (
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
      INNER JOIN release_participants participant
        ON participant."participantId" = attempt."participantId"
      CROSS JOIN release_boundary boundary
      WHERE attempt."practiceQuizId" = ${practiceQuizId}::uuid
        AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
        AND attempt."completedAt" IS NOT NULL
        AND (attempt."completedAt", attempt."id") <= (boundary."completedAt", boundary."id")
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
  if (
    aggregate.schemaVersion !== COHORT_SNAPSHOT_POLICY_VERSION ||
    aggregate.result.practiceQuizId !== practiceQuizId
  ) {
    throw new Error('Adaptive cohort snapshot metadata is inconsistent.')
  }
  return aggregate.result
}
