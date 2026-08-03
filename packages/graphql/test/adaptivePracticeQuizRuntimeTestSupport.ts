import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { EventEmitter } from 'node:events'
import type { ContextWithUser } from '../src/lib/context.js'
import { materializeAdaptivePracticeQuizPool } from '../src/services/adaptivePracticeQuizPublication.js'
import { createLegacyAdaptivePublicationFixture } from './adaptivePracticeQuizTestHelpers.js'

export async function createRuntimeFixture({
  attemptSelectionPolicy = DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
  measurementVersion = DB.AdaptiveMeasurementVersion.IRT_V1,
  preset,
  resetTimeDays = 0,
}: {
  attemptSelectionPolicy?: DB.AdaptiveAttemptSelectionPolicy
  measurementVersion?: DB.AdaptiveMeasurementVersion
  preset?: DB.AdaptivePracticeQuizPreset
  resetTimeDays?: number
} = {}) {
  const isV2Research =
    measurementVersion === DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1 &&
    (preset ?? DB.AdaptivePracticeQuizPreset.RESEARCH) ===
      DB.AdaptivePracticeQuizPreset.RESEARCH
  const owner = await prisma.user.create({
    data: {
      id: '20000000-0000-4000-8000-000000000001',
      email: 'adaptive-runtime-owner@example.com',
      shortname: 'adaptive-runtime-owner',
    },
  })
  const reviewer = isV2Research
    ? await prisma.user.create({
        data: {
          id: '20000000-0000-4000-8000-000000000099',
          email: 'adaptive-runtime-reviewer@example.com',
          shortname: 'adaptive-runtime-reviewer',
        },
      })
    : null
  const course = await prisma.course.create({
    data: {
      name: 'adaptive-runtime-course',
      displayName: 'Adaptive runtime course',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
      pinCode: 4242,
      ownerId: owner.id,
      isAdaptiveLearningEnabled: true,
      isAdaptiveLearningCalibrationEnabled: isV2Research,
    },
  })
  const tree = await prisma.competenceTree.create({
    data: {
      name: 'adaptive-runtime-tree',
      displayName: 'Adaptive runtime tree',
      ownerId: owner.id,
      thetaMin: -3,
      thetaMax: 3,
      levelMappingRule: DB.AdaptiveLevelMappingRule.NEAREST,
    },
  })
  await prisma.competenceTreeCourse.create({
    data: { treeId: tree.id, courseId: course.id, linkedById: owner.id },
  })
  const levels = await Promise.all(
    ['Basic', 'Independent', 'Advanced'].map((label, order) =>
      prisma.competenceTreeLevel.create({
        data: { treeId: tree.id, label, order },
      })
    )
  )
  const firstRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Reading',
      order: 0,
      depth: 0,
      weight: 0.6,
    },
  })
  const firstLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Scanning',
      order: 0,
      depth: 1,
      parentId: firstRoot.id,
    },
  })
  const secondRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Grammar',
      order: 1,
      depth: 0,
      weight: 0.4,
    },
  })
  const secondLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Agreement',
      order: 0,
      depth: 1,
      parentId: secondRoot.id,
    },
  })
  for (const leafNodeId of [firstLeaf.id, secondLeaf.id]) {
    for (const level of levels) {
      await prisma.competenceTreeLeafLevelCoverage.create({
        data: {
          treeId: tree.id,
          leafNodeId,
          levelId: level.id,
          targetItemCount: 2,
        },
      })
    }
  }

  const quiz = await prisma.practiceQuiz.create({
    data: {
      name: 'adaptive-runtime-quiz',
      displayName: 'Adaptive runtime quiz',
      ownerId: owner.id,
      courseId: course.id,
      mode: DB.PracticeQuizMode.ADAPTIVE,
      status: DB.PublicationStatus.PUBLISHED,
      pointsMultiplier: 0,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      resetTimeDays,
    },
  })
  await prisma.derivedPermission.create({
    data: {
      practiceQuizId: quiz.id,
      userId: owner.id,
      permissionLevel: DB.PermissionLevel.OWNER,
    },
  })
  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId: quiz.id,
      competenceTreeId: tree.id,
      measurementVersion,
      calibrationPolicyVersion: isV2Research ? 1 : null,
      preset:
        preset ??
        (isV2Research
          ? DB.AdaptivePracticeQuizPreset.RESEARCH
          : attemptSelectionPolicy ===
              DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
            ? DB.AdaptivePracticeQuizPreset.PLACEMENT
            : DB.AdaptivePracticeQuizPreset.DIAGNOSTIC),
      attemptSelectionPolicy,
      levelMappingRule:
        attemptSelectionPolicy ===
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
          ? DB.AdaptiveLevelMappingRule.MASTERY
          : DB.AdaptiveLevelMappingRule.NEAREST,
      totalQuestionCap: 8,
      perLeafQuestionCap: 4,
      minQuestionsPerLeaf: 1,
      classificationZ: 0.2,
    },
  })
  await prisma.practiceQuizAdaptiveNodeOverride.createMany({
    data: [
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstRoot.id,
        enabled: true,
        weight: 0.6,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstLeaf.id,
        enabled: true,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondRoot.id,
        enabled: true,
        weight: 0.4,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondLeaf.id,
        enabled: true,
      },
    ],
  })

  const researchLevelOrders = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 0, 1, 2]
  const difficulties = isV2Research
    ? [-2, -1.75, -1.5, -0.75, -0.5, -0.25, 0.5, 0.75, 1, 1.25, -1, 0, 1.5]
    : [-2, -0.5, 0.5, 2]
  const poolParameters = new Map<
    number,
    { discrimination: number; difficulty: number; guessing: number }
  >()
  const assignments: Array<{
    assignment: DB.CompetenceTreeElementAssignment
    index: number
  }> = []
  for (const [root, leaf] of [
    [firstRoot, firstLeaf],
    [secondRoot, secondLeaf],
  ] as const) {
    for (let index = 0; index < difficulties.length; index++) {
      const level = isV2Research
        ? levels[researchLevelOrders[index]!]!
        : levels[Math.min(index, levels.length - 1)]!
      const element = await prisma.element.create({
        data: {
          type: DB.ElementType.SC,
          name: `Adaptive item ${root.id}-${index}`,
          content: `Adaptive item pending`,
          options: choiceOptions(0),
          ownerId: owner.id,
        },
      })
      const assignment = await prisma.competenceTreeElementAssignment.create({
        data: {
          treeId: tree.id,
          elementId: element.id,
          leafNodeId: leaf.id,
          levelId: level.id,
        },
      })
      assignments.push({ assignment, index })
      poolParameters.set(assignment.id, {
        discrimination: 1.2,
        difficulty: difficulties[index]!,
        guessing: 0.5,
      })
    }
  }
  const { publication, poolItems } = isV2Research
    ? await createResearchRuntimePublication({
        quizId: quiz.id,
        configId: config.id,
        treeId: tree.id,
        ownerId: owner.id,
        reviewerId: reviewer!.id,
        levels,
        assignments,
        poolParameters,
      })
    : await createLegacyAdaptivePublicationFixture({
        configId: config.id,
        publishedById: owner.id,
        poolParameters,
        beforeSeal: async ({ prisma: tx, poolItems }) => {
          for (const poolItem of poolItems) {
            const content = `Adaptive item ${poolItem.id}`
            const element = await tx.element.update({
              where: { id: poolItem.elementId },
              data: { content },
            })
            await tx.practiceQuizAdaptivePoolItem.update({
              where: { id: poolItem.id },
              data: { elementData: elementData(element, content) },
            })
          }
        },
      })
  const poolItemIds = poolItems.map(({ id }) => id)

  const participant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-participant', password: 'test' },
  })
  const otherParticipant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-other', password: 'test' },
  })
  await prisma.participation.createMany({
    data: [
      { courseId: course.id, participantId: participant.id, isActive: false },
    ],
  })

  return {
    ownerId: owner.id,
    courseId: course.id,
    treeId: tree.id,
    configId: config.id,
    publicationIdentity: {
      publicationId: publication.id,
      scaleVersionId: publication.scaleVersionId,
      measurementVersion: publication.measurementVersion,
      estimatorImplementationVersion:
        publication.estimatorImplementationVersion,
      classificationPolicyVersion: publication.classificationPolicyVersion,
      calibrationPolicyVersion: publication.calibrationPolicyVersion,
    },
    quizId: quiz.id,
    levelIds: levels.map(({ id }) => id),
    participantId: participant.id,
    otherParticipantId: otherParticipant.id,
    poolItemIds,
  }
}

export async function createResearchRuntimePublication({
  quizId,
  configId,
  treeId,
  ownerId,
  reviewerId,
  levels,
  assignments,
  poolParameters,
}: {
  quizId: string
  configId: string
  treeId: string
  ownerId: string
  reviewerId: string
  levels: DB.CompetenceTreeLevel[]
  assignments: Array<{
    assignment: DB.CompetenceTreeElementAssignment
    index: number
  }>
  poolParameters: ReadonlyMap<
    number,
    { discrimination: number; difficulty: number; guessing: number }
  >
}) {
  const scale = await prisma.competenceTreeScaleVersion.create({
    data: {
      treeId,
      version: 1,
      createdById: ownerId,
      priorMean: 0,
      priorStandardDeviation: 1,
      gridMin: -4,
      gridMax: 4,
      gridStep: 0.1,
      classificationPolicyVersion: 1,
      levels: {
        create: levels.map((level) => ({
          sourceLevelId: level.id,
          order: level.order,
          label: level.label,
          lowerBound:
            level.order === 0 ? null : level.order === 1 ? -0.75 : 0.75,
          itemDifficultyPrior:
            level.order === 0 ? -1.5 : level.order === 1 ? 0 : 1.5,
        })),
      },
    },
  })
  const approval = await prisma.competenceTreeScaleApproval.create({
    data: {
      treeId,
      scaleVersionId: scale.id,
      method: 'BOOKMARK',
      methodVersion: 'test-bookmark-v1',
      panelSize: 3,
      standardSettingDate: new Date('2026-01-15T00:00:00.000Z'),
      cutRationale: levels.slice(1).map((level) => ({
        scaleLevelOrder: level.order,
        codes: ['TEST_PANEL_CONSENSUS'],
      })),
      artifactChecksum: 'a'.repeat(64),
      artifactKey: 'test/adaptive-standard-setting.json',
      submittedById: ownerId,
    },
  })
  await prisma.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: { status: DB.AdaptiveScaleVersionStatus.IN_REVIEW },
  })
  await prisma.competenceTreeScaleApproval.update({
    where: { id: approval.id },
    data: {
      decision: DB.AdaptiveScaleVersionStatus.APPROVED,
      reviewerId,
      reviewedAt: new Date('2026-01-16T00:00:00.000Z'),
    },
  })
  await prisma.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: { status: DB.AdaptiveScaleVersionStatus.APPROVED },
  })
  await prisma.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: { status: DB.AdaptiveScaleVersionStatus.ACTIVE },
  })
  await prisma.practiceQuizAdaptiveConfig.update({
    where: { id: configId },
    data: { scaleVersionId: scale.id },
  })

  for (const { assignment, index } of assignments) {
    const parameters = poolParameters.get(assignment.id)!
    const isFieldTest = index >= 10
    await prisma.adaptiveItemCalibration.create({
      data: {
        treeId,
        scaleVersionId: scale.id,
        assignmentId: assignment.id,
        elementId: assignment.elementId,
        elementVersion: 1,
        version: 1,
        model: DB.AdaptiveItemModel.THREE_PL_FIXED_C,
        status: isFieldTest
          ? DB.AdaptiveItemCalibrationStatus.PILOT
          : DB.AdaptiveItemCalibrationStatus.CALIBRATED,
        discrimination: parameters.discrimination,
        difficulty: parameters.difficulty,
        guessing: parameters.guessing,
        parameterUncertainty: {
          discriminationStandardError: 0.05,
          difficultyStandardError: 0.1,
          guessingStandardError: 0.01,
          discriminationInterval: [1.1, 1.3],
          difficultyInterval: [
            parameters.difficulty - 0.2,
            parameters.difficulty + 0.2,
          ],
          guessingInterval: [0.45, 0.55],
        },
        responseCount: isFieldTest ? 20 : 200,
        participantCount: isFieldTest ? 20 : 150,
        diagnostics: {
          fitStatus: 'PASS',
          difStatus: 'PASS',
          driftStatus: 'PASS',
          fitStatistics: {},
          warningCodes: [],
          dif: {},
          drift: {},
        },
        datasetVersion: 'test-calibration-v1',
        datasetChecksum: `${assignment.id}`.padStart(64, '0'),
        modelImplementationVersion: 'test-3pl-v1',
        elementContentChecksum: `${assignment.elementId}`.padStart(64, '0'),
        createdById: ownerId,
        approvedById: isFieldTest ? null : reviewerId,
        approvedAt: isFieldTest ? null : new Date('2026-01-17T00:00:00.000Z'),
      },
    })
  }

  await prisma.$transaction((tx) =>
    materializeAdaptivePracticeQuizPool(quizId, ownerId, tx)
  )
  const publication =
    await prisma.practiceQuizAdaptivePublication.findFirstOrThrow({
      where: {
        configId,
        supersededAt: null,
        unpublishedAt: null,
      },
      orderBy: { version: 'desc' },
    })
  const poolItems = await prisma.practiceQuizAdaptivePoolItem.findMany({
    where: { publicationId: publication.id },
    orderBy: { id: 'asc' },
  })
  return { publication, poolItems }
}

export function choiceOptions(correctIndex: number) {
  return {
    displayMode: 'LIST',
    choices: [
      { ix: 0, value: 'A', correct: correctIndex === 0 },
      { ix: 1, value: 'B', correct: correctIndex === 1 },
    ],
  }
}

export function elementData(
  element: Pick<
    DB.Element,
    'id' | 'version' | 'name' | 'type' | 'pointsMultiplier'
  > & { content: string },
  content: string
): ElementData {
  return {
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
    type: element.type,
    name: element.name,
    content,
    pointsMultiplier: element.pointsMultiplier,
    options: choiceOptions(0),
  } as ElementData
}

export function holdConfigLock(configId: string, mode: 'SHARE' | 'UPDATE') {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      if (mode === 'SHARE') {
        await tx.$queryRaw`
          SELECT "id"
          FROM "PracticeQuizAdaptiveConfig"
          WHERE "id" = ${configId}::uuid
          FOR SHARE
        `
      } else {
        await tx.$queryRaw`
          SELECT "id"
          FROM "PracticeQuizAdaptiveConfig"
          WHERE "id" = ${configId}::uuid
          FOR UPDATE
        `
      }
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

export function holdAttemptLock(attemptId: string) {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "AdaptivePracticeQuizAttempt"
        WHERE "id" = ${attemptId}::uuid
        FOR UPDATE
      `
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

export function holdPermissionRemoval(permissionId: number) {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Permission"
        WHERE "id" = ${permissionId}
        FOR UPDATE
      `
      ready.resolve()
      await release.promise
      await tx.permission.delete({ where: { id: permissionId } })
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

export function holdActivityLogTableLock() {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE "ActivityLogEntry" IN ACCESS EXCLUSIVE MODE'
      )
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

export function holdAdaptiveAttemptTableLock() {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE "AdaptivePracticeQuizAttempt" IN ACCESS EXCLUSIVE MODE'
      )
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

export async function waitForQuizLockConflict(
  practiceQuizId: string,
  probe: 'SHARE' | 'UPDATE'
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        if (probe === 'SHARE') {
          await tx.$queryRaw`
            SELECT "id"
            FROM "PracticeQuiz"
            WHERE "id" = ${practiceQuizId}::uuid
            FOR SHARE NOWAIT
          `
        } else {
          await tx.$queryRaw`
            SELECT "id"
            FROM "PracticeQuiz"
            WHERE "id" = ${practiceQuizId}::uuid
            FOR UPDATE NOWAIT
          `
        }
      })
    } catch (error) {
      if (postgresErrorCode(error) === '55P03') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the practice-quiz lifecycle lock.')
}

export async function waitForCourseLockConflict(
  courseId: string,
  probe: 'SHARE' | 'UPDATE'
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        if (probe === 'SHARE') {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Course"
            WHERE "id" = ${courseId}::uuid
            FOR SHARE NOWAIT
          `
        } else {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Course"
            WHERE "id" = ${courseId}::uuid
            FOR UPDATE NOWAIT
          `
        }
      })
    } catch (error) {
      if (postgresErrorCode(error) === '55P03') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the course lifecycle lock.')
}

export async function waitForBlockedDatabaseQuery(queryPattern: string) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const [state] = await prisma.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND query LIKE ${queryPattern}
          AND cardinality(pg_blocking_pids(pid)) > 0
      ) AS blocked
    `
    if (state?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for blocked query ${queryPattern}.`)
}

export function postgresErrorCode(error: unknown): string | undefined {
  const prismaError = error as {
    code?: string
    meta?: {
      code?: string
      driverAdapterError?: {
        cause?: { code?: string; originalCode?: string }
      }
    }
  }
  return (
    prismaError.meta?.code ??
    prismaError.meta?.driverAdapterError?.cause?.originalCode ??
    prismaError.meta?.driverAdapterError?.cause?.code ??
    prismaError.code
  )
}

export function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export function contextFor(
  subject: string,
  role: DB.UserRole
): ContextWithUser {
  return {
    prisma,
    user: {
      sub: subject,
      role,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    emitter: new EventEmitter(),
    redisExec: {} as ContextWithUser['redisExec'],
    redisAssessmentExec: {} as ContextWithUser['redisAssessmentExec'],
    pubSub: {} as ContextWithUser['pubSub'],
    hatchet: {} as ContextWithUser['hatchet'],
    tasks: {} as ContextWithUser['tasks'],
    req: {} as ContextWithUser['req'],
    res: {} as ContextWithUser['res'],
  }
}
