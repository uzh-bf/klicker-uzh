import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findChatbot: vi.fn(),
  rateLimitCheck: vi.fn(),
  withOwnerPreviewAuth: vi.fn(),
}))

vi.mock('@/src/lib/server/ownerPreviewAuth', () => ({
  withOwnerPreviewAuth: mocks.withOwnerPreviewAuth,
}))

vi.mock('@/src/services/rateLimiter', () => ({
  createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}))

vi.mock('@klicker-uzh/prisma/client', () => ({
  Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } },
}))

vi.mock('@klicker-uzh/prisma', () => {
  const tx = {
    chatbot: { findUnique: mocks.findChatbot },
    participation: { findMany: async () => [] },
    participantInvitation: { findMany: async () => [] },
    chatThread: { findMany: async () => [] },
  }
  return {
    prisma: {
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})

import { GET } from '@/src/app/api/manage/chatbots/[chatbotId]/export/route'

function exportRequest() {
  return GET(
    new NextRequest(
      'https://chat.example.test/api/manage/chatbots/bot-1/export?format=json'
    ),
    { params: Promise.resolve({ chatbotId: 'bot-1' }) }
  )
}

function chatbotInCourse(isAssessmentEnabled: boolean) {
  return {
    id: 'bot-1',
    name: 'Bot',
    course: { id: 'course-1', name: 'Course', isAssessmentEnabled },
  }
}

describe('conversation export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withOwnerPreviewAuth.mockResolvedValue({
      scope: 'ACCOUNT_OWNER',
      userId: 'owner-id',
    })
    mocks.rateLimitCheck.mockReturnValue({
      allowed: true,
      remaining: 29,
      retryAfterMs: 0,
    })
  })

  it('refuses chatbots of regular courses', async () => {
    mocks.findChatbot.mockResolvedValue(chatbotInCourse(false))

    const response = await exportRequest()

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: 'EXPORT_ASSESSMENT_ONLY',
    })
  })

  it('exports chatbots of assessment courses', async () => {
    mocks.findChatbot.mockResolvedValue(chatbotInCourse(true))

    const response = await exportRequest()

    expect(response.status).toBe(200)
  })
})
