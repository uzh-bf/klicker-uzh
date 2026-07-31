import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
  meetsCourseDiscussionScopePrerequisites,
} from './access.js'
import {
  buildReplyInclude,
  extractCourseIdFromSpace,
  getDiscussionThreadById,
  isActiveCourseScopeType,
  mapReply,
} from './model.js'
import { lockParticipantForDiscussionVoteChanges } from './participant-votes.js'
import type {
  DiscussionReplyWithRelations,
  DiscussionThreadWithRelations,
  ResolvedActor,
} from './types.js'

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
    scope: DB.DiscussionScope & {
      space: DB.DiscussionSpace
    }
  }
  courseId: string
  actor: ResolvedActor
} | null> {
  const thread = await ctx.prisma.discussionThread.findUnique({
    where: { id: threadId },
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

  const courseId = extractCourseIdFromSpace(thread.scope.space)
  if (!courseId) return null

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel,
    },
    ctx
  )

  if (!actor) return null

  if (
    !(await meetsCourseDiscussionScopePrerequisites(
      {
        participantId: actor.participantId,
        courseId,
        scope: thread.scope,
      },
      ctx
    ))
  ) {
    return null
  }

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
    thread: DB.DiscussionThread & {
      scope: DB.DiscussionScope & {
        space: DB.DiscussionSpace
      }
    }
  }
  courseId: string
  actor: ResolvedActor
} | null> {
  const reply = await ctx.prisma.discussionReply.findUnique({
    where: { id: replyId },
    include: {
      thread: {
        include: {
          scope: {
            include: {
              space: true,
            },
          },
        },
      },
    },
  })

  if (!reply || reply.isDeleted) return null
  if (!isActiveCourseScopeType(reply.thread.scope.scopeType)) return null

  const courseId = extractCourseIdFromSpace(reply.thread.scope.space)
  if (!courseId) return null

  const actor = await getCourseAccessActor(
    {
      courseId,
      minimumPermissionLevel,
    },
    ctx
  )

  if (!actor) return null

  if (
    !(await meetsCourseDiscussionScopePrerequisites(
      {
        participantId: actor.participantId,
        courseId,
        scope: reply.thread.scope,
      },
      ctx
    ))
  ) {
    return null
  }

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
    if (!(await lockParticipantForDiscussionVoteChanges(tx, participantId))) {
      return
    }

    if (upvote) {
      const createdVote = await tx.discussionThreadVote.createMany({
        data: [
          {
            threadId,
            participantId,
          },
        ],
        skipDuplicates: true,
      })

      if (createdVote.count === 0) return

      const updatedThread = await tx.discussionThread.updateMany({
        where: {
          id: threadId,
          isDeleted: false,
        },
        data: {
          upvotes: {
            increment: 1,
          },
        },
      })

      if (updatedThread.count === 0) {
        await tx.discussionThreadVote.deleteMany({
          where: {
            threadId,
            participantId,
          },
        })
        return
      }

      await tx.discussionEvent.create({
        data: {
          scopeId: resolved.thread.scopeId,
          subjectId: threadId,
          participantId,
          eventType: DB.DiscussionEventType.THREAD_UPVOTED,
        },
      })
      return
    }

    const deletedVote = await tx.discussionThreadVote.deleteMany({
      where: {
        threadId,
        participantId,
      },
    })

    if (deletedVote.count === 0) return

    const updatedThread = await tx.discussionThread.updateMany({
      where: {
        id: threadId,
        upvotes: {
          gt: 0,
        },
      },
      data: {
        upvotes: {
          decrement: 1,
        },
      },
    })

    if (updatedThread.count === 0) {
      throw new Error('Discussion thread upvote counter is inconsistent')
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
    if (!(await lockParticipantForDiscussionVoteChanges(tx, participantId))) {
      return
    }

    if (upvote) {
      const createdVote = await tx.discussionReplyVote.createMany({
        data: [
          {
            replyId,
            participantId,
          },
        ],
        skipDuplicates: true,
      })

      if (createdVote.count === 0) return

      const updatedReply = await tx.discussionReply.updateMany({
        where: {
          id: replyId,
          isDeleted: false,
        },
        data: {
          upvotes: {
            increment: 1,
          },
        },
      })

      if (updatedReply.count === 0) {
        await tx.discussionReplyVote.deleteMany({
          where: {
            replyId,
            participantId,
          },
        })
        return
      }

      await tx.discussionEvent.create({
        data: {
          scopeId: resolved.reply.thread.scopeId,
          subjectId: replyId,
          participantId,
          eventType: DB.DiscussionEventType.REPLY_UPVOTED,
        },
      })
      return
    }

    const deletedVote = await tx.discussionReplyVote.deleteMany({
      where: {
        replyId,
        participantId,
      },
    })

    if (deletedVote.count === 0) return

    const updatedReply = await tx.discussionReply.updateMany({
      where: {
        id: replyId,
        upvotes: {
          gt: 0,
        },
      },
      data: {
        upvotes: {
          decrement: 1,
        },
      },
    })

    if (updatedReply.count === 0) {
      throw new Error('Discussion reply upvote counter is inconsistent')
    }
  })

  const reply = await ctx.prisma.discussionReply.findUnique({
    where: {
      id: replyId,
    },
    include: buildReplyInclude(participantId),
  })

  if (!reply || reply.isDeleted) return null

  return mapReply(reply, {
    spaceId: resolved.reply.thread.scope.spaceId,
    scopeId: resolved.reply.thread.scopeId,
    viewer: { participantId, isModerator: false },
  })
}

async function canDeleteDiscussionContent(
  {
    courseId,
    authorParticipantId,
    scope,
  }: {
    courseId: string
    authorParticipantId: string | null
    scope: {
      scopeType: DB.DiscussionScopeType
      stackId?: number | null
    }
  },
  ctx: Context
): Promise<{ allowed: boolean; actor: ResolvedActor | null }> {
  const actor = await getCourseAccessActor({ courseId }, ctx)
  if (!actor) return { allowed: false, actor: null }

  let allowed =
    !!actor.participantId && actor.participantId === authorParticipantId

  if (!allowed && actor.userId) {
    const writeAccess = await getCourseAccessActor(
      { courseId, minimumPermissionLevel: DB.PermissionLevel.WRITE },
      ctx
    )
    allowed = !!writeAccess?.userId
  }

  if (
    !allowed ||
    !(await meetsCourseDiscussionScopePrerequisites(
      {
        participantId: actor.participantId,
        courseId,
        scope,
      },
      ctx
    ))
  ) {
    return { allowed: false, actor }
  }

  return { allowed: true, actor }
}

export async function deleteCourseDiscussionThread(
  { threadId }: { threadId: number },
  ctx: Context
): Promise<boolean> {
  const thread = await ctx.prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      scope: {
        include: {
          space: true,
        },
      },
    },
  })

  if (!thread || thread.isDeleted) return false
  if (!isActiveCourseScopeType(thread.scope.scopeType)) return false

  const courseId = extractCourseIdFromSpace(thread.scope.space)
  if (!courseId) return false

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return false

  const { allowed, actor } = await canDeleteDiscussionContent(
    {
      courseId,
      authorParticipantId: thread.authorParticipantId,
      scope: thread.scope,
    },
    ctx
  )
  if (!allowed) return false

  const now = new Date()

  const deleted = await ctx.prisma.$transaction(async (tx) => {
    const deletedThread = await tx.discussionThread.updateMany({
      where: {
        id: threadId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: now,
        content: '',
        replyCount: 0,
      },
    })

    if (deletedThread.count === 0) return false

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
        scopeId: thread.scopeId,
        subjectId: threadId,
        participantId: actor?.participantId ?? null,
        eventType: DB.DiscussionEventType.THREAD_DELETED,
      },
    })

    return true
  })

  return deleted
}

export async function deleteCourseDiscussionReply(
  { replyId }: { replyId: number },
  ctx: Context
): Promise<boolean> {
  const reply = await ctx.prisma.discussionReply.findUnique({
    where: { id: replyId },
    include: {
      thread: {
        include: {
          scope: {
            include: {
              space: true,
            },
          },
        },
      },
    },
  })

  if (!reply || reply.isDeleted) return false
  if (!isActiveCourseScopeType(reply.thread.scope.scopeType)) return false

  const courseId = extractCourseIdFromSpace(reply.thread.scope.space)
  if (!courseId) return false

  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) return false

  const { allowed, actor } = await canDeleteDiscussionContent(
    {
      courseId,
      authorParticipantId: reply.authorParticipantId,
      scope: reply.thread.scope,
    },
    ctx
  )
  if (!allowed) return false

  const now = new Date()

  try {
    return await ctx.prisma.$transaction(async (tx) => {
      const updatedThread = await tx.discussionThread.updateMany({
        where: {
          id: reply.thread.id,
          isDeleted: false,
          replyCount: { gt: 0 },
        },
        data: {
          replyCount: { decrement: 1 },
          lastActivityAt: now,
        },
      })

      if (updatedThread.count === 0) {
        throw new DiscussionReplyDeleteConflictError()
      }

      const deletedReply = await tx.discussionReply.updateMany({
        where: {
          id: replyId,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: now,
          content: '',
        },
      })

      if (deletedReply.count === 0) {
        throw new DiscussionReplyDeleteConflictError()
      }

      await tx.discussionEvent.create({
        data: {
          scopeId: reply.thread.scopeId,
          subjectId: replyId,
          participantId: actor?.participantId ?? null,
          eventType: DB.DiscussionEventType.REPLY_DELETED,
        },
      })

      return true
    })
  } catch (error) {
    if (error instanceof DiscussionReplyDeleteConflictError) return false
    throw error
  }
}

class DiscussionReplyDeleteConflictError extends Error {}
