import {
  abortCardGenerationLease,
  claimCardGenerationLease,
  completeCardGenerationLease,
  type PersonalElementServiceContext,
} from '@klicker-uzh/graphql/dist/server'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

type CardGenerationLease = {
  id: string
  attemptToken: string
}

function serviceContext(
  prisma: PrismaClient,
  participantId: string
): PersonalElementServiceContext {
  return { prisma, participantId }
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
  prisma,
  participantId,
  planMessageId,
  planToolCallId,
  attemptToken,
}: {
  prisma: PrismaClient
  participantId: string
  planMessageId: string
  planToolCallId: string
  attemptToken: string
}): Promise<CardGenerationLease> {
  const lease = await claimCardGenerationLease(
    { planMessageId, planToolCallId, attemptToken },
    serviceContext(prisma, participantId)
  )
  return { id: lease.id, attemptToken }
}

export async function completeGenerationLease({
  prisma,
  participantId,
  lease,
}: {
  prisma: PrismaClient
  participantId: string
  lease: CardGenerationLease
}) {
  return completeCardGenerationLease(
    lease.id,
    lease.attemptToken,
    serviceContext(prisma, participantId)
  )
}

export async function abortGenerationLease({
  prisma,
  participantId,
  lease,
}: {
  prisma: PrismaClient
  participantId: string
  lease: CardGenerationLease
}) {
  return abortCardGenerationLease(
    lease.id,
    lease.attemptToken,
    serviceContext(prisma, participantId)
  )
}

export type { CardGenerationLease }
