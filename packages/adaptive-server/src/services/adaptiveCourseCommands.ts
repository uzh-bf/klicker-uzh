import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  lockAdaptiveAdministratorForShare,
  lockAdaptiveCourseForUpdate,
} from './adaptivePracticeQuizRepository.js'
import { withAdaptiveOperationalTransaction } from './adaptiveTransactions.js'

export async function setCourseAdaptiveLearningEnabled(
  { courseId, enabled }: { courseId: string; enabled: boolean },
  ctx: ContextWithUser
) {
  const course = await withAdaptiveOperationalTransaction(
    ctx.prisma,
    async (prisma) => {
      const administrator = await lockAdaptiveAdministratorForShare(
        ctx.user.sub,
        prisma
      )
      if (
        ctx.user.role !== DB.UserRole.ADMIN ||
        administrator?.role !== DB.UserRole.ADMIN
      ) {
        throw new GraphQLError(
          'Only administrators can change the adaptive-learning rollout.',
          { extensions: { code: 'ADAPTIVE_ROLLOUT_FORBIDDEN' } }
        )
      }

      const existing = await lockAdaptiveCourseForUpdate(courseId, prisma)
      if (!existing) {
        throw new GraphQLError('Course not found.', {
          extensions: { code: 'NOT_FOUND' },
        })
      }
      if (existing.isAdaptiveLearningEnabled === enabled) {
        return await prisma.course.findUniqueOrThrow({
          where: { id: courseId },
        })
      }

      const updated = await prisma.course.update({
        where: { id: courseId },
        data: { isAdaptiveLearningEnabled: enabled },
      })
      await prisma.activityLogEntry.create({
        data: {
          type: DB.ActivityLogType.MODIFICATION,
          objectType: DB.ObjectType.COURSE,
          courseId,
          userId: ctx.user.sub,
          message: `Adaptive learning rollout ${enabled ? 'enabled' : 'disabled'} by an administrator.`,
        },
      })
      return updated
    },
    {
      errorCode: 'ADAPTIVE_ROLLOUT_CONFLICT',
      errorMessage:
        'The adaptive-learning rollout could not be changed due to concurrent activity.',
    }
  )
  emitAdaptiveOperationalEvent({
    name: 'adaptive_course_gate',
    action: enabled ? 'ENABLED' : 'DISABLED',
    courseId,
  })
  ctx.emitter.emit('invalidate', { typename: 'Course', id: courseId })
  return course
}
