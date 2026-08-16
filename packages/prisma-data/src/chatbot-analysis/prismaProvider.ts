import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'

import type { AnalysisMessage, AnalysisRecordProvider } from './core.js'

const messageSelect = {
  id: true,
  parentId: true,
  role: true,
  chatMode: true,
  modelId: true,
  rating: true,
  creditsUsed: true,
  createdAt: true,
  attachments: { select: { id: true } },
  thread: {
    select: {
      id: true,
      participantId: true,
      chatbot: { select: { id: true, courseId: true } },
    },
  },
} as const satisfies Prisma.ChatMessageSelect

type MessageRow = Prisma.ChatMessageGetPayload<{ select: typeof messageSelect }>

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const decimal = value as { toNumber?: () => number }
  if (typeof decimal.toNumber === 'function') return decimal.toNumber()
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toAnalysisMessage(message: MessageRow): AnalysisMessage {
  return {
    id: message.id,
    threadId: message.thread.id,
    participantId: message.thread.participantId,
    chatbotId: message.thread.chatbot.id,
    courseId: message.thread.chatbot.courseId,
    parentId: message.parentId,
    role: message.role,
    createdAt: message.createdAt,
    rating: message.rating,
    // Aggregate reporting does not inspect or emit message content.
    text: '',
    attachmentCount: message.attachments.length,
    creditsUsed: decimalToNumber(message.creditsUsed),
    chatMode: message.chatMode,
    modelId: message.modelId,
  }
}

export function createPrismaAnalysisRecordProvider(
  courseId: string
): AnalysisRecordProvider {
  return {
    loadMessages: async ({ from, to }) => {
      const selected = await prisma.chatMessage.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          thread: { chatbot: { courseId } },
        },
        select: messageSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      const userIds = selected
        .filter((message) => message.role === 'user')
        .map((message) => message.id)
      const replies =
        userIds.length === 0
          ? []
          : await prisma.chatMessage.findMany({
              where: {
                parentId: { in: userIds },
                role: 'assistant',
                createdAt: { gt: to },
                thread: { chatbot: { courseId } },
              },
              select: messageSelect,
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            })

      return [...selected, ...replies]
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id)
        )
        .map(toAnalysisMessage)
    },
    // An authoritative effective-dated eligibility source does not exist yet.
    // Empty decisions make every database-backed aggregate run fail closed.
    loadEligibility: async () => [],
  }
}
