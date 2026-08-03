import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import {
  advanceAdaptiveRuntimeWithTelemetry,
  assertParticipant,
  clearAdaptiveDeliveryData,
  createAdaptiveAttempt,
  submittedChoiceFeedback,
} from './adaptivePracticeQuizCommandSupport.js'
import { adaptivePracticeQuizError as runtimeError } from './adaptivePracticeQuizErrors.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  serializeAdaptiveAttemptState as serializeAttemptState,
  type AdaptivePracticeQuizAttemptState,
} from './adaptivePracticeQuizParticipantViews.js'
import {
  lockAdaptivePracticeQuizConfigForShare,
  lockPracticeQuizForShare,
  persistAdaptivePracticeQuizEstimates,
  withSerializableRetry,
} from './adaptivePracticeQuizRepository.js'
import { planAdaptivePracticeQuizResponseTransition } from './adaptivePracticeQuizResponseTransition.js'
import { isAdaptiveRetakeCooldownElapsed } from './adaptivePracticeQuizRetakes.js'
import {
  AdaptiveRuntimeValidationError,
  gradeAdaptiveResponse,
  type AdaptivePracticeQuizResponseInput,
  type AdaptiveRuntimeResponse,
} from './adaptivePracticeQuizRuntime.js'
import {
  assertAdaptiveQuizPublished,
  assertAdaptiveRuntimeAvailable as assertRuntimeAvailable,
  adaptiveAttemptRuntimeInclude as attemptRuntimeInclude,
  incrementAdaptiveV2Exposure,
  loadAdaptiveRuntime,
  loadAdaptiveV2SelectionContext,
  lockAdaptiveAttemptLifecycle,
  requireAdaptiveAttemptLifecycleIdentity,
  requireParticipantAdaptiveAttempt as requireParticipantAttempt,
  requireAdaptiveParticipation as requireParticipation,
  toDeliveredRuntimePoolItem,
  toRuntimeResponses,
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
        const existingRuntime = await loadAdaptiveRuntime(
          prisma,
          existing.practiceQuizId,
          {
            includeAlgorithmData: true,
            publicationId: existing.publicationId,
          }
        )
        return {
          state: serializeAttemptState(existingRuntime, existing),
          created: false,
          courseId: runtime.quiz.courseId,
        }
      }
      const completed = await prisma.adaptivePracticeQuizAttempt.findFirst({
        where: {
          practiceQuizId,
          participantId: ctx.user.sub,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        },
        orderBy: { completedAt: 'desc' },
        select: { id: true, completedAt: true },
      })
      if (completed) {
        if (
          runtime.publication.retakePolicy ===
          DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
        ) {
          throw runtimeError(
            'This adaptive practice quiz uses the first completed attempt and does not allow a retake.',
            'ADAPTIVE_RETAKE_FORBIDDEN'
          )
        }
        if (
          completed.completedAt &&
          !isAdaptiveRetakeCooldownElapsed({
            completedAt: completed.completedAt,
            cooldownDays: runtime.publication.retakeCooldownDays,
          })
        ) {
          throw runtimeError(
            'This adaptive practice quiz is still in its retake cooldown period.',
            'ADAPTIVE_RETAKE_COOLDOWN'
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
      includeAlgorithmData: true,
      publicationId: attempt.publicationId,
    })
    assertAdaptiveQuizPublished(runtime, { allowSupersededPublication: true })
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
      publicationId: attempt.publicationId,
    })
    assertRuntimeAvailable(runtime, { allowSupersededPublication: true })
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
        ...clearAdaptiveDeliveryData(),
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

  const outcome = await withSerializableRetry(ctx, async (prisma) => {
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
      publicationId: attempt.publicationId,
    })
    assertRuntimeAvailable(runtime, { allowSupersededPublication: true })
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
        poolItem: routingPoolItem,
      },
    ]
    const selectionContext = await loadAdaptiveV2SelectionContext({
      prisma,
      runtime,
      participantId: ctx.user.sub,
      attemptId,
      startingAttempt: false,
    })
    const loadedDecision = advanceAdaptiveRuntimeWithTelemetry({
      loadedRuntime: runtime,
      operation: 'ADVANCE',
      input: {
        attemptId,
        responses: evidence,
        selectionContext,
      },
    })
    const totalElapsedSeconds =
      elapsedSeconds === null ||
      typeof elapsedSeconds === 'undefined' ||
      attempt.responses.some((entry) => entry.elapsedSeconds === null)
        ? null
        : attempt.responses.reduce(
            (total, entry) => total + entry.elapsedSeconds!,
            elapsedSeconds
          )
    const transition = planAdaptivePracticeQuizResponseTransition({
      attempt,
      servedPoolItem: routingPoolItem,
      responses: evidence,
      advancedRuntime: loadedDecision,
      totalElapsedSeconds,
      completedAt: new Date(),
    })

    await prisma.adaptivePracticeQuizResponse.create({
      data: {
        attemptId: attempt.id,
        configId: attempt.configId,
        publicationId: attempt.publicationId,
        assignmentId: poolItem.sourceAssignmentId,
        poolItemId: poolItem.id,
        elementId: poolItem.elementId,
        order: responseOrder,
        response: graded.rawResponse as DB.Prisma.InputJsonObject,
        normalizedResponse:
          graded.normalizedResponse as DB.Prisma.InputJsonObject,
        score: graded.score,
        correct: graded.correct,
        ...transition.responseEstimateData,
        elapsedSeconds: elapsedSeconds ?? null,
        elementSnapshot: poolItem.elementData,
      },
    })

    if (transition.answeredExposurePoolItemId !== null) {
      await incrementAdaptiveV2Exposure({
        prisma,
        publicationId: attempt.publicationId,
        poolItemId: transition.answeredExposurePoolItemId,
        counter: 'answeredCount',
      })
    }

    await persistAdaptivePracticeQuizEstimates(transition.estimateWrite, prisma)

    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: attempt.id },
      data: transition.attemptUpdate,
    })
    if (transition.nextExposurePoolItemId !== null) {
      await incrementAdaptiveV2Exposure({
        prisma,
        publicationId: attempt.publicationId,
        poolItemId: transition.nextExposurePoolItemId,
        counter: 'servedCount',
      })
    }

    const updated = await requireParticipantAttempt(
      prisma,
      attempt.id,
      ctx.user.sub
    )
    return {
      state: {
        ...serializeAttemptState(runtime, updated),
        submittedResponseFeedback: {
          correct: graded.correct,
          score: graded.score,
          feedback: submittedChoiceFeedback(poolItem, response),
        },
      },
      shadowEvent: transition.shadowEvent,
    }
  })
  const state = outcome.state
  if (outcome.shadowEvent) emitAdaptiveOperationalEvent(outcome.shadowEvent)
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
          ...clearAdaptiveDeliveryData(),
          completedAt: new Date(),
        },
      })
    }
    const runtime = await loadAdaptiveRuntime(prisma, attempt.practiceQuizId, {
      includeAlgorithmData: true,
      publicationId: attempt.publicationId,
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
