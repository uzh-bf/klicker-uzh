import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'
import {
  clearAllLiveQuizExecutionCache,
  clearLiveQuizExecutionCache,
} from './liveQuizExecutionCache.js'

async function recoverAndClearUnavailableLiveQuizExecutionCache({
  liveQuizId,
  redis,
  prisma,
}: {
  liveQuizId: string
  redis: Redis
  prisma: DB.PrismaClient
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "LiveQuiz"
      WHERE "id" = ${liveQuizId}::uuid
      FOR UPDATE
    `
    if (lockedRows.length === 0) {
      await clearAllLiveQuizExecutionCache({ liveQuizId, redis })
      return
    }

    const quiz = await tx.liveQuiz.findUnique({
      where: { id: liveQuizId },
      select: { status: true, isDeleted: true },
    })
    if (!quiz || quiz.isDeleted) {
      await clearAllLiveQuizExecutionCache({ liveQuizId, redis })
      return
    }
    if (
      quiz.status !== DB.PublicationStatus.DRAFT &&
      quiz.status !== DB.PublicationStatus.SCHEDULED
    ) {
      return
    }

    const generation = await redis.hget(
      `lq:${liveQuizId}:meta`,
      'cacheGeneration'
    )
    const cleared = await clearLiveQuizExecutionCache({
      liveQuizId,
      redis,
      cacheGenerationSnapshot: {
        status: 'AVAILABLE',
        generation,
      },
    })
    if (!cleared) {
      throw new Error('Live quiz cache generation changed during cleanup')
    }
  })
}

export const handleCleanupLiveQuizResetCache = (async (
  {
    liveQuizId,
    isAssessmentEnabled,
    cacheGenerationSnapshot,
  }: Parameters<HatchetHandlers['handleCleanupLiveQuizResetCache']>[0],
  globalCtx: Parameters<HatchetHandlers['handleCleanupLiveQuizResetCache']>[1],
  _executionCtx?: Parameters<
    HatchetHandlers['handleCleanupLiveQuizResetCache']
  >[2]
) => {
  const redis = isAssessmentEnabled
    ? globalCtx.redisAssessmentExec
    : globalCtx.redisExec
  if (cacheGenerationSnapshot.status === 'UNAVAILABLE') {
    await recoverAndClearUnavailableLiveQuizExecutionCache({
      liveQuizId,
      redis,
      prisma: globalCtx.prisma,
    })
  } else {
    await clearLiveQuizExecutionCache({
      liveQuizId,
      redis,
      cacheGenerationSnapshot,
    })
  }
  return true
}) satisfies HatchetHandlers['handleCleanupLiveQuizResetCache']
