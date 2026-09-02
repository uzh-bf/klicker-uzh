import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { Context, ContextWithUser } from '../lib/context.js'
import { deleteCourse as permanentlyDeleteCourse } from './courses.js'

const COURSE_DELETION_ACTIVE_LIVE_QUIZ_CODE = 'COURSE_DELETION_ACTIVE_LIVE_QUIZ'
const COURSE_DELETION_STALE_AFTER_MS = 75 * 60 * 1000

type CourseDeletionContext = Pick<Context, 'prisma' | 'hatchet' | 'emitter'>

export interface CourseDeletionRequest {
  courseId: string
  deletionRequestedAt: Date
  course: DB.Course
}

function getCourseDeletionError() {
  return new GraphQLError(
    'The course cannot be deleted while it contains a published live quiz.',
    { extensions: { code: COURSE_DELETION_ACTIVE_LIVE_QUIZ_CODE } }
  )
}

export async function requestCourseDeletion(
  {
    id,
    deleteDraftActivities,
  }: { id: string; deleteDraftActivities?: boolean | null },
  ctx: ContextWithUser
): Promise<CourseDeletionRequest> {
  const request = await ctx.prisma.$transaction(async (prisma) => {
    const course = await prisma.course.findUnique({
      where: { id, isAssessmentEnabled: false },
      include: {
        liveQuizzes: {
          where: {
            isDeleted: false,
            status: DB.PublicationStatus.PUBLISHED,
          },
          select: { id: true },
        },
      },
    })

    if (!course) {
      throw new GraphQLError('Course not found or permission denied', {
        extensions: { code: 'NOT_FOUND' },
      })
    }

    if (course.deletionRequestedAt) {
      return {
        courseId: course.id,
        deletionRequestedAt: course.deletionRequestedAt,
        course,
      }
    }

    if (course.liveQuizzes.length > 0) {
      throw getCourseDeletionError()
    }

    const deletionRequestedAt = new Date()
    const updated = await prisma.course.updateMany({
      where: { id: course.id, deletionRequestedAt: null },
      data: {
        deletionRequestedAt,
        deletionRequestedById: ctx.user.sub,
        deleteDraftActivitiesOnDeletion: deleteDraftActivities ?? false,
      },
    })

    if (updated.count === 0) {
      const existingCourse = await prisma.course.findUnique({
        where: { id: course.id },
      })

      if (!existingCourse?.deletionRequestedAt) {
        throw new Error('Course deletion request could not be persisted')
      }

      return {
        courseId: existingCourse.id,
        deletionRequestedAt: existingCourse.deletionRequestedAt,
        course: existingCourse,
      }
    }

    const { liveQuizzes: _liveQuizzes, ...courseWithoutLiveQuizzes } = course

    return {
      courseId: course.id,
      deletionRequestedAt,
      course: {
        ...courseWithoutLiveQuizzes,
        deletionRequestedAt,
        deletionRequestedById: ctx.user.sub,
        deleteDraftActivitiesOnDeletion: deleteDraftActivities ?? false,
      },
    }
  })

  try {
    await ctx.hatchet.events.push('process-course-deletion', {
      courseId: request.courseId,
      deletionRequestedAt: request.deletionRequestedAt.toISOString(),
    })
  } catch (error) {
    // The marker is a durable outbox. The scheduled sweep republishes requests
    // when Hatchet was unavailable or the acknowledgement was lost.
    console.error(
      `Failed to publish course deletion for ${request.courseId}:`,
      error
    )
  }

  return request
}

async function clearCourseDeletionRequest(
  courseId: string,
  deletionRequestedAt: Date,
  ctx: CourseDeletionContext
) {
  const cleared = await ctx.prisma.course.updateMany({
    where: { id: courseId, deletionRequestedAt },
    data: {
      deletionRequestedAt: null,
      deletionRequestedById: null,
      deleteDraftActivitiesOnDeletion: false,
    },
  })

  if (cleared.count > 0) {
    ctx.emitter.emit('invalidate', { typename: 'Course', id: courseId })
  }
}

export const handleProcessCourseDeletion: HatchetHandlers['handleProcessCourseDeletion'] =
  async ({ courseId, deletionRequestedAt }, globalCtx, executionCtx) => {
    const requestedAt = new Date(deletionRequestedAt)
    if (Number.isNaN(requestedAt.getTime())) {
      throw new Error(`Invalid deletion request timestamp for ${courseId}`)
    }

    const course = await globalCtx.prisma.course.findUnique({
      where: { id: courseId, deletionRequestedAt: requestedAt },
      select: {
        id: true,
        deletionRequestedAt: true,
        deletionRequestedById: true,
        deleteDraftActivitiesOnDeletion: true,
        liveQuizzes: {
          where: {
            isDeleted: false,
            status: DB.PublicationStatus.PUBLISHED,
          },
          select: { id: true },
        },
      },
    })

    if (!course || !course.deletionRequestedAt) {
      return true
    }

    const requesterPermission = course.deletionRequestedById
      ? await globalCtx.prisma.derivedPermission.findFirst({
          where: {
            courseId: course.id,
            userId: course.deletionRequestedById,
          },
          select: { permissionLevel: true },
        })
      : null

    if (
      !requesterPermission ||
      (requesterPermission.permissionLevel !== DB.PermissionLevel.ADMIN &&
        requesterPermission.permissionLevel !== DB.PermissionLevel.OWNER) ||
      course.liveQuizzes.length > 0
    ) {
      await clearCourseDeletionRequest(course.id, course.deletionRequestedAt, {
        prisma: globalCtx.prisma,
        emitter: globalCtx.emitter,
        hatchet: globalCtx.hatchet,
      })
      executionCtx.logger.warn(
        `Course deletion request for ${course.id} was cancelled by a safety check.`
      )
      return true
    }

    await permanentlyDeleteCourse(
      {
        id: course.id,
        deleteDraftActivities: course.deleteDraftActivitiesOnDeletion,
        deletionRequestedAt: course.deletionRequestedAt,
      },
      globalCtx
    )

    return true
  }

export const handleSweepCourseDeletions: HatchetHandlers['handleSweepCourseDeletions'] =
  async (_, globalCtx, executionCtx) => {
    const courses = await globalCtx.prisma.course.findMany({
      where: { deletionRequestedAt: { not: null } },
      select: { id: true, deletionRequestedAt: true },
      orderBy: { deletionRequestedAt: 'asc' },
      take: 100,
    })

    for (const course of courses) {
      if (!course.deletionRequestedAt) continue

      if (
        Date.now() - course.deletionRequestedAt.getTime() >
        COURSE_DELETION_STALE_AFTER_MS
      ) {
        executionCtx.logger.warn(
          `Course deletion request for ${course.id} has been pending for more than 75 minutes.`
        )
      }

      try {
        await globalCtx.hatchet.events.push('process-course-deletion', {
          courseId: course.id,
          deletionRequestedAt: course.deletionRequestedAt.toISOString(),
        })
      } catch (error) {
        executionCtx.logger.warn(
          `Failed to republish course deletion for ${course.id}: ${String(error)}`
        )
      }
    }

    return true
  }
