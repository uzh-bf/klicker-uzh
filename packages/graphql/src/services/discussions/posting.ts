import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  canParticipantAccessDiscussionScope,
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import {
  enforceAnonymousRateLimits,
  enforceParticipantRateLimit,
  hashAnonymousFingerprint,
  rejectEmbedCourseMismatch,
  verifyEmbedScopeBinding,
  verifyEmbedToken,
} from './embeds.js'
import {
  REPLIES_PER_THREAD_MAX,
  buildReplyInclude,
  extractCourseIdFromSpace,
  getDiscussionThreadById,
  isActiveCourseScopeType,
  mapReply,
  normalizeContent,
  normalizeExternalScopeIdentifiers,
} from './model.js'
import {
  canonicalizeScope,
  resolveOrCreateScope,
  resolveOrCreateSpace,
} from './scopes.js'
import type {
  CourseDiscussionReplyPostResult,
  CourseDiscussionThreadPostResult,
  CreateCourseDiscussionReplyArgs,
  CreateCourseDiscussionThreadArgs,
  DiscussionReplyWithRelations,
  DiscussionThreadWithRelations,
} from './types.js'
import { CourseDiscussionPostFailureCode } from './types.js'

function threadFailure(
  failureCode: CourseDiscussionPostFailureCode
): CourseDiscussionThreadPostResult {
  return { thread: null, failureCode }
}

function replyFailure(
  failureCode: CourseDiscussionPostFailureCode
): CourseDiscussionReplyPostResult {
  return { reply: null, failureCode }
}

export async function createCourseDiscussionThread(
  args: CreateCourseDiscussionThreadArgs,
  ctx: Context
): Promise<DiscussionThreadWithRelations | null> {
  return (await createCourseDiscussionThreadResult(args, ctx)).thread
}

export async function createCourseDiscussionThreadResult(
  {
    courseId,
    content,
    scope,
    isAnonymous,
    embedToken,
  }: CreateCourseDiscussionThreadArgs,
  ctx: Context
): Promise<CourseDiscussionThreadPostResult> {
  const normalizedContent = normalizeContent(content)
  if (!normalizedContent) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_INPUT)
  }

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) {
    return threadFailure(CourseDiscussionPostFailureCode.COURSE_QA_UNAVAILABLE)
  }

  // Verify embed token early to reject courseId mismatches before creating
  // spaces or scopes as a side effect
  const embedClaims = await verifyEmbedToken(embedToken)
  if (embedToken?.trim() && !embedClaims) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }
  if (rejectEmbedCourseMismatch(embedClaims, courseId)) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }
  if (
    scope.scopeType === DB.DiscussionScopeType.EXTERNAL_BLOCK &&
    !embedClaims
  ) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }
  if (
    scope.scopeType === DB.DiscussionScopeType.EXTERNAL_BLOCK &&
    !normalizeExternalScopeIdentifiers(
      scope.externalSource ?? '',
      scope.externalRef ?? ''
    )
  ) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_SCOPE)
  }

  const anonymous = !!isAnonymous
  const authorizedParticipantId = anonymous
    ? null
    : ((await getCourseAccessActor({ courseId }, ctx))?.participantId ?? null)

  if (!anonymous && !authorizedParticipantId) {
    return threadFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
  }
  if (
    !(await canParticipantAccessDiscussionScope(
      {
        participantId: authorizedParticipantId,
        courseId,
        scope,
      },
      ctx
    ))
  ) {
    return threadFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
  }

  const space = anonymous
    ? await ctx.prisma.discussionSpace.findUnique({
        where: { courseId },
      })
    : await resolveOrCreateSpace(
        {
          spaceType: DB.DiscussionSpaceType.COURSE,
          courseId,
        },
        ctx
      )

  if (!space) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }

  const canonicalScope = await canonicalizeScope(
    {
      space,
      scope,
    },
    ctx
  )

  if (!canonicalScope) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_SCOPE)
  }

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

    if (!validBinding) {
      return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
    }

    resolvedScope = await ctx.prisma.discussionScope.findUnique({
      where: {
        spaceId_scopeKey: {
          spaceId: space.id,
          scopeKey: canonicalScope.scopeKey,
        },
      },
    })

    if (!resolvedScope) {
      return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
    }

    fingerprintHash = hashAnonymousFingerprint(ctx, courseId)

    const allowedByRateLimit = await enforceAnonymousRateLimits(
      {
        courseId,
        scopeKey: resolvedScope.scopeKey,
        scopeId: resolvedScope.id,
        fingerprintHash,
      },
      ctx
    )

    if (!allowedByRateLimit) {
      return threadFailure(CourseDiscussionPostFailureCode.RATE_LIMITED)
    }
  } else {
    participantId = authorizedParticipantId
    if (!participantId) {
      return threadFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
    }

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

      if (!validBinding) {
        return threadFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
      }
    }

    const withinRateLimit = await enforceParticipantRateLimit(
      { courseId, participantId },
      ctx
    )
    if (!withinRateLimit) {
      return threadFailure(CourseDiscussionPostFailureCode.RATE_LIMITED)
    }
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

  if (!resolvedScope) {
    return threadFailure(CourseDiscussionPostFailureCode.INVALID_SCOPE)
  }

  const thread = await ctx.prisma.$transaction(async (tx) => {
    const createdThread = await tx.discussionThread.create({
      data: {
        scopeId: resolvedScope.id,
        content: normalizedContent,
        isAnonymous: anonymous,
        authorFingerprintHash: fingerprintHash,
        authorParticipantId: participantId,
      },
    })

    await tx.discussionEvent.create({
      data: {
        scopeId: resolvedScope.id,
        subjectId: createdThread.id,
        participantId,
        eventType: DB.DiscussionEventType.THREAD_CREATED,
      },
    })

    return createdThread
  })

  const response = await getDiscussionThreadById(
    {
      threadId: thread.id,
      participantId,
    },
    ctx
  )

  if (!response) {
    return threadFailure(CourseDiscussionPostFailureCode.POST_FAILED)
  }

  return { thread: response, failureCode: null }
}

export async function createCourseDiscussionReply(
  args: CreateCourseDiscussionReplyArgs,
  ctx: Context
): Promise<DiscussionReplyWithRelations | null> {
  return (await createCourseDiscussionReplyResult(args, ctx)).reply
}

export async function createCourseDiscussionReplyResult(
  {
    courseId,
    threadId,
    content,
    isAnonymous,
    embedToken,
  }: CreateCourseDiscussionReplyArgs,
  ctx: Context
): Promise<CourseDiscussionReplyPostResult> {
  const normalizedContent = normalizeContent(content)
  if (!normalizedContent) {
    return replyFailure(CourseDiscussionPostFailureCode.INVALID_INPUT)
  }

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) {
    return replyFailure(CourseDiscussionPostFailureCode.COURSE_QA_UNAVAILABLE)
  }

  // Verify embed token early to reject courseId mismatches before any lookups
  const embedClaims = await verifyEmbedToken(embedToken)
  if (embedToken?.trim() && !embedClaims) {
    return replyFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }
  if (rejectEmbedCourseMismatch(embedClaims, courseId)) {
    return replyFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
  }

  const thread = await ctx.prisma.discussionThread.findUnique({
    where: {
      id: threadId,
    },
    include: {
      scope: {
        include: {
          space: true,
        },
      },
    },
  })

  if (!thread || thread.isDeleted) {
    return replyFailure(CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE)
  }
  if (!isActiveCourseScopeType(thread.scope.scopeType)) {
    return replyFailure(CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE)
  }

  const threadCourseId = extractCourseIdFromSpace(thread.scope.space)
  if (!threadCourseId || threadCourseId !== courseId) {
    return replyFailure(CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE)
  }
  if (thread.replyCount >= REPLIES_PER_THREAD_MAX) {
    return replyFailure(CourseDiscussionPostFailureCode.REPLY_LIMIT_REACHED)
  }

  const anonymous = !!isAnonymous

  let participantId: string | null = null
  let fingerprintHash: string | null = null

  if (anonymous) {
    const validBinding = await verifyEmbedScopeBinding(
      {
        embedClaims,
        expectedSpace: thread.scope.space,
        expectedScopeKey: thread.scope.scopeKey,
        requireAnonymous: true,
      },
      ctx
    )

    if (!validBinding) {
      return replyFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
    }

    fingerprintHash = hashAnonymousFingerprint(ctx, courseId)

    const allowedByRateLimit = await enforceAnonymousRateLimits(
      {
        courseId,
        scopeKey: thread.scope.scopeKey,
        scopeId: thread.scopeId,
        fingerprintHash,
      },
      ctx
    )

    if (!allowedByRateLimit) {
      return replyFailure(CourseDiscussionPostFailureCode.RATE_LIMITED)
    }
  } else {
    const actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) {
      return replyFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
    }

    participantId = actor.participantId ?? null
    if (!participantId) {
      return replyFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
    }

    if (
      !(await canParticipantAccessDiscussionScope(
        {
          participantId,
          courseId,
          scope: thread.scope,
        },
        ctx
      ))
    ) {
      return replyFailure(CourseDiscussionPostFailureCode.ACCESS_DENIED)
    }

    if (embedClaims) {
      const validBinding = await verifyEmbedScopeBinding(
        {
          embedClaims,
          expectedSpace: thread.scope.space,
          expectedScopeKey: thread.scope.scopeKey,
          requireAnonymous: false,
        },
        ctx
      )

      if (!validBinding) {
        return replyFailure(CourseDiscussionPostFailureCode.INVALID_EMBED)
      }
    }

    const withinRateLimit = await enforceParticipantRateLimit(
      { courseId, participantId },
      ctx
    )
    if (!withinRateLimit) {
      return replyFailure(CourseDiscussionPostFailureCode.RATE_LIMITED)
    }
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
        content: normalizedContent,
        isAnonymous: anonymous,
        authorFingerprintHash: fingerprintHash,
        authorParticipantId: participantId,
      },
    })

    await tx.discussionEvent.create({
      data: {
        scopeId: thread.scopeId,
        subjectId: createdReply.id,
        participantId,
        eventType: DB.DiscussionEventType.REPLY_CREATED,
      },
    })

    return createdReply
  })

  if (!reply) {
    const currentThread = await ctx.prisma.discussionThread.findUnique({
      where: { id: threadId },
      select: { isDeleted: true, replyCount: true },
    })

    return replyFailure(
      currentThread &&
        !currentThread.isDeleted &&
        currentThread.replyCount >= REPLIES_PER_THREAD_MAX
        ? CourseDiscussionPostFailureCode.REPLY_LIMIT_REACHED
        : CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE
    )
  }

  const response = await ctx.prisma.discussionReply.findUnique({
    where: {
      id: reply.id,
    },
    include: buildReplyInclude(participantId),
  })

  if (!response || response.isDeleted) {
    return replyFailure(CourseDiscussionPostFailureCode.POST_FAILED)
  }

  return {
    reply: mapReply(response, {
      spaceId: thread.scope.spaceId,
      scopeId: thread.scopeId,
    }),
    failureCode: null,
  }
}
