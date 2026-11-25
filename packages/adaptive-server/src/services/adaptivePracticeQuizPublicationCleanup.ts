import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { adaptiveServiceError } from './adaptivePracticeQuizConfigPreparation.js'

export async function purgeAttemptFreeAdaptivePublications(
  practiceQuizId: string,
  prisma: PrismaTransactionClient
): Promise<void> {
  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    select: { id: true, _count: { select: { attempts: true } } },
  })
  if (!config) return
  if (config._count.attempts > 0) {
    throw adaptiveServiceError(
      'Adaptive publications with learner attempts must be retained.',
      'ADAPTIVE_PUBLICATION_HISTORY_RETAINED'
    )
  }

  const retiredAt = new Date()
  await prisma.practiceQuizAdaptivePublication.updateMany({
    where: { configId: config.id, unpublishedAt: null },
    data: { unpublishedAt: retiredAt },
  })
  await prisma.practiceQuizAdaptivePoolItem.deleteMany({
    where: { configId: config.id },
  })
  await prisma.practiceQuizAdaptivePublication.deleteMany({
    where: { configId: config.id },
  })
  await prisma.practiceQuizAdaptiveConfig.update({
    where: { id: config.id },
    data: { poolPublishedAt: null },
  })
}
