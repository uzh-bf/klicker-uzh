import * as DB from '@klicker-uzh/prisma/client'
import {
  COURSE_QA_EXTERNAL_REF_MAX_LENGTH,
  COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH,
} from '@klicker-uzh/types'
import type { Context } from '../../lib/context.js'
import {
  buildThreadInclude,
  type DiscussionReplyWithVotes,
  type DiscussionThreadWithRelationsBase,
} from './relations.js'
import type {
  DiscussionReplyWithRelations,
  DiscussionSort,
  DiscussionThreadWithRelations,
} from './types.js'

export {
  buildReplyInclude,
  buildThreadInclude,
  REPLIES_PER_THREAD_MAX,
} from './relations.js'

const LIMIT_DEFAULT = 20

const LIMIT_MAX = 50

const DISCUSSION_CONTENT_MAX_LENGTH = 4000

export const ACTIVE_COURSE_SCOPE_TYPES = [
  DB.DiscussionScopeType.COURSE,
  DB.DiscussionScopeType.PRACTICE_STACK,
  DB.DiscussionScopeType.EXTERNAL_BLOCK,
] as const

export function normalizeContent(content: string) {
  const normalized = content.trim()
  if (
    normalized.length === 0 ||
    normalized.length > DISCUSSION_CONTENT_MAX_LENGTH
  ) {
    return null
  }

  return normalized
}

export function parseLimit(limit?: number | null) {
  if (!limit || Number.isNaN(limit)) return LIMIT_DEFAULT
  return Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit)))
}

export function parseCursor(cursor?: string | null) {
  if (!cursor) return null

  const parsed = Number.parseInt(cursor, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null

  return parsed
}

export function getThreadOrderBy(
  sort?: DiscussionSort | null
): DB.Prisma.DiscussionThreadOrderByWithRelationInput[] {
  if (sort === 'NEWEST_DESC') {
    return [{ createdAt: 'desc' }, { id: 'desc' }]
  }

  if (sort === 'UPVOTES_DESC') {
    return [{ upvotes: 'desc' }, { lastActivityAt: 'desc' }, { id: 'desc' }]
  }

  return [{ lastActivityAt: 'desc' }, { id: 'desc' }]
}

function sourceKeyForSpace(space: DB.DiscussionSpace) {
  return `course:${space.courseId}`
}

function sourceLabelForSpace() {
  return 'Course'
}

export function isActiveCourseScopeType(scopeType: DB.DiscussionScopeType) {
  return ACTIVE_COURSE_SCOPE_TYPES.includes(
    scopeType as (typeof ACTIVE_COURSE_SCOPE_TYPES)[number]
  )
}

export function isSupportedCourseScopeKey(courseId: string, scopeKey: string) {
  return (
    scopeKey === `course:${courseId}` ||
    /^stack:\d+$/.test(scopeKey) ||
    /^ext:[^:]+:.+$/.test(scopeKey)
  )
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

export function mapReply(
  reply: DiscussionReplyWithVotes,
  {
    spaceId,
    scopeId,
  }: {
    spaceId: number
    scopeId: number
  }
): DiscussionReplyWithRelations {
  return {
    ...reply,
    spaceId,
    scopeId,
    hasUpvoted: (reply.votes?.length ?? 0) > 0,
  }
}

function mapThread(
  thread: DiscussionThreadWithRelationsBase,
  stack?: {
    type: DB.ElementStackType
    order: number
    displayName: string | null
  }
): DiscussionThreadWithRelations {
  const { space, ...scope } = thread.scope
  const sourceKey = sourceKeyForSpace(space)
  const sourceLabel = sourceLabelForSpace()

  return {
    ...thread,
    spaceId: space.id,
    scope: {
      ...scope,
      stackType: stack?.type ?? null,
      stackOrder: stack?.order ?? null,
      stackDisplayName: stack?.displayName ?? null,
    },
    sourceKey,
    sourceLabel,
    hasUpvoted: (thread.votes?.length ?? 0) > 0,
    replies: thread.replies.map((reply) =>
      mapReply(reply, {
        spaceId: space.id,
        scopeId: thread.scopeId,
      })
    ),
  }
}

export async function mapThreads(
  threads: DiscussionThreadWithRelationsBase[],
  ctx: Context
) {
  const stackIds = [
    ...new Set(
      threads
        .map((thread) => thread.scope.stackId)
        .filter((stackId): stackId is number => stackId !== null)
    ),
  ]
  const stacks =
    stackIds.length === 0
      ? []
      : await ctx.prisma.elementStack.findMany({
          where: { id: { in: stackIds } },
          select: {
            id: true,
            type: true,
            order: true,
            displayName: true,
          },
        })
  const stacksById = new Map(stacks.map((stack) => [stack.id, stack]))

  return threads.map((thread) => {
    const stack = thread.scope.stackId
      ? stacksById.get(thread.scope.stackId)
      : undefined

    return mapThread(thread, stack)
  })
}

export function encodeScopePart(value: string) {
  return encodeURIComponent(value.trim()).replace(/:/g, '%3A')
}

export function normalizeExternalScopeIdentifiers(
  externalSource: string,
  externalRef: string
) {
  const normalizedSource = externalSource.trim()
  const normalizedRef = externalRef.trim()

  if (
    !normalizedSource ||
    !normalizedRef ||
    normalizedSource.length > COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH ||
    normalizedRef.length > COURSE_QA_EXTERNAL_REF_MAX_LENGTH
  ) {
    return null
  }

  try {
    encodeScopePart(normalizedSource)
    encodeScopePart(normalizedRef)
  } catch {
    return null
  }

  return {
    externalSource: normalizedSource,
    externalRef: normalizedRef,
  }
}

export function extractCourseIdFromSpace(space: DB.DiscussionSpace | null) {
  if (!space) return null

  return space.spaceType === DB.DiscussionSpaceType.COURSE
    ? space.courseId
    : null
}

export async function getDiscussionThreadById(
  {
    threadId,
    participantId,
  }: { threadId: number; participantId?: string | null },
  ctx: Context
): Promise<DiscussionThreadWithRelations | null> {
  const thread = await ctx.prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: buildThreadInclude(participantId),
  })

  if (!thread || thread.isDeleted) {
    return null
  }

  if (!isActiveCourseScopeType(thread.scope.scopeType)) {
    return null
  }

  const [mappedThread] = await mapThreads([thread], ctx)
  return mappedThread ?? null
}
