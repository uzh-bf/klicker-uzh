import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import {
  lockAdaptiveCourseForUpdate,
  lockPracticeQuizForUpdateInCourse,
  lockAdaptivePracticeQuizConfigForUpdate,
} from './adaptivePracticeQuizRepository.js'
import { purgeAttemptFreeAdaptivePublications } from './adaptivePracticeQuizPublicationCleanup.js'

export async function prepareAdaptiveCourseDeletion(
  {
    courseId,
    purgePublications = false,
  }: { courseId: string; purgePublications?: boolean },
  prisma: PrismaTransactionClient
) {
  const course = await lockAdaptiveCourseForUpdate(courseId, prisma)
  if (!course) return
  const quizzes = await prisma.practiceQuiz.findMany({
    where: { courseId, mode: 'ADAPTIVE' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const quizIds = quizzes.map(({ id }) => id)
  for (const id of quizIds) {
    await lockPracticeQuizForUpdateInCourse(id, courseId, prisma)
    await lockAdaptivePracticeQuizConfigForUpdate(id, prisma)
  }
  const [attemptCount, snapshotCount] = await Promise.all([
    prisma.adaptivePracticeQuizAttempt.count({ where: { courseId } }),
    prisma.adaptivePracticeQuizCohortSnapshot.count({
      where: { practiceQuizId: { in: quizIds } },
    }),
  ])
  if (attemptCount > 0 || snapshotCount > 0) {
    throw new GraphQLError(
      'This course contains retained adaptive-learning history and cannot be deleted. Archive the course instead.',
      { extensions: { code: 'ADAPTIVE_COURSE_HISTORY_RETAINED' } }
    )
  }
  if (purgePublications) {
    for (const id of quizIds)
      await purgeAttemptFreeAdaptivePublications(id, prisma)
  }
}
