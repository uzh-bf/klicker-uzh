import * as DB from '@klicker-uzh/prisma/client'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { createHash } from 'node:crypto'
import type { Context, ContextWithUser } from '../lib/context.js'
import { checkAccess } from './sharing.js'

const EMBED_SCOPE = 'COURSE_DISCUSSION_EMBED'
const EMBED_VERSION = 1

const LIMIT_DEFAULT = 20
const LIMIT_MAX = 50
const REPLIES_PER_THREAD_MAX = 50
const DISCUSSION_CONTENT_MAX_LENGTH = 4000

const EXTERNAL_SOURCE_MAX_LENGTH = 100
const EXTERNAL_REF_MAX_LENGTH = 200

const ANON_SCOPE_WINDOW_SEC = 90
const ANON_SCOPE_LIMIT = 1
const ANON_COURSE_WINDOW_SEC = 60 * 60
const ANON_COURSE_LIMIT = 6
const ANON_IP_COURSE_WINDOW_SEC = 60 * 60
const ANON_IP_COURSE_LIMIT = 20
const PARTICIPANT_COURSE_WINDOW_SEC = 60 * 60
const PARTICIPANT_COURSE_LIMIT = 60

const ACTIVE_COURSE_SCOPE_TYPES = [
  DB.DiscussionScopeType.COURSE,
  DB.DiscussionScopeType.PRACTICE_STACK,
  DB.DiscussionScopeType.EXTERNAL_BLOCK,
] as const

type DiscussionSort = 'ACTIVITY_DESC' | 'NEWEST_DESC' | 'UPVOTES_DESC'

export interface DiscussionSpaceInput {
  spaceType: DB.DiscussionSpaceType
  courseId: string
}

export interface DiscussionScopeInput {
  scopeType: DB.DiscussionScopeType
  stackId?: number | null
  externalSource?: string | null
  externalRef?: string | null
}

export interface CreateCourseDiscussionThreadArgs {
  courseId: string
  content: string
  scope: DiscussionScopeInput
  isAnonymous?: boolean | null
  embedToken?: string | null
}

export interface CreateCourseDiscussionReplyArgs {
  courseId: string
  threadId: number
  content: string
  isAnonymous?: boolean | null
  embedToken?: string | null
}

export interface CourseDiscussionThreadsArgs {
  courseId: string
  scopeKey?: string | null
  sort?: DiscussionSort | null
  limit?: number | null
  cursor?: string | null
  embedToken?: string | null
}

export interface CourseDiscussionOverviewArgs {
  courseId: string
  sort?: DiscussionSort | null
  limit?: number | null
  cursor?: string | null
}

export interface GetCourseDiscussionEmbeddingInfoArgs {
  courseId: string
  externalBlock: {
    externalSource: string
    externalRef: string
  }
  allowAnonymous?: boolean | null
  expiresInHours?: number | null
}

interface DiscussionReplyWithRelations extends DB.DiscussionReply {
  votes?: Pick<DB.DiscussionReplyVote, 'participantId'>[]
  hasUpvoted?: boolean
}

interface DiscussionThreadWithRelations extends DB.DiscussionThread {
  scope: DB.DiscussionScope
  space: DB.DiscussionSpace
  replies: DiscussionReplyWithRelations[]
  votes?: Pick<DB.DiscussionThreadVote, 'participantId'>[]

  sourceKey?: string
  sourceLabel?: string
  hasUpvoted?: boolean
}

export interface DiscussionThreadPage {
  threads: DiscussionThreadWithRelations[]
  nextCursor: string | null
  hasMore: boolean
  canPostAnonymously: boolean
  isAccessible: boolean
}

export interface CourseDiscussionOverviewGroup {
  sourceKey: string
  sourceLabel: string
  spaceType: DB.DiscussionSpaceType
  threads: DiscussionThreadWithRelations[]
}

export interface CourseDiscussionOverview {
  groups: CourseDiscussionOverviewGroup[]
  nextCursor: string | null
  hasMore: boolean
  totalThreads: number
}

export interface CourseDiscussionEmbeddingInfo {
  courseId: string
  scopeKey: string
  scopeLabel: string
  allowAnonymous: boolean
  expiresAt: Date
  embedToken: string
  embedUrl: string
}

interface CourseEmbedClaims {
  sub: string
  scope: string
  version: number
  spaceType: DB.DiscussionSpaceType
  courseId: string
  scopeKey: string
  allowAnonymous: boolean
  iat?: number
  exp?: number
}

interface ResolvedActor {
  participantId?: string
  userId?: string
}

interface CanonicalScope {
  scopeType: DB.DiscussionScopeType
  scopeKey: string
  scopeLabel: string
  stackId?: number | null
  externalSource?: string | null
  externalRef?: string | null
}

function normalizeContent(content: string) {
  const normalized = content.trim()
  if (
    normalized.length === 0 ||
    normalized.length > DISCUSSION_CONTENT_MAX_LENGTH
  ) {
    return null
  }

  return normalized
}

function parseLimit(limit?: number | null) {
  if (!limit || Number.isNaN(limit)) return LIMIT_DEFAULT
  return Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit)))
}

function parseCursor(cursor?: string | null) {
  if (!cursor) return null

  const parsed = Number.parseInt(cursor, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null

  return parsed
}

function getThreadOrderBy(
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

function isActiveCourseScopeType(scopeType: DB.DiscussionScopeType) {
  return ACTIVE_COURSE_SCOPE_TYPES.includes(
    scopeType as (typeof ACTIVE_COURSE_SCOPE_TYPES)[number]
  )
}

function isSupportedCourseScopeKey(courseId: string, scopeKey: string) {
  return (
    scopeKey === `course:${courseId}` ||
    /^stack:\d+$/.test(scopeKey) ||
    /^ext:[^:]+:.+$/.test(scopeKey)
  )
}

function mapReply(
  reply: DiscussionReplyWithRelations
): DiscussionReplyWithRelations {
  return {
    ...reply,
    hasUpvoted: (reply.votes?.length ?? 0) > 0,
  }
}

function mapThread(
  thread: DiscussionThreadWithRelations
): DiscussionThreadWithRelations {
  const sourceKey = sourceKeyForSpace(thread.space)
  const sourceLabel = sourceLabelForSpace()

  return {
    ...thread,
    sourceKey,
    sourceLabel,
    hasUpvoted: (thread.votes?.length ?? 0) > 0,
    replies: thread.replies.map(mapReply),
  }
}

function getRequestIP(ctx: Context) {
  const headers = ctx.req?.headers ?? {}
  const forwardedFor = headers['x-forwarded-for']
  if (typeof forwardedFor === 'string') {
    const [first] = forwardedFor.split(',')
    if (first) return first.trim()
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const [first] = forwardedFor
    if (first) {
      const [firstSplit] = first.split(',')
      if (firstSplit) return firstSplit.trim()
    }
  }

  const requestIp = ctx.req.ip
  if (requestIp) return requestIp

  return 'unknown-ip'
}

function getRequestUserAgent(ctx: Context) {
  const headers = ctx.req?.headers ?? {}
  const userAgent = headers['user-agent'] as string | string[] | undefined

  if (typeof userAgent === 'string') {
    return userAgent
  }

  if (Array.isArray(userAgent) && userAgent.length > 0) {
    return userAgent[0] ?? 'unknown-user-agent'
  }

  return 'unknown-user-agent'
}

function getAppSecret(): string {
  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error(
      'APP_SECRET environment variable is required for discussion features'
    )
  }
  return secret
}

function hashAnonymousFingerprint(ctx: Context, courseId: string) {
  const ip = getRequestIP(ctx)
  const userAgent = getRequestUserAgent(ctx)
  const salt = getAppSecret()

  return createHash('sha256')
    .update(`${salt}|${courseId}|${ip}|${userAgent}`)
    .digest('hex')
}

function encodeScopePart(value: string) {
  return encodeURIComponent(value.trim()).replace(/:/g, '%3A')
}

function truncateString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function rejectEmbedCourseMismatch(
  embedClaims: CourseEmbedClaims | null,
  courseId: string
): boolean {
  if (!embedClaims) return false

  if (
    embedClaims.spaceType === DB.DiscussionSpaceType.COURSE &&
    embedClaims.courseId !== courseId
  ) {
    return true
  }

  return false
}

async function incrementCounter(
  ctx: Context,
  key: string,
  ttlSec: number
): Promise<number> {
  const currentValue = await ctx.redisExec.incr(key)

  if (currentValue === 1) {
    await ctx.redisExec.expire(key, ttlSec)
  }

  return currentValue
}

async function getCourseSettings(courseId: string, ctx: Context) {
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

function isCourseDiscussionEnabled(
  course: Awaited<ReturnType<typeof getCourseSettings>>
): course is NonNullable<Awaited<ReturnType<typeof getCourseSettings>>> {
  return Boolean(course?.isCourseQARolloutEnabled && course.isCourseQAEnabled)
}

async function getCourseAccessActor(
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

function extractCourseIdFromSpace(space: DB.DiscussionSpace | null) {
  if (!space) return null

  return space.spaceType === DB.DiscussionSpaceType.COURSE
    ? space.courseId
    : null
}

async function resolveOrCreateSpace(
  input: DiscussionSpaceInput,
  ctx: Context
): Promise<DB.DiscussionSpace | null> {
  if (input.spaceType !== DB.DiscussionSpaceType.COURSE) {
    return null
  }

  return ctx.prisma.discussionSpace.upsert({
    where: { courseId: input.courseId },
    create: {
      spaceType: DB.DiscussionSpaceType.COURSE,
      course: {
        connect: { id: input.courseId },
      },
    },
    update: {
      spaceType: DB.DiscussionSpaceType.COURSE,
    },
  })
}

async function canonicalizeScope(
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

async function resolveOrCreateScope(
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

  return ctx.prisma.discussionScope.upsert({
    where: {
      spaceId_scopeKey: {
        spaceId: space.id,
        scopeKey: canonicalScope.scopeKey,
      },
    },
    create: {
      space: { connect: { id: space.id } },
      scopeType: canonicalScope.scopeType,
      scopeKey: canonicalScope.scopeKey,
      scopeLabel: canonicalScope.scopeLabel,
      stackId: canonicalScope.stackId,
      externalSource: canonicalScope.externalSource,
      externalRef: canonicalScope.externalRef,
    },
    update: {
      scopeLabel: canonicalScope.scopeLabel,
    },
  })
}

async function createDiscussionEvent(
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

async function verifyEmbedToken(
  embedToken?: string | null
): Promise<CourseEmbedClaims | null> {
  if (!embedToken || embedToken.trim().length === 0) {
    return null
  }

  try {
    const payload = await verifyJWT(embedToken, getAppSecret(), {
      issuer: process.env.APP_ORIGIN_API,
    })

    if (
      payload.scope !== EMBED_SCOPE ||
      payload.version !== EMBED_VERSION ||
      typeof payload.sub !== 'string' ||
      typeof payload.scopeKey !== 'string' ||
      typeof payload.allowAnonymous !== 'boolean' ||
      payload.spaceType !== DB.DiscussionSpaceType.COURSE
    ) {
      return null
    }

    if (typeof payload.courseId !== 'string') {
      return null
    }

    return {
      sub: payload.sub,
      scope: payload.scope,
      version: payload.version,
      spaceType: payload.spaceType,
      courseId: payload.courseId,
      scopeKey: payload.scopeKey,
      allowAnonymous: payload.allowAnonymous,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
  } catch {
    return null
  }
}

async function enforceAnonymousRateLimits(
  {
    courseId,
    scopeKey,
    spaceId,
    scopeId,
    fingerprintHash,
  }: {
    courseId: string
    scopeKey: string
    spaceId: number
    scopeId: number
    fingerprintHash: string
  },
  ctx: Context
) {
  const ip = getRequestIP(ctx)

  const scopeWindowCount = await incrementCounter(
    ctx,
    `discussion:anon:scope:${courseId}:${scopeKey}:${fingerprintHash}`,
    ANON_SCOPE_WINDOW_SEC
  )

  if (scopeWindowCount > ANON_SCOPE_LIMIT) {
    await createDiscussionEvent(
      {
        spaceId,
        scopeId,
        eventType: DB.DiscussionEventType.ANON_RATE_LIMITED,
        metadata: {
          reason: 'scope_window',
          limit: ANON_SCOPE_LIMIT,
          ttlSec: ANON_SCOPE_WINDOW_SEC,
        },
      },
      ctx
    )

    return false
  }

  const courseWindowCount = await incrementCounter(
    ctx,
    `discussion:anon:course:${courseId}:${fingerprintHash}`,
    ANON_COURSE_WINDOW_SEC
  )

  if (courseWindowCount > ANON_COURSE_LIMIT) {
    await createDiscussionEvent(
      {
        spaceId,
        scopeId,
        eventType: DB.DiscussionEventType.ANON_RATE_LIMITED,
        metadata: {
          reason: 'course_window',
          limit: ANON_COURSE_LIMIT,
          ttlSec: ANON_COURSE_WINDOW_SEC,
        },
      },
      ctx
    )

    return false
  }

  const ipWindowCount = await incrementCounter(
    ctx,
    `discussion:anon:ip:${courseId}:${ip}`,
    ANON_IP_COURSE_WINDOW_SEC
  )

  if (ipWindowCount > ANON_IP_COURSE_LIMIT) {
    await createDiscussionEvent(
      {
        spaceId,
        scopeId,
        eventType: DB.DiscussionEventType.ANON_RATE_LIMITED,
        metadata: {
          reason: 'ip_window',
          limit: ANON_IP_COURSE_LIMIT,
          ttlSec: ANON_IP_COURSE_WINDOW_SEC,
        },
      },
      ctx
    )

    return false
  }

  return true
}

async function enforceParticipantRateLimit(
  {
    courseId,
    participantId,
  }: {
    courseId: string
    participantId: string
  },
  ctx: Context
) {
  const participantWindowCount = await incrementCounter(
    ctx,
    `discussion:participant:course:${courseId}:${participantId}`,
    PARTICIPANT_COURSE_WINDOW_SEC
  )

  return participantWindowCount <= PARTICIPANT_COURSE_LIMIT
}

function buildThreadInclude(participantId?: string | null) {
  const replyInclude: DB.Prisma.DiscussionReplyInclude = {}
  if (participantId) {
    replyInclude.votes = {
      where: { participantId },
      select: { participantId: true },
    }
  }

  const include: DB.Prisma.DiscussionThreadInclude = {
    scope: true,
    space: true,
    replies: {
      where: { isDeleted: false },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: REPLIES_PER_THREAD_MAX,
      include: replyInclude,
    },
  }

  if (participantId) {
    include.votes = {
      where: { participantId },
      select: { participantId: true },
    }
  }

  return include
}

async function getDiscussionThreadById(
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

  return mapThread(thread as unknown as DiscussionThreadWithRelations)
}

async function verifyEmbedScopeBinding(
  {
    embedClaims,
    expectedSpace,
    expectedScopeKey,
    requireAnonymous,
  }: {
    embedClaims: CourseEmbedClaims | null
    expectedSpace: DB.DiscussionSpace
    expectedScopeKey: string
    requireAnonymous: boolean
  },
  ctx: Context
) {
  if (!embedClaims) return false

  if (embedClaims.spaceType !== expectedSpace.spaceType) {
    return false
  }

  if (embedClaims.scopeKey !== expectedScopeKey) {
    return false
  }

  if (
    expectedSpace.spaceType !== DB.DiscussionSpaceType.COURSE ||
    !expectedSpace.courseId ||
    embedClaims.courseId !== expectedSpace.courseId
  ) {
    return false
  }

  if (requireAnonymous) {
    if (!embedClaims.allowAnonymous) {
      return false
    }

    if (
      expectedSpace.spaceType !== DB.DiscussionSpaceType.COURSE ||
      !expectedSpace.courseId
    ) {
      return false
    }

    const course = await getCourseSettings(expectedSpace.courseId, ctx)
    if (!course?.isCourseQAAnonymousEnabled) {
      return false
    }
  }

  return true
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

  if (!embedClaims) {
    const actor = await getCourseAccessActor({ courseId }, ctx)
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

    if (!stack) {
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

  const mappedThreads = pageThreads.map((thread) =>
    mapThread(thread as unknown as DiscussionThreadWithRelations)
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

  pageThreads
    .map((thread) =>
      mapThread(thread as unknown as DiscussionThreadWithRelations)
    )
    .forEach((thread) => {
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

export async function getCourseDiscussionEmbeddingInfo(
  {
    courseId,
    externalBlock,
    allowAnonymous,
    expiresInHours,
  }: GetCourseDiscussionEmbeddingInfoArgs,
  ctx: ContextWithUser
): Promise<CourseDiscussionEmbeddingInfo | null> {
  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return null

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel: DB.PermissionLevel.WRITE,
    },
    ctx
  )

  if (!actor?.userId) {
    return null
  }

  const space = await resolveOrCreateSpace(
    {
      spaceType: DB.DiscussionSpaceType.COURSE,
      courseId,
    },
    ctx
  )

  if (!space) return null

  const resolvedScope = await resolveOrCreateScope(
    {
      space,
      scope: {
        scopeType: DB.DiscussionScopeType.EXTERNAL_BLOCK,
        externalSource: externalBlock.externalSource,
        externalRef: externalBlock.externalRef,
      },
    },
    ctx
  )

  if (!resolvedScope) return null

  const validHours = Math.max(1, Math.min(24 * 14, expiresInHours ?? 48))
  const anonymousAllowed =
    !!allowAnonymous && !!course.isCourseQAAnonymousEnabled

  const embedToken = await signJWT(
    {
      sub: `discussion-space:${space.id}`,
      scope: EMBED_SCOPE,
      version: EMBED_VERSION,
      spaceType: space.spaceType,
      courseId: space.courseId,
      scopeKey: resolvedScope.scopeKey,
      allowAnonymous: anonymousAllowed,
    },
    getAppSecret(),
    {
      algorithm: 'HS256',
      expiresIn: `${validHours}h`,
      issuer: process.env.APP_ORIGIN_API,
    }
  )

  const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000)
  const baseUrl = process.env.APP_ORIGIN_PWA ?? ''
  const embedPath = `/course/${courseId}/qa?embed=1&scopeKey=${encodeURIComponent(
    resolvedScope.scopeKey
  )}&embedToken=${encodeURIComponent(embedToken)}`

  return {
    courseId,
    scopeKey: resolvedScope.scopeKey,
    scopeLabel: resolvedScope.scopeLabel,
    allowAnonymous: anonymousAllowed,
    expiresAt,
    embedToken,
    embedUrl: baseUrl ? `${baseUrl}${embedPath}` : embedPath,
  }
}

export async function createCourseDiscussionThread(
  {
    courseId,
    content,
    scope,
    isAnonymous,
    embedToken,
  }: CreateCourseDiscussionThreadArgs,
  ctx: Context
): Promise<DiscussionThreadWithRelations | null> {
  const normalizedContent = normalizeContent(content)
  if (!normalizedContent) return null

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return null

  // Verify embed token early to reject courseId mismatches before creating
  // spaces or scopes as a side effect
  const embedClaims = await verifyEmbedToken(embedToken)
  if (rejectEmbedCourseMismatch(embedClaims, courseId)) return null
  if (
    scope.scopeType === DB.DiscussionScopeType.EXTERNAL_BLOCK &&
    !embedClaims
  ) {
    return null
  }

  const space = await resolveOrCreateSpace(
    {
      spaceType: DB.DiscussionSpaceType.COURSE,
      courseId,
    },
    ctx
  )

  if (!space) return null

  const canonicalScope = await canonicalizeScope(
    {
      space,
      scope,
    },
    ctx
  )

  if (!canonicalScope) return null

  const anonymous = !!isAnonymous

  let participantId: string | null = null
  let fingerprintHash: string | null = null
  let resolvedScope: DB.DiscussionScope | null = null

  if (anonymous) {
    const validBinding = await verifyEmbedScopeBinding(
      {
        embedClaims,
        expectedSpace: space,
        expectedScopeKey: canonicalScope.scopeKey,
        requireAnonymous: true,
      },
      ctx
    )

    if (!validBinding) return null

    resolvedScope = await resolveOrCreateScope(
      {
        space,
        scope,
      },
      ctx
    )

    if (!resolvedScope) return null

    fingerprintHash = hashAnonymousFingerprint(ctx, courseId)

    const allowedByRateLimit = await enforceAnonymousRateLimits(
      {
        courseId,
        scopeKey: resolvedScope.scopeKey,
        spaceId: space.id,
        scopeId: resolvedScope.id,
        fingerprintHash,
      },
      ctx
    )

    if (!allowedByRateLimit) return null
  } else {
    const actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) return null

    participantId = actor.participantId ?? null
    if (!participantId) return null

    if (embedClaims) {
      const validBinding = await verifyEmbedScopeBinding(
        {
          embedClaims,
          expectedSpace: space,
          expectedScopeKey: canonicalScope.scopeKey,
          requireAnonymous: false,
        },
        ctx
      )

      if (!validBinding) return null
    }

    const withinRateLimit = await enforceParticipantRateLimit(
      { courseId, participantId },
      ctx
    )
    if (!withinRateLimit) return null
  }

  if (!resolvedScope) {
    resolvedScope = await resolveOrCreateScope(
      {
        space,
        scope,
      },
      ctx
    )
  }

  if (!resolvedScope) return null

  const thread = await ctx.prisma.$transaction(async (tx) => {
    const createdThread = await tx.discussionThread.create({
      data: {
        spaceId: space.id,
        scopeId: resolvedScope.id,
        content: normalizedContent,
        isAnonymous: anonymous,
        authorFingerprintHash: fingerprintHash,
        authorParticipantId: participantId,
      },
    })

    await tx.discussionEvent.create({
      data: {
        spaceId: space.id,
        scopeId: resolvedScope.id,
        threadId: createdThread.id,
        participantId,
        eventType: DB.DiscussionEventType.THREAD_CREATED,
      },
    })

    return createdThread
  })

  return getDiscussionThreadById(
    {
      threadId: thread.id,
      participantId,
    },
    ctx
  )
}

export async function createCourseDiscussionReply(
  {
    courseId,
    threadId,
    content,
    isAnonymous,
    embedToken,
  }: CreateCourseDiscussionReplyArgs,
  ctx: Context
): Promise<DiscussionReplyWithRelations | null> {
  const normalizedContent = normalizeContent(content)
  if (!normalizedContent) return null

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return null

  // Verify embed token early to reject courseId mismatches before any lookups
  const embedClaims = await verifyEmbedToken(embedToken)
  if (rejectEmbedCourseMismatch(embedClaims, courseId)) return null

  const thread = await ctx.prisma.discussionThread.findUnique({
    where: {
      id: threadId,
    },
    include: {
      scope: true,
      space: true,
    },
  })

  if (!thread || thread.isDeleted) return null
  if (!isActiveCourseScopeType(thread.scope.scopeType)) return null

  const threadCourseId = extractCourseIdFromSpace(thread.space)
  if (!threadCourseId || threadCourseId !== courseId) return null
  if (thread.replyCount >= REPLIES_PER_THREAD_MAX) return null

  const anonymous = !!isAnonymous

  let participantId: string | null = null
  let fingerprintHash: string | null = null

  if (anonymous) {
    const validBinding = await verifyEmbedScopeBinding(
      {
        embedClaims,
        expectedSpace: thread.space,
        expectedScopeKey: thread.scope.scopeKey,
        requireAnonymous: true,
      },
      ctx
    )

    if (!validBinding) return null

    fingerprintHash = hashAnonymousFingerprint(ctx, courseId)

    const allowedByRateLimit = await enforceAnonymousRateLimits(
      {
        courseId,
        scopeKey: thread.scope.scopeKey,
        spaceId: thread.spaceId,
        scopeId: thread.scopeId,
        fingerprintHash,
      },
      ctx
    )

    if (!allowedByRateLimit) return null
  } else {
    const actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) return null

    participantId = actor.participantId ?? null
    if (!participantId) return null

    if (embedClaims) {
      const validBinding = await verifyEmbedScopeBinding(
        {
          embedClaims,
          expectedSpace: thread.space,
          expectedScopeKey: thread.scope.scopeKey,
          requireAnonymous: false,
        },
        ctx
      )

      if (!validBinding) return null
    }

    const withinRateLimit = await enforceParticipantRateLimit(
      { courseId, participantId },
      ctx
    )
    if (!withinRateLimit) return null
  }

  const reply = await ctx.prisma.$transaction(async (tx) => {
    const reservedReplySlot = await tx.discussionThread.updateMany({
      where: {
        id: threadId,
        isDeleted: false,
        replyCount: { lt: REPLIES_PER_THREAD_MAX },
      },
      data: {
        replyCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })

    if (reservedReplySlot.count === 0) return null

    const createdReply = await tx.discussionReply.create({
      data: {
        threadId,
        spaceId: thread.spaceId,
        scopeId: thread.scopeId,
        content: normalizedContent,
        isAnonymous: anonymous,
        authorFingerprintHash: fingerprintHash,
        authorParticipantId: participantId,
      },
    })

    await tx.discussionEvent.create({
      data: {
        spaceId: thread.spaceId,
        scopeId: thread.scopeId,
        threadId,
        replyId: createdReply.id,
        participantId,
        eventType: DB.DiscussionEventType.REPLY_CREATED,
      },
    })

    return createdReply
  })

  if (!reply) return null

  const includeVotes =
    ctx.user?.role === DB.UserRole.PARTICIPANT && ctx.user.sub
      ? {
          where: {
            participantId: ctx.user.sub,
          },
          select: {
            participantId: true,
          },
        }
      : undefined

  const response = await ctx.prisma.discussionReply.findUnique({
    where: {
      id: reply.id,
    },
    include: {
      votes: includeVotes,
    },
  })

  if (!response || response.isDeleted) return null

  return mapReply(response as DiscussionReplyWithRelations)
}

async function resolveThreadCourseAndActor(
  {
    threadId,
    minimumPermissionLevel = DB.PermissionLevel.READ,
  }: {
    threadId: number
    minimumPermissionLevel?: DB.PermissionLevel
  },
  ctx: Context
): Promise<{
  thread: DB.DiscussionThread & {
    scope: Pick<DB.DiscussionScope, 'scopeType'>
    space: DB.DiscussionSpace
  }
  courseId: string
  actor: ResolvedActor
} | null> {
  const thread = await ctx.prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      scope: true,
      space: true,
    },
  })

  if (!thread || thread.isDeleted) return null
  if (!isActiveCourseScopeType(thread.scope.scopeType)) return null

  const courseId = extractCourseIdFromSpace(thread.space)
  if (!courseId) return null

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel,
    },
    ctx
  )

  if (!actor) return null

  return {
    thread,
    courseId,
    actor,
  }
}

async function resolveReplyCourseAndActor(
  {
    replyId,
    minimumPermissionLevel = DB.PermissionLevel.READ,
  }: {
    replyId: number
    minimumPermissionLevel?: DB.PermissionLevel
  },
  ctx: Context
): Promise<{
  reply: DB.DiscussionReply & {
    thread: Pick<DB.DiscussionThread, 'id' | 'spaceId' | 'scopeId'> & {
      scope: Pick<DB.DiscussionScope, 'scopeType'>
    }
    space: DB.DiscussionSpace
  }
  courseId: string
  actor: ResolvedActor
} | null> {
  const reply = await ctx.prisma.discussionReply.findUnique({
    where: { id: replyId },
    include: {
      thread: {
        select: {
          id: true,
          spaceId: true,
          scopeId: true,
          scope: true,
        },
      },
      space: {
        select: {
          id: true,
          spaceType: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!reply || reply.isDeleted) return null
  if (!isActiveCourseScopeType(reply.thread.scope.scopeType)) return null

  const courseId = extractCourseIdFromSpace(reply.space)
  if (!courseId) return null

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel,
    },
    ctx
  )

  if (!actor) return null

  return {
    reply,
    courseId,
    actor,
  }
}

export async function toggleCourseDiscussionThreadUpvote(
  {
    threadId,
    upvote,
  }: {
    threadId: number
    upvote: boolean
  },
  ctx: Context
): Promise<DiscussionThreadWithRelations | null> {
  const resolved = await resolveThreadCourseAndActor({ threadId }, ctx)
  if (!resolved || !resolved.actor.participantId) return null

  const course = await getCourseSettings(resolved.courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return null

  const participantId = resolved.actor.participantId

  await ctx.prisma.$transaction(async (tx) => {
    const existingVote = await tx.discussionThreadVote.findUnique({
      where: {
        threadId_participantId: {
          threadId,
          participantId,
        },
      },
    })

    if (upvote && !existingVote) {
      await tx.discussionThreadVote.create({
        data: {
          threadId,
          participantId,
        },
      })

      await tx.discussionThread.update({
        where: { id: threadId },
        data: {
          upvotes: {
            increment: 1,
          },
        },
      })

      await tx.discussionEvent.create({
        data: {
          spaceId: resolved.thread.spaceId,
          scopeId: resolved.thread.scopeId,
          threadId,
          participantId,
          eventType: DB.DiscussionEventType.THREAD_UPVOTED,
        },
      })
    } else if (!upvote && existingVote) {
      await tx.discussionThreadVote.delete({
        where: {
          threadId_participantId: {
            threadId,
            participantId,
          },
        },
      })

      const currentThread = await tx.discussionThread.findUnique({
        where: { id: threadId },
        select: { upvotes: true },
      })

      await tx.discussionThread.update({
        where: { id: threadId },
        data: {
          upvotes: Math.max(0, (currentThread?.upvotes ?? 1) - 1),
        },
      })
    }
  })

  return getDiscussionThreadById({ threadId, participantId }, ctx)
}

export async function toggleCourseDiscussionReplyUpvote(
  {
    replyId,
    upvote,
  }: {
    replyId: number
    upvote: boolean
  },
  ctx: Context
): Promise<DiscussionReplyWithRelations | null> {
  const resolved = await resolveReplyCourseAndActor({ replyId }, ctx)
  if (!resolved || !resolved.actor.participantId) return null

  const course = await getCourseSettings(resolved.courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return null

  const participantId = resolved.actor.participantId

  await ctx.prisma.$transaction(async (tx) => {
    const existingVote = await tx.discussionReplyVote.findUnique({
      where: {
        replyId_participantId: {
          replyId,
          participantId,
        },
      },
    })

    if (upvote && !existingVote) {
      await tx.discussionReplyVote.create({
        data: {
          replyId,
          participantId,
        },
      })

      await tx.discussionReply.update({
        where: { id: replyId },
        data: {
          upvotes: {
            increment: 1,
          },
        },
      })

      await tx.discussionEvent.create({
        data: {
          spaceId: resolved.reply.spaceId,
          scopeId: resolved.reply.scopeId,
          threadId: resolved.reply.threadId,
          replyId,
          participantId,
          eventType: DB.DiscussionEventType.REPLY_UPVOTED,
        },
      })
    } else if (!upvote && existingVote) {
      await tx.discussionReplyVote.delete({
        where: {
          replyId_participantId: {
            replyId,
            participantId,
          },
        },
      })

      const currentReply = await tx.discussionReply.findUnique({
        where: { id: replyId },
        select: { upvotes: true },
      })

      await tx.discussionReply.update({
        where: { id: replyId },
        data: {
          upvotes: Math.max(0, (currentReply?.upvotes ?? 1) - 1),
        },
      })
    }
  })

  const includeVotes = {
    where: {
      participantId,
    },
    select: {
      participantId: true,
    },
  }

  const reply = await ctx.prisma.discussionReply.findUnique({
    where: {
      id: replyId,
    },
    include: {
      votes: includeVotes,
    },
  })

  if (!reply || reply.isDeleted) return null

  return mapReply(reply as DiscussionReplyWithRelations)
}

async function canDeleteDiscussionContent(
  {
    courseId,
    authorParticipantId,
  }: {
    courseId: string
    authorParticipantId: string | null
  },
  ctx: Context
): Promise<{ allowed: boolean; actor: ResolvedActor | null }> {
  const actor = await getCourseAccessActor({ courseId }, ctx)
  if (!actor) return { allowed: false, actor: null }

  if (actor.participantId && actor.participantId === authorParticipantId) {
    return { allowed: true, actor }
  }

  if (actor.userId) {
    const writeAccess = await getCourseAccessActor(
      { courseId, minimumPermissionLevel: DB.PermissionLevel.WRITE },
      ctx
    )
    if (writeAccess?.userId) {
      return { allowed: true, actor }
    }
  }

  return { allowed: false, actor }
}

export async function deleteCourseDiscussionThread(
  { threadId }: { threadId: number },
  ctx: Context
): Promise<boolean> {
  const thread = await ctx.prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      scope: true,
      space: true,
    },
  })

  if (!thread || thread.isDeleted) return false
  if (!isActiveCourseScopeType(thread.scope.scopeType)) return false

  const courseId = extractCourseIdFromSpace(thread.space)
  if (!courseId) return false

  const { allowed, actor } = await canDeleteDiscussionContent(
    { courseId, authorParticipantId: thread.authorParticipantId },
    ctx
  )
  if (!allowed) return false

  const now = new Date()

  await ctx.prisma.$transaction(async (tx) => {
    await tx.discussionThread.update({
      where: { id: threadId },
      data: {
        isDeleted: true,
        deletedAt: now,
        content: '',
        replyCount: 0,
      },
    })

    await tx.discussionReply.updateMany({
      where: {
        threadId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: now,
        content: '',
      },
    })

    await tx.discussionEvent.create({
      data: {
        spaceId: thread.spaceId,
        scopeId: thread.scopeId,
        threadId,
        participantId: actor?.participantId ?? null,
        eventType: DB.DiscussionEventType.THREAD_DELETED,
      },
    })
  })

  return true
}

export async function deleteCourseDiscussionReply(
  { replyId }: { replyId: number },
  ctx: Context
): Promise<boolean> {
  const reply = await ctx.prisma.discussionReply.findUnique({
    where: { id: replyId },
    include: {
      space: true,
      thread: {
        select: {
          id: true,
          spaceId: true,
          scopeId: true,
          scope: true,
        },
      },
    },
  })

  if (!reply || reply.isDeleted) return false
  if (!isActiveCourseScopeType(reply.thread.scope.scopeType)) return false

  const courseId = extractCourseIdFromSpace(reply.space)
  if (!courseId) return false

  const { allowed, actor } = await canDeleteDiscussionContent(
    { courseId, authorParticipantId: reply.authorParticipantId },
    ctx
  )
  if (!allowed) return false

  const now = new Date()

  await ctx.prisma.$transaction(async (tx) => {
    await tx.discussionReply.update({
      where: { id: replyId },
      data: {
        isDeleted: true,
        deletedAt: now,
        content: '',
      },
    })

    const nonDeletedRepliesCount = await tx.discussionReply.count({
      where: {
        threadId: reply.thread.id,
        isDeleted: false,
      },
    })

    await tx.discussionThread.update({
      where: {
        id: reply.thread.id,
      },
      data: {
        replyCount: nonDeletedRepliesCount,
        lastActivityAt: now,
      },
    })

    await tx.discussionEvent.create({
      data: {
        spaceId: reply.thread.spaceId,
        scopeId: reply.thread.scopeId,
        threadId: reply.thread.id,
        replyId,
        participantId: actor?.participantId ?? null,
        eventType: DB.DiscussionEventType.REPLY_DELETED,
      },
    })
  })

  return true
}
