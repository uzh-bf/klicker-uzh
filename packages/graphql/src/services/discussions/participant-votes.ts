import { Prisma } from '@klicker-uzh/prisma/client'

export async function lockParticipantForDiscussionVoteChanges(
  prisma: Prisma.TransactionClient,
  participantId: string
) {
  const lockedParticipants = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "public"."Participant"
      WHERE "id" = ${participantId}::uuid
      FOR NO KEY UPDATE
    `
  )

  return lockedParticipants.length === 1
}

export async function reconcileParticipantDiscussionVotesBeforeDeletion(
  prisma: Prisma.TransactionClient,
  participantId: string
) {
  if (!(await lockParticipantForDiscussionVoteChanges(prisma, participantId))) {
    return false
  }

  const threadVotes = await prisma.discussionThreadVote.findMany({
    where: { participantId },
    select: { threadId: true },
  })
  const replyVotes = await prisma.discussionReplyVote.findMany({
    where: { participantId },
    select: { replyId: true },
  })

  if (threadVotes.length > 0) {
    await prisma.discussionThread.updateMany({
      where: {
        id: { in: threadVotes.map((vote) => vote.threadId) },
        upvotes: { gt: 0 },
      },
      data: {
        upvotes: { decrement: 1 },
      },
    })
  }

  if (replyVotes.length > 0) {
    await prisma.discussionReply.updateMany({
      where: {
        id: { in: replyVotes.map((vote) => vote.replyId) },
        upvotes: { gt: 0 },
      },
      data: {
        upvotes: { decrement: 1 },
      },
    })
  }

  return true
}
