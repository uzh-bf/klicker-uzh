import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import {
  ACTIVE_COURSE_SCOPE_TYPES,
  buildThreadInclude,
  getThreadOrderBy,
  mapThreads,
  parseCursor,
  parseLimit,
} from './model.js'
import { resolveCourseDiscussionReadContext } from './read-context.js'
import type {
  CourseDiscussionOverview,
  CourseDiscussionOverviewArgs,
  CourseDiscussionOverviewGroup,
  CourseDiscussionThreadsArgs,
  DiscussionThreadPage,
} from './types.js'

function inaccessibleDiscussionThreadPage(): DiscussionThreadPage {
  return {
    threads: [],
    nextCursor: null,
    hasMore: false,
    canPostAnonymously: false,
    canPostIdentified: false,
    isAccessible: false,
  }
}

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
  const readContext = await resolveCourseDiscussionReadContext(
    { courseId, scopeKey, embedToken },
    ctx
  )

  if (!readContext) {
    return inaccessibleDiscussionThreadPage()
  }

  const {
    participantId,
    canPostAnonymously,
    canPostIdentified,
    effectiveScopeKey,
    spaces,
  } = readContext

  if (spaces.length === 0) {
    return {
      threads: [],
      nextCursor: null,
      hasMore: false,
      canPostAnonymously,
      canPostIdentified,
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

  const mappedThreads = await mapThreads(pageThreads, ctx)

  const nextCursor = hasMore
    ? String(pageThreads[pageThreads.length - 1]!.id)
    : null

  return {
    threads: mappedThreads,
    nextCursor,
    hasMore,
    canPostAnonymously,
    canPostIdentified,
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

  const mappedThreads = await mapThreads(pageThreads, ctx)

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
