import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  getChatbotOr404: vi.fn(),
  notFound: vi.fn(),
  resolveParticipantIdentity: vi.fn(),
  authorizeIdentityForChatbot: vi.fn(),
  assistant: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('../src/components/assistant', () => ({
  Assistant: mocks.assistant,
}))

vi.mock('../src/lib/server/apiGuards', () => ({
  getChatbotOr404: mocks.getChatbotOr404,
  resolveParticipantIdentity: mocks.resolveParticipantIdentity,
  authorizeIdentityForChatbot: mocks.authorizeIdentityForChatbot,
}))

import ChatLayout from '../src/app/[chatbotId]/layout'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const SCOPE_TOKEN = 'forwarded-scope-token'

function cookieStore(values: Record<string, string>) {
  return {
    get: vi.fn((name: string) =>
      name in values ? { value: values[name] } : undefined
    ),
  }
}

function headerStore(values: Record<string, string>) {
  return {
    get: vi.fn((name: string) => values[name]),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cookies.mockResolvedValue(
    cookieStore({ participant_token: 'participant-token' })
  )
  mocks.headers.mockResolvedValue(headerStore({}))
  mocks.resolveParticipantIdentity.mockResolvedValue({
    participantId: 'participant-1',
    authMode: 'account',
  })
  mocks.authorizeIdentityForChatbot.mockResolvedValue({
    participantId: 'participant-1',
    authMode: 'account',
    chatbot: { courseId: 'course-1' },
  })
  mocks.getChatbotOr404.mockResolvedValue({
    chatbot: {
      id: CHATBOT_ID,
      name: 'Course chatbot',
      avatar: null,
      systemPrompts: null,
      standardModeConfig: null,
      knowledgeGraphVisible: true,
      mcpConfigurations: [],
    },
  })
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found')
  })
})

describe('chatbot layout access', () => {
  test('resolves the cookie transports before rendering chatbot data', async () => {
    const layout = await ChatLayout({
      children: null,
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(mocks.resolveParticipantIdentity).toHaveBeenCalledWith({
      participantToken: 'participant-token',
      chatGuestToken: undefined,
      pwaEmbedToken: undefined,
      scopedFallbackToken: undefined,
    })
    expect(mocks.authorizeIdentityForChatbot).toHaveBeenCalledWith(
      { participantId: 'participant-1', authMode: 'account' },
      CHATBOT_ID
    )
    const authorizationOrder =
      mocks.authorizeIdentityForChatbot.mock.invocationCallOrder[0] ?? -1
    const chatbotFetchOrder =
      mocks.getChatbotOr404.mock.invocationCallOrder[0] ?? -1
    expect(authorizationOrder).toBeLessThan(chatbotFetchOrder)
    expect(mocks.getChatbotOr404.mock.calls[0]?.[1]).toMatchObject({
      standardModeConfig: true,
      knowledgeGraphVisible: true,
    })
    expect(layout.props.children[0].props).toMatchObject({
      chatbot: { id: CHATBOT_ID },
      knowledgeGraphVisible: true,
    })
  })

  test('re-verifies the token forwarded in the reserved request header', async () => {
    mocks.cookies.mockResolvedValue(cookieStore({}))
    mocks.headers.mockResolvedValue(
      headerStore({ 'x-chat-scoped-token': SCOPE_TOKEN })
    )
    mocks.resolveParticipantIdentity.mockResolvedValue({
      participantId: 'guest-1',
      authMode: 'anonymous',
    })

    await ChatLayout({
      children: null,
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    // The layout hands the header value to the shared resolver, which verifies
    // its signature; the header never carries an identity of its own.
    expect(mocks.resolveParticipantIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ scopedFallbackToken: SCOPE_TOKEN })
    )
    expect(mocks.authorizeIdentityForChatbot).toHaveBeenCalledWith(
      { participantId: 'guest-1', authMode: 'anonymous' },
      CHATBOT_ID
    )
  })

  test('does not load chatbot data when participant access fails', async () => {
    mocks.resolveParticipantIdentity.mockResolvedValue({
      response: Response.json({ error: 'unauthorized' }, { status: 401 }),
    })

    await expect(
      ChatLayout({
        children: null,
        params: Promise.resolve({ chatbotId: CHATBOT_ID }),
      })
    ).rejects.toThrow('not found')

    expect(mocks.authorizeIdentityForChatbot).not.toHaveBeenCalled()
    expect(mocks.getChatbotOr404).not.toHaveBeenCalled()
  })

  test('does not load chatbot data when authorization fails', async () => {
    mocks.authorizeIdentityForChatbot.mockResolvedValue({
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
