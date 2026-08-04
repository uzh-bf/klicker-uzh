import * as DB from '@klicker-uzh/prisma/client'
import type {
  CleanupLiveQuizResetCacheInput,
  LiveQuizResetCacheGenerationSnapshot,
} from '@klicker-uzh/types'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { clearLiveQuizExecutionCache } from './liveQuizExecutionCache.js'
import {
  executeLiveQuizReset,
  type ResetLiveQuizServiceResult,
} from './liveQuizResetTransaction.js'

export * from './liveQuizExecutionCache.js'
export * from './liveQuizResetCleanup.js'
export * from './liveQuizResetSummary.js'
export * from './liveQuizResetTransaction.js'

type LiveQuizResetAuditDetails =
  | {
      event: 'LIVE_QUIZ_RESET_INITIATED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 1
    }
  | {
      event: 'LIVE_QUIZ_RESET_BLOCKED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      outcome: 'INVALID_STATE'
    }
  | {
      event: 'LIVE_QUIZ_RESET_COMPLETED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      outcome: 'SUCCESS'
    }
  | {
      event: 'LIVE_QUIZ_RESET_FAILED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      failureCode: 'UNEXPECTED_RESET_FAILURE'
    }

async function enqueueLiveQuizResetAudit(
  ctx: ContextWithUser,
  details: LiveQuizResetAuditDetails
): Promise<void> {
  await ctx.tasks.createAuditLogEntry.runNoWait([
    { message: { info: JSON.stringify(details) } },
  ])
}

function logResetDeliveryFailure(
  delivery: 'audit' | 'cleanup' | 'invalidation'
): void {
  console.error(`Failed to deliver live quiz reset ${delivery}`)
}

async function snapshotResetCacheGeneration({
  id,
  ctx,
}: {
  id: string
  ctx: ContextWithUser
}): Promise<LiveQuizResetCacheGenerationSnapshot> {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    select: {
      status: true,
      isDeleted: true,
      isAssessmentEnabled: true,
    },
  })
  if (!quiz || quiz.isDeleted || quiz.status !== DB.PublicationStatus.ENDED) {
    return { status: 'UNAVAILABLE' }
  }

  const redis = quiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec
  try {
    return {
      status: 'AVAILABLE',
      generation: await redis.hget(`lq:${id}:meta`, 'cacheGeneration'),
    }
  } catch {
    return { status: 'UNAVAILABLE' }
  }
}

async function runPostCommitCleanup({
  id,
  result,
  cacheGenerationSnapshot,
  ctx,
}: {
  id: string
  result: Extract<ResetLiveQuizServiceResult, { outcome: 'SUCCESS' }>
  cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
  ctx: ContextWithUser
}): Promise<void> {
  const cleanupInput: CleanupLiveQuizResetCacheInput = {
    liveQuizId: id,
    isAssessmentEnabled: result.activity.isAssessmentEnabled,
    cacheGenerationSnapshot,
  }
  const redis = result.activity.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

  let fallbackRequired = false
  try {
    fallbackRequired = !(await clearLiveQuizExecutionCache({
      liveQuizId: id,
      redis,
      cacheGenerationSnapshot,
    }))
  } catch {
    fallbackRequired = true
  }

  if (fallbackRequired) {
    try {
      await ctx.tasks.cleanupLiveQuizResetCache.runNoWait([cleanupInput])
    } catch {
      logResetDeliveryFailure('cleanup')
    }
  }

  try {
    ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
  } catch {
    logResetDeliveryFailure('invalidation')
  }
}

export async function resetLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<ResetLiveQuizServiceResult> {
  const operationId = uuidv4()
  await enqueueLiveQuizResetAudit(ctx, {
    event: 'LIVE_QUIZ_RESET_INITIATED',
    actorId: ctx.user.sub,
    liveQuizId: id,
    operationId,
    occurredAt: new Date().toISOString(),
    sequence: 1,
  })

  let result: ResetLiveQuizServiceResult
  let cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
  try {
    cacheGenerationSnapshot = await snapshotResetCacheGeneration({ id, ctx })
    result = await executeLiveQuizReset({ id }, ctx)
  } catch (error) {
    try {
      await enqueueLiveQuizResetAudit(ctx, {
        event: 'LIVE_QUIZ_RESET_FAILED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        operationId,
        occurredAt: new Date().toISOString(),
        sequence: 2,
        failureCode: 'UNEXPECTED_RESET_FAILURE',
      })
    } catch {
      logResetDeliveryFailure('audit')
    }
    throw error
  }

  if (result.outcome === 'SUCCESS') {
    await runPostCommitCleanup({
      id,
      result,
      cacheGenerationSnapshot,
      ctx,
    })
    try {
      await enqueueLiveQuizResetAudit(ctx, {
        event: 'LIVE_QUIZ_RESET_COMPLETED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        operationId,
        occurredAt: new Date().toISOString(),
        sequence: 2,
        outcome: result.outcome,
      })
    } catch {
      logResetDeliveryFailure('audit')
    }
    return result
  }

  try {
    await enqueueLiveQuizResetAudit(ctx, {
      event: 'LIVE_QUIZ_RESET_BLOCKED',
      actorId: ctx.user.sub,
      liveQuizId: id,
      operationId,
      occurredAt: new Date().toISOString(),
      sequence: 2,
      outcome: result.outcome,
    })
  } catch {
    logResetDeliveryFailure('audit')
  }
  return result
}
