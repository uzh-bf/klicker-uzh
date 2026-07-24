import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  canParticipantAccessDiscussionScope,
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import { rejectEmbedCourseMismatch, verifyEmbedToken } from './embeds.js'
import {
  ACTIVE_COURSE_SCOPE_TYPES,
  buildThreadInclude,
  getThreadOrderBy,
  isSupportedCourseScopeKey,
  mapThreads,
  parseCursor,
  parseLimit,
} from './model.js'
import type {
  CourseDiscussionOverview,
  CourseDiscussionOverviewArgs,
  CourseDiscussionOverviewGroup,
  CourseDiscussionThreadsArgs,
  DiscussionThreadPage,
  DiscussionThreadWithRelations,
  ResolvedActor,
} from './types.js'

export async function courseDiscussionThreads(
  {
    courseId,
    scopeKey,
    sort,
    limit,
    cursor,
    embedToken,
  }: CourseDiscussionThreadsArgs,
  ctx: Context
): Promise<DiscussionThreadPage> {
  const pageSize = parseLimit(limit)
  const parsedCursor = parseCursor(cursor)

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously: false,
      isAccessible: false,
    }
  }

  const embedClaims = await verifyEmbedToken(embedToken)

  let actor: ResolvedActor | null = null

  if (!embedClaims) {
    actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) {
      return {
        threads: [],
        nextCursor: null,
        hasMore: false,
        canPostAnonymously: false,
        isAccessible: false,
      }
    }
  } else {
    if (embedClaims.spaceType !== DB.DiscussionSpaceType.COURSE) {
      return {
        threads: [],
        nextCursor: null,
        hasMore: false,
        canPostAnonymously: false,
        isAccessible: false,
      }
    }

    if (rejectEmbedCourseMismatch(embedClaims, courseId)) {
      return {
        threads: [],
        nextCursor: null,
        hasMore: false,
        canPostAnonymously: false,
        isAccessible: false,
      }
    }
  }

  const canPostAnonymously =
    !!embedClaims?.allowAnonymous && !!course.isCourseQAAnonymousEnabled

  const participantId =
    ctx.user?.role === DB.UserRole.PARTICIPANT && ctx.user.sub
      ? ctx.user.sub
      : null

  const effectiveScopeKey =
    embedClaims?.scopeKey ?? scopeKey ?? `course:${courseId}`

  if (!isSupportedCourseScopeKey(courseId, effectiveScopeKey)) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously: false,
      isAccessible: false,
    }
  }

  if (embedClaims && scopeKey && scopeKey !== embedClaims.scopeKey) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously: false,
      isAccessible: false,
    }
  }

  if (effectiveScopeKey.startsWith('ext:') && !embedClaims) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously: false,
      isAccessible: false,
    }
  }

  const stackScopeMatch = effectiveScopeKey.match(/^stack:(\d+)$/)
  if (stackScopeMatch) {
    const stackId = Number.parseInt(stackScopeMatch[1] ?? '', 10)
    const stack = await ctx.prisma.elementStack.findFirst({
      where: {
        id: stackId,
        OR: [
          { courseId },
          { practiceQuiz: { courseId } },
          { microLearning: { courseId } },
        ],
      },
      select: { id: true },
    })

    const participantCanAccess = await canParticipantAccessDiscussionScope(
      {
        participantId: actor?.participantId,
        courseId,
        scope: {
          scopeType: DB.DiscussionScopeType.PRACTICE_STACK,
          stackId,
        },
      },
      ctx
    )

    if (!stack || !participantCanAccess) {
      return {
        threads: [],
        nextCursor: null,
        hasMore: false,
        canPostAnonymously: false,
        isAccessible: false,
      }
    }
  }

  const spaces = await ctx.prisma.discussionSpace.findMany({
    where: {
      spaceType: DB.DiscussionSpaceType.COURSE,
      courseId,
    },
  })

  if (spaces.length === 0) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously,
      isAccessible: true,
    }
  }

  const threads = await ctx.prisma.discussionThread.findMany({
    where: {
      spaceId: { in: spaces.map((space) => space.id) },
      isDeleted: false,
      scope: {
        scopeType: { in: [...ACTIVE_COURSE_SCOPE_TYPES] },
        ...(effectiveScopeKey
          ? {
              scopeKey: effectiveScopeKey,
            }
          : {}),
      },
    },
    include: buildThreadInclude(participantId),
    orderBy: getThreadOrderBy(sort),
    cursor: parsedCursor ? { id: parsedCursor } : undefined,
    skip: parsedCursor ? 1 : undefined,
    take: pageSize + 1,
  })

  const hasMore = threads.length > pageSize
  const pageThreads = hasMore ? threads.slice(0, pageSize) : threads

  const mappedThreads = await mapThreads(
    pageThreads as unknown as DiscussionThreadWithRelations[],
    ctx
  )

  const nextCursor = hasMore
    ? String(pageThreads[pageThreads.length - 1]!.id)
    : null

  return {
    threads: mappedThreads,
    nextCursor,
    hasMore,
    canPostAnonymously,
    isAccessible: true,
  }
}

export async function courseDiscussionOverview(
  { courseId, sort, limit, cursor }: CourseDiscussionOverviewArgs,
  ctx: Context
): Promise<CourseDiscussionOverview> {
  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) {
    return { groups: [], nextCursor: null, hasMore: false, totalThreads: 0 }
  }

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel: DB.PermissionLevel.WRITE,
    },
    ctx
  )
  if (!actor) {
    return { groups: [], nextCursor: null, hasMore: false, totalThreads: 0 }
  }

  const pageSize = parseLimit(limit)
  const parsedCursor = parseCursor(cursor)
  const participantId = actor.participantId ?? null

  const spaces = await ctx.prisma.discussionSpace.findMany({
    where: {
      spaceType: DB.DiscussionSpaceType.COURSE,
      courseId,
    },
  })

  if (spaces.length === 0) {
    return { groups: [], nextCursor: null, hasMore: false, totalThreads: 0 }
  }

  const threadWhere: DB.Prisma.DiscussionThreadWhereInput = {
    spaceId: { in: spaces.map((space) => space.id) },
    isDeleted: false,
    scope: {
      scopeType: { in: [...ACTIVE_COURSE_SCOPE_TYPES] },
    },
  }

  const [threads, totalThreads] = await Promise.all([
    ctx.prisma.discussionThread.findMany({
      where: threadWhere,
      include: buildThreadInclude(participantId),
      orderBy: getThreadOrderBy(sort),
      cursor: parsedCursor ? { id: parsedCursor } : undefined,
      skip: parsedCursor ? 1 : undefined,
      take: pageSize + 1,
    }),
    ctx.prisma.discussionThread.count({ where: threadWhere }),
  ])

  const hasMore = threads.length > pageSize
  const pageThreads = hasMore ? threads.slice(0, pageSize) : threads

  const grouped = new Map<string, CourseDiscussionOverviewGroup>()

  const mappedThreads = await mapThreads(
    pageThreads as unknown as DiscussionThreadWithRelations[],
    ctx
  )

  mappedThreads.forEach((thread) => {
    if (!thread.sourceKey || !thread.sourceLabel) return

    const existing = grouped.get(thread.sourceKey)
    if (existing) {
      existing.threads.push(thread)
      return
    }

    grouped.set(thread.sourceKey, {
      sourceKey: thread.sourceKey,
      sourceLabel: thread.sourceLabel,
      spaceType: thread.space.spaceType,
      threads: [thread],
    })
  })

  const nextCursor = hasMore
    ? String(pageThreads[pageThreads.length - 1]!.id)
    : null

  return {
    groups: [...grouped.values()],
    nextCursor,
    hasMore,
    totalThreads,
  }
}
