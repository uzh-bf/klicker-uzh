import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  abortCardGenerationLease,
  claimCardGenerationLease,
  completeCardGenerationLease,
} from './graphqlClient'

type CardGenerationLease = {
  id: string
  attemptToken: string
}

export async function createGenerationAttemptMessage({
  prisma,
  assistantMessageId,
  threadId,
  parentId,
}: {
  prisma: PrismaClient
  assistantMessageId: string
  threadId: string
  parentId: string | null
}) {
  const existing = await prisma.chatMessage.findUnique({
    where: { id: assistantMessageId },
    select: { threadId: true, role: true },
  })
  if (existing) {
    throw new Error('The assistant message ID is already in use')
  }

  await prisma.chatMessage.create({
    data: {
      id: assistantMessageId,
      threadId,
      parentId,
      role: 'assistant',
      content: [],
    },
  })
}

export async function claimGenerationLease({
  participantId,
  planMessageId,
  planToolCallId,
  attemptToken,
}: {
  participantId: string
  planMessageId: string
  planToolCallId: string
  attemptToken: string
}): Promise<CardGenerationLease> {
  const lease = await claimCardGenerationLease(
    { planMessageId, planToolCallId, attemptToken },
    participantId
  )
  return { id: lease.id, attemptToken }
}

export async function completeGenerationLease({
  participantId,
  lease,
}: {
  participantId: string
  lease: CardGenerationLease
}) {
  return completeCardGenerationLease(
    lease.id,
    lease.attemptToken,
    participantId
  )
}

export async function abortGenerationLease({
  participantId,
  lease,
}: {
  participantId: string
  lease: CardGenerationLease
}) {
  return abortCardGenerationLease(lease.id, lease.attemptToken, participantId)
}

export type { CardGenerationLease }
