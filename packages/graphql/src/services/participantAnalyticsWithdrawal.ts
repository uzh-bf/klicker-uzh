import type * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { LEARNING_ANALYTICS_ADVISORY_LOCK } from '../lib/learningAnalytics.js'

export async function processParticipantAnalyticsWithdrawal(
  participantId: string,
  client: DB.PrismaClient
) {
  return client.$transaction(
    async (prisma) => {
      await prisma.$executeRaw`SET LOCAL lock_timeout = '5s'`
      await prisma.$executeRaw`
        SELECT pg_advisory_xact_lock(
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.classId},
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
        )
      `
      await prisma.$queryRaw`
        SELECT "id" FROM "Participant"
        WHERE "id" = ${participantId}::uuid FOR UPDATE
      `
      const pending = await prisma.participantAnalyticsWithdrawal.findMany({
        where: { participantId, completedAt: null },
        select: { withdrawalRevision: true },
      })
      if (pending.length === 0) return 0

      // New analytics publication waits for these requests even after re-enable.
      // Completing deletion and its receipt together makes duplicate delivery safe.
      const where = { participantId }
      await prisma.participantAnalytics.deleteMany({ where })
      await prisma.participantCourseAnalytics.deleteMany({ where })
      await prisma.participantPerformance.deleteMany({ where })
      await prisma.participantActivityPerformance.deleteMany({ where })
      await prisma.participantChatAnalytics.deleteMany({ where })
      await prisma.participantChatOutcome.deleteMany({ where })
      await prisma.participantLiveQuizAnalytics.deleteMany({ where })
      await prisma.$executeRaw`
        UPDATE "ParticipantAnalyticsWithdrawal"
        SET "completedAt" = clock_timestamp()
        WHERE "participantId" = ${participantId}::uuid
          AND "completedAt" IS NULL
      `
      return pending.length
    },
    { maxWait: 10_000, timeout: 60_000 }
  )
}

export const handleParticipantAnalyticsWithdrawals: HatchetHandlers['handleParticipantAnalyticsWithdrawals'] =
  async (_args, globalCtx) => {
    const clock = await globalCtx.prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `
    const cutoff = clock[0]?.now
    if (!(cutoff instanceof Date) || Number.isNaN(cutoff.getTime())) {
      throw new Error('PARTICIPANT_ANALYTICS_WITHDRAWAL_CLOCK_FAILURE')
    }
    // Freeze the request horizon so continuous new requests cannot extend a
    // sweep indefinitely. Failed pages remain pending for the scheduled retry.
    while (true) {
      const requests =
        await globalCtx.prisma.participantAnalyticsWithdrawal.findMany({
          where: { completedAt: null, requestedAt: { lte: cutoff } },
          orderBy: [{ requestedAt: 'asc' }, { participantId: 'asc' }],
          take: 100,
          select: { participantId: true },
        })
      if (requests.length === 0) break
      for (const participantId of new Set(
        requests.map((row) => row.participantId)
      )) {
        await processParticipantAnalyticsWithdrawal(
          participantId,
          globalCtx.prisma
        )
      }
    }
    return true
  }
