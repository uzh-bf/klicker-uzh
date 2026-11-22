import * as DB from '@klicker-uzh/prisma/client'
import type {
  AdaptivePracticeQuizBenchmarkFixture,
  AdaptivePracticeQuizBenchmarkProfile,
} from './adaptivePracticeQuizPerformanceBenchmarkFixture.js'

export type AdaptivePracticeQuizBenchmarkQuery = {
  name:
    | 'completed-attempt-release-order'
    | 'participant-attempt-selection'
    | 'estimate-node-level-aggregation'
    | 'response-pool-item-diagnostics'
  description: string
  expectedIndexes: string[]
  sql: DB.Prisma.Sql
}

export function buildAdaptivePracticeQuizBenchmarkQueries(
  fixture: AdaptivePracticeQuizBenchmarkFixture,
  profile: AdaptivePracticeQuizBenchmarkProfile
): AdaptivePracticeQuizBenchmarkQuery[] {
  return [
    {
      name: 'completed-attempt-release-order',
      description:
        'Computes the fixed five-participant release size and watermark from first completions.',
      expectedIndexes: [
        'apqa_quiz_status_completed_idx',
        'apqa_quiz_participant_completed_idx',
      ],
      sql: DB.Prisma.sql`
        WITH first_completions AS (
          SELECT DISTINCT ON ("participantId")
            "participantId",
            "completedAt",
            "id"
          FROM "AdaptivePracticeQuizAttempt"
          WHERE "practiceQuizId" = ${fixture.practiceQuizId}::uuid
            AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
            AND "completedAt" IS NOT NULL
          ORDER BY "participantId", "completedAt", "id"
        ), ordered AS (
          SELECT
            "completedAt",
            "id",
            ROW_NUMBER() OVER (ORDER BY "completedAt", "id") AS release_order
          FROM first_completions
        ), release AS (
          SELECT ((COUNT(*) / 5) * 5)::integer AS release_size
          FROM ordered
        )
        SELECT
          release.release_size AS "releaseSize",
          ordered."completedAt" AS "releaseWatermark"
        FROM release
        LEFT JOIN ordered ON ordered.release_order = release.release_size
      `,
    },
    {
      name: 'participant-attempt-selection',
      description:
        'Selects a bounded page of canonical latest attempts inside the fixed release boundary.',
      expectedIndexes: [
        'apqa_quiz_status_completed_idx',
        'apqa_quiz_participant_completed_idx',
      ],
      sql: DB.Prisma.sql`
        WITH first_completions AS (
          SELECT DISTINCT ON ("participantId")
            "participantId",
            "completedAt",
            "id"
          FROM "AdaptivePracticeQuizAttempt"
          WHERE "practiceQuizId" = ${fixture.practiceQuizId}::uuid
            AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
            AND "completedAt" IS NOT NULL
          ORDER BY "participantId", "completedAt", "id"
        ), release_participants AS (
          SELECT "participantId", "completedAt", "id"
          FROM first_completions
          ORDER BY "completedAt", "id"
          LIMIT ${profile.participantCount}
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
              ORDER BY attempt."completedAt" DESC, attempt."id" DESC
            ) AS attempt_rank
          FROM "AdaptivePracticeQuizAttempt" attempt
          INNER JOIN release_participants participant
            ON participant."participantId" = attempt."participantId"
          CROSS JOIN release_boundary boundary
          WHERE attempt."practiceQuizId" = ${fixture.practiceQuizId}::uuid
            AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
            AND attempt."completedAt" IS NOT NULL
            AND (attempt."completedAt", attempt."id") <= (boundary."completedAt", boundary."id")
        )
        SELECT "id", "completedAt"
        FROM ranked
        WHERE attempt_rank = 1
        ORDER BY "completedAt", "id"
        LIMIT 250
      `,
    },
    {
      name: 'estimate-node-level-aggregation',
      description:
        'Aggregates overall and 500-node estimates for canonical completed attempts by node and level.',
      expectedIndexes: [
        'apqa_quiz_participant_completed_idx',
        'apqe_attempt_node_level_idx',
        'apqe_config_tree_idx',
      ],
      sql: DB.Prisma.sql`
        WITH canonical AS MATERIALIZED (
          SELECT DISTINCT ON (attempt."participantId")
            attempt."id"
          FROM "AdaptivePracticeQuizAttempt" attempt
          WHERE attempt."practiceQuizId" = ${fixture.practiceQuizId}::uuid
            AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
            AND attempt."completedAt" IS NOT NULL
          ORDER BY attempt."participantId", attempt."completedAt" DESC, attempt."id" DESC
        )
        SELECT
          estimate."nodeKind",
          estimate."nodeId",
          estimate."levelId",
          COUNT(*)::integer AS "estimateCount",
          AVG(estimate."theta") AS "averageTheta",
          AVG(estimate."standardError") AS "averageStandardError",
          SUM(estimate."responseCount")::bigint AS "responseCount"
        FROM canonical
        INNER JOIN "AdaptivePracticeQuizEstimate" estimate
          ON estimate."attemptId" = canonical."id"
          AND estimate."configId" = ${fixture.configId}::uuid
          AND estimate."competenceTreeId" = ${fixture.competenceTreeId}::uuid
        GROUP BY estimate."nodeKind", estimate."nodeId", estimate."levelId"
        ORDER BY estimate."nodeKind", estimate."nodeId" NULLS FIRST, estimate."levelId"
      `,
    },
    {
      name: 'response-pool-item-diagnostics',
      description:
        'Aggregates canonical responses across every published pool item, including zero-exposure items.',
      expectedIndexes: [
        'apqa_quiz_participant_completed_idx',
        'apqr_config_pool_attempt_idx',
        'pqapi_config_id_key',
      ],
      sql: DB.Prisma.sql`
        WITH canonical AS MATERIALIZED (
          SELECT DISTINCT ON (attempt."participantId")
            attempt."id"
          FROM "AdaptivePracticeQuizAttempt" attempt
          WHERE attempt."practiceQuizId" = ${fixture.practiceQuizId}::uuid
            AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
            AND attempt."completedAt" IS NOT NULL
          ORDER BY attempt."participantId", attempt."completedAt" DESC, attempt."id" DESC
        ), diagnostics AS MATERIALIZED (
          SELECT
            response."poolItemId",
            COUNT(*)::integer AS response_count,
            COUNT(DISTINCT response."attemptId")::integer AS exposure_count,
            AVG(CASE WHEN response."correct" THEN 1.0 ELSE 0.0 END) AS observed_correct_rate
          FROM canonical
          INNER JOIN "AdaptivePracticeQuizResponse" response
            ON response."attemptId" = canonical."id"
            AND response."configId" = ${fixture.configId}::uuid
          GROUP BY response."poolItemId"
        )
        SELECT
          pool."id" AS "poolItemId",
          pool."leafNodeId",
          pool."levelId",
          COALESCE(diagnostics.response_count, 0) AS "responseCount",
          COALESCE(diagnostics.exposure_count, 0) AS "exposureCount",
          diagnostics.observed_correct_rate AS "observedCorrectRate"
        FROM "PracticeQuizAdaptivePoolItem" pool
        LEFT JOIN diagnostics ON diagnostics."poolItemId" = pool."id"
        WHERE pool."configId" = ${fixture.configId}::uuid
        ORDER BY pool."id"
      `,
    },
  ]
}

export async function explainAdaptivePracticeQuizBenchmarkQuery(
  prisma: DB.PrismaClient,
  query: AdaptivePracticeQuizBenchmarkQuery
): Promise<unknown> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(
    DB.Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      ${query.sql}
    `
  )
  return readExplainPlan(rows)
}

export async function explainAdaptiveEstimatePersistence(
  prisma: DB.PrismaClient,
  fixture: AdaptivePracticeQuizBenchmarkFixture
): Promise<unknown> {
  const nodeRows = fixture.nodes.slice(0, 250)
  const attemptId = fixture.contentionAttemptIds[0]
  if (!attemptId || nodeRows.length === 0) {
    throw new Error('Adaptive estimate EXPLAIN fixture is incomplete.')
  }
  const values = DB.Prisma.join(
    nodeRows.map(
      (node, index) => DB.Prisma.sql`
      (
        ${attemptId}::uuid,
        ${fixture.configId}::uuid,
        ${fixture.competenceTreeId}::uuid,
        ${
          node.kind === DB.AdaptiveNodeKind.COMPETENCE
            ? DB.AdaptiveEstimateNodeKind.COMPETENCE
            : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE
        }::"AdaptiveEstimateNodeKind",
        ${node.id}::integer,
        ${((index % 7) - 3) / 10}::double precision,
        ${0.5 + (index % 5) / 10}::double precision,
        1::integer,
        ${fixture.levelId}::integer,
        NULL::"AdaptivePracticeQuizStopReason"
      )
    `
    )
  )
  const rollback = new ExplainRollback()
  let plan: unknown
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(
          DB.Prisma.sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            INSERT INTO "AdaptivePracticeQuizEstimate" (
              "attemptId",
              "configId",
              "competenceTreeId",
              "nodeKind",
              "nodeId",
              "theta",
              "standardError",
              "responseCount",
              "levelId",
              "stopReason"
            )
            VALUES ${values}
            ON CONFLICT ("attemptId", "nodeKind", "nodeId")
            DO UPDATE SET
              "configId" = EXCLUDED."configId",
              "competenceTreeId" = EXCLUDED."competenceTreeId",
              "theta" = EXCLUDED."theta",
              "standardError" = EXCLUDED."standardError",
              "responseCount" = EXCLUDED."responseCount",
              "levelId" = EXCLUDED."levelId",
              "stopReason" = EXCLUDED."stopReason"
          `
        )
        plan = readExplainPlan(rows)
        throw rollback
      },
      { maxWait: 5_000, timeout: 60_000 }
    )
  } catch (error) {
    if (error !== rollback) throw error
  }
  if (plan === undefined) {
    throw new Error('Adaptive estimate EXPLAIN did not return a plan.')
  }
  return plan
}

function readExplainPlan(rows: Array<Record<string, unknown>>): unknown {
  const row = rows[0]
  if (!row) throw new Error('PostgreSQL EXPLAIN returned no rows.')
  const plan = row['QUERY PLAN'] ?? row['query plan']
  if (plan === undefined) {
    throw new Error('PostgreSQL EXPLAIN returned an unexpected row shape.')
  }
  return plan
}

class ExplainRollback extends Error {
  constructor() {
    super('Rollback EXPLAIN ANALYZE write')
  }
}
