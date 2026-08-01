import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  getOrCreateAdaptiveCohortSnapshot,
  type AdaptiveCohortResults,
} from './adaptivePracticeQuizCohort.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  serializeAdaptiveAttemptState,
  serializeAdaptiveStudentResult,
  type AdaptivePracticeQuizAttemptState,
  type AdaptiveStudentResult,
} from './adaptivePracticeQuizParticipantViews.js'
import {
  lockAdaptivePracticeQuizConfigForUpdate,
  withSerializableRetry,
} from './adaptivePracticeQuizRepository.js'
import {
  adaptiveAttemptRuntimeInclude,
  assertAdaptiveCourseEnabled,
  assertAdaptiveQuizPublished,
  loadAdaptiveRuntime,
  requireParticipantAdaptiveAttempt,
} from './adaptivePracticeQuizRuntimeData.js'

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
    include: adaptiveAttemptRuntimeInclude,
  })
  const attempt =
    activeAttempt ??
    (await ctx.prisma.adaptivePracticeQuizAttempt.findFirst({
      where: {
        practiceQuizId,
        participantId: ctx.user.sub,
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      },
      include: adaptiveAttemptRuntimeInclude,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    }))
  if (!attempt) return null

  const runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
    includeAlgorithmData: true,
    publicationId: attempt.publicationId,
  })
  assertAdaptiveQuizPublished(runtime, { allowSupersededPublication: true })
  return serializeAdaptiveAttemptState(runtime, attempt)
}

export async function getAdaptivePracticeQuizResult(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
): Promise<AdaptiveStudentResult> {
  assertParticipant(ctx)
  const attempt = await requireParticipantAdaptiveAttempt(
    ctx.prisma,
    attemptId,
    ctx.user.sub
  )
  if (
    attempt.status !== DB.AdaptivePracticeQuizAttemptStatus.COMPLETED ||
    !attempt.stopReason ||
    !attempt.completedAt
  ) {
    throw adaptivePracticeQuizError(
      'Adaptive results are available only for completed attempts.',
      'ADAPTIVE_RESULT_UNAVAILABLE'
    )
  }
  const runtime = await loadAdaptiveRuntime(
    ctx.prisma,
    attempt.practiceQuizId,
    { includeAlgorithmData: true, publicationId: attempt.publicationId }
  )
  assertAdaptiveCourseEnabled(runtime)
  return serializeAdaptiveStudentResult(runtime, attempt)
}

export async function getAdaptivePracticeQuizCohortResults(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser
): Promise<AdaptiveCohortResultsView> {
  if (
    ctx.user.role !== DB.UserRole.USER &&
    ctx.user.role !== DB.UserRole.ADMIN
  ) {
    throw adaptivePracticeQuizError(
      'Adaptive cohort results require lecturer access.',
      'ADAPTIVE_RESULTS_FORBIDDEN'
    )
  }
  let snapshotStartedAt: number | null = null
  try {
    return await withSerializableRetry(
      ctx,
      async (prisma) => {
        const lockedConfig = await lockAdaptivePracticeQuizConfigForUpdate(
          practiceQuizId,
          prisma
        )
        if (!lockedConfig) {
          throw adaptivePracticeQuizError(
            'Adaptive practice quiz was not found.',
            'ADAPTIVE_QUIZ_NOT_FOUND'
          )
        }
        const runtime = await loadAdaptiveRuntime(prisma, practiceQuizId, {
          includeAlgorithmData: true,
        })
        if (runtime.config.id !== lockedConfig.id) {
          throw adaptivePracticeQuizError(
            'Adaptive practice quiz configuration changed unexpectedly.',
            'ADAPTIVE_COHORT_SNAPSHOT_CONFLICT'
          )
        }
        snapshotStartedAt ??= Date.now()
        const results = await getOrCreateAdaptiveCohortSnapshot(prisma, runtime)
        return { ...results, competenceTreeId: runtime.tree.id }
      },
      {
        conflictCode: 'ADAPTIVE_COHORT_SNAPSHOT_CONFLICT',
        conflictMessage:
          'The adaptive cohort snapshot could not be generated due to concurrent activity.',
        operation: 'COHORT_SNAPSHOT',
      }
    )
  } catch (error) {
    if (snapshotStartedAt !== null) {
      emitAdaptiveOperationalEvent({
        name: 'adaptive_cohort_snapshot',
        outcome: 'FAILED',
        practiceQuizId,
        generationDurationMs: Date.now() - snapshotStartedAt,
      })
    }
    throw error
  }
}

export type AdaptiveCohortResultsView = AdaptiveCohortResults & {
  competenceTreeId: string
}

function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw adaptivePracticeQuizError(
      'Adaptive attempts require participant authentication.',
      'ADAPTIVE_PARTICIPANT_REQUIRED'
    )
  }
}
