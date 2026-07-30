import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  encodeScopePart,
  isPrismaUniqueConstraintError,
  normalizeExternalScopeIdentifiers,
} from './model.js'
import type {
  CanonicalScope,
  DiscussionScopeInput,
  DiscussionSpaceInput,
} from './types.js'

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

        const externalIdentifiers = normalizeExternalScopeIdentifiers(
          scope.externalSource,
          scope.externalRef
        )
        if (!externalIdentifiers) return null
        const { externalSource, externalRef } = externalIdentifiers

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
    scopeId,
    subjectId,
    participantId,
    eventType,
    metadata,
  }: {
    scopeId: number
    subjectId?: number | null
    participantId?: string | null
    eventType: DB.DiscussionEventType
    metadata?: Record<string, unknown> | null
  },
  ctx: Context
) {
  return ctx.prisma.discussionEvent.create({
    data: {
      scopeId,
      subjectId: subjectId ?? null,
      participantId: participantId ?? null,
      eventType,
      metadata: metadata ?? undefined,
    },
  })
}
