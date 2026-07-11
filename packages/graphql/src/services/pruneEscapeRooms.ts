import type { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'

// How long completed/expired attempts are retained before housekeeping removes
// them. They are the integrity record that prevents replay (a fresh full-time
// attempt) and drives the "finished" view, so they must outlive the activity's
// realistic lifetime. Deletion is pure hygiene, never same-day.
const RETENTION_DAYS = 90

export async function handlePruneEscapeRooms(
  globalContext: { prisma: typeof prisma },
  executionContext: { logger: any }
): Promise<boolean> {
  executionContext.logger.info(
    'Starting Escape Room attempt bookkeeping and housekeeping...'
  )

  try {
    // Submission paths own response/instance statistics. PracticeQuiz and
    // MicroLearning update them while grading, LiveQuiz uses its response-event
    // pipeline, and GroupActivity has no compatible participant-level metric.
    // Attempt hints/penalties are not tries and must never be projected onto
    // every instance. This job therefore only marks finished attempts as
    // processed and applies retention, atomically and idempotently.
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const finishedWhere = {
      status: {
        in: [
          DB.EscapeRoomStatus.COMPLETED,
          DB.EscapeRoomStatus.EXPIRED,
        ] as DB.EscapeRoomStatus[],
      },
    }
    const [marked, deleted] = await globalContext.prisma.$transaction([
      globalContext.prisma.escapeRoomAttempt.updateMany({
        where: { ...finishedWhere, statsAggregatedAt: null },
        data: { statsAggregatedAt: new Date() },
      }),
      globalContext.prisma.escapeRoomAttempt.deleteMany({
        where: {
          statsAggregatedAt: { not: null },
          OR: [
            {
              status: DB.EscapeRoomStatus.COMPLETED,
              completedAt: { lt: cutoff },
            },
            {
              // There is no expiredAt timestamp. startedAt older than the full
              // retention window is the conservative available lower bound.
              status: DB.EscapeRoomStatus.EXPIRED,
              startedAt: { lt: cutoff },
            },
          ],
        },
      }),
    ])

    executionContext.logger.info(
      `Marked ${marked.count} finished attempts, pruned ${deleted.count} stale attempts (>${RETENTION_DAYS}d)`
    )

    return true
  } catch (error) {
    executionContext.logger.error(`Error in handlePruneEscapeRooms: ${error}`)
    return false
  }
}
