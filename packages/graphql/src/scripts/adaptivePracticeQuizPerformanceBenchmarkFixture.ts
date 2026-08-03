import * as DB from '@klicker-uzh/prisma/client'

export type AdaptivePracticeQuizBenchmarkProfile = {
  name: 'smoke' | 'full'
  isMaximumShape: boolean
  rootCount: number
  levelCount: number
  itemsPerLeafLevel: number
  participantCount: number
  responsesPerAttempt: number
  queryWarmups: number
  queryIterations: number
  persistenceConcurrency: number
  persistenceRounds: number
}

export const ADAPTIVE_PRACTICE_QUIZ_BENCHMARK_PROFILES = {
  smoke: {
    name: 'smoke',
    isMaximumShape: false,
    rootCount: 2,
    levelCount: 2,
    itemsPerLeafLevel: 2,
    participantCount: 10,
    responsesPerAttempt: 2,
    queryWarmups: 1,
    queryIterations: 5,
    persistenceConcurrency: 2,
    persistenceRounds: 2,
  },
  full: {
    name: 'full',
    isMaximumShape: true,
    rootCount: 250,
    levelCount: 20,
    itemsPerLeafLevel: 2,
    participantCount: 10_000,
    responsesPerAttempt: 50,
    queryWarmups: 5,
    queryIterations: 100,
    persistenceConcurrency: 16,
    persistenceRounds: 10,
  },
} as const satisfies Record<string, AdaptivePracticeQuizBenchmarkProfile>

type BenchmarkNode = {
  id: number
  kind: DB.AdaptiveNodeKind
}

export type AdaptivePracticeQuizBenchmarkPoolItem = {
  id: number
  sourceAssignmentId: number
  elementId: number
}

export type AdaptivePracticeQuizBenchmarkFixture = {
  runLabel: string
  participantPrefix: string
  ownerId: string
  courseId: string
  competenceTreeId: string
  practiceQuizId: string
  configId: string
  levelId: number
  nodes: BenchmarkNode[]
  contentionAttemptIds: string[]
  persistencePoolItems: AdaptivePracticeQuizBenchmarkPoolItem[]
}

export type AdaptivePracticeQuizBenchmarkFixtureCounts = {
  nodes: number
  elements: number
  poolItems: number
  participants: number
  completedAttempts: number
  contentionAttempts: number
  responses: number
  estimates: number
}

export async function createAdaptivePracticeQuizBenchmarkFixture(
  prisma: DB.PrismaClient,
  profile: AdaptivePracticeQuizBenchmarkProfile,
  runLabel: string
): Promise<AdaptivePracticeQuizBenchmarkFixture> {
  const participantPrefix = `${runLabel}-participant-`
  const elementPrefix = `${runLabel}-element-`
  const contentionGroupCount = Math.ceil(profile.persistenceConcurrency / 2)
  const persistencePoolItemCount = profile.persistenceRounds * 2

  return prisma.$transaction(
    async (tx) => {
      const owner = await tx.user.create({
        data: {
          email: `${runLabel}@benchmark.invalid`,
          shortname: runLabel,
        },
      })
      const course = await tx.course.create({
        data: {
          name: `${runLabel}-course`,
          displayName: 'Adaptive practice quiz benchmark course',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
          pinCode: 6543,
          ownerId: owner.id,
          isAdaptiveLearningEnabled: true,
        },
      })
      const tree = await tx.competenceTree.create({
        data: {
          name: `${runLabel}-tree`,
          displayName: 'Adaptive practice quiz benchmark tree',
          ownerId: owner.id,
        },
      })

      await tx.competenceTreeLevel.createMany({
        data: Array.from({ length: profile.levelCount }, (_, index) => ({
          treeId: tree.id,
          label: `Benchmark level ${index + 1}`,
          order: index,
        })),
      })
      const levels = await tx.competenceTreeLevel.findMany({
        where: { treeId: tree.id },
        orderBy: { order: 'asc' },
      })

      await tx.competenceTreeNode.createMany({
        data: Array.from({ length: profile.rootCount }, (_, index) => ({
          treeId: tree.id,
          kind: DB.AdaptiveNodeKind.COMPETENCE,
          name: `Benchmark root ${index + 1}`,
          order: index,
          depth: 0,
        })),
      })
      const roots = await tx.competenceTreeNode.findMany({
        where: { treeId: tree.id, depth: 0 },
        orderBy: { order: 'asc' },
      })
      await tx.competenceTreeNode.createMany({
        data: roots.map((root, index) => ({
          treeId: tree.id,
          kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
          name: `Benchmark leaf ${index + 1}`,
          order: 0,
          depth: 1,
          parentId: root.id,
        })),
      })
      const nodes = await tx.competenceTreeNode.findMany({
        where: { treeId: tree.id },
        select: { id: true, kind: true },
        orderBy: { id: 'asc' },
      })

      const quiz = await tx.practiceQuiz.create({
        data: {
          name: `${runLabel}-quiz`,
          displayName: 'Adaptive practice quiz benchmark',
          ownerId: owner.id,
          courseId: course.id,
          mode: DB.PracticeQuizMode.ADAPTIVE,
          status: DB.PublicationStatus.PUBLISHED,
          pointsMultiplier: 0,
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
        },
      })
      const config = await tx.practiceQuizAdaptiveConfig.create({
        data: {
          practiceQuizId: quiz.id,
          competenceTreeId: tree.id,
          totalQuestionCap: profile.responsesPerAttempt,
          poolPublishedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      })

      const poolItemCount =
        profile.rootCount * profile.levelCount * profile.itemsPerLeafLevel
      await insertElements({
        tx,
        ownerId: owner.id,
        elementPrefix,
        poolItemCount,
      })
      await insertAssignments({
        tx,
        ownerId: owner.id,
        competenceTreeId: tree.id,
        elementPrefix,
        levelCount: profile.levelCount,
        itemsPerLeafLevel: profile.itemsPerLeafLevel,
      })
      await insertPoolItems({
        tx,
        configId: config.id,
        competenceTreeId: tree.id,
        levelCount: profile.levelCount,
      })
      await insertParticipants({
        tx,
        runLabel,
        participantPrefix,
        participantCount: profile.participantCount,
      })
      await insertParticipations({
        tx,
        courseId: course.id,
        participantPrefix,
      })
      await insertCompletedAttempts({
        tx,
        runLabel,
        participantPrefix,
        courseId: course.id,
        practiceQuizId: quiz.id,
        configId: config.id,
        competenceTreeId: tree.id,
        levelId: levels[0]!.id,
        responsesPerAttempt: profile.responsesPerAttempt,
      })
      await insertCompletedResponses({
        tx,
        configId: config.id,
        practiceQuizId: quiz.id,
        poolItemCount,
        responsesPerAttempt: profile.responsesPerAttempt,
      })
      await insertCompletedEstimates({
        tx,
        configId: config.id,
        practiceQuizId: quiz.id,
        competenceTreeId: tree.id,
        levelId: levels[0]!.id,
        responsesPerAttempt: profile.responsesPerAttempt,
      })
      await insertContentionAttempts({
        tx,
        runLabel,
        participantPrefix,
        contentionGroupCount,
        courseId: course.id,
        practiceQuizId: quiz.id,
        configId: config.id,
        competenceTreeId: tree.id,
      })

      const contentionAttempts = await tx.adaptivePracticeQuizAttempt.findMany({
        where: {
          configId: config.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      const persistencePoolItems =
        await tx.practiceQuizAdaptivePoolItem.findMany({
          where: { configId: config.id },
          select: {
            id: true,
            sourceAssignmentId: true,
            elementId: true,
          },
          orderBy: { id: 'asc' },
          take: persistencePoolItemCount,
        })

      if (
        contentionAttempts.length !== contentionGroupCount ||
        persistencePoolItems.length !== persistencePoolItemCount
      ) {
        throw new Error('Adaptive benchmark contention fixture is incomplete.')
      }

      return {
        runLabel,
        participantPrefix,
        ownerId: owner.id,
        courseId: course.id,
        competenceTreeId: tree.id,
        practiceQuizId: quiz.id,
        configId: config.id,
        levelId: levels[0]!.id,
        nodes,
        contentionAttemptIds: contentionAttempts.map(({ id }) => id),
        persistencePoolItems,
      }
    },
    {
      maxWait: 10_000,
      timeout: profile.name === 'full' ? 3_600_000 : 120_000,
    }
  )
}

export async function verifyAdaptivePracticeQuizBenchmarkFixture(
  prisma: DB.PrismaClient,
  fixture: AdaptivePracticeQuizBenchmarkFixture,
  profile: AdaptivePracticeQuizBenchmarkProfile
): Promise<AdaptivePracticeQuizBenchmarkFixtureCounts> {
  const rows = await prisma.$queryRaw<
    Array<{
      nodes: bigint
      elements: bigint
      poolItems: bigint
      participants: bigint
      completedAttempts: bigint
      contentionAttempts: bigint
      responses: bigint
      estimates: bigint
    }>
  >`
    SELECT
      (SELECT COUNT(*) FROM "CompetenceTreeNode" WHERE "treeId" = ${fixture.competenceTreeId}::uuid) AS nodes,
      (SELECT COUNT(*) FROM "Element" WHERE "ownerId" = ${fixture.ownerId}::uuid) AS elements,
      (SELECT COUNT(*) FROM "PracticeQuizAdaptivePoolItem" WHERE "configId" = ${fixture.configId}::uuid) AS "poolItems",
      (SELECT COUNT(*) FROM "Participant" WHERE "username" LIKE ${`${fixture.participantPrefix}%`}) AS participants,
      (
        SELECT COUNT(*)
        FROM "AdaptivePracticeQuizAttempt"
        WHERE "configId" = ${fixture.configId}::uuid
          AND "status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
      ) AS "completedAttempts",
      (
        SELECT COUNT(*)
        FROM "AdaptivePracticeQuizAttempt"
        WHERE "configId" = ${fixture.configId}::uuid
          AND "status" = 'IN_PROGRESS'::"AdaptivePracticeQuizAttemptStatus"
      ) AS "contentionAttempts",
      (SELECT COUNT(*) FROM "AdaptivePracticeQuizResponse" WHERE "configId" = ${fixture.configId}::uuid) AS responses,
      (SELECT COUNT(*) FROM "AdaptivePracticeQuizEstimate" WHERE "configId" = ${fixture.configId}::uuid) AS estimates
  `
  const row = rows[0]
  if (!row) throw new Error('Adaptive benchmark fixture count query failed.')

  const counts = {
    nodes: Number(row.nodes),
    elements: Number(row.elements),
    poolItems: Number(row.poolItems),
    participants: Number(row.participants),
    completedAttempts: Number(row.completedAttempts),
    contentionAttempts: Number(row.contentionAttempts),
    responses: Number(row.responses),
    estimates: Number(row.estimates),
  }
  const expected = {
    nodes: profile.rootCount * 2,
    elements:
      profile.rootCount * profile.levelCount * profile.itemsPerLeafLevel,
    poolItems:
      profile.rootCount * profile.levelCount * profile.itemsPerLeafLevel,
    participants: profile.participantCount,
    completedAttempts: profile.participantCount,
    contentionAttempts: Math.ceil(profile.persistenceConcurrency / 2),
    responses: profile.participantCount * profile.responsesPerAttempt,
    estimates: profile.participantCount * (profile.rootCount * 2 + 1),
  }
  if (JSON.stringify(counts) !== JSON.stringify(expected)) {
    throw new Error(
      `Adaptive benchmark fixture mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(counts)}.`
    )
  }
  return counts
}

export async function analyzeAdaptivePracticeQuizBenchmarkTables(
  prisma: DB.PrismaClient
): Promise<void> {
  await prisma.$executeRaw(DB.Prisma.sql`
    ANALYZE
      "AdaptivePracticeQuizAttempt",
      "AdaptivePracticeQuizResponse",
      "AdaptivePracticeQuizEstimate",
      "PracticeQuizAdaptivePoolItem"
  `)
}

export async function cleanupAdaptivePracticeQuizBenchmarkFixture(
  prisma: DB.PrismaClient,
  fixture: AdaptivePracticeQuizBenchmarkFixture
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.participant.deleteMany({
        where: { username: { startsWith: fixture.participantPrefix } },
      })
      await tx.practiceQuiz.deleteMany({
        where: { id: fixture.practiceQuizId },
      })
      await tx.competenceTree.deleteMany({
        where: { id: fixture.competenceTreeId },
      })
      await tx.element.deleteMany({ where: { ownerId: fixture.ownerId } })
      await tx.course.deleteMany({ where: { id: fixture.courseId } })
      await tx.user.deleteMany({ where: { id: fixture.ownerId } })
    },
    { maxWait: 10_000, timeout: 600_000 }
  )
}

async function insertElements({
  tx,
  ownerId,
  elementPrefix,
  poolItemCount,
}: {
  tx: DB.Prisma.TransactionClient
  ownerId: string
  elementPrefix: string
  poolItemCount: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    INSERT INTO "Element" (
      "name",
      "content",
      "options",
      "status",
      "type",
      "ownerId",
      "updatedAt"
    )
    SELECT
      ${elementPrefix} || generated.sequence::text,
      'Adaptive benchmark numerical item',
      '{}'::jsonb,
      'READY'::"ElementStatus",
      'NUMERICAL'::"ElementType",
      ${ownerId}::uuid,
      CURRENT_TIMESTAMP
    FROM generate_series(1, ${poolItemCount}) AS generated(sequence)
  `)
}

async function insertAssignments({
  tx,
  ownerId,
  competenceTreeId,
  elementPrefix,
  levelCount,
  itemsPerLeafLevel,
}: {
  tx: DB.Prisma.TransactionClient
  ownerId: string
  competenceTreeId: string
  elementPrefix: string
  levelCount: number
  itemsPerLeafLevel: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    WITH fixture_elements AS MATERIALIZED (
      SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "id") - 1 AS item_index
      FROM "Element"
      WHERE "ownerId" = ${ownerId}::uuid
        AND "name" LIKE ${`${elementPrefix}%`}
    ), fixture_leaves AS MATERIALIZED (
      SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "id") - 1 AS leaf_index
      FROM "CompetenceTreeNode"
      WHERE "treeId" = ${competenceTreeId}::uuid
        AND "depth" = 1
    )
    INSERT INTO "CompetenceTreeElementAssignment" (
      "enabled",
      "discrimination",
      "treeId",
      "elementId",
      "leafNodeId",
      "levelId",
      "updatedAt"
    )
    SELECT
      TRUE,
      1.2,
      ${competenceTreeId}::uuid,
      element."id",
      leaf."id",
      level."id",
      CURRENT_TIMESTAMP
    FROM fixture_elements element
    INNER JOIN fixture_leaves leaf
      ON leaf.leaf_index = element.item_index / ${levelCount * itemsPerLeafLevel}
    INNER JOIN "CompetenceTreeLevel" level
      ON level."treeId" = ${competenceTreeId}::uuid
      AND level."order" = ((element.item_index / ${itemsPerLeafLevel}) % ${levelCount})::integer
  `)
}

async function insertPoolItems({
  tx,
  configId,
  competenceTreeId,
  levelCount,
}: {
  tx: DB.Prisma.TransactionClient
  configId: string
  competenceTreeId: string
  levelCount: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    INSERT INTO "PracticeQuizAdaptivePoolItem" (
      "configId",
      "competenceTreeId",
      "sourceAssignmentId",
      "elementId",
      "elementVersion",
      "elementType",
      "elementName",
      "elementData",
      "leafNodeId",
      "nodePath",
      "nodeNamePath",
      "levelId",
      "levelLabel",
      "levelOrder",
      "discrimination",
      "difficulty",
      "guessing",
      "enablePercentInput"
    )
    SELECT
      ${configId}::uuid,
      ${competenceTreeId}::uuid,
      assignment."id",
      element."id",
      element."version",
      element."type",
      element."name",
      jsonb_build_object(
        'type', 'NUMERICAL',
        'content', element."content",
        'options', element."options",
        'solutionRanges', jsonb_build_array(jsonb_build_object('min', 0, 'max', 1))
      ),
      leaf."id",
      ARRAY[root."id", leaf."id"]::integer[],
      ARRAY[root."name", leaf."name"]::text[],
      level."id",
      level."label",
      level."order",
      COALESCE(assignment."discrimination", 1.2),
      -3.0 + (6.0 * level."order" / GREATEST(${levelCount - 1}, 1)),
      0.0,
      FALSE
    FROM "CompetenceTreeElementAssignment" assignment
    INNER JOIN "Element" element ON element."id" = assignment."elementId"
    INNER JOIN "CompetenceTreeNode" leaf ON leaf."id" = assignment."leafNodeId"
    INNER JOIN "CompetenceTreeNode" root ON root."id" = leaf."parentId"
    INNER JOIN "CompetenceTreeLevel" level ON level."id" = assignment."levelId"
    WHERE assignment."treeId" = ${competenceTreeId}::uuid
    ORDER BY assignment."id"
  `)
}

async function insertParticipants({
  tx,
  runLabel,
  participantPrefix,
  participantCount,
}: {
  tx: DB.Prisma.TransactionClient
  runLabel: string
  participantPrefix: string
  participantCount: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    INSERT INTO "Participant" (
      "id",
      "username",
      "password",
      "isActive",
      "isProfilePublic",
      "updatedAt"
    )
    SELECT
      md5(${runLabel} || ':participant:' || generated.sequence::text)::uuid,
      ${participantPrefix} || generated.sequence::text,
      'benchmark-only',
      TRUE,
      FALSE,
      CURRENT_TIMESTAMP
    FROM generate_series(1, ${participantCount}) AS generated(sequence)
  `)
}

async function insertParticipations({
  tx,
  courseId,
  participantPrefix,
}: {
  tx: DB.Prisma.TransactionClient
  courseId: string
  participantPrefix: string
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    INSERT INTO "Participation" (
      "isActive",
      "courseId",
      "participantId",
      "updatedAt"
    )
    SELECT
      TRUE,
      ${courseId}::uuid,
      participant."id",
      CURRENT_TIMESTAMP
    FROM "Participant" participant
    WHERE participant."username" LIKE ${`${participantPrefix}%`}
  `)
}

async function insertCompletedAttempts({
  tx,
  runLabel,
  participantPrefix,
  courseId,
  practiceQuizId,
  configId,
  competenceTreeId,
  levelId,
  responsesPerAttempt,
}: {
  tx: DB.Prisma.TransactionClient
  runLabel: string
  participantPrefix: string
  courseId: string
  practiceQuizId: string
  configId: string
  competenceTreeId: string
  levelId: number
  responsesPerAttempt: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    WITH fixture_participants AS MATERIALIZED (
      SELECT
        participant."id",
        participation."id" AS participation_id,
        ROW_NUMBER() OVER (ORDER BY participant."id") AS participant_order
      FROM "Participant" participant
      INNER JOIN "Participation" participation
        ON participation."participantId" = participant."id"
        AND participation."courseId" = ${courseId}::uuid
      WHERE participant."username" LIKE ${`${participantPrefix}%`}
    )
    INSERT INTO "AdaptivePracticeQuizAttempt" (
      "id",
      "status",
      "stopReason",
      "currentTheta",
      "currentStandardError",
      "finalTheta",
      "finalStandardError",
      "finalLevelId",
      "elapsedSeconds",
      "nextPoolItemId",
      "configId",
      "competenceTreeId",
      "practiceQuizId",
      "courseId",
      "participantId",
      "participationId",
      "startedAt",
      "completedAt",
      "updatedAt"
    )
    SELECT
      md5(${runLabel} || ':completed-attempt:' || participant."id"::text)::uuid,
      'COMPLETED'::"AdaptivePracticeQuizAttemptStatus",
      'TOTAL_QUESTION_CAP'::"AdaptivePracticeQuizStopReason",
      0.0,
      0.5,
      0.0,
      0.5,
      ${levelId},
      ${responsesPerAttempt * 30},
      NULL,
      ${configId}::uuid,
      ${competenceTreeId}::uuid,
      ${practiceQuizId}::uuid,
      ${courseId}::uuid,
      participant."id",
      participant.participation_id,
      TIMESTAMP '2026-01-01 00:00:00' + participant.participant_order * INTERVAL '1 millisecond',
      TIMESTAMP '2026-01-01 00:00:00' + participant.participant_order * INTERVAL '1 millisecond',
      CURRENT_TIMESTAMP
    FROM fixture_participants participant
  `)
}

async function insertCompletedResponses({
  tx,
  configId,
  practiceQuizId,
  poolItemCount,
  responsesPerAttempt,
}: {
  tx: DB.Prisma.TransactionClient
  configId: string
  practiceQuizId: string
  poolItemCount: number
  responsesPerAttempt: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    WITH fixture_attempts AS MATERIALIZED (
      SELECT
        attempt."id",
        ROW_NUMBER() OVER (ORDER BY attempt."id") - 1 AS attempt_index
      FROM "AdaptivePracticeQuizAttempt" attempt
      WHERE attempt."practiceQuizId" = ${practiceQuizId}::uuid
        AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
    ), fixture_pool AS MATERIALIZED (
      SELECT
        pool."id",
        pool."sourceAssignmentId",
        pool."elementId",
        pool."elementData",
        ROW_NUMBER() OVER (ORDER BY pool."id") AS pool_index
      FROM "PracticeQuizAdaptivePoolItem" pool
      WHERE pool."configId" = ${configId}::uuid
    ), expanded AS (
      SELECT
        attempt."id" AS attempt_id,
        attempt.attempt_index,
        response_order
      FROM fixture_attempts attempt
      CROSS JOIN generate_series(1, ${responsesPerAttempt}) response_order
    )
    INSERT INTO "AdaptivePracticeQuizResponse" (
      "order",
      "response",
      "normalizedResponse",
      "score",
      "correct",
      "overallThetaBefore",
      "overallThetaAfter",
      "overallStandardErrorAfter",
      "elapsedSeconds",
      "attemptId",
      "configId",
      "assignmentId",
      "poolItemId",
      "elementId",
      "elementSnapshot"
    )
    SELECT
      expanded.response_order,
      jsonb_build_object('value', expanded.response_order % 2),
      jsonb_build_object('value', expanded.response_order % 2),
      CASE WHEN expanded.response_order % 2 = 0 THEN 1.0 ELSE 0.0 END,
      expanded.response_order % 2 = 0,
      ((expanded.response_order - 1) % 7 - 3) / 10.0,
      (expanded.response_order % 7 - 3) / 10.0,
      0.5 + expanded.response_order / 1000.0,
      30,
      expanded.attempt_id,
      ${configId}::uuid,
      pool."sourceAssignmentId",
      pool."id",
      pool."elementId",
      pool."elementData"
    FROM expanded
    INNER JOIN fixture_pool pool
      ON pool.pool_index = (
        (expanded.attempt_index * ${responsesPerAttempt} + expanded.response_order - 1)
        % ${poolItemCount}
      ) + 1
  `)
}

async function insertCompletedEstimates({
  tx,
  configId,
  practiceQuizId,
  competenceTreeId,
  levelId,
  responsesPerAttempt,
}: {
  tx: DB.Prisma.TransactionClient
  configId: string
  practiceQuizId: string
  competenceTreeId: string
  levelId: number
  responsesPerAttempt: number
}) {
  await tx.$executeRaw(DB.Prisma.sql`
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
    SELECT
      attempt."id",
      ${configId}::uuid,
      ${competenceTreeId}::uuid,
      'OVERALL'::"AdaptiveEstimateNodeKind",
      NULL,
      0.0,
      0.5,
      ${responsesPerAttempt},
      ${levelId},
      'TOTAL_QUESTION_CAP'::"AdaptivePracticeQuizStopReason"
    FROM "AdaptivePracticeQuizAttempt" attempt
    WHERE attempt."practiceQuizId" = ${practiceQuizId}::uuid
      AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
  `)
  await tx.$executeRaw(DB.Prisma.sql`
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
    SELECT
      attempt."id",
      ${configId}::uuid,
      ${competenceTreeId}::uuid,
      CASE
        WHEN node."kind" = 'COMPETENCE'::"AdaptiveNodeKind"
          THEN 'COMPETENCE'::"AdaptiveEstimateNodeKind"
        ELSE 'SUBCOMPETENCE'::"AdaptiveEstimateNodeKind"
      END,
      node."id",
      ((node."id" % 7) - 3) / 10.0,
      0.5 + (node."id" % 5) / 10.0,
      GREATEST(1, ${Math.floor(responsesPerAttempt / 2)}),
      ${levelId},
      'TOTAL_QUESTION_CAP'::"AdaptivePracticeQuizStopReason"
    FROM "AdaptivePracticeQuizAttempt" attempt
    CROSS JOIN "CompetenceTreeNode" node
    WHERE attempt."practiceQuizId" = ${practiceQuizId}::uuid
      AND attempt."status" = 'COMPLETED'::"AdaptivePracticeQuizAttemptStatus"
      AND node."treeId" = ${competenceTreeId}::uuid
  `)
}

async function insertContentionAttempts({
  tx,
  runLabel,
  participantPrefix,
  contentionGroupCount,
  courseId,
  practiceQuizId,
  configId,
  competenceTreeId,
}: {
  tx: DB.Prisma.TransactionClient
  runLabel: string
  participantPrefix: string
  contentionGroupCount: number
  courseId: string
  practiceQuizId: string
  configId: string
  competenceTreeId: string
}) {
  await tx.$executeRaw(DB.Prisma.sql`
    WITH fixture_participants AS MATERIALIZED (
      SELECT
        participant."id",
        participation."id" AS participation_id,
        ROW_NUMBER() OVER (ORDER BY participant."id") AS participant_order
      FROM "Participant" participant
      INNER JOIN "Participation" participation
        ON participation."participantId" = participant."id"
        AND participation."courseId" = ${courseId}::uuid
      WHERE participant."username" LIKE ${`${participantPrefix}%`}
      ORDER BY participant."id"
      LIMIT ${contentionGroupCount}
    ), first_pool_item AS (
      SELECT "id"
      FROM "PracticeQuizAdaptivePoolItem"
      WHERE "configId" = ${configId}::uuid
      ORDER BY "id"
      LIMIT 1
    )
    INSERT INTO "AdaptivePracticeQuizAttempt" (
      "id",
      "status",
      "currentTheta",
      "currentStandardError",
      "nextPoolItemId",
      "configId",
      "competenceTreeId",
      "practiceQuizId",
      "courseId",
      "participantId",
      "participationId",
      "startedAt",
      "updatedAt"
    )
    SELECT
      md5(${runLabel} || ':contention-attempt:' || participant."id"::text)::uuid,
      'IN_PROGRESS'::"AdaptivePracticeQuizAttemptStatus",
      0.0,
      1.0,
      pool."id",
      ${configId}::uuid,
      ${competenceTreeId}::uuid,
      ${practiceQuizId}::uuid,
      ${courseId}::uuid,
      participant."id",
      participant.participation_id,
      TIMESTAMP '2026-02-01 00:00:00' + participant.participant_order * INTERVAL '1 millisecond',
      CURRENT_TIMESTAMP
    FROM fixture_participants participant
    CROSS JOIN first_pool_item pool
  `)
}
