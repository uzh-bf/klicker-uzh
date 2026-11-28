import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  deliverLearnerMemoryForgets,
  purgeConfirmedLearnerMemoryForgets,
} from '@klicker-uzh/util/learner-memory'

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => unknown
  warn: (message: string, extra?: Record<string, unknown>) => unknown
}

/**
 * A student who withdraws their choice, deletes their notes or deletes their
 * account leaves a deletion request for the learner-memory service. Requests
 * are sent when they are written where possible; this task sends the ones the
 * service has not confirmed and removes confirmed ones after their retention
 * period. In a deployment without the service the requests stay open.
 */
export async function retryLearnerMemoryForgets(input: {
  prisma: Pick<PrismaClient, 'learnerMemoryForgetRequest'>
  logger: Logger
}) {
  const purged = await purgeConfirmedLearnerMemoryForgets({
    prisma: input.prisma,
  })
  const result = await deliverLearnerMemoryForgets({ prisma: input.prisma })
  if (result.failed > 0) {
    await input.logger.warn(
      'Learner-memory deletion requests are still unconfirmed',
      { failed: result.failed, delivered: result.delivered }
    )
  } else if (result.delivered > 0 || purged > 0) {
    await input.logger.info('Learner-memory deletion requests processed', {
      delivered: result.delivered,
      purged,
    })
  }
  return { ...result, purged }
}
