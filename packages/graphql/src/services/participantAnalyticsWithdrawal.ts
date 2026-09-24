import type * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { LEARNING_ANALYTICS_ADVISORY_LOCK } from '../lib/learningAnalytics.js'

/**
 * Deletes the learning-analytics records of one participant and stamps the
 * withdrawal requests that asked for it. Raw responses, points, corrections and
 * course membership are deliberately retained: withdrawing analytics consent
 * removes derived analytics, not the participant's learning history.
 *
 * The delete list is part of the analytics schema contract. Every table that
 * stores per-participant analytics derivatives has to be added here, otherwise a
 * withdrawal silently leaves that derivative behind.
 */
export async function processParticipantAnalyticsWithdrawal(
  participantId: string,
  client: DB.PrismaClient
) {
  return client.$transaction(
    async (prisma) => {
      await prisma.$executeRaw`SET LOCAL lock_timeout = '5s'`
      // Writers of analytics derivatives hold the same key so a withdrawal
      // cannot interleave with a publication that was already in flight.
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
      // A request that is already completed must not delete analytics that was
      // published afterwards, for example after the participant re-enabled
      // analytics and a new computation ran.
      if (pending.length === 0) return 0

      const where = { participantId }
      await prisma.participantAnalytics.deleteMany({ where })
      await prisma.participantCourseAnalytics.deleteMany({ where })
      await prisma.participantPerformance.deleteMany({ where })
      await prisma.participantActivityPerformance.deleteMany({ where })
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
    // sweep indefinitely. Failed pages stay pending for the next scheduled run.
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
