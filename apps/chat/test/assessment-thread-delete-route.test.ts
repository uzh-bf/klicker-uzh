import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  deleteThread: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@/src/services/threads', () => ({
  ThreadService: { deleteThread: mocks.deleteThread },
}))

import { DELETE } from '@/src/app/api/chatbots/[chatbotId]/threads/[threadId]/route'

function removeThread() {
  return DELETE(
    new NextRequest(
      'http://localhost/api/chatbots/chatbot-1/threads/thread-1',
      { method: 'DELETE' }
    ),
    {
      params: Promise.resolve({ chatbotId: 'chatbot-1', threadId: 'thread-1' }),
    }
  )
}

describe('thread deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({ participantId: 'participant-1' })
    mocks.deleteThread.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('is refused with 409 in assessment mode', async () => {
    vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')

    const response = await removeThread()

    expect(response.status).toBe(409)
    expect(mocks.deleteThread).not.toHaveBeenCalled()
  })

  test('still deletes in regular mode', async () => {
    const response = await removeThread()

    expect(response.status).toBe(200)
    expect(mocks.deleteThread).toHaveBeenCalledWith(
      'thread-1',
      'participant-1',
      'chatbot-1'
    )
  })
})
