import * as DB from '@klicker-uzh/prisma/client'

export const REPLIES_PER_THREAD_MAX = 50

function replyVoteWhere(
  participantId?: string | null
): DB.Prisma.DiscussionReplyVoteWhereInput {
  return participantId ? { participantId } : { participantId: { in: [] } }
}

function threadVoteWhere(
  participantId?: string | null
): DB.Prisma.DiscussionThreadVoteWhereInput {
  return participantId ? { participantId } : { participantId: { in: [] } }
}

export function buildReplyInclude(participantId?: string | null) {
  return {
    votes: {
      where: replyVoteWhere(participantId),
      select: { participantId: true },
    },
  } satisfies DB.Prisma.DiscussionReplyInclude
}

export type DiscussionReplyWithVotes = DB.Prisma.DiscussionReplyGetPayload<{
  include: ReturnType<typeof buildReplyInclude>
}>

export function buildThreadInclude(participantId?: string | null) {
  return {
    scope: true,
    space: true,
    replies: {
      where: { isDeleted: false },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: REPLIES_PER_THREAD_MAX,
      include: buildReplyInclude(participantId),
    },
    votes: {
      where: threadVoteWhere(participantId),
      select: { participantId: true },
    },
  } satisfies DB.Prisma.DiscussionThreadInclude
}

export type DiscussionThreadWithRelationsBase =
  DB.Prisma.DiscussionThreadGetPayload<{
    include: ReturnType<typeof buildThreadInclude>
  }>
