import {
  classificationIntervalWithinLevelBand,
  isNearLevelBoundary,
  mapLevelsToTheta,
  normalizeThetaForChart,
  probability,
  updateTheta,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import { lockAdaptivePracticeQuizConfigForAttempt } from './adaptivePracticeQuizPublication.js'
import {
  AdaptiveRuntimeValidationError,
  MIN_REPORTING_RESPONSES,
  computeAdaptiveEstimates,
  gradeAdaptiveResponse,
  normalizeRuntimeEstimateForChart,
  selectAdaptiveNextPoolItem,
  serializeAdaptiveParticipantElement,
  type AdaptiveParticipantElement,
  type AdaptivePracticeQuizResponseInput,
  type AdaptiveRuntimeCoverage,
  type AdaptiveRuntimeEstimate,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

const TRANSACTION_RETRIES = 3
const SMALL_BUCKET_THRESHOLD = 5
const ITEM_DIAGNOSTIC_MIN_RESPONSES = 30
const HIGH_EXPOSURE_THRESHOLD = 0.4
const ITEM_RESIDUAL_WARNING_THRESHOLD = 0.25
const MAX_REPORTED_QUESTION_ELAPSED_SECONDS = 24 * 60 * 60

export type AdaptivePracticeQuizAttemptState = {
  attemptId: string
  practiceQuizId: string
  practiceQuizName: string
  status: DB.AdaptivePracticeQuizAttemptStatus
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  answeredQuestions: number
  questionNumber: number | null
  maximumQuestions: number
  startedAt: Date
  completedAt: Date | null
  elapsedSeconds: number
  showTimer: boolean
  canStartNewAttempt: boolean
  servedItem: AdaptiveParticipantElement | null
}

export type AdaptiveResultConfidence =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT_DATA'

export type AdaptiveResultLevelBand = {
  label: string
  order: number
  startPosition: number
  endPosition: number
}

export type AdaptiveResultTrajectoryPoint = {
  order: number
  position: number
  lowerPosition: number
  upperPosition: number
  levelLabel: string | null
}

export type AdaptiveStudentResultNode = {
  id: number
  name: string
  kind: DB.AdaptiveNodeKind
  order: number
  responseCount: number
  levelLabel: string | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
  children: AdaptiveStudentResultNode[]
}

export type AdaptiveStudentResult = {
  attemptId: string
  practiceQuizId: string
  practiceQuizName: string
  stopReason: DB.AdaptivePracticeQuizStopReason
  answeredQuestions: number
  completedAt: Date
  levelLabel: string | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
  levelBands: AdaptiveResultLevelBand[]
  trajectory: AdaptiveResultTrajectoryPoint[]
  competenceProfile: AdaptiveStudentResultNode[]
}

export type AdaptiveCohortLevelBucket = {
  levelLabel: string
  levelOrder: number
  count: number
}

export type AdaptiveCohortNodeDistribution = {
  nodeId: number | null
  parentNodeId: number | null
  nodeName: string
  nodeKind: DB.AdaptiveEstimateNodeKind
  depth: number
  order: number
  suppressed: boolean
  insufficientDataCount: number | null
  buckets: AdaptiveCohortLevelBucket[]
}

export type AdaptiveCohortAttemptSummary = {
  total: number | null
  completed: number | null
  inProgress: number | null
  abandoned: number | null
  suppressed: boolean
  classified: number | null
  capped: number | null
  poolExhausted: number | null
  stoppedInsufficientData: number | null
  insufficientData: number | null
  nearBoundary: number | null
}

export type AdaptivePilotMetrics = {
  suppressed: boolean
  medianQuestionCount: number | null
  p95QuestionCount: number | null
  medianElapsedSeconds: number | null
  p95ElapsedSeconds: number | null
  nearBoundaryRate: number | null
  responseCountMismatchDetected: boolean | null
  durationMissingDetected: boolean | null
}

export type AdaptiveItemDiagnostic = {
  poolItemId: number
  elementName: string
  elementType: DB.ElementType
  nodeNamePath: string[]
  levelLabel: string
  suppressed: boolean
  responseCount: number | null
  exposureRate: number | null
  observedCorrectRate: number | null
  expectedCorrectRate: number | null
  residual: number | null
  highExposure: boolean | null
  misfitFlag: boolean | null
}

export type AdaptiveCohortResults = {
  practiceQuizId: string
  cohortSize: number | null
  suppressed: boolean
  attemptSummary: AdaptiveCohortAttemptSummary
  pilotMetrics: AdaptivePilotMetrics
  itemDiagnostics: AdaptiveItemDiagnostic[]
  distributions: AdaptiveCohortNodeDistribution[]
}

export async function startAdaptivePracticeQuizAttempt(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  return withSerializableRetry(ctx, async (prisma) => {
    const targetQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuizId, isDeleted: false },
      select: { courseId: true },
    })
    if (!targetQuiz) {
      throw runtimeError(
        'Adaptive practice quiz was not found.',
        'ADAPTIVE_QUIZ_NOT_FOUND'
      )
    }
    await lockAdaptiveLearningCourseEnabled(targetQuiz.courseId, prisma)
    await lockAdaptivePracticeQuizConfigForAttempt(practiceQuizId, prisma)
    const runtime = await loadAdaptiveRuntime(prisma, practiceQuizId, {
      includeAlgorithmData: true,
    })
    assertRuntimeAvailable(runtime)
    const participation = await requireParticipation(
      prisma,
      runtime.quiz.courseId,
      ctx.user.sub
    )
    const existing = await prisma.adaptivePracticeQuizAttempt.findFirst({
      where: {
        practiceQuizId,
        participantId: ctx.user.sub,
        status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
      },
      include: attemptRuntimeInclude,
    })
    if (existing) return serializeAttemptState(runtime, existing)
    if (
      runtime.config.attemptSelectionPolicy ===
      DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
    ) {
      const completed = await prisma.adaptivePracticeQuizAttempt.findFirst({
        where: {
          practiceQuizId,
          participantId: ctx.user.sub,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        },
        select: { id: true },
      })
      if (completed) {
        throw runtimeError(
          'This adaptive practice quiz uses the first completed attempt and does not allow a retake.',
          'ADAPTIVE_RETAKE_FORBIDDEN'
        )
      }
    }

    return await createAdaptiveAttempt({
      prisma,
      runtime,
      participantId: ctx.user.sub,
      participationId: participation.id,
    })
  })
}

export async function resumeAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  return withSerializableRetry(ctx, async (prisma) => {
    await lockParticipantAttempt(prisma, attemptId, ctx.user.sub)
    const attempt = await requireParticipantAttempt(
      prisma,
      attemptId,
      ctx.user.sub
    )
    if (attempt.status !== DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      throw runtimeError(
        'Only an in-progress adaptive attempt can be resumed.',
        'ADAPTIVE_ATTEMPT_NOT_IN_PROGRESS'
      )
    }
    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: false,
    })
    assertAdaptiveCourseEnabled(runtime)
    return serializeAttemptState(runtime, attempt)
  })
}

export async function restartAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  const candidate = await ctx.prisma.adaptivePracticeQuizAttempt.findFirst({
    where: { id: attemptId, participantId: ctx.user.sub },
    select: { practiceQuizId: true, courseId: true },
  })
  if (!candidate) {
    throw runtimeError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }

  return withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveLearningCourseEnabled(candidate.courseId, prisma)
    await lockAdaptivePracticeQuizConfigForAttempt(
      candidate.practiceQuizId,
      prisma
    )
    await lockParticipantAttempt(prisma, attemptId, ctx.user.sub)
    const attempt = await requireParticipantAttempt(
      prisma,
      attemptId,
      ctx.user.sub
    )
    if (attempt.status !== DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      throw runtimeError(
        'Only an in-progress adaptive attempt can be restarted.',
        'ADAPTIVE_ATTEMPT_NOT_IN_PROGRESS'
      )
    }

    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: true,
    })
    assertRuntimeAvailable(runtime)
    const participation = await requireParticipation(
      prisma,
      runtime.quiz.courseId,
      ctx.user.sub
    )
    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
        stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
        nextPoolItemId: null,
        completedAt: new Date(),
      },
    })

    return await createAdaptiveAttempt({
      prisma,
      runtime,
      participantId: ctx.user.sub,
      participationId: participation.id,
    })
  })
}

export async function getAdaptivePracticeQuizState(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState | null> {
  assertParticipant(ctx)
  const activeAttempt = await ctx.prisma.adaptivePracticeQuizAttempt.findFirst({
    where: {
      practiceQuizId,
      participantId: ctx.user.sub,
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
    },
    include: attemptRuntimeInclude,
  })
  const attempt =
    activeAttempt ??
    (await ctx.prisma.adaptivePracticeQuizAttempt.findFirst({
      where: {
        practiceQuizId,
        participantId: ctx.user.sub,
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      },
      include: attemptRuntimeInclude,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    }))
  if (!attempt) return null
  const runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
    includeAlgorithmData: false,
  })
  assertAdaptiveCourseEnabled(runtime)
  return serializeAttemptState(runtime, attempt)
}

export async function submitAdaptivePracticeQuizResponse(
  {
    attemptId,
    servedItemId,
    response,
    elapsedSeconds,
  }: {
    attemptId: string
    servedItemId: number
    response: AdaptivePracticeQuizResponseInput
    elapsedSeconds?: number | null
  },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  if (
    elapsedSeconds !== null &&
    typeof elapsedSeconds !== 'undefined' &&
    (!Number.isInteger(elapsedSeconds) ||
      elapsedSeconds < 0 ||
      elapsedSeconds > MAX_REPORTED_QUESTION_ELAPSED_SECONDS)
  ) {
    throw runtimeError(
      'Elapsed seconds must be an integer between 0 and 86400.',
      'ADAPTIVE_ELAPSED_SECONDS_INVALID'
    )
  }

  const candidate = await ctx.prisma.adaptivePracticeQuizAttempt.findFirst({
    where: { id: attemptId, participantId: ctx.user.sub },
    select: { courseId: true },
  })
  if (!candidate) {
    throw runtimeError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }

  return withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveLearningCourseEnabled(candidate.courseId, prisma)
    await lockParticipantAttempt(prisma, attemptId, ctx.user.sub)
    const attempt = await requireParticipantAttempt(
      prisma,
      attemptId,
      ctx.user.sub
    )
    if (
      attempt.responses.some(({ poolItemId }) => poolItemId === servedItemId)
    ) {
      throw runtimeError(
        'This adaptive item has already been answered.',
        'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED'
      )
    }
    if (attempt.status !== DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      throw runtimeError(
        'The adaptive attempt is no longer in progress.',
        'ADAPTIVE_ATTEMPT_NOT_IN_PROGRESS'
      )
    }
    if (attempt.nextPoolItemId !== servedItemId) {
      throw runtimeError(
        'Only the currently served adaptive item can be submitted.',
        'ADAPTIVE_ITEM_NOT_SERVED'
      )
    }

    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: true,
    })
    assertAdaptiveCourseEnabled(runtime)
    const routingPoolItem = runtime.poolById.get(servedItemId)
    const poolItem = attempt.nextPoolItem
      ? toDeliveredRuntimePoolItem(attempt.nextPoolItem)
      : null
    if (
      !routingPoolItem ||
      !poolItem ||
      poolItem.id !== attempt.nextPoolItemId ||
      routingPoolItem.id !== poolItem.id
    ) {
      throw runtimeError(
        'The served adaptive item does not belong to this published quiz pool.',
        'ADAPTIVE_POOL_ITEM_INVALID'
      )
    }
    let graded
    try {
      graded = gradeAdaptiveResponse({ poolItem, input: response })
    } catch (error) {
      if (error instanceof AdaptiveRuntimeValidationError) {
        throw runtimeError(error.message, error.code)
      }
      throw error
    }

    const previousEvidence = toRuntimeResponses(attempt.responses)
    const responseOrder = previousEvidence.length + 1
    const evidence: AdaptiveRuntimeResponse[] = [
      ...previousEvidence,
      {
        order: responseOrder,
        poolItemId: poolItem.id,
        correct: graded.correct,
        poolItem,
      },
    ]
    const decision = selectAdaptiveNextPoolItem({
      attemptId,
      ...runtime.algorithm,
      responses: evidence,
    })
    const terminalStopReason = decision.nextPoolItem
      ? null
      : (decision.stopReason ??
        DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA)
    const estimates = terminalStopReason
      ? computeAdaptiveEstimates({
          nodes: runtime.algorithm.nodes,
          levels: runtime.algorithm.levels,
          responses: evidence,
          settings: runtime.algorithm.settings,
          terminalStopReason,
        })
      : decision.estimates
    if (terminalStopReason) {
      markClassifiedRootEstimates(runtime, evidence, estimates)
    }
    const overallBefore =
      attempt.currentStandardError === null
        ? null
        : {
            theta: attempt.currentTheta,
            standardError: attempt.currentStandardError,
          }
    const overallAfter = estimates.overall
    const totalElapsedSeconds =
      elapsedSeconds === null ||
      typeof elapsedSeconds === 'undefined' ||
      attempt.responses.some((entry) => entry.elapsedSeconds === null)
        ? null
        : attempt.responses.reduce(
            (total, entry) => total + entry.elapsedSeconds!,
            elapsedSeconds
          )

    await prisma.adaptivePracticeQuizResponse.create({
      data: {
        attemptId: attempt.id,
        configId: attempt.configId,
        assignmentId: poolItem.sourceAssignmentId,
        poolItemId: poolItem.id,
        elementId: poolItem.elementId,
        order: responseOrder,
        response: graded.rawResponse as DB.Prisma.InputJsonObject,
        normalizedResponse:
          graded.normalizedResponse as DB.Prisma.InputJsonObject,
        score: graded.score,
        correct: graded.correct,
        overallThetaBefore: overallBefore?.theta ?? null,
        overallThetaAfter: overallAfter.theta,
        overallStandardErrorAfter: overallAfter.standardError,
        elapsedSeconds: elapsedSeconds ?? null,
        elementSnapshot:
          poolItem.elementData as unknown as DB.Prisma.InputJsonValue,
      },
    })

    const estimateNodeIds = terminalStopReason
      ? [...estimates.nodes.keys()]
      : poolItem.nodePath
    await persistAdaptiveEstimates({
      prisma,
      attempt,
      estimates,
      nodeIds: estimateNodeIds,
    })

    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: attempt.id },
      data: terminalStopReason
        ? {
            status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
            stopReason: terminalStopReason,
            nextPoolItemId: null,
            currentTheta: overallAfter.theta ?? attempt.currentTheta,
            currentStandardError: overallAfter.standardError,
            finalTheta: overallAfter.theta,
            finalStandardError: overallAfter.standardError,
            finalLevelId: overallAfter.levelId,
            elapsedSeconds: totalElapsedSeconds,
            completedAt: new Date(),
          }
        : {
            nextPoolItemId: decision.nextPoolItem!.id,
            currentTheta: overallAfter.theta ?? attempt.currentTheta,
            currentStandardError: overallAfter.standardError,
            elapsedSeconds: totalElapsedSeconds,
          },
    })

    const updated = await requireParticipantAttempt(
      prisma,
      attempt.id,
      ctx.user.sub
    )
    return serializeAttemptState(runtime, updated)
  })
}

export async function abandonAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  return withSerializableRetry(ctx, async (prisma) => {
    await lockParticipantAttempt(prisma, attemptId, ctx.user.sub)
    const attempt = await requireParticipantAttempt(
      prisma,
      attemptId,
      ctx.user.sub
    )
    if (attempt.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED) {
      throw runtimeError(
        'A completed adaptive attempt cannot be abandoned.',
        'ADAPTIVE_ATTEMPT_COMPLETED'
      )
    }
    if (attempt.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      await prisma.adaptivePracticeQuizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
          stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
          nextPoolItemId: null,
          completedAt: new Date(),
        },
      })
    }
    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: false,
    })
    const updated = await requireParticipantAttempt(
      prisma,
      attempt.id,
      ctx.user.sub
    )
    return serializeAttemptState(runtime, updated)
  })
}

export async function getAdaptivePracticeQuizResult(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptiveStudentResult> {
  assertParticipant(ctx)
  const attempt = await requireParticipantAttempt(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )
  if (
    attempt.status !== DB.AdaptivePracticeQuizAttemptStatus.COMPLETED ||
    !attempt.stopReason ||
    !attempt.completedAt
  ) {
    throw runtimeError(
      'Adaptive results are available only for completed attempts.',
      'ADAPTIVE_RESULT_UNAVAILABLE'
    )
  }
  const runtime = await loadAdaptiveRuntime(
    ctx.prisma,
    attempt.practiceQuizId,
    {
      includeAlgorithmData: false,
    }
  )
  assertAdaptiveCourseEnabled(runtime)
  return serializeStudentResult(runtime, attempt)
}

export async function getAdaptivePracticeQuizCohortResults(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser
): Promise<AdaptiveCohortResults> {
  if (
    ctx.user.role !== DB.UserRole.USER &&
    ctx.user.role !== DB.UserRole.ADMIN
  ) {
    throw runtimeError(
      'Adaptive cohort results require lecturer access.',
      'ADAPTIVE_RESULTS_FORBIDDEN'
    )
  }
  const runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
    includeAlgorithmData: true,
  })
  const attempts = await ctx.prisma.adaptivePracticeQuizAttempt.findMany({
    where: { practiceQuizId },
    include: { estimates: true },
    orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
  })
  const released = releaseCompletedCohortAttempts(
    attempts.filter(
      ({ status }) => status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED
    )
  )
  const selected = selectCohortAttempts(
    released,
    runtime.config.attemptSelectionPolicy
  )
  const responses =
    selected.length === 0
      ? []
      : await ctx.prisma.adaptivePracticeQuizResponse.findMany({
          where: { attemptId: { in: selected.map(({ id }) => id) } },
          include: {
            poolItem: { select: adaptiveRuntimePoolItemSelect },
          },
          orderBy: [{ attemptId: 'asc' }, { order: 'asc' }],
        })
  return serializeCohortResults(runtime, selected, responses)
}

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

const attemptRuntimeInclude = {
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
type AttemptRuntimeRecord = DB.Prisma.AdaptivePracticeQuizAttemptGetPayload<{
  include: typeof attemptRuntimeInclude
}>
type CohortAttemptRecord = DB.Prisma.AdaptivePracticeQuizAttemptGetPayload<{
  include: { estimates: true }
}>
type CohortResponseRecord = DB.Prisma.AdaptivePracticeQuizResponseGetPayload<{
  include: { poolItem: { select: typeof adaptiveRuntimePoolItemSelect } }
}>

type LoadedAdaptiveRuntime = ReturnType<typeof prepareAdaptiveRuntime>

async function loadAdaptiveRuntime(
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
    throw runtimeError(
      'Adaptive practice quiz was not found.',
      'ADAPTIVE_QUIZ_NOT_FOUND'
    )
  }
  let coverageRecords: DB.CompetenceTreeLeafLevelCoverage[] = []
  let poolRecords: RuntimePoolItemRecord[] = []
  if (includeAlgorithmData) {
    const [loadedCoverages, loadedPool] = await Promise.all([
      prisma.competenceTreeLeafLevelCoverage.findMany({
        where: { treeId: quiz.adaptiveConfig.competenceTreeId },
      }),
      prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { configId: quiz.adaptiveConfig.id },
        select: adaptiveRuntimePoolItemSelect,
        orderBy: { id: 'asc' },
      }),
    ])
    coverageRecords = loadedCoverages
    poolRecords = loadedPool
  }
  return prepareAdaptiveRuntime(quiz, coverageRecords, poolRecords)
}

function prepareAdaptiveRuntime(
  quiz: RuntimeQuizRecord,
  coverageRecords: DB.CompetenceTreeLeafLevelCoverage[],
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
  const coverages: AdaptiveRuntimeCoverage[] = coverageRecords.map(
    (coverage) => ({
      leafNodeId: coverage.leafNodeId,
      levelId: coverage.levelId,
      targetItemCount: coverage.targetItemCount,
      enabled: coverage.enabled,
    })
  )
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
    algorithm: { nodes, levels, coverages, pool, settings },
  }
}

function toRuntimePoolItem(
  item: RuntimePoolItemRecord
): AdaptiveRuntimeRoutingPoolItem {
  return item
}

function toDeliveredRuntimePoolItem(
  item: DeliveredPoolItemRecord
): AdaptiveRuntimePoolItem {
  return { ...item, elementData: item.elementData as ElementData }
}

function toRuntimeResponses(
  responses: AttemptRuntimeRecord['responses']
): AdaptiveRuntimeResponse[] {
  return responses.map((response) => {
    if (!response.poolItem) {
      throw runtimeError(
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

async function createAdaptiveAttempt({
  prisma,
  runtime,
  participantId,
  participationId,
}: {
  prisma: DB.Prisma.TransactionClient
  runtime: LoadedAdaptiveRuntime
  participantId: string
  participationId: number
}): Promise<AdaptivePracticeQuizAttemptState> {
  const attemptId = randomUUID()
  const decision = selectAdaptiveNextPoolItem({
    attemptId,
    ...runtime.algorithm,
    responses: [],
  })
  if (!decision.nextPoolItem) {
    throw runtimeError(
      'The adaptive practice quiz has no deliverable item.',
      'ADAPTIVE_POOL_EXHAUSTED'
    )
  }
  const attempt = await prisma.adaptivePracticeQuizAttempt.create({
    data: {
      id: attemptId,
      configId: runtime.config.id,
      competenceTreeId: runtime.tree.id,
      practiceQuizId: runtime.quiz.id,
      courseId: runtime.quiz.courseId,
      participantId,
      participationId,
      nextPoolItemId: decision.nextPoolItem.id,
    },
    include: attemptRuntimeInclude,
  })
  return serializeAttemptState(runtime, attempt)
}

async function requireParticipation(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  courseId: string,
  participantId: string
) {
  const participation = await prisma.participation.findUnique({
    where: { courseId_participantId: { courseId, participantId } },
  })
  if (!participation) {
    throw runtimeError(
      'A course participation is required for this adaptive quiz.',
      'ADAPTIVE_PARTICIPATION_REQUIRED'
    )
  }
  return participation
}

async function requireParticipantAttempt(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  attemptId: string,
  participantId: string
) {
  const attempt = await prisma.adaptivePracticeQuizAttempt.findFirst({
    where: { id: attemptId, participantId },
    include: attemptRuntimeInclude,
  })
  if (!attempt) {
    throw runtimeError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
  return attempt
}

async function lockParticipantAttempt(
  prisma: DB.Prisma.TransactionClient,
  attemptId: string,
  participantId: string
) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "AdaptivePracticeQuizAttempt"
    WHERE "id" = ${attemptId}::uuid
      AND "participantId" = ${participantId}::uuid
    FOR UPDATE
  `
  if (!rows[0]) {
    throw runtimeError(
      'Adaptive attempt was not found.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
}

function assertRuntimeAvailable(runtime: LoadedAdaptiveRuntime) {
  assertAdaptiveCourseEnabled(runtime)
  if (
    runtime.quiz.status !== DB.PublicationStatus.PUBLISHED ||
    !runtime.config.poolPublishedAt ||
    runtime.pool.length === 0
  ) {
    throw runtimeError(
      'This adaptive practice quiz is not available.',
      'ADAPTIVE_QUIZ_UNAVAILABLE'
    )
  }
}

function assertAdaptiveCourseEnabled(runtime: LoadedAdaptiveRuntime) {
  if (!runtime.quiz.course.isAdaptiveLearningEnabled) {
    throw runtimeError(
      'Adaptive learning is not enabled for this course.',
      'ADAPTIVE_COURSE_DISABLED'
    )
  }
}

function serializeAttemptState(
  runtime: LoadedAdaptiveRuntime,
  attempt: AttemptRuntimeRecord
): AdaptivePracticeQuizAttemptState {
  const nextPoolItem = attempt.nextPoolItem
    ? toDeliveredRuntimePoolItem(attempt.nextPoolItem)
    : null
  if (
    attempt.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS &&
    (!nextPoolItem || nextPoolItem.id !== attempt.nextPoolItemId)
  ) {
    throw runtimeError(
      'The in-progress adaptive attempt has no valid served item.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  return {
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    status: attempt.status,
    stopReason: attempt.stopReason,
    answeredQuestions: attempt.responses.length,
    questionNumber: nextPoolItem ? attempt.responses.length + 1 : null,
    maximumQuestions: runtime.config.totalQuestionCap,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    elapsedSeconds: attempt.elapsedSeconds ?? 0,
    showTimer: runtime.config.showTimer,
    canStartNewAttempt:
      attempt.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED &&
      runtime.config.attemptSelectionPolicy !==
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
    servedItem: nextPoolItem
      ? serializeAdaptiveParticipantElement(nextPoolItem)
      : null,
  }
}

function markClassifiedRootEstimates(
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

async function persistAdaptiveEstimates({
  prisma,
  attempt,
  estimates,
  nodeIds,
}: {
  prisma: DB.Prisma.TransactionClient
  attempt: AttemptRuntimeRecord
  estimates: ReturnType<typeof computeAdaptiveEstimates>
  nodeIds: number[]
}) {
  await persistOverallEstimate(prisma, attempt, estimates.overall)
  for (const nodeId of [...new Set(nodeIds)]) {
    const estimate = estimates.nodes.get(nodeId)
    if (!estimate) continue
    await prisma.adaptivePracticeQuizEstimate.upsert({
      where: {
        attemptId_nodeKind_nodeId: {
          attemptId: attempt.id,
          nodeKind: estimate.nodeKind,
          nodeId,
        },
      },
      create: estimateData(attempt, estimate),
      update: estimateUpdate(estimate),
    })
  }
}

async function persistOverallEstimate(
  prisma: DB.Prisma.TransactionClient,
  attempt: AttemptRuntimeRecord,
  estimate: AdaptiveRuntimeEstimate
) {
  const updated = await prisma.adaptivePracticeQuizEstimate.updateMany({
    where: {
      attemptId: attempt.id,
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      nodeId: null,
    },
    data: estimateUpdate(estimate),
  })
  if (updated.count === 0) {
    await prisma.adaptivePracticeQuizEstimate.create({
      data: estimateData(attempt, estimate),
    })
  }
}

function estimateData(
  attempt: AttemptRuntimeRecord,
  estimate: AdaptiveRuntimeEstimate
): DB.Prisma.AdaptivePracticeQuizEstimateUncheckedCreateInput {
  return {
    attemptId: attempt.id,
    configId: attempt.configId,
    competenceTreeId: attempt.competenceTreeId,
    nodeKind: estimate.nodeKind,
    nodeId: estimate.nodeId,
    theta: estimate.theta,
    standardError: estimate.standardError,
    responseCount: estimate.responseCount,
    levelId: estimate.levelId,
    stopReason: estimate.stopReason,
  }
}

function estimateUpdate(
  estimate: AdaptiveRuntimeEstimate
): DB.Prisma.AdaptivePracticeQuizEstimateUncheckedUpdateManyInput {
  return {
    theta: estimate.theta,
    standardError: estimate.standardError,
    responseCount: estimate.responseCount,
    levelId: estimate.levelId,
    stopReason: estimate.stopReason,
  }
}

function serializeStudentResult(
  runtime: LoadedAdaptiveRuntime,
  attempt: AttemptRuntimeRecord
): AdaptiveStudentResult {
  if (!attempt.stopReason || !attempt.completedAt) {
    throw runtimeError(
      'The completed adaptive attempt has no terminal metadata.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const settings = runtime.algorithm.settings
  const levelsById = new Map(
    runtime.algorithm.levels.map((level) => [level.id, level])
  )
  const estimatesByNode = new Map(
    attempt.estimates
      .filter((estimate) => estimate.nodeId !== null)
      .map((estimate) => [estimate.nodeId!, estimate])
  )
  const overall = attempt.estimates.find(
    (estimate) => estimate.nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
  )
  if (!overall) {
    throw runtimeError(
      'The completed adaptive attempt has no overall estimate.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  if (overall.responseCount !== attempt.responses.length) {
    throw runtimeError(
      'The completed adaptive attempt response evidence is inconsistent.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const overallView = serializeEstimateView({
    estimate: overall,
    levelsById,
    settings,
  })
  const childrenByParent = new Map<number | null, AdaptiveRuntimeNode[]>()
  const effectiveNodes = getEffectivelyEnabledRuntimeNodes(
    runtime.algorithm.nodes
  )
  for (const node of effectiveNodes) {
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node)
    childrenByParent.set(node.parentId, siblings)
  }
  const buildNode = (node: AdaptiveRuntimeNode): AdaptiveStudentResultNode => {
    const estimate = estimatesByNode.get(node.id)
    const view = serializeEstimateView({
      estimate,
      levelsById,
      settings,
    })
    return {
      id: node.id,
      name: runtime.tree.nodes.find(({ id }) => id === node.id)!.name,
      kind: node.kind,
      order: node.order,
      responseCount: estimate?.responseCount ?? 0,
      ...view,
      children: (childrenByParent.get(node.id) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map(buildNode),
    }
  }
  const rootIds = effectiveNodes
    .filter(
      (node) =>
        node.parentId === null && node.kind === DB.AdaptiveNodeKind.COMPETENCE
    )
    .map(({ id }) => id)
  const trajectoryRootCounts = new Map<number, number>()
  const trajectory = attempt.responses.flatMap((response) => {
    const rootId = response.poolItem?.nodePath[0]
    if (typeof rootId === 'number') {
      trajectoryRootCounts.set(
        rootId,
        (trajectoryRootCounts.get(rootId) ?? 0) + 1
      )
    }
    if (
      response.overallThetaAfter === null ||
      response.overallStandardErrorAfter === null
    ) {
      return []
    }
    const normalized = normalizeRuntimeEstimateForChart({
      estimate: {
        theta: response.overallThetaAfter,
        standardError: response.overallStandardErrorAfter,
      },
      settings,
    })!
    const level = rootIds.every(
      (id) => (trajectoryRootCounts.get(id) ?? 0) >= MIN_REPORTING_RESPONSES
    )
      ? mapLevelForTheta(
          response.overallThetaAfter,
          runtime.algorithm.levels,
          settings
        )
      : null
    return [
      {
        order: response.order,
        ...normalized,
        levelLabel: level?.label ?? null,
      },
    ]
  })

  return {
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    stopReason: attempt.stopReason,
    answeredQuestions: attempt.responses.length,
    completedAt: attempt.completedAt,
    ...overallView,
    levelBands: serializeLevelBands(runtime.algorithm.levels, settings),
    trajectory,
    competenceProfile: (childrenByParent.get(null) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map(buildNode),
  }
}

function serializeEstimateView({
  estimate,
  levelsById,
  settings,
}: {
  estimate:
    | Pick<
        DB.AdaptivePracticeQuizEstimate,
        'theta' | 'standardError' | 'responseCount' | 'levelId'
      >
    | undefined
  levelsById: Map<number, AdaptiveRuntimeLevel>
  settings: AdaptiveRuntimeSettings
}) {
  if (
    !estimate ||
    estimate.responseCount < MIN_REPORTING_RESPONSES ||
    estimate.theta === null ||
    estimate.standardError === null ||
    estimate.levelId === null
  ) {
    return {
      levelLabel: null,
      confidence: 'INSUFFICIENT_DATA' as const,
      nearBoundary: false,
      position: null,
      lowerPosition: null,
      upperPosition: null,
    }
  }
  const level = levelsById.get(estimate.levelId)
  const normalized = normalizeRuntimeEstimateForChart({ estimate, settings })!
  const classified = classificationIntervalWithinLevelBand({
    theta: estimate.theta,
    standardError: estimate.standardError,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    z: settings.classificationZ,
  })
  const nearBoundary = isNearLevelBoundary({
    theta: estimate.theta,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    margin: settings.classificationZ * estimate.standardError,
  })
  return {
    levelLabel: level?.label ?? null,
    confidence: classified
      ? ('HIGH' as const)
      : nearBoundary
        ? ('LOW' as const)
        : ('MODERATE' as const),
    nearBoundary,
    ...normalized,
  }
}

function serializeLevelBands(
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings
) {
  return mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).map((level) => ({
    label: level.label,
    order: level.order,
    startPosition: normalizeThetaForChart(
      Number.isFinite(level.lowerBound)
        ? level.lowerBound
        : settings.thetaRange.min,
      settings.thetaRange
    ),
    endPosition: normalizeThetaForChart(
      Number.isFinite(level.upperBound)
        ? level.upperBound
        : settings.thetaRange.max,
      settings.thetaRange
    ),
  }))
}

function mapLevelForTheta(
  theta: number,
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings
) {
  const mapped = mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).find((level) => theta >= level.lowerBound && theta < level.upperBound)
  return mapped
    ? levels.find(
        (level) => level.label === mapped.label && level.order === mapped.order
      )
    : levels.at(-1)
}

function selectCohortAttempts(
  attempts: CohortAttemptRecord[],
  policy: DB.AdaptiveAttemptSelectionPolicy
) {
  const selected = new Map<string, CohortAttemptRecord>()
  for (const attempt of attempts) {
    if (
      policy === DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED &&
      selected.has(attempt.participantId)
    ) {
      continue
    }
    selected.set(attempt.participantId, attempt)
  }
  return [...selected.values()]
}

function releaseCompletedCohortAttempts(attempts: CohortAttemptRecord[]) {
  const participants = new Set<string>()
  let releaseThroughIndex = -1

  for (const [index, attempt] of attempts.entries()) {
    const isNewParticipant = !participants.has(attempt.participantId)
    participants.add(attempt.participantId)
    if (
      isNewParticipant &&
      participants.size >= SMALL_BUCKET_THRESHOLD &&
      participants.size % SMALL_BUCKET_THRESHOLD === 0
    ) {
      releaseThroughIndex = index
    }
  }

  return releaseThroughIndex === -1
    ? []
    : attempts.slice(0, releaseThroughIndex + 1)
}

function serializeCohortResults(
  runtime: LoadedAdaptiveRuntime,
  attempts: CohortAttemptRecord[],
  responses: CohortResponseRecord[]
): AdaptiveCohortResults {
  const releasedCohortSize = attempts.length
  const levels = runtime.algorithm.levels
  const nodesById = new Map(runtime.tree.nodes.map((node) => [node.id, node]))
  const definitions = [
    {
      nodeId: null,
      parentNodeId: null,
      nodeName: 'Overall',
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      depth: 0,
      order: 0,
    },
    ...getEffectivelyEnabledRuntimeNodes(runtime.algorithm.nodes).map(
      (node) => ({
        nodeId: node.id,
        parentNodeId: node.parentId,
        nodeName: nodesById.get(node.id)!.name,
        nodeKind:
          node.kind === DB.AdaptiveNodeKind.COMPETENCE
            ? DB.AdaptiveEstimateNodeKind.COMPETENCE
            : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
        depth: nodesById.get(node.id)!.depth,
        order: nodesById.get(node.id)!.order,
      })
    ),
  ]
  const distributions = definitions.map((definition) => {
    const estimates = attempts.map((attempt) =>
      attempt.estimates.find(
        (estimate) =>
          estimate.nodeKind === definition.nodeKind &&
          estimate.nodeId === definition.nodeId
      )
    )
    const insufficientDataCount = estimates.filter(
      (estimate) =>
        !estimate ||
        estimate.responseCount < MIN_REPORTING_RESPONSES ||
        estimate.levelId === null
    ).length
    const counts = new Map<number, number>()
    for (const estimate of estimates) {
      if (
        !estimate ||
        estimate.responseCount < MIN_REPORTING_RESPONSES ||
        estimate.levelId === null
      ) {
        continue
      }
      counts.set(estimate.levelId, (counts.get(estimate.levelId) ?? 0) + 1)
    }
    const hasSmallBucket = [...counts.values(), insufficientDataCount].some(
      (count) => count > 0 && count < SMALL_BUCKET_THRESHOLD
    )
    const suppressed =
      releasedCohortSize < SMALL_BUCKET_THRESHOLD || hasSmallBucket
    return {
      ...definition,
      suppressed,
      insufficientDataCount: suppressed ? null : insufficientDataCount,
      buckets: suppressed
        ? []
        : levels.map((level) => ({
            levelLabel: level.label,
            levelOrder: level.order,
            count: counts.get(level.id) ?? 0,
          })),
    }
  })

  const attemptSummary = serializeCohortAttemptSummary(runtime, attempts)
  return {
    practiceQuizId: runtime.quiz.id,
    cohortSize: releasedCohortSize === 0 ? null : releasedCohortSize,
    suppressed: distributions.every(({ suppressed }) => suppressed),
    attemptSummary,
    pilotMetrics: serializePilotMetrics(attempts, responses, attemptSummary),
    itemDiagnostics: serializeItemDiagnostics(runtime, attempts, responses),
    distributions,
  }
}

function serializePilotMetrics(
  attempts: CohortAttemptRecord[],
  responses: CohortResponseRecord[],
  attemptSummary: AdaptiveCohortAttemptSummary
): AdaptivePilotMetrics {
  const suppressed = attempts.length < SMALL_BUCKET_THRESHOLD
  if (suppressed) {
    return {
      suppressed: true,
      medianQuestionCount: null,
      p95QuestionCount: null,
      medianElapsedSeconds: null,
      p95ElapsedSeconds: null,
      nearBoundaryRate: null,
      responseCountMismatchDetected: null,
      durationMissingDetected: null,
    }
  }

  const responseCounts = new Map<string, number>()
  for (const response of responses) {
    responseCounts.set(
      response.attemptId,
      (responseCounts.get(response.attemptId) ?? 0) + 1
    )
  }
  const questionCounts = attempts.map(({ id }) => responseCounts.get(id) ?? 0)
  const durations = attempts.flatMap(({ elapsedSeconds }) =>
    elapsedSeconds === null ? [] : [elapsedSeconds]
  )
  const responseCountMismatchDetected = attempts.some((attempt) => {
    const overall = attempt.estimates.find(
      ({ nodeKind, nodeId }) =>
        nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL && nodeId === null
    )
    return (
      !overall ||
      overall.responseCount !== (responseCounts.get(attempt.id) ?? 0)
    )
  })

  return {
    suppressed: false,
    medianQuestionCount: percentile(questionCounts, 0.5),
    p95QuestionCount: percentile(questionCounts, 0.95),
    medianElapsedSeconds: percentile(durations, 0.5),
    p95ElapsedSeconds: percentile(durations, 0.95),
    nearBoundaryRate:
      attemptSummary.nearBoundary === null
        ? null
        : attemptSummary.nearBoundary / attempts.length,
    responseCountMismatchDetected,
    durationMissingDetected: durations.length !== attempts.length,
  }
}

function serializeItemDiagnostics(
  runtime: LoadedAdaptiveRuntime,
  attempts: CohortAttemptRecord[],
  responses: CohortResponseRecord[]
): AdaptiveItemDiagnostic[] {
  const attemptsById = new Set(attempts.map(({ id }) => id))
  const metrics = new Map(
    runtime.pool.map((item) => [
      item.id,
      {
        item,
        responseCount: 0,
        correctCount: 0,
        expectedTotal: 0,
        expectedCount: 0,
      },
    ])
  )
  const responsesByAttempt = new Map<string, CohortResponseRecord[]>()
  for (const response of responses) {
    if (!attemptsById.has(response.attemptId)) continue
    const entries = responsesByAttempt.get(response.attemptId) ?? []
    entries.push(response)
    responsesByAttempt.set(response.attemptId, entries)
  }

  for (const attemptResponses of responsesByAttempt.values()) {
    const evidenceByRoot = new Map<
      number,
      Array<{
        item: { id: number; a: number; b: number; c: number }
        correct: boolean
      }>
    >()
    for (const response of attemptResponses.sort(
      (left, right) => left.order - right.order
    )) {
      const item = response.poolItem
      if (!item) continue
      const metric = metrics.get(item.id)
      const rootId = item.nodePath[0]
      if (!metric || typeof rootId !== 'number') continue

      const evidence = evidenceByRoot.get(rootId) ?? []
      const routingTheta = updateTheta({
        responses: evidence,
        range: runtime.algorithm.settings.thetaRange,
        usePrior: true,
        priorMean: 0,
        priorSD: 1,
      }).theta
      metric.responseCount += 1
      metric.correctCount += response.correct ? 1 : 0
      metric.expectedTotal += probability(routingTheta, {
        a: item.discrimination,
        b: item.difficulty,
        c: item.guessing,
      })
      metric.expectedCount += 1
      evidence.push({
        item: {
          id: item.id,
          a: item.discrimination,
          b: item.difficulty,
          c: item.guessing,
        },
        correct: response.correct,
      })
      evidenceByRoot.set(rootId, evidence)
    }
  }

  const cohortSize = attempts.length
  return [...metrics.values()]
    .sort((left, right) => left.item.id - right.item.id)
    .map(
      ({ item, responseCount, correctCount, expectedTotal, expectedCount }) => {
        const unexposedCount = cohortSize - responseCount
        const exposureSuppressed =
          cohortSize < SMALL_BUCKET_THRESHOLD ||
          (responseCount > 0 && responseCount < SMALL_BUCKET_THRESHOLD) ||
          (unexposedCount > 0 && unexposedCount < SMALL_BUCKET_THRESHOLD)
        const incorrectCount = responseCount - correctCount
        const accuracySuppressed =
          exposureSuppressed ||
          (correctCount > 0 && correctCount < SMALL_BUCKET_THRESHOLD) ||
          (incorrectCount > 0 && incorrectCount < SMALL_BUCKET_THRESHOLD)
        const exposureRate =
          exposureSuppressed || cohortSize === 0
            ? null
            : responseCount / cohortSize
        const observedCorrectRate =
          accuracySuppressed || responseCount === 0
            ? null
            : correctCount / responseCount
        const expectedCorrectRate =
          accuracySuppressed || expectedCount === 0
            ? null
            : expectedTotal / expectedCount
        const residual =
          responseCount >= ITEM_DIAGNOSTIC_MIN_RESPONSES &&
          observedCorrectRate !== null &&
          expectedCorrectRate !== null
            ? observedCorrectRate - expectedCorrectRate
            : null

        return {
          poolItemId: item.id,
          elementName: item.elementName,
          elementType: item.elementType,
          nodeNamePath: item.nodeNamePath,
          levelLabel: item.levelLabel,
          suppressed: exposureSuppressed,
          responseCount: exposureSuppressed ? null : responseCount,
          exposureRate,
          observedCorrectRate,
          expectedCorrectRate,
          residual,
          highExposure:
            exposureRate === null
              ? null
              : exposureRate > HIGH_EXPOSURE_THRESHOLD,
          misfitFlag:
            residual === null
              ? null
              : Math.abs(residual) >= ITEM_RESIDUAL_WARNING_THRESHOLD,
        }
      }
    )
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null
  const sorted = values.slice().sort((left, right) => left - right)
  const position = (sorted.length - 1) * quantile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!
  return lower + (upper - lower) * (position - lowerIndex)
}

function serializeCohortAttemptSummary(
  runtime: LoadedAdaptiveRuntime,
  selectedAttempts: CohortAttemptRecord[]
): AdaptiveCohortAttemptSummary {
  const classified = selectedAttempts.filter(
    ({ stopReason }) =>
      stopReason === DB.AdaptivePracticeQuizStopReason.CLASSIFIED ||
      stopReason === DB.AdaptivePracticeQuizStopReason.ALL_ROOTS_CLASSIFIED
  ).length
  const capped = selectedAttempts.filter(
    ({ stopReason }) =>
      stopReason === DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP ||
      stopReason === DB.AdaptivePracticeQuizStopReason.NODE_QUESTION_CAP
  ).length
  const poolExhausted = selectedAttempts.filter(
    ({ stopReason }) =>
      stopReason === DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
  ).length
  const stoppedInsufficientData = selectedAttempts.filter(
    ({ stopReason }) =>
      stopReason === DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
  ).length
  const overallEstimates = selectedAttempts.map((attempt) =>
    attempt.estimates.find(
      ({ nodeKind, nodeId }) =>
        nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL && nodeId === null
    )
  )
  const insufficientData = overallEstimates.filter(
    (estimate) =>
      !estimate ||
      estimate.responseCount < MIN_REPORTING_RESPONSES ||
      estimate.levelId === null
  ).length
  const levelsById = new Map(
    runtime.algorithm.levels.map((level) => [level.id, level])
  )
  const nearBoundary = overallEstimates.filter(
    (estimate) =>
      serializeEstimateView({
        estimate,
        levelsById,
        settings: runtime.algorithm.settings,
      }).nearBoundary
  ).length
  const selectedCount = selectedAttempts.length
  const sensitiveCounts = [
    classified,
    capped,
    poolExhausted,
    stoppedInsufficientData,
    insufficientData,
    nearBoundary,
    selectedCount - nearBoundary,
  ]
  const suppressed =
    selectedCount < SMALL_BUCKET_THRESHOLD ||
    sensitiveCounts.some((count) => count > 0 && count < SMALL_BUCKET_THRESHOLD)

  return {
    total: selectedCount === 0 ? null : selectedCount,
    completed: selectedCount === 0 ? null : selectedCount,
    inProgress: null,
    abandoned: null,
    suppressed,
    classified: suppressed ? null : classified,
    capped: suppressed ? null : capped,
    poolExhausted: suppressed ? null : poolExhausted,
    stoppedInsufficientData: suppressed ? null : stoppedInsufficientData,
    insufficientData: suppressed ? null : insufficientData,
    nearBoundary: suppressed ? null : nearBoundary,
  }
}

function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw runtimeError(
      'Adaptive attempts require participant authentication.',
      'ADAPTIVE_PARTICIPANT_REQUIRED'
    )
  }
}

function getEffectivelyEnabledRuntimeNodes(nodes: AdaptiveRuntimeNode[]) {
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

export async function withSerializableRetry<T>(
  ctx: ContextWithUser,
  operation: (prisma: DB.Prisma.TransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < TRANSACTION_RETRIES; attempt++) {
    try {
      return await ctx.prisma.$transaction(operation, {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 20_000,
      })
    } catch (error) {
      if (isRetryableTransactionConflict(error)) {
        if (attempt < TRANSACTION_RETRIES - 1) continue
        throw runtimeError(
          'The adaptive attempt could not be updated due to concurrent activity.',
          'ADAPTIVE_ATTEMPT_CONFLICT'
        )
      }
      throw error
    }
  }
  throw new Error('Unreachable adaptive transaction retry state.')
}

function isRetryableTransactionConflict(error: unknown) {
  const prismaError = error as {
    code?: string
    meta?: {
      code?: string
      driverAdapterError?: {
        cause?: { kind?: string; originalCode?: string }
      }
    }
  }
  const driverCause = prismaError.meta?.driverAdapterError?.cause
  const postgresCode = prismaError.meta?.code ?? driverCause?.originalCode
  return (
    prismaError.code === 'P2034' ||
    (prismaError.code === 'P2010' &&
      (postgresCode === '40001' ||
        postgresCode === '40P01' ||
        driverCause?.kind === 'TransactionWriteConflict'))
  )
}

function runtimeError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
