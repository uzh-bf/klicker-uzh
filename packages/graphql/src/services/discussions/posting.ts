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
  CreateCourseDiscussionReplyArgs,
  CreateCourseDiscussionThreadArgs,
  DiscussionReplyWithRelations,
  DiscussionThreadWithRelations,
} from './types.js'

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
  if (
    scope.scopeType === DB.DiscussionScopeType.EXTERNAL_BLOCK &&
    !normalizeExternalScopeIdentifiers(
      scope.externalSource ?? '',
      scope.externalRef ?? ''
    )
  ) {
    return null
  }

  const anonymous = !!isAnonymous
  const authorizedParticipantId = anonymous
    ? null
    : ((await getCourseAccessActor({ courseId }, ctx))?.participantId ?? null)

  if (!anonymous && !authorizedParticipantId) return null
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
    return null
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

  if (!space) return null

  const canonicalScope = await canonicalizeScope(
    {
      space,
      scope,
    },
    ctx
  )

  if (!canonicalScope) return null

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

    resolvedScope = await ctx.prisma.discussionScope.findUnique({
      where: {
        spaceId_scopeKey: {
          spaceId: space.id,
          scopeKey: canonicalScope.scopeKey,
        },
      },
    })

    if (!resolvedScope) return null

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

    if (!allowedByRateLimit) return null
  } else {
    participantId = authorizedParticipantId
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
      scope: {
        include: {
          space: true,
        },
      },
    },
  })

  if (!thread || thread.isDeleted) return null
  if (!isActiveCourseScopeType(thread.scope.scopeType)) return null

  const threadCourseId = extractCourseIdFromSpace(thread.scope.space)
  if (!threadCourseId || threadCourseId !== courseId) return null
  if (thread.replyCount >= REPLIES_PER_THREAD_MAX) return null

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

    if (!validBinding) return null

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

    if (!allowedByRateLimit) return null
  } else {
    const actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) return null

    participantId = actor.participantId ?? null
    if (!participantId) return null

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
      return null
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

  if (!reply) return null

  const response = await ctx.prisma.discussionReply.findUnique({
    where: {
      id: reply.id,
    },
    include: buildReplyInclude(participantId),
  })

  if (!response || response.isDeleted) return null

  return mapReply(response, {
    spaceId: thread.scope.spaceId,
    scopeId: thread.scopeId,
  })
}
