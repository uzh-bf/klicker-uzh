import type { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'

export async function handlePruneEscapeRooms(
  globalContext: { prisma: typeof prisma },
  executionContext: { logger: any }
): Promise<boolean> {
  executionContext.logger.info(
    'Starting daily Escape Room attempt pruning and statistics aggregation...'
  )

  try {
    // Find all completed or expired attempts
    const attempts = await globalContext.prisma.escapeRoomAttempt.findMany({
      where: {
        status: {
          in: [DB.EscapeRoomStatus.COMPLETED, DB.EscapeRoomStatus.EXPIRED],
        },
      },
    })

    executionContext.logger.info(`Found ${attempts.length} attempts to prune`)

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

      if (instances.length === 0) continue

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
        await globalContext.prisma.instanceStatistics
          .upsert({
            where: { elementInstanceId: instance.id },
            create: {
              elementInstanceId: instance.id,
              uniqueParticipantCount: 1,
              correctCount: isSuccess ? 1 : 0,
              wrongCount: isSuccess ? Math.max(0, triesCount - 1) : triesCount,
              averageTimeSpent: timeSpent,
            },
            update: {
              uniqueParticipantCount: { increment: 1 },
              correctCount: isSuccess ? { increment: 1 } : undefined,
              wrongCount: {
                increment: isSuccess ? Math.max(0, triesCount - 1) : triesCount,
              },
              averageTimeSpent: {
                set: timeSpent,
              },
            },
          })
          .catch((err) => {
            executionContext.logger.error(
              `Failed to update stats for instance ${instance.id}: ${err}`
            )
          })
      }
    }

    // Delete pruned attempts
    if (attempts.length > 0) {
      await globalContext.prisma.escapeRoomAttempt.deleteMany({
        where: {
          id: { in: attempts.map((a) => a.id) },
        },
      })
      executionContext.logger.info(
        `Successfully pruned ${attempts.length} attempts`
      )
    }

    return true
  } catch (error) {
    executionContext.logger.error(`Error in handlePruneEscapeRooms: ${error}`)
    return false
  }
}
