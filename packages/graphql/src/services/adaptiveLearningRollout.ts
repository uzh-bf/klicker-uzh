import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export async function assertAdaptiveLearningCourseEnabled(
  courseId: string,
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isAdaptiveLearningEnabled: true },
  })
  assertEnabled(course)
}

export async function lockAdaptiveLearningCourseEnabled(
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ isAdaptiveLearningEnabled: boolean }>
  >`
    SELECT "isAdaptiveLearningEnabled"
    FROM "Course"
    WHERE "id" = ${courseId}::uuid
    FOR SHARE
  `
  assertEnabled(rows[0])
}

function assertEnabled(
  course: { isAdaptiveLearningEnabled: boolean } | null | undefined
): void {
  if (!course?.isAdaptiveLearningEnabled) {
    throw new GraphQLError(
      'Adaptive learning is not enabled for this course.',
      { extensions: { code: 'ADAPTIVE_COURSE_DISABLED' } }
    )
  }
}
