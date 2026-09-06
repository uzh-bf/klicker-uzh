import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getChatbotOr404: vi.fn(),
  notFound: vi.fn(),
  withChatbotTokenAuth: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('../src/components/assistant', () => ({
  Assistant: vi.fn(),
}))

vi.mock('../src/lib/server/apiGuards', () => ({
  getChatbotOr404: mocks.getChatbotOr404,
  withChatbotTokenAuth: mocks.withChatbotTokenAuth,
}))

import ChatLayout from '../src/app/[chatbotId]/layout'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

describe('chatbot layout access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'participant-token' }),
    })
    mocks.withChatbotTokenAuth.mockResolvedValue({
      participantId: 'participant-1',
      chatbot: { courseId: 'course-1' },
    })
    mocks.getChatbotOr404.mockResolvedValue({
      chatbot: {
        id: CHATBOT_ID,
        name: 'Course chatbot',
        avatar: null,
        systemPrompts: null,
        standardModeConfig: null,
        mcpConfigurations: [],
      },
    })
    mocks.notFound.mockImplementation(() => {
      throw new Error('not found')
    })
  })

  test('authorizes the participant token before rendering chatbot data', async () => {
    await ChatLayout({
      children: null,
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(mocks.withChatbotTokenAuth).toHaveBeenCalledWith(
      'participant-token',
      CHATBOT_ID
    )
    expect(mocks.getChatbotOr404).toHaveBeenCalledAfter(
      mocks.withChatbotTokenAuth
    )
    expect(mocks.getChatbotOr404.mock.calls[0]?.[1]).toMatchObject({
      standardModeConfig: true,
    })
  })

  test('does not load chatbot data when participant access fails', async () => {
    mocks.withChatbotTokenAuth.mockResolvedValue({
      response: Response.json({ error: 'forbidden' }, { status: 403 }),
    })

    await expect(
      ChatLayout({
        children: null,
        params: Promise.resolve({ chatbotId: CHATBOT_ID }),
      })
    ).rejects.toThrow('not found')
    expect(mocks.getChatbotOr404).not.toHaveBeenCalled()
  })
})
