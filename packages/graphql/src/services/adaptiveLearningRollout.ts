import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import { lockAdaptiveCourseForShare } from './adaptivePracticeQuizRepository.js'

export async function assertAdaptiveLearningCourseEnabled(
  courseId: string,
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isAdaptiveLearningEnabled: true },
  })
  assertEnabled(courseId, course)
}

export async function lockAdaptiveLearningCourseEnabled(
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  assertEnabled(courseId, await lockAdaptiveCourseForShare(courseId, prisma))
}

function assertEnabled(
  courseId: string,
  course: { isAdaptiveLearningEnabled: boolean } | null | undefined
): void {
  if (!course?.isAdaptiveLearningEnabled) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_course_gate',
      action: 'DENIED',
      courseId,
    })
    throw new GraphQLError(
      'Adaptive learning is not enabled for this course.',
      { extensions: { code: 'ADAPTIVE_COURSE_DISABLED' } }
    )
  }
}
