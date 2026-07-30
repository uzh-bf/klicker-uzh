import { classificationIntervalWithinLevelBand } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import {
  lockAdaptiveAttemptForUpdate,
  lockAdaptiveCourseForShare,
  lockAdaptivePracticeQuizConfigForShare,
  lockPracticeQuizForShare,
  persistAdaptivePracticeQuizEstimates,
  type AdaptiveAttemptLifecycleIdentity,
} from './adaptivePracticeQuizRepository.js'
import {
  MIN_REPORTING_RESPONSES,
  computeAdaptiveEstimates,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

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
} satisfies DB.Prisma.PracticeQuizAdaptivePoolItemSelect

const adaptiveDeliveredPoolItemSelect = {
  ...adaptiveRuntimePoolItemSelect,
  elementData: true,
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

export type AdaptiveAttemptRuntimeRecord =
  DB.Prisma.AdaptivePracticeQuizAttemptGetPayload<{
    include: typeof adaptiveAttemptRuntimeInclude
  }>

export type LoadedAdaptiveRuntime = ReturnType<typeof prepareAdaptiveRuntime>

export async function loadAdaptiveRuntime(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  practiceQuizId: string,
  { includeAlgorithmData }: { includeAlgorithmData: boolean }
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

  const poolRecords = includeAlgorithmData
    ? await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { configId: quiz.adaptiveConfig.id },
        select: adaptiveRuntimePoolItemSelect,
        orderBy: { id: 'asc' },
      })
    : []
  return prepareAdaptiveRuntime(quiz, poolRecords)
}

function prepareAdaptiveRuntime(
  quiz: RuntimeQuizRecord,
  poolRecords: RuntimePoolItemRecord[]
) {
  const config = quiz.adaptiveConfig!
  const tree = config.competenceTree
  const overrides = new Map(
    config.nodeOverrides.map((override) => [override.nodeId, override])
  )
  const nodes: AdaptiveRuntimeNode[] = tree.nodes.map((node) => {
    const override = overrides.get(node.id)
    return {
      id: node.id,
      parentId: node.parentId,
      kind: node.kind,
      depth: node.depth,
      order: node.order,
      enabled: override?.enabled ?? true,
      weight:
        node.kind === DB.AdaptiveNodeKind.COMPETENCE
          ? (override?.weight ?? node.weight)
          : null,
      questionCap: override?.questionCap ?? null,
    }
  })
  const levels: AdaptiveRuntimeLevel[] = tree.levels.map((level) => ({
    id: level.id,
    label: level.label,
    order: level.order,
  }))
  const pool = poolRecords.map(toRuntimePoolItem)
  const settings: AdaptiveRuntimeSettings = {
    totalQuestionCap: config.totalQuestionCap,
    perLeafQuestionCap: config.perLeafQuestionCap,
    minQuestionsPerLeaf: config.minQuestionsPerLeaf,
    classificationZ: config.classificationZ,
    topInformationRatio: config.topInformationRatio,
    levelMappingRule: config.levelMappingRule,
    thetaRange: { min: tree.thetaMin, max: tree.thetaMax },
  }

  return {
    quiz,
    config,
    tree,
    pool,
    poolById: new Map(pool.map((item) => [item.id, item])),
    algorithm: { nodes, levels, pool, settings },
  }
}

export function toRuntimePoolItem(
  item: RuntimePoolItemRecord
): AdaptiveRuntimeRoutingPoolItem {
  return item
}

export function toDeliveredRuntimePoolItem(
  item: DeliveredPoolItemRecord
): AdaptiveRuntimePoolItem {
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

export function assertAdaptiveRuntimeAvailable(runtime: LoadedAdaptiveRuntime) {
  assertAdaptiveQuizPublished(runtime)
  if (runtime.pool.length === 0) {
    throw adaptivePracticeQuizError(
      'This adaptive practice quiz is not available.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }
}

export function assertAdaptiveQuizPublished(runtime: LoadedAdaptiveRuntime) {
  assertAdaptiveCourseEnabled(runtime)
  if (
    runtime.quiz.status !== DB.PublicationStatus.PUBLISHED ||
    !runtime.config.poolPublishedAt
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

export function getEffectivelyEnabledRuntimeNodes(
  nodes: AdaptiveRuntimeNode[]
) {
  const enabled = new Set<number>()
  for (const node of nodes.slice().sort((a, b) => a.depth - b.depth)) {
    if (
      node.enabled &&
      (node.parentId === null || enabled.has(node.parentId))
    ) {
      enabled.add(node.id)
    }
  }
  return nodes.filter((node) => enabled.has(node.id))
}

export function markClassifiedAdaptiveRootEstimates(
  runtime: LoadedAdaptiveRuntime,
  responses: AdaptiveRuntimeResponse[],
  estimates: ReturnType<typeof computeAdaptiveEstimates>
) {
  const leafCounts = new Map<number, number>()
  for (const response of responses) {
    leafCounts.set(
      response.poolItem.leafNodeId,
      (leafCounts.get(response.poolItem.leafNodeId) ?? 0) + 1
    )
  }
  const roots = getEffectivelyEnabledRuntimeNodes(
    runtime.algorithm.nodes
  ).filter(
    (node) =>
      node.parentId === null && node.kind === DB.AdaptiveNodeKind.COMPETENCE
  )
  for (const root of roots) {
    const estimate = estimates.nodes.get(root.id)
    if (
      !estimate ||
      estimate.theta === null ||
      estimate.standardError === null ||
      estimate.responseCount < MIN_REPORTING_RESPONSES
    ) {
      continue
    }
    const leafIds = [
      ...new Set(
        runtime.pool
          .filter((item) => item.nodePath[0] === root.id)
          .map(({ leafNodeId }) => leafNodeId)
      ),
    ]
    const breadthSatisfied = leafIds.every(
      (leafId) =>
        (leafCounts.get(leafId) ?? 0) >=
        runtime.algorithm.settings.minQuestionsPerLeaf
    )
    if (
      breadthSatisfied &&
      classificationIntervalWithinLevelBand({
        theta: estimate.theta,
        standardError: estimate.standardError,
        levels: runtime.algorithm.levels,
        range: runtime.algorithm.settings.thetaRange,
        mappingRule: runtime.algorithm.settings.levelMappingRule,
        z: runtime.algorithm.settings.classificationZ,
      })
    ) {
      estimates.nodes.set(root.id, {
        ...estimate,
        stopReason: DB.AdaptivePracticeQuizStopReason.CLASSIFIED,
      })
    }
  }
}

export async function persistAdaptiveRuntimeEstimates({
  prisma,
  attempt,
  estimates,
  nodeIds,
}: {
  prisma: DB.Prisma.TransactionClient
  attempt: AdaptiveAttemptRuntimeRecord
  estimates: ReturnType<typeof computeAdaptiveEstimates>
  nodeIds: number[]
}) {
  const overall = estimates.overall
  await persistAdaptivePracticeQuizEstimates(
    {
      attemptId: attempt.id,
      configId: attempt.configId,
      competenceTreeId: attempt.competenceTreeId,
      overall: {
        nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
        nodeId: null,
        theta: overall.theta,
        standardError: overall.standardError,
        responseCount: overall.responseCount,
        levelId: overall.levelId,
        stopReason: overall.stopReason,
      },
      nodes: [...new Set(nodeIds)].flatMap((nodeId) => {
        const estimate = estimates.nodes.get(nodeId)
        if (!estimate) return []
        if (
          estimate.nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL ||
          estimate.nodeId === null
        ) {
          throw new Error('Adaptive node estimate identity is invalid.')
        }
        return [
          {
            nodeKind: estimate.nodeKind,
            nodeId: estimate.nodeId,
            theta: estimate.theta,
            standardError: estimate.standardError,
            responseCount: estimate.responseCount,
            levelId: estimate.levelId,
            stopReason: estimate.stopReason,
          },
        ]
      }),
    },
    prisma
  )
}
