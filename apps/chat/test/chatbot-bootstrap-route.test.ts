import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getChatbotOr404: vi.fn(),
  withChatbotAuth: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  getChatbotOr404: mocks.getChatbotOr404,
  withChatbotAuth: mocks.withChatbotAuth,
}))

import { GET } from '../src/app/api/chatbots/[chatbotId]/route'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

describe('chatbot bootstrap route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      chatbot: { courseId: 'course-1' },
    })
    mocks.getChatbotOr404.mockResolvedValue({
      chatbot: {
        modelSelection: true,
        systemPrompts: {
          tutor: {
            prompt: 'private prompt',
            description: 'Tutor description',
          },
        },
        standardModeConfig: null,
        mcpConfigurations: [],
      },
    })
  })

  test('returns only participant-safe bootstrap data', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}`),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(Object.keys(payload)).toEqual(['modelSelection', 'modeOptions'])
    expect(payload.modelSelection).toBe(true)
    expect(typeof payload.modeOptions.tutor).toBe('string')
    expect(JSON.stringify(payload)).not.toContain('private prompt')
    expect(mocks.getChatbotOr404.mock.calls[0]?.[1]).toMatchObject({
      standardModeConfig: true,
    })
  })

  test('honours typed mode availability in the participant bootstrap', async () => {
    mocks.getChatbotOr404.mockResolvedValueOnce({
      chatbot: {
        modelSelection: true,
        systemPrompts: null,
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
        mcpConfigurations: [],
      },
    })

    const response = await GET(
      new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}`),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    const payload = await response.json()
    expect(payload).toMatchObject({
      modeOptions: {
        explainer: expect.any(String),
      },
    })
    expect(payload.modeOptions.tutor).toBeUndefined()
  })

  test('returns the authorization response without loading bootstrap data', async () => {
    mocks.withChatbotAuth.mockResolvedValue({
      response: Response.json({ error: 'forbidden' }, { status: 403 }),
    })

    const response = await GET(
      new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}`),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    expect(response.status).toBe(403)
    expect(mocks.getChatbotOr404).not.toHaveBeenCalled()
  })
})
