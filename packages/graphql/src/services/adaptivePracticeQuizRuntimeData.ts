import {
  AdaptiveRuntimeConfigurationError,
  type AdaptiveV2PoolItem,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { prepareLoadedAdaptiveEstimator } from './adaptivePracticeQuizEstimatorVersions.js'
import {
  lockAdaptiveAttemptForUpdate,
  lockAdaptiveCourseForShare,
  lockAdaptivePracticeQuizConfigForShare,
  lockPracticeQuizForShare,
  type AdaptiveAttemptLifecycleIdentity,
} from './adaptivePracticeQuizRepository.js'
import {
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'
import {
  preparePublishedRuntimeTopology,
  preparePublishedV2Scale,
  preparePublishedV2Settings,
  toPublishedV2PoolItem,
  type AdaptiveV2RoutingPoolItem,
} from './adaptivePracticeQuizRuntimeV2.js'

const adaptiveRuntimePoolItemSelect = {
  id: true,
  sourceAssignmentId: true,
  elementId: true,
  elementVersion: true,
  elementType: true,
  elementName: true,
  leafNodeId: true,
  nodePath: true,
  nodeNamePath: true,
  levelId: true,
  levelLabel: true,
  levelOrder: true,
  discrimination: true,
  difficulty: true,
  guessing: true,
  enablePercentInput: true,
  elementData: true,
  measurementVersion: true,
  calibrationId: true,
  itemModel: true,
  role: true,
  contributesToEstimate: true,
} satisfies DB.Prisma.PracticeQuizAdaptivePoolItemSelect

const adaptiveDeliveredPoolItemSelect = {
  ...adaptiveRuntimePoolItemSelect,
} satisfies DB.Prisma.PracticeQuizAdaptivePoolItemSelect

const runtimeQuizInclude = {
  course: { select: { isAdaptiveLearningEnabled: true } },
  adaptiveConfig: {
    include: {
      competenceTree: {
        include: {
          levels: { orderBy: { order: 'asc' as const } },
          nodes: {
            orderBy: [
              { depth: 'asc' as const },
              { order: 'asc' as const },
              { id: 'asc' as const },
            ],
          },
        },
      },
      nodeOverrides: true,
    },
  },
} satisfies DB.Prisma.PracticeQuizInclude

export const adaptiveAttemptRuntimeInclude = {
  nextPoolItem: { select: adaptiveDeliveredPoolItemSelect },
  responses: {
    include: { poolItem: { select: adaptiveRuntimePoolItemSelect } },
    orderBy: { order: 'asc' as const },
  },
  estimates: true,
} satisfies DB.Prisma.AdaptivePracticeQuizAttemptInclude

type RuntimeQuizRecord = DB.Prisma.PracticeQuizGetPayload<{
  include: typeof runtimeQuizInclude
}>
type RuntimePoolItemRecord = DB.Prisma.PracticeQuizAdaptivePoolItemGetPayload<{
  select: typeof adaptiveRuntimePoolItemSelect
}>
type DeliveredPoolItemRecord =
  DB.Prisma.PracticeQuizAdaptivePoolItemGetPayload<{
    select: typeof adaptiveDeliveredPoolItemSelect
  }>

export type AdaptivePublishedRuntimePoolItem = AdaptiveRuntimePoolItem &
  Pick<
    DeliveredPoolItemRecord,
    | 'measurementVersion'
    | 'calibrationId'
    | 'itemModel'
    | 'role'
    | 'contributesToEstimate'
  >

type RuntimeAlgorithmView = {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  pool: AdaptiveRuntimeRoutingPoolItem[]
  settings: AdaptiveRuntimeSettings
}

export type AdaptiveAttemptRuntimeRecord =
  DB.Prisma.AdaptivePracticeQuizAttemptGetPayload<{
    include: typeof adaptiveAttemptRuntimeInclude
  }>

export type LoadedAdaptiveRuntime = ReturnType<typeof prepareAdaptiveRuntime>

export async function loadAdaptiveRuntime(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  practiceQuizId: string,
  {
    includeAlgorithmData,
    publicationId,
  }: { includeAlgorithmData: boolean; publicationId?: string }
) {
  const quiz = await prisma.practiceQuiz.findUnique({
    where: { id: practiceQuizId, isDeleted: false },
    include: runtimeQuizInclude,
  })
  if (
    !quiz ||
    quiz.mode !== DB.PracticeQuizMode.ADAPTIVE ||
    !quiz.adaptiveConfig
  ) {
    throw adaptivePracticeQuizError(
      'Adaptive practice quiz was not found.',
      'ADAPTIVE_QUIZ_NOT_FOUND'
    )
  }

  const publication = await prisma.practiceQuizAdaptivePublication.findFirst({
    where: {
      configId: quiz.adaptiveConfig.id,
      sealedAt: { not: null },
      ...(publicationId
        ? { id: publicationId }
        : { supersededAt: null, unpublishedAt: null }),
    },
    orderBy: { version: 'desc' },
  })
  if (!publication) {
    throw adaptivePracticeQuizError(
      'This adaptive practice quiz has no sealed publication.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }

  const poolRecords = includeAlgorithmData
    ? await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { publicationId: publication.id },
        select: adaptiveRuntimePoolItemSelect,
        orderBy: { id: 'asc' },
      })
    : []
  return prepareAdaptiveRuntime(quiz, publication, poolRecords)
}

function prepareAdaptiveRuntime(
  quiz: RuntimeQuizRecord,
  publication: DB.PracticeQuizAdaptivePublication,
  poolRecords: RuntimePoolItemRecord[]
) {
  const config = quiz.adaptiveConfig!
  const tree = config.competenceTree
  const { nodes, levels } = preparePublishedRuntimeTopology(publication)
  const pool = poolRecords.map(toRuntimePoolItem)
  const publishedPool = poolRecords.map(toDeliveredRuntimePoolItem)
  const evidence = publication.evidenceMinimumSnapshot
  const leafCaps = Object.values(publication.questionCapSnapshot.leaf)
  const legacySettings: AdaptiveRuntimeSettings = {
    totalQuestionCap: publication.totalQuestionCap,
    perLeafQuestionCap: leafCaps[0] ?? null,
    minQuestionsPerLeaf: evidence.minimumResponsesPerLeaf,
    classificationZ: evidence.classificationZ,
    topInformationRatio: evidence.topInformationRatio,
    levelMappingRule: evidence.levelMappingRule,
    thetaRange: { min: evidence.thetaMin, max: evidence.thetaMax },
  }

  try {
    const estimator =
      publication.measurementVersion ===
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
        ? prepareLoadedAdaptiveEstimator({
            measurementVersion: publication.measurementVersion,
            nodes,
            scale: preparePublishedV2Scale(publication),
            pool: pool as AdaptiveV2RoutingPoolItem[],
            settings: preparePublishedV2Settings(publication),
          })
        : prepareLoadedAdaptiveEstimator({
            measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
            nodes,
            levels,
            pool,
            settings: legacySettings,
          })
    const algorithm: RuntimeAlgorithmView =
      estimator.measurementVersion ===
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
        ? {
            nodes: [...estimator.algorithm.nodes],
            levels: estimator.algorithm.scale.levels.map(
              ({ id, label, order }) => ({ id, label, order })
            ),
            pool: [
              ...(estimator.algorithm.pool as AdaptiveV2RoutingPoolItem[]),
            ],
            settings: estimator.algorithm.settings,
          }
        : estimator.algorithm

    return {
      quiz,
      config,
      tree,
      publication,
      pool,
      publishedPool,
      poolById: new Map(pool.map((item) => [item.id, item])),
      algorithm,
      estimator,
    }
  } catch (error) {
    if (error instanceof AdaptiveRuntimeConfigurationError) {
      throw adaptivePracticeQuizError(error.message, error.code)
    }
    throw error
  }
}

export function toRuntimePoolItem(
  item: RuntimePoolItemRecord
): AdaptiveRuntimeRoutingPoolItem {
  if (
    item.measurementVersion === DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return toPublishedV2PoolItem({
      ...item,
      elementData: item.elementData as ElementData,
    })
  }
  const {
    elementData: _elementData,
    measurementVersion: _measurementVersion,
    calibrationId: _calibrationId,
    itemModel: _itemModel,
    role: _role,
    contributesToEstimate: _contributesToEstimate,
    ...routing
  } = item
  return routing
}

export function toDeliveredRuntimePoolItem(
  item: DeliveredPoolItemRecord
): AdaptivePublishedRuntimePoolItem {
  return { ...item, elementData: item.elementData as ElementData }
}

export function toRuntimeResponses(
  responses: AdaptiveAttemptRuntimeRecord['responses']
): AdaptiveRuntimeResponse[] {
  return responses.map((response) => {
    if (!response.poolItem) {
      throw adaptivePracticeQuizError(
        'This adaptive attempt contains a legacy response without a pool item.',
        'ADAPTIVE_ATTEMPT_DATA_INVALID'
      )
    }
    return {
      order: response.order,
      poolItemId: response.poolItem.id,
      correct: response.correct,
      poolItem: toRuntimePoolItem(response.poolItem),
    }
  })
}

export async function loadAdaptiveV2SelectionContext({
  prisma,
  runtime,
  participantId,
  attemptId,
  startingAttempt,
}: {
  prisma: DB.Prisma.TransactionClient
  runtime: LoadedAdaptiveRuntime
  participantId: string
  attemptId?: string
  startingAttempt: boolean
}) {
  if (
    runtime.estimator.measurementVersion !==
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return undefined
  }

  const exposureRows = await prisma.$queryRaw<
    Array<{ poolItemId: number; servedCount: bigint }>
  >`
    SELECT "poolItemId", "servedCount"
    FROM "AdaptivePracticeQuizItemExposure"
    WHERE "publicationId" = ${runtime.publication.id}::uuid
    ORDER BY "poolItemId"
    FOR UPDATE
  `
  if (exposureRows.length !== runtime.estimator.algorithm.pool.length) {
    throw adaptivePracticeQuizError(
      'Adaptive publication exposure state is incomplete.',
      'ADAPTIVE_EXPOSURE_STATE_INVALID'
    )
  }
  const servedCountByPoolItem = new Map(
    exposureRows.map(({ poolItemId, servedCount }) => {
      const count = Number(servedCount)
      if (!Number.isSafeInteger(count) || count < 0) {
        throw adaptivePracticeQuizError(
          'Adaptive publication exposure state is invalid.',
          'ADAPTIVE_EXPOSURE_STATE_INVALID'
        )
      }
      return [poolItemId, count]
    })
  )
  const priorResponses = await prisma.adaptivePracticeQuizResponse.findMany({
    where: {
      attempt: {
        participantId,
        practiceQuizId: runtime.quiz.id,
        ...(attemptId ? { id: { not: attemptId } } : {}),
      },
      poolItemId: { not: null },
    },
    select: {
      poolItem: {
        select: {
          sourceAssignmentId: true,
          elementId: true,
          elementVersion: true,
        },
      },
    },
  })
  const priorKeys = new Set(
    priorResponses.flatMap(({ poolItem }) =>
      poolItem
        ? [
            adaptiveItemVersionKey(
              poolItem.sourceAssignmentId,
              poolItem.elementId,
              poolItem.elementVersion
            ),
          ]
        : []
    )
  )
  const priorAttemptPoolItemIds = new Set(
    (runtime.pool as AdaptiveV2RoutingPoolItem[]).flatMap((item) =>
      priorKeys.has(
        adaptiveItemVersionKey(
          item.sourceAssignmentId,
          item.elementId,
          item.elementVersion
        )
      )
        ? [item.id]
        : []
    )
  )
  const attemptCount = await prisma.adaptivePracticeQuizAttempt.count({
    where: { publicationId: runtime.publication.id },
  })
  const projectedAttemptCount = Math.max(
    1,
    attemptCount + (startingAttempt ? 1 : 0)
  )
  const exposureCapacity = Math.max(
    1,
    Math.ceil(runtime.publication.exposureCeiling * projectedAttemptCount)
  )

  return {
    servedCountByPoolItem,
    priorAttemptPoolItemIds,
    isExposureEligible: (item: AdaptiveV2PoolItem) =>
      (servedCountByPoolItem.get(item.id) ?? 0) < exposureCapacity,
  }
}

export async function incrementAdaptiveV2Exposure({
  prisma,
  publicationId,
  poolItemId,
  counter,
}: {
  prisma: DB.Prisma.TransactionClient
  publicationId: string
  poolItemId: number
  counter: 'servedCount' | 'answeredCount'
}) {
  await prisma.adaptivePracticeQuizItemExposure.update({
    where: {
      publicationId_poolItemId: { publicationId, poolItemId },
    },
    data: { [counter]: { increment: 1 } },
  })
}

function adaptiveItemVersionKey(
  assignmentId: number,
  elementId: number,
  elementVersion: number
) {
  return `${assignmentId}:${elementId}:${elementVersion}`
}

export async function requireAdaptiveParticipation(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  courseId: string,
  participantId: string
) {
  const participation = await prisma.participation.findUnique({
    where: { courseId_participantId: { courseId, participantId } },
  })
  if (!participation) {
    throw adaptivePracticeQuizError(
      'A course participation is required for this adaptive quiz.',
      'ADAPTIVE_PARTICIPATION_REQUIRED'
    )
  }
  return participation
}

export async function requireParticipantAdaptiveAttempt(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  attemptId: string,
  participantId: string
) {
  const attempt = await prisma.adaptivePracticeQuizAttempt.findFirst({
    where: { id: attemptId, participantId },
    include: adaptiveAttemptRuntimeInclude,
  })
  if (!attempt) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
  return attempt
}

export async function requireAdaptiveAttemptLifecycleIdentity(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  attemptId: string,
  participantId: string
): Promise<AdaptiveAttemptLifecycleIdentity> {
  const identity = await prisma.adaptivePracticeQuizAttempt.findFirst({
    where: { id: attemptId, participantId },
    select: {
      id: true,
      courseId: true,
      practiceQuizId: true,
      configId: true,
      publicationId: true,
    },
  })
  if (!identity) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
  return identity
}

export async function lockAdaptiveAttemptLifecycle({
  prisma,
  identity,
  participantId,
  requireCourseEnabled,
}: {
  prisma: DB.Prisma.TransactionClient
  identity: AdaptiveAttemptLifecycleIdentity
  participantId: string
  requireCourseEnabled: boolean
}): Promise<void> {
  if (requireCourseEnabled) {
    await lockAdaptiveLearningCourseEnabled(identity.courseId, prisma)
  } else if (!(await lockAdaptiveCourseForShare(identity.courseId, prisma))) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }

  const quiz = await lockPracticeQuizForShare(
    identity.practiceQuizId,
    identity.courseId,
    prisma
  )
  if (!quiz) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
  if (
    requireCourseEnabled &&
    (quiz.isDeleted || quiz.status !== DB.PublicationStatus.PUBLISHED)
  ) {
    throw adaptivePracticeQuizError(
      'This adaptive practice quiz is not available.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }

  const config = await lockAdaptivePracticeQuizConfigForShare(
    identity.practiceQuizId,
    prisma
  )
  if (!config || config.id !== identity.configId) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt references an invalid quiz configuration.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }

  const locked = await lockAdaptiveAttemptForUpdate(
    identity,
    participantId,
    prisma
  )
  if (!locked) {
    throw adaptivePracticeQuizError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
}

export function assertAdaptiveRuntimeAvailable(
  runtime: LoadedAdaptiveRuntime,
  { allowSupersededPublication = false } = {}
) {
  assertAdaptiveQuizPublished(runtime, { allowSupersededPublication })
  if (runtime.pool.length === 0) {
    throw adaptivePracticeQuizError(
      'This adaptive practice quiz is not available.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }
}

export function assertAdaptiveQuizPublished(
  runtime: LoadedAdaptiveRuntime,
  { allowSupersededPublication = false } = {}
) {
  assertAdaptiveCourseEnabled(runtime)
  if (
    runtime.quiz.status !== DB.PublicationStatus.PUBLISHED ||
    !runtime.config.poolPublishedAt ||
    !runtime.publication.sealedAt ||
    runtime.publication.unpublishedAt !== null ||
    (!allowSupersededPublication && runtime.publication.supersededAt !== null)
  ) {
    throw adaptivePracticeQuizError(
      'This adaptive practice quiz is not available.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }
}

export function assertAdaptiveCourseEnabled(runtime: LoadedAdaptiveRuntime) {
  if (!runtime.quiz.course.isAdaptiveLearningEnabled) {
    throw adaptivePracticeQuizError(
      'Adaptive learning is not enabled for this course.',
      'ADAPTIVE_COURSE_DISABLED'
    )
  }
}
