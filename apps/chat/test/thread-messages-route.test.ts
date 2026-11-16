import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  chatbotFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: { findUnique: mocks.chatbotFindUnique },
    chatMessage: { findMany: mocks.messageFindMany },
  },
}))

import { GET } from '@/src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/route'

function assistantMessage(id: string, chatMode: string) {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    threadId: 'thread-1',
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'Private case fact.' },
      { type: 'text', text: 'Answer.' },
    ],
    chatMode,
    modelId: 'gpt-6-luna',
    reasoningEffort: 'high',
    reasoningContent: 'Private case fact.',
    learningContext: null,
    rating: null,
    creditsUsed: null,
    attachments: [],
    parentId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function loadHistory() {
  const response = await GET(
    new NextRequest(
      'http://localhost/api/chatbots/chatbot-1/threads/thread-1/messages'
    ),
    {
      params: Promise.resolve({ chatbotId: 'chatbot-1', threadId: 'thread-1' }),
    }
  )
  expect(response.status).toBe(200)
  return (await response.json()) as Array<{
    id: string
    content: Array<{ type: string }>
    reasoningContent: string | null
    reasoningEffort: string | null
  }>
}

describe('thread history route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      authMode: 'account',
      chatbot: { courseId: 'course-1', knowledgeGraphVisible: false },
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      customModeConfig: {
        modes: [
          {
            key: 'cm_hidden',
            name: 'Case interview',
            description: null,
            personaText: 'Keep the case facts private.',
          },
          {
            key: 'cm_shown',
            name: 'Worked examples',
            description: null,
            personaText: null,
            showReasoning: true,
          },
        ],
      },
    })
  })

  test('returns stored reasoning only for modes that show it to participants', async () => {
    mocks.messageFindMany.mockResolvedValue([
      assistantMessage('standard', 'tutor'),
      assistantMessage('hidden', 'cm_hidden'),
      assistantMessage('shown', 'cm_shown'),
      assistantMessage('removed', 'cm_removed'),
    ])

    const history = await loadHistory()
    const byId = new Map(history.map((message) => [message.id, message]))

    for (const id of ['standard', 'shown']) {
      expect(byId.get(id)?.reasoningContent).toBe('Private case fact.')
      expect(byId.get(id)?.content.map((part) => part.type)).toEqual([
        'reasoning',
        'text',
      ])
    }
    for (const id of ['hidden', 'removed']) {
      expect(byId.get(id)?.reasoningContent).toBeNull()
      expect(byId.get(id)?.content.map((part) => part.type)).toEqual(['text'])
      expect(byId.get(id)?.reasoningEffort).toBe('high')
    }
  })
})
