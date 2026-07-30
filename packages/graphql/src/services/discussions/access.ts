import * as DB from '@klicker-uzh/prisma/client'
import type { Context, ContextWithUser } from '../../lib/context.js'
import { checkAccess } from '../sharing.js'
import type { ResolvedActor } from './types.js'

export async function getCourseSettings(courseId: string, ctx: Context) {
  return ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: true,
    },
  })
}

export function isCourseDiscussionEnabled(
  course: Awaited<ReturnType<typeof getCourseSettings>>
): course is NonNullable<Awaited<ReturnType<typeof getCourseSettings>>> {
  return Boolean(course?.isCourseQARolloutEnabled && course.isCourseQAEnabled)
}

export async function getCourseAccessActor(
  {
    courseId,
    minimumPermissionLevel = DB.PermissionLevel.READ,
  }: {
    courseId: string
    minimumPermissionLevel?: DB.PermissionLevel
  },
  ctx: Context
): Promise<ResolvedActor | null> {
  if (!ctx.user?.sub) {
    return null
  }

  if (ctx.user.role === DB.UserRole.PARTICIPANT) {
    if (minimumPermissionLevel !== DB.PermissionLevel.READ) {
      return null
    }

    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
      select: { participantId: true },
    })

    if (!participation) return null

    return { participantId: participation.participantId }
  }

  if (
    ctx.user.role === DB.UserRole.USER ||
    ctx.user.role === DB.UserRole.ADMIN
  ) {
    const validAccess = await checkAccess(
      [
        {
          courseId,
          minimumPermissionLevel,
        },
      ],
      ctx as ContextWithUser
    )

    if (!validAccess) return null

    return { userId: ctx.user.sub }
  }

  return null
}

export async function canAccessCourseDiscussionScope(
  {
    participantId,
    courseId,
    scope,
  }: {
    participantId: string | null | undefined
    courseId: string
    scope: {
      scopeType: DB.DiscussionScopeType
      stackId?: number | null
    }
  },
  ctx: Context
) {
  if (scope.scopeType !== DB.DiscussionScopeType.PRACTICE_STACK) {
    return true
  }

  if (!scope.stackId) return false

  const accessibleStack = await ctx.prisma.elementStack.findFirst({
    where: {
      id: scope.stackId,
      OR: [
        { courseId },
        { practiceQuiz: { courseId } },
        { microLearning: { courseId } },
      ],
      ...(participantId
        ? {
            elements: {
              some: {},
              every: {
                responses: {
                  some: {
                    participantId,
                    courseId,
                  },
                },
              },
            },
          }
        : {}),
    },
    select: { id: true },
  })

  return Boolean(accessibleStack)
}
