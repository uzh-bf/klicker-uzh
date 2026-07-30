import * as DB from '@klicker-uzh/prisma/client'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { createHash } from 'node:crypto'
import type { Context, ContextWithUser } from '../../lib/context.js'
import {
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import { normalizeExternalScopeIdentifiers } from './model.js'
import {
  createDiscussionEvent,
  resolveOrCreateScope,
  resolveOrCreateSpace,
} from './scopes.js'
import type {
  CourseDiscussionEmbeddingInfo,
  CourseEmbedClaims,
  GenerateCourseDiscussionEmbeddingInfoArgs,
} from './types.js'

const EMBED_SCOPE = 'COURSE_DISCUSSION_EMBED'

const EMBED_VERSION = 1

const ANON_SCOPE_WINDOW_SEC = 90

const ANON_SCOPE_LIMIT = 1

const ANON_COURSE_WINDOW_SEC = 60 * 60

const ANON_COURSE_LIMIT = 6

const ANON_IP_COURSE_WINDOW_SEC = 60 * 60

const ANON_IP_COURSE_LIMIT = 20

const PARTICIPANT_COURSE_WINDOW_SEC = 60 * 60

const PARTICIPANT_COURSE_LIMIT = 60

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`

function getRequestIP(ctx: Context) {
  return ctx.req?.ip || 'unknown-ip'
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

export function hashAnonymousFingerprint(ctx: Context, courseId: string) {
  const ip = getRequestIP(ctx)
  const userAgent = getRequestUserAgent(ctx)
  const salt = getAppSecret()

  return createHash('sha256')
    .update(`${salt}|${courseId}|${ip}|${userAgent}`)
    .digest('hex')
}

export function rejectEmbedCourseMismatch(
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
  const currentValue = await ctx.redisExec.eval(
    INCREMENT_WITH_EXPIRY_SCRIPT,
    1,
    key,
    String(ttlSec)
  )

  return Number(currentValue)
}

export async function verifyEmbedToken(
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

export async function enforceAnonymousRateLimits(
  {
    courseId,
    scopeKey,
    scopeId,
    fingerprintHash,
  }: {
    courseId: string
    scopeKey: string
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
    if (scopeWindowCount > ANON_SCOPE_LIMIT + 1) return false

    await createDiscussionEvent(
      {
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
    if (courseWindowCount > ANON_COURSE_LIMIT + 1) return false

    await createDiscussionEvent(
      {
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
    if (ipWindowCount > ANON_IP_COURSE_LIMIT + 1) return false

    await createDiscussionEvent(
      {
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

export async function enforceParticipantRateLimit(
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

export async function verifyEmbedScopeBinding(
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

  if (embedClaims.sub !== `discussion-space:${expectedSpace.id}`) {
    return false
  }

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

export async function generateCourseDiscussionEmbeddingInfo(
  {
    courseId,
    externalBlock,
    allowAnonymous,
    expiresInHours,
  }: GenerateCourseDiscussionEmbeddingInfoArgs,
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

  const externalIdentifiers = externalBlock
    ? normalizeExternalScopeIdentifiers(
        externalBlock.externalSource,
        externalBlock.externalRef
      )
    : null
  if (externalBlock && !externalIdentifiers) return null

  const space = await resolveOrCreateSpace(courseId, ctx)

  if (!space) return null

  const resolvedScope = await resolveOrCreateScope(
    {
      space,
      scope: externalIdentifiers
        ? {
            scopeType: DB.DiscussionScopeType.EXTERNAL_BLOCK,
            ...externalIdentifiers,
          }
        : {
            scopeType: DB.DiscussionScopeType.COURSE,
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
  )}#embedToken=${encodeURIComponent(embedToken)}`

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
