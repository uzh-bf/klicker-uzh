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
    'Starting Escape Room statistics aggregation and housekeeping...'
  )

  try {
    // 1. Aggregate statistics for attempts that have finished but have not yet
    //    been rolled into instance statistics. The statsAggregatedAt marker
    //    makes this idempotent across repeated runs (no double counting).
    const attempts = await globalContext.prisma.escapeRoomAttempt.findMany({
      where: {
        status: {
          in: [DB.EscapeRoomStatus.COMPLETED, DB.EscapeRoomStatus.EXPIRED],
        },
        statsAggregatedAt: null,
      },
    })

    executionContext.logger.info(
      `Found ${attempts.length} finished attempts to aggregate`
    )

    for (const attempt of attempts) {
      // Find element instances related to this attempt
      let instances: { id: number }[] = []

      if (attempt.elementBlockId) {
        instances = await globalContext.prisma.elementInstance.findMany({
          where: { elementBlockId: attempt.elementBlockId },
          select: { id: true },
        })
      } else if (attempt.practiceQuizId) {
        instances = await globalContext.prisma.elementInstance.findMany({
          where: {
            elementStack: { practiceQuizId: attempt.practiceQuizId },
          },
          select: { id: true },
        })
      } else if (attempt.microLearningId) {
        instances = await globalContext.prisma.elementInstance.findMany({
          where: {
            elementStack: { microLearningId: attempt.microLearningId },
          },
          select: { id: true },
        })
      } else if (attempt.groupActivityId) {
        instances = await globalContext.prisma.elementInstance.findMany({
          where: {
            elementStack: { groupActivityId: attempt.groupActivityId },
          },
          select: { id: true },
        })
      }

      if (instances.length > 0) {
        const timeSpent = attempt.completedAt
          ? (new Date(attempt.completedAt).getTime() -
              new Date(attempt.startedAt).getTime()) /
            1000
          : attempt.timeLimit

        const isSuccess = attempt.status === DB.EscapeRoomStatus.COMPLETED
        const hintsUsedCount = Array.isArray(attempt.hintsUsed)
          ? attempt.hintsUsed.length
          : 0

        // Estimate tries count (1 success + incorrect tries)
        const triesCount =
          1 + hintsUsedCount + Math.floor(attempt.penaltySeconds / 60)

        for (const instance of instances) {
          const stats =
            await globalContext.prisma.instanceStatistics.findUnique({
              where: { elementInstanceId: instance.id },
            })

          if (stats) {
            const newParticipantCount = stats.uniqueParticipantCount + 1
            const newAverageTimeSpent =
              ((stats.averageTimeSpent ?? 0) * stats.uniqueParticipantCount +
                timeSpent) /
              newParticipantCount

            await globalContext.prisma.instanceStatistics
              .update({
                where: { elementInstanceId: instance.id },
                data: {
                  uniqueParticipantCount: newParticipantCount,
                  correctCount: isSuccess
                    ? stats.correctCount + 1
                    : stats.correctCount,
                  wrongCount:
                    stats.wrongCount +
                    (isSuccess ? Math.max(0, triesCount - 1) : triesCount),
                  averageTimeSpent: newAverageTimeSpent,
                },
              })
              .catch((err) => {
                executionContext.logger.error(
                  `Failed to update stats for instance ${instance.id}: ${err}`
                )
              })
          } else {
            await globalContext.prisma.instanceStatistics
              .create({
                data: {
                  elementInstanceId: instance.id,
                  uniqueParticipantCount: 1,
                  correctCount: isSuccess ? 1 : 0,
                  wrongCount: isSuccess
                    ? Math.max(0, triesCount - 1)
                    : triesCount,
                  averageTimeSpent: timeSpent,
                },
              })
              .catch((err) => {
                executionContext.logger.error(
                  `Failed to create stats for instance ${instance.id}: ${err}`
                )
              })
          }
        }
      }

      // Mark this attempt aggregated immediately so a mid-run failure never
      // causes it to be counted a second time on the next run.
      await globalContext.prisma.escapeRoomAttempt
        .update({
          where: { id: attempt.id },
          data: { statsAggregatedAt: new Date() },
        })
        .catch((err) => {
          executionContext.logger.error(
            `Failed to mark attempt ${attempt.id} aggregated: ${err}`
          )
        })
    }

    // 2. Housekeeping: remove only long-stale finished attempts that have
    //    already been aggregated. Recent completions/expiries are retained so
    //    finished participants keep seeing their result and cannot restart.
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const deleted = await globalContext.prisma.escapeRoomAttempt.deleteMany({
      where: {
        status: {
          in: [DB.EscapeRoomStatus.COMPLETED, DB.EscapeRoomStatus.EXPIRED],
        },
        statsAggregatedAt: { not: null },
        startedAt: { lt: cutoff },
      },
    })

    executionContext.logger.info(
      `Aggregated ${attempts.length} attempts, pruned ${deleted.count} stale attempts (>${RETENTION_DAYS}d)`
    )

    return true
  } catch (error) {
    executionContext.logger.error(`Error in handlePruneEscapeRooms: ${error}`)
    return false
  }
}
