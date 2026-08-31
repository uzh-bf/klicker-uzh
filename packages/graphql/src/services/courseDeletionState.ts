import { allowCourseDeletionMutationInTransaction } from '@klicker-uzh/prisma'
import type { Context } from '../lib/context.js'

type PrismaClient = Context['prisma']

export interface CourseDeletionDraftActivityIds {
  liveQuizIds: string[]
  practiceQuizIds: string[]
  microLearningIds: string[]
  groupActivityIds: string[]
}

export async function markCourseDeletionPending(
  prisma: PrismaClient,
  {
    courseId,
    deleteDraftActivities,
    jobId,
    requestedById,
  }: {
    courseId: string
    deleteDraftActivities: boolean
    jobId: string
    requestedById: string
  }
) {
  const result = await prisma.course.updateMany({
    where: {
      id: courseId,
      isDeleted: false,
      isDeletionPending: false,
      deletionJobId: null,
    },
    data: {
      deletionJobId: jobId,
      deletionRequestedById: requestedById,
      deletionPendingAt: new Date(),
      deleteDraftActivitiesOnDeletion: deleteDraftActivities,
      isDeletionPending: true,
    },
  })
  return result.count === 1
}

export async function clearCourseDeletionPending(
  prisma: PrismaClient,
  { courseId, jobId }: { courseId: string; jobId: string }
) {
  const result = await prisma.$transaction(async (tx) => {
    await allowCourseDeletionMutationInTransaction(tx)
    return tx.course.updateMany({
      where: {
        id: courseId,
        deletionJobId: jobId,
        isDeleted: false,
        isDeletionPending: true,
      },
      data: {
        deletionJobId: null,
        deletionRequestedById: null,
        deletionPendingAt: null,
        deleteDraftActivitiesOnDeletion: false,
        isDeletionPending: false,
      },
    })
  })
  return result.count === 1
}
