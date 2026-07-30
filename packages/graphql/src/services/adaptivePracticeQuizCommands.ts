import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import { adaptivePracticeQuizError as runtimeError } from './adaptivePracticeQuizErrors.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  serializeAdaptiveAttemptState as serializeAttemptState,
  type AdaptivePracticeQuizAttemptState,
} from './adaptivePracticeQuizParticipantViews.js'
import {
  lockAdaptivePracticeQuizConfigForShare,
  lockPracticeQuizForShare,
  withSerializableRetry,
} from './adaptivePracticeQuizRepository.js'
import {
  AdaptiveRuntimeValidationError,
  computeAdaptiveEstimates,
  gradeAdaptiveResponse,
  selectAdaptiveNextPoolItem,
  type AdaptivePracticeQuizResponseInput,
  type AdaptiveRuntimeResponse,
} from './adaptivePracticeQuizRuntime.js'
import {
  assertAdaptiveQuizPublished,
  assertAdaptiveRuntimeAvailable as assertRuntimeAvailable,
  adaptiveAttemptRuntimeInclude as attemptRuntimeInclude,
  loadAdaptiveRuntime,
  lockAdaptiveAttemptLifecycle,
  markClassifiedAdaptiveRootEstimates as markClassifiedRootEstimates,
  persistAdaptiveRuntimeEstimates as persistAdaptiveEstimates,
  requireAdaptiveAttemptLifecycleIdentity,
  requireParticipantAdaptiveAttempt as requireParticipantAttempt,
  requireAdaptiveParticipation as requireParticipation,
  toDeliveredRuntimePoolItem,
  toRuntimeResponses,
  type LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'

const MAX_REPORTED_QUESTION_ELAPSED_SECONDS = 24 * 60 * 60

export async function startAdaptivePracticeQuizAttempt(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  const outcome = await withSerializableRetry(
    ctx,
    async (prisma) => {
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
      const lockedQuiz = await lockPracticeQuizForShare(
        practiceQuizId,
        targetQuiz.courseId,
        prisma
      )
      if (!lockedQuiz || lockedQuiz.isDeleted) {
        throw runtimeError(
          'Adaptive practice quiz was not found.',
          'ADAPTIVE_QUIZ_NOT_FOUND'
        )
      }
      await lockAdaptivePracticeQuizConfigForShare(practiceQuizId, prisma)
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
      if (existing) {
        return {
          state: serializeAttemptState(runtime, existing),
          created: false,
          courseId: runtime.quiz.courseId,
        }
      }
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

      return {
        state: await createAdaptiveAttempt({
          prisma,
          runtime,
          participantId: ctx.user.sub,
          participationId: participation.id,
        }),
        created: true,
        courseId: runtime.quiz.courseId,
      }
    },
    { retryOnUniqueConstraint: true }
  )
  if (outcome.created) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_attempt_lifecycle',
      phase: 'STARTED',
      practiceQuizId,
      courseId: outcome.courseId,
    })
  }
  return outcome.state
}

export async function resumeAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  const identity = await requireAdaptiveAttemptLifecycleIdentity(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )
  return withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveAttemptLifecycle({
      prisma,
      identity,
      participantId: ctx.user.sub,
      requireCourseEnabled: true,
    })
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
    assertAdaptiveQuizPublished(runtime)
    return serializeAttemptState(runtime, attempt)
  })
}

export async function restartAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  const candidate = await requireAdaptiveAttemptLifecycleIdentity(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )

  const state = await withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveAttemptLifecycle({
      prisma,
      identity: candidate,
      participantId: ctx.user.sub,
      requireCourseEnabled: true,
    })
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
  emitAdaptiveOperationalEvent({
    name: 'adaptive_attempt_lifecycle',
    phase: 'ABANDONED',
    practiceQuizId: candidate.practiceQuizId,
    courseId: candidate.courseId,
    stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
  })
  emitAdaptiveOperationalEvent({
    name: 'adaptive_attempt_lifecycle',
    phase: 'STARTED',
    practiceQuizId: candidate.practiceQuizId,
    courseId: candidate.courseId,
  })
  return state
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

  const candidate = await requireAdaptiveAttemptLifecycleIdentity(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )

  const state = await withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveAttemptLifecycle({
      prisma,
      identity: candidate,
      participantId: ctx.user.sub,
      requireCourseEnabled: true,
    })
    const attempt = await requireParticipantAttempt(
      prisma,
      attemptId,
      ctx.user.sub
    )
    if (
      attempt.responses.some(({ poolItemId }) => poolItemId === servedItemId)
    ) {
      emitAdaptiveOperationalEvent({
        name: 'adaptive_integrity_rejection',
        reason: 'REPLAYED_RESPONSE',
        practiceQuizId: candidate.practiceQuizId,
        courseId: candidate.courseId,
      })
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
      emitAdaptiveOperationalEvent({
        name: 'adaptive_integrity_rejection',
        reason: 'STALE_ITEM',
        practiceQuizId: candidate.practiceQuizId,
        courseId: candidate.courseId,
      })
      throw runtimeError(
        'Only the currently served adaptive item can be submitted.',
        'ADAPTIVE_ITEM_NOT_SERVED'
      )
    }

    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: true,
    })
    assertRuntimeAvailable(runtime)
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
      emitAdaptiveOperationalEvent({
        name: 'adaptive_integrity_rejection',
        reason: 'INVALID_POOL_ITEM',
        practiceQuizId: candidate.practiceQuizId,
        courseId: candidate.courseId,
      })
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
  if (state.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_attempt_lifecycle',
      phase: 'COMPLETED',
      practiceQuizId: candidate.practiceQuizId,
      courseId: candidate.courseId,
      stopReason: state.stopReason,
      answeredQuestions: state.answeredQuestions,
    })
  }
  return state
}

export async function abandonAdaptivePracticeQuizAttempt(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizAttemptState> {
  assertParticipant(ctx)
  const identity = await requireAdaptiveAttemptLifecycleIdentity(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )
  const outcome = await withSerializableRetry(ctx, async (prisma) => {
    await lockAdaptiveAttemptLifecycle({
      prisma,
      identity,
      participantId: ctx.user.sub,
      requireCourseEnabled: false,
    })
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
    const changed =
      attempt.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    if (changed) {
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
    return { state: serializeAttemptState(runtime, updated), changed }
  })
  if (outcome.changed) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_attempt_lifecycle',
      phase: 'ABANDONED',
      practiceQuizId: identity.practiceQuizId,
      courseId: identity.courseId,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
    })
  }
  return outcome.state
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

function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw runtimeError(
      'Adaptive attempts require participant authentication.',
      'ADAPTIVE_PARTICIPANT_REQUIRED'
    )
  }
}
