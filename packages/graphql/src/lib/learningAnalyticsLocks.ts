import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { LEARNING_ANALYTICS_ADVISORY_LOCK } from './learningAnalytics.js'

export const LEARNING_ANALYTICS_GLOBAL_LOCK_NAMESPACE =
  LEARNING_ANALYTICS_ADVISORY_LOCK.classId
export const LEARNING_ANALYTICS_COURSE_LOCK_NAMESPACE =
  LEARNING_ANALYTICS_ADVISORY_LOCK.classId + 1

export async function lockLearningAnalyticsCourseMutation(
  prisma: PrismaTransactionClient,
  courseId: string
): Promise<void> {
  await prisma.$executeRaw`
    SELECT pg_advisory_xact_lock_shared(
      ${LEARNING_ANALYTICS_GLOBAL_LOCK_NAMESPACE},
      ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
    )
  `
  await prisma.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ${LEARNING_ANALYTICS_COURSE_LOCK_NAMESPACE},
      hashtext(CAST(${courseId} AS text))
    )
  `
}
