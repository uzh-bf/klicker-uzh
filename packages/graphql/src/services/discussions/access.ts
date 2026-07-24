import * as DB from '@klicker-uzh/prisma/client'
import type { Context, ContextWithUser } from '../../lib/context.js'
import { checkAccess } from '../sharing.js'
import {
  EXTERNAL_REF_MAX_LENGTH,
  EXTERNAL_SOURCE_MAX_LENGTH,
  encodeScopePart,
  isPrismaUniqueConstraintError,
  truncateString,
} from './model.js'
import type {
  CanonicalScope,
  DiscussionScopeInput,
  DiscussionSpaceInput,
  ResolvedActor,
} from './types.js'

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

export async function canParticipantAccessDiscussionScope(
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
  if (
    !participantId ||
    scope.scopeType !== DB.DiscussionScopeType.PRACTICE_STACK
  ) {
    return true
  }

  if (!scope.stackId) return false

  const evaluatedStack = await ctx.prisma.elementStack.findFirst({
    where: {
      id: scope.stackId,
      OR: [
        { courseId },
        { practiceQuiz: { courseId } },
        { microLearning: { courseId } },
      ],
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
    },
    select: { id: true },
  })

  return Boolean(evaluatedStack)
}

export async function resolveOrCreateSpace(
  input: DiscussionSpaceInput,
  ctx: Context
): Promise<DB.DiscussionSpace | null> {
  if (input.spaceType !== DB.DiscussionSpaceType.COURSE) {
    return null
  }

  const existingSpace = await ctx.prisma.discussionSpace.findUnique({
    where: { courseId: input.courseId },
  })
  if (existingSpace) return existingSpace

  try {
    return await ctx.prisma.discussionSpace.create({
      data: {
        spaceType: DB.DiscussionSpaceType.COURSE,
        course: {
          connect: { id: input.courseId },
        },
      },
    })
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error

    return ctx.prisma.discussionSpace.findUnique({
      where: { courseId: input.courseId },
    })
  }
}

export async function canonicalizeScope(
  {
    space,
    scope,
  }: {
    space: DB.DiscussionSpace
    scope: DiscussionScopeInput
  },
  ctx: Context
): Promise<CanonicalScope | null> {
  if (space.spaceType === DB.DiscussionSpaceType.COURSE) {
    switch (scope.scopeType) {
      case DB.DiscussionScopeType.COURSE: {
        return {
          scopeType: scope.scopeType,
          scopeKey: `course:${space.courseId}`,
          scopeLabel: 'Course',
        }
      }

      case DB.DiscussionScopeType.PRACTICE_STACK: {
        if (!scope.stackId) return null

        const stack = await ctx.prisma.elementStack.findFirst({
          where: {
            id: scope.stackId,
            OR: [
              { courseId: space.courseId },
              { practiceQuiz: { courseId: space.courseId } },
              { microLearning: { courseId: space.courseId } },
            ],
          },
          select: {
            id: true,
            order: true,
            displayName: true,
            type: true,
          },
        })

        if (!stack) return null

        return {
          scopeType: scope.scopeType,
          scopeKey: `stack:${stack.id}`,
          scopeLabel:
            stack.displayName ||
            `${stack.type === DB.ElementStackType.MICROLEARNING ? 'Microlearning' : 'Practice'} Stack ${stack.order}`,
          stackId: stack.id,
        }
      }

      case DB.DiscussionScopeType.EXTERNAL_BLOCK: {
        if (!scope.externalSource || !scope.externalRef) return null

        const externalSource = truncateString(
          scope.externalSource.trim(),
          EXTERNAL_SOURCE_MAX_LENGTH
        )
        const externalRef = truncateString(
          scope.externalRef.trim(),
          EXTERNAL_REF_MAX_LENGTH
        )

        if (!externalSource || !externalRef) return null

        return {
          scopeType: scope.scopeType,
          scopeKey: `ext:${encodeScopePart(externalSource)}:${encodeScopePart(externalRef)}`,
          scopeLabel: `${externalSource}:${externalRef}`,
          externalSource,
          externalRef,
        }
      }

      default:
        return null
    }
  }

  return null
}

export async function resolveOrCreateScope(
  {
    space,
    scope,
  }: {
    space: DB.DiscussionSpace
    scope: DiscussionScopeInput
  },
  ctx: Context
): Promise<DB.DiscussionScope | null> {
  const canonicalScope = await canonicalizeScope(
    {
      space,
      scope,
    },
    ctx
  )

  if (!canonicalScope) return null

  const scopeWhere = {
    spaceId_scopeKey: {
      spaceId: space.id,
      scopeKey: canonicalScope.scopeKey,
    },
  }
  const existingScope = await ctx.prisma.discussionScope.findUnique({
    where: scopeWhere,
  })

  if (existingScope) {
    if (existingScope.scopeLabel === canonicalScope.scopeLabel) {
      return existingScope
    }

    return ctx.prisma.discussionScope.update({
      where: scopeWhere,
      data: { scopeLabel: canonicalScope.scopeLabel },
    })
  }

  try {
    return await ctx.prisma.discussionScope.create({
      data: {
        space: { connect: { id: space.id } },
        scopeType: canonicalScope.scopeType,
        scopeKey: canonicalScope.scopeKey,
        scopeLabel: canonicalScope.scopeLabel,
        stackId: canonicalScope.stackId,
        externalSource: canonicalScope.externalSource,
        externalRef: canonicalScope.externalRef,
      },
    })
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error

    const concurrentScope = await ctx.prisma.discussionScope.findUnique({
      where: scopeWhere,
    })

    if (
      !concurrentScope ||
      concurrentScope.scopeLabel === canonicalScope.scopeLabel
    ) {
      return concurrentScope
    }

    return ctx.prisma.discussionScope.update({
      where: scopeWhere,
      data: { scopeLabel: canonicalScope.scopeLabel },
    })
  }
}

export async function createDiscussionEvent(
  {
    spaceId,
    scopeId,
    threadId,
    replyId,
    participantId,
    eventType,
    metadata,
  }: {
    spaceId: number
    scopeId?: number | null
    threadId?: number | null
    replyId?: number | null
    participantId?: string | null
    eventType: DB.DiscussionEventType
    metadata?: Record<string, unknown> | null
  },
  ctx: Context
) {
  return ctx.prisma.discussionEvent.create({
    data: {
      spaceId,
      scopeId: scopeId ?? null,
      threadId: threadId ?? null,
      replyId: replyId ?? null,
      participantId: participantId ?? null,
      eventType,
      metadata: metadata ?? undefined,
    },
  })
}
