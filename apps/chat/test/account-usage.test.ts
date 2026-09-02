import { Prisma } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEffectiveChatAccountUsage: vi.fn(),
  prisma: {
    chatMessage: { updateMany: vi.fn() },
  },
  transaction: {
    chatAccountUsage: { upsert: vi.fn() },
    chatMessage: { updateMany: vi.fn(), findUnique: vi.fn() },
    chatThread: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  decrementCreditsInTransaction: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  getEffectiveChatAccountUsage: mocks.getEffectiveChatAccountUsage,
  prisma: mocks.prisma,
}))
vi.mock('../src/utils/transactions', () => ({
  withTransaction: mocks.withTransaction,
}))
vi.mock('../src/services/credits', () => ({
  CreditsService: {
    decrementCreditsInTransaction: mocks.decrementCreditsInTransaction,
  },
}))

import {
  finalizeChatTurn,
  roundChatUsageCredits,
} from '../src/services/accountUsage'

describe('account usage credit rounding', () => {
  test('rounds once to the persisted six-decimal precision', () => {
    expect(roundChatUsageCredits(0.1234564).toString()).toBe('0.123456')
    expect(roundChatUsageCredits(0.1234565).toString()).toBe('0.123457')
  })

  test.each([
    -1,
    Number.POSITIVE_INFINITY,
    Number.NaN,
  ])('rejects invalid usage value %s', (value) => {
    expect(() => roundChatUsageCredits(value)).toThrow(RangeError)
  })

  test('rejects the first value beyond Decimal(18,6)', () => {
    expect(() => roundChatUsageCredits(1e12)).toThrow(RangeError)
  })
})

describe('account usage finalization errors', () => {
  test('propagates a later uniqueness error without duplicate verification', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'synthetic account usage uniqueness error',
      { code: 'P2002', clientVersion: 'test' }
    )
    mocks.withTransaction.mockImplementation(async (operation) =>
      operation(mocks.transaction)
    )
    mocks.transaction.chatThread.findFirst.mockResolvedValue({ id: 'thread-1' })
    mocks.transaction.chatMessage.updateMany.mockResolvedValue({ count: 1 })
    mocks.getEffectiveChatAccountUsage.mockResolvedValue({
      budgetCredits: new Prisma.Decimal('10'),
    })
    mocks.transaction.chatAccountUsage.upsert.mockRejectedValue(error)

    await expect(
      finalizeChatTurn({
        ownerId: 'owner-1',
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        usageClass: 'BASE',
        threadId: 'thread-1',
        assistantMessageId: 'message-1',
        lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
        parentId: null,
        content: [],
        chatMode: 'tutor',
        modelId: 'model-1',
        reasoningEffort: null,
        reasoningContent: null,
        rawCreditsUsed: 0.25,
        now: new Date('2026-08-15T12:00:00.000Z'),
      })
    ).rejects.toBe(error)

    expect(mocks.transaction.chatMessage.findUnique).not.toHaveBeenCalled()
  })
})
