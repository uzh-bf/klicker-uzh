import type { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'

// Completed and expired attempts are kept like a gamified Live Quiz
// leaderboard: they prevent replay, drive the "finished" view and hold the
// results lecturers debrief. Only a lecturer reset deletes an attempt.
export async function handlePruneEscapeRooms(
  globalContext: { prisma: typeof prisma },
  executionContext: { logger: any }
): Promise<boolean> {
  executionContext.logger.info(
    'Starting Escape Room attempt bookkeeping and housekeeping...'
  )

  try {
    // Submission paths own response/instance statistics. PracticeQuiz and
    // MicroLearning update them while grading.
    // Attempt hints/penalties are not tries and must never be projected onto
    // every instance. This job therefore only marks finished attempts as
    // processed, atomically and idempotently.
    const finishedWhere = {
      status: {
        in: [
          DB.EscapeRoomStatus.COMPLETED,
          DB.EscapeRoomStatus.EXPIRED,
        ] as DB.EscapeRoomStatus[],
      },
    }
    const [marked] = await globalContext.prisma.$transaction([
      globalContext.prisma.escapeRoomAttempt.updateMany({
        where: { ...finishedWhere, retentionProcessedAt: null },
        data: { retentionProcessedAt: new Date() },
      }),
    ])

    executionContext.logger.info(`Marked ${marked.count} finished attempts`)

    return true
  } catch (error) {
    executionContext.logger.error(`Error in handlePruneEscapeRooms: ${error}`)
    return false
  }
}
