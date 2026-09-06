import { CreditResetPeriod } from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatUsageCreditsFindUnique: vi.fn(),
  chatbotFindUnique: vi.fn(),
  atomicDecrementCredits: vi.fn(),
  atomicInitializeCredits: vi.fn(),
  atomicResetCreditsIfNeeded: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatUsageCredits: {
      findUnique: mocks.chatUsageCreditsFindUnique,
    },
    chatbot: {
      findUnique: mocks.chatbotFindUnique,
    },
  },
}))

vi.mock('../src/utils/transactions', () => ({
  atomicDecrementCredits: mocks.atomicDecrementCredits,
  atomicInitializeCredits: mocks.atomicInitializeCredits,
  atomicResetCreditsIfNeeded: mocks.atomicResetCreditsIfNeeded,
}))

import { CreditsService } from '../src/services/credits'

function decimal(value: number) {
  return { toNumber: () => value }
}

describe('CreditsService.previewUserCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    expect(mocks.atomicDecrementCredits).not.toHaveBeenCalled()
    expect(mocks.atomicInitializeCredits).not.toHaveBeenCalled()
    expect(mocks.atomicResetCreditsIfNeeded).not.toHaveBeenCalled()
  })

  test('returns configured initial credits for a missing record without writing', async () => {
    mocks.chatUsageCreditsFindUnique.mockResolvedValue(null)
    mocks.chatbotFindUnique.mockResolvedValue({
      creditInitialCredits: 3,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 2,
      creditMaxCredits: 5,
    })

    await expect(
      CreditsService.previewUserCredits('participant-1', 'chatbot-1')
    ).resolves.toEqual({ current: 3, total: 5 })
  })

  test('returns an existing NONE-period balance without writing', async () => {
    mocks.chatUsageCreditsFindUnique.mockResolvedValue({
      current: decimal(0),
      total: decimal(5),
      periodStartedAt: new Date(0),
      createdAt: new Date(0),
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      creditInitialCredits: 1,
      creditResetPeriod: CreditResetPeriod.NONE,
      creditResetAmount: 2,
      creditMaxCredits: 5,
    })

    await expect(
      CreditsService.previewUserCredits('participant-1', 'chatbot-1')
    ).resolves.toEqual({ current: 0, total: 5 })
  })

  test('computes an expired-period reset without writing', async () => {
    mocks.chatUsageCreditsFindUnique.mockResolvedValue({
      current: decimal(2),
      total: decimal(3),
      periodStartedAt: new Date(0),
      createdAt: new Date(0),
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      creditInitialCredits: 1,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 2,
      creditMaxCredits: 5,
    })

    await expect(
      CreditsService.previewUserCredits('participant-1', 'chatbot-1')
    ).resolves.toEqual({ current: 4, total: 5 })
  })
})
