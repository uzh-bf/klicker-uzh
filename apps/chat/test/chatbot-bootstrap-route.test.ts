import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getChatbotOr404: vi.fn(),
  withChatbotAuth: vi.fn(),
  getUserCredits: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  getChatbotOr404: mocks.getChatbotOr404,
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@/src/services/credits', () => ({
  CreditsService: { getUserCredits: mocks.getUserCredits },
}))

import { GET as getCredits } from '../src/app/api/chatbots/[chatbotId]/credits/route'
import { GET } from '../src/app/api/chatbots/[chatbotId]/route'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

describe('chatbot bootstrap route', () => {
  afterEach(() => vi.unstubAllEnvs())
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
        customModeConfig: null,
        mcpConfigurations: [],
      },
    })
  })

  test.each([
    'anonymous',
    'account',
  ])('exposes the safety model only for %s bootstrap', async (authMode) => {
    vi.stubEnv(
      'CHAT_MODEL_REGISTRY_JSON',
      JSON.stringify([
        {
          id: 'auto',
          name: 'Auto',
          deploymentId: 'router',
          maxOutputTokens: 512,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'advanced-choice',
          name: 'Primary',
          deploymentId: 'primary',
          maxOutputTokens: 512,
          usageClass: 'ADVANCED',
          fallback: true,
          cost: { input: 1, output: 1 },
        },
        {
          id: 'safe-base',
          name: 'Safety',
          deploymentId: 'base',
          maxOutputTokens: 512,
          usageClass: 'BASE',
          fallback: true,
          supportsReasoning: true,
          supportedReasoningEfforts: ['low', 'high'],
          cost: { input: 0, output: 0 },
        },
      ])
    )
    vi.stubEnv('CHAT_FALLBACK_MODEL_ID', 'safe-base')
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', 'advanced-choice')
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      authMode,
    })
    mocks.getUserCredits.mockResolvedValue({ current: 0, total: 5 })
    mocks.getChatbotOr404.mockResolvedValue({
      chatbot: {
        allowedModelIds: ['advanced-choice'],
        allowedReasoningEffortsByModel: { 'safe-base': ['low'] },
        creditResetPeriod: null,
      },
    })
    const response = await getCredits(
      new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}/credits`),
      {
        params: Promise.resolve({ chatbotId: CHATBOT_ID }),
      }
    )
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.availableModels).toHaveLength(1)
    expect(payload.automaticModelId).toBe(
      authMode === 'anonymous' ? 'safe-base' : 'advanced-choice'
    )
    expect(payload.availableModels[0].id).toBe(payload.automaticModelId)
    if (authMode === 'anonymous')
      expect(payload.availableModels[0].allowedReasoningEfforts).toEqual([
        'low',
      ])
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
    expect(typeof payload.modeOptions.tutor.description).toBe('string')
    expect(JSON.stringify(payload)).not.toContain('private prompt')
    expect(mocks.getChatbotOr404.mock.calls[0]?.[1]).toMatchObject({
      standardModeConfig: true,
      customModeConfig: true,
    })
  })

  test('offers approved custom modes without leaking unapproved stored keys', async () => {
    mocks.getChatbotOr404.mockResolvedValueOnce({
      chatbot: {
        modelSelection: true,
        systemPrompts: {
          tutor: {
            prompt: 'private prompt',
            description: 'Tutor description',
          },
          'Draft-Mode': {
            prompt: 'drafted prompt',
            description: 'Draft mode description',
          },
        },
        standardModeConfig: null,
        customModeConfig: {
          modes: [
            {
              key: 'cm_0d1f2c3b-4a59-4e6f-8b7a-9c8d7e6f5a4b',
              name: 'Ethik-Rollenspiel',
              description: 'Practises ethical reasoning in a role play.',
              personaText: 'Act as the role-play counterpart.',
            },
          ],
        },
        mcpConfigurations: [],
      },
    })

    const response = await GET(
      new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}`),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    const payload = await response.json()
    expect(payload.modeOptions).toEqual({
      explainer: expect.objectContaining({ description: expect.any(String) }),
      tutor: expect.objectContaining({ description: expect.any(String) }),
      'cm_0d1f2c3b-4a59-4e6f-8b7a-9c8d7e6f5a4b': {
        description: 'Practises ethical reasoning in a role play.',
        name: 'Ethik-Rollenspiel',
      },
    })
    expect(payload.modeOptions['Draft-Mode']).toBeUndefined()
    expect(JSON.stringify(payload)).not.toContain('drafted prompt')
  })

  test('honours typed mode availability in the participant bootstrap', async () => {
    mocks.getChatbotOr404.mockResolvedValueOnce({
      chatbot: {
        modelSelection: true,
        systemPrompts: null,
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          quizzerEnabled: false,
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
        explainer: expect.objectContaining({
          description: expect.any(String),
        }),
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
