import * as DB from '@klicker-uzh/prisma/client'
import type { CourseDeletionEvent, HatchetHandlers } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  cancelCourseDeletionRequest,
  deleteCourse as permanentlyDeleteCourse,
} from './courses.js'

const COURSE_DELETION_ACTIVE_LIVE_QUIZ_CODE = 'COURSE_DELETION_ACTIVE_LIVE_QUIZ'

// must match the `retries` of the `process-course-deletion` Hatchet task
export const COURSE_DELETION_MAX_RETRIES = 3

export interface CourseDeletionRequest {
  courseId: string
  deletionRequestedAt: Date
}

function getCourseDeletionError() {
  return new GraphQLError(
    'The course cannot be deleted while it contains a published live quiz.',
    { extensions: { code: COURSE_DELETION_ACTIVE_LIVE_QUIZ_CODE } }
  )
}

// Accept a course deletion request: mark the course so it disappears from all
// user-facing reads, then hand the permanent deletion to the Hatchet worker.
// If the worker cannot be reached, the marker is cleared again and the caller
// receives an error, so a course never stays hidden without a scheduled job.
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

    // a repeated request while the first one is pending is a no-op
    if (course.deletionRequestedAt) {
      return {
        courseId: course.id,
        deletionRequestedAt: course.deletionRequestedAt,
        alreadyRequested: true,
      }
    }

    if (course.liveQuizzes.length > 0) {
      throw getCourseDeletionError()
    }

    const deletionRequestedAt = new Date()
    const updated = await prisma.course.updateMany({
      where: { id: course.id, deletionRequestedAt: null },
      data: { deletionRequestedAt },
    })

    if (updated.count === 0) {
      throw new Error('Course deletion request could not be persisted')
    }

    return { courseId: course.id, deletionRequestedAt, alreadyRequested: false }
  })

  if (request.alreadyRequested) {
    return {
      courseId: request.courseId,
      deletionRequestedAt: request.deletionRequestedAt,
    }
  }

  const event: CourseDeletionEvent = {
    courseId: request.courseId,
    deletionRequestedAt: request.deletionRequestedAt.toISOString(),
    requestedById: ctx.user.sub,
    deleteDraftActivities: deleteDraftActivities ?? false,
  }

  try {
    await ctx.hatchet.events.push('process-course-deletion', event)
  } catch (error) {
    console.error(
      `Failed to publish course deletion for ${request.courseId}:`,
      error
    )
    await cancelCourseDeletionRequest(
      {
        id: request.courseId,
        deletionRequestedAt: request.deletionRequestedAt,
      },
      ctx
    )
    throw new GraphQLError('Course deletion could not be scheduled', {
      extensions: { code: 'COURSE_DELETION_UNAVAILABLE' },
    })
  }

  ctx.emitter.emit('invalidate', { typename: 'Course', id: request.courseId })

  return {
    courseId: request.courseId,
    deletionRequestedAt: request.deletionRequestedAt,
  }
}

// Hatchet handler for `process-course-deletion`. The deletion transaction
// re-verifies the request marker, the requester's permission and the
// published-live-quiz condition and cancels the request if they no longer
// hold. When the last retry fails, the marker is cleared so the course
// becomes visible again and the lecturer can retry.
export const handleProcessCourseDeletion: HatchetHandlers['handleProcessCourseDeletion'] =
  async (
    { courseId, deletionRequestedAt, requestedById, deleteDraftActivities },
    globalCtx,
    executionCtx
  ) => {
    const requestedAt = new Date(deletionRequestedAt)
    if (Number.isNaN(requestedAt.getTime())) {
      throw new Error(`Invalid deletion request timestamp for ${courseId}`)
    }

    try {
      await permanentlyDeleteCourse(
        {
          id: courseId,
          deleteDraftActivities,
          request: { deletionRequestedAt: requestedAt, requestedById },
        },
        globalCtx
      )
    } catch (error) {
      if (executionCtx.retryCount() >= COURSE_DELETION_MAX_RETRIES) {
        executionCtx.logger.error(
          `Course deletion for ${courseId} failed permanently; the course is visible again.`
        )
        await cancelCourseDeletionRequest(
          { id: courseId, deletionRequestedAt: requestedAt },
          globalCtx
        )
      }
      throw error
    }

    return true
  }
