import type { PrismaTransactionClient } from '@klicker-uzh/util'

export interface DedicatedLearningAnalyticsCounts {
  participantAnalytics: number
  competencyAnalytics: number
  aggregatedAnalytics: number
  aggregatedCompetencyAnalytics: number
  participantCourseAnalytics: number
  aggregatedCourseAnalytics: number
  participantPerformance: number
  instancePerformance: number
  activityPerformance: number
  participantActivityPerformance: number
  activityProgress: number
}

async function readDedicatedLearningAnalyticsCounts(
  prisma: PrismaTransactionClient,
  courseId?: string
): Promise<DedicatedLearningAnalyticsCounts> {
  const [
    participantAnalytics,
    competencyAnalytics,
    aggregatedAnalytics,
    aggregatedCompetencyAnalytics,
    participantCourseAnalytics,
    aggregatedCourseAnalytics,
    participantPerformance,
    instancePerformance,
    activityPerformance,
    participantActivityPerformance,
    activityProgress,
  ] = await Promise.all([
    prisma.participantAnalytics.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.competencyAnalytics.count({
      where: courseId ? { participantAnalytics: { courseId } } : undefined,
    }),
    prisma.aggregatedAnalytics.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.aggregatedCompetencyAnalytics.count({
      where: courseId ? { aggregatedAnalytics: { courseId } } : undefined,
    }),
    prisma.participantCourseAnalytics.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.aggregatedCourseAnalytics.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.participantPerformance.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.instancePerformance.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.activityPerformance.count({
      where: courseId ? { courseId } : undefined,
    }),
    prisma.participantActivityPerformance.count({
      where: courseId
        ? {
            OR: [
              { practiceQuiz: { courseId } },
              { microLearning: { courseId } },
            ],
          }
        : undefined,
    }),
    prisma.activityProgress.count({
      where: courseId ? { courseId } : undefined,
    }),
  ])

  return {
    participantAnalytics,
    competencyAnalytics,
    aggregatedAnalytics,
    aggregatedCompetencyAnalytics,
    participantCourseAnalytics,
    aggregatedCourseAnalytics,
    participantPerformance,
    instancePerformance,
    activityPerformance,
    participantActivityPerformance,
    activityProgress,
  }
}

export function readDedicatedLearningAnalyticsCountsForCourse(
  prisma: PrismaTransactionClient,
  courseId: string
): Promise<DedicatedLearningAnalyticsCounts> {
  return readDedicatedLearningAnalyticsCounts(prisma, courseId)
}

export function readAllDedicatedLearningAnalyticsCounts(
  prisma: PrismaTransactionClient
): Promise<DedicatedLearningAnalyticsCounts> {
  return readDedicatedLearningAnalyticsCounts(prisma)
}

async function deleteDedicatedLearningAnalytics(
  prisma: PrismaTransactionClient,
  courseId?: string
): Promise<void> {
  await prisma.participantActivityPerformance.deleteMany({
    where: courseId
      ? {
          OR: [{ practiceQuiz: { courseId } }, { microLearning: { courseId } }],
        }
      : undefined,
  })
  await prisma.participantAnalytics.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.aggregatedAnalytics.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.participantCourseAnalytics.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.aggregatedCourseAnalytics.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.participantPerformance.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.instancePerformance.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.activityPerformance.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
  await prisma.activityProgress.deleteMany({
    where: courseId ? { courseId } : undefined,
  })
}

export function deleteDedicatedLearningAnalyticsForCourse(
  prisma: PrismaTransactionClient,
  courseId: string
): Promise<void> {
  return deleteDedicatedLearningAnalytics(prisma, courseId)
}

export function deleteAllDedicatedLearningAnalytics(
  prisma: PrismaTransactionClient
): Promise<void> {
  return deleteDedicatedLearningAnalytics(prisma)
}
