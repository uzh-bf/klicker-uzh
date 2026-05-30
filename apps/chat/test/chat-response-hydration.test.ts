import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useChatResponse } from '../src/hooks/useChatResponse'

const { mockUseChatContextStore, mockUseChatStore } = vi.hoisted(() => ({
  mockUseChatContextStore: vi.fn(),
  mockUseChatStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
  }),
}))

const loadCreditsMock = vi.fn().mockResolvedValue(undefined)

vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'chatbot-1' }),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  return {
    ...actual,
    useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
    useRef: <T>(initialValue: T) => ({ current: initialValue }),
  }
})

vi.mock('../src/lib/utils/chatUtils', () => ({
  generateId: () => 'assistant-message-id',
}))

vi.mock('../src/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    loadCredits: loadCreditsMock,
  }),
}))

vi.mock('../src/stores/chatStore', () => ({
  useChatStore: mockUseChatStore,
}))

vi.mock('../src/stores/chatContextStore', () => ({
  useChatContextStore: mockUseChatContextStore,
}))

type MockThread = {
  id: string
  messages: any[]
  allMessages?: any[]
  isRunning?: boolean
}

type MockState = {
  threads: MockThread[]
  ensureFullImageAttachments: ReturnType<typeof vi.fn>
}

let storeState: MockState

function createStreamingResponse(lines: string[]) {
  const encoder = new TextEncoder()

  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`${lines.join('\n')}\n`))
        controller.close()
      },
    }),
  }
}

describe('useChatResponse attachment hydration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    storeState = {
      threads: [
        {
          id: 'thread-1',
          messages: [],
          allMessages: [],
          isRunning: false,
        },
      ],
      ensureFullImageAttachments: vi.fn(),
    }

    mockUseChatContextStore.mockReset()
    mockUseChatContextStore.mockImplementation((selector: any) =>
      selector({ context: null })
    )

    mockUseChatStore.mockReset()
    mockUseChatStore.mockReturnValue(undefined)
    mockUseChatStore.getState.mockImplementation(() => storeState)
    mockUseChatStore.setState.mockImplementation((updater: any) => {
      const partial =
        typeof updater === 'function' ? updater(storeState) : updater

      storeState = {
        ...storeState,
        ...partial,
      }
    })

    loadCreditsMock.mockClear()
  })

  test('hydrates a historical preview-only trigger message before submit', async () => {
    storeState.threads = [
      {
        id: 'thread-1',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: [{ type: 'text', text: 'retry this' }],
            parentId: null,
            imageAttachments: [
              {
                id: 'att-1',
                type: 'image' as const,
                position: 0,
                imagePreviewBase64: 'preview-1',
                imageDescription: 'attachment',
                hasFullImage: false,
              },
            ],
          },
        ],
        allMessages: [
          {
            id: 'message-1',
            role: 'user',
            content: [{ type: 'text', text: 'retry this' }],
            parentId: null,
            imageAttachments: [
              {
                id: 'att-1',
                type: 'image' as const,
                position: 0,
                imagePreviewBase64: 'preview-1',
                imageDescription: 'attachment',
                hasFullImage: false,
              },
            ],
          },
        ],
        isRunning: false,
      },
    ]

    const hydratedMessage = {
      id: 'message-1',
      role: 'user',
      content: [{ type: 'text', text: 'retry this' }],
      parentId: null,
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image' as const,
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    }

    storeState.ensureFullImageAttachments.mockResolvedValue(hydratedMessage)

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hello"}',
          'data: {"type":"finish","messageMetadata":{"chatMode":"chat","modelId":"model-1","reasoningEffort":"medium"}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchSpy)

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse(
      [
        {
          id: 'message-1',
          role: 'user',
          content: [{ type: 'text', text: 'retry this' }],
          parentId: null,
          imageAttachments: [
            {
              id: 'att-1',
              type: 'image' as const,
              position: 0,
              imagePreviewBase64: 'preview-1',
              imageDescription: 'attachment',
              hasFullImage: false,
            },
          ],
        },
      ] as any,
      'thread-1'
    )

    expect(storeState.ensureFullImageAttachments).toHaveBeenCalledWith(
      'chatbot-1',
      'thread-1',
      'message-1'
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      images: ['full-1'],
    })
    expect(storeState.threads[0]?.messages[0]).toMatchObject({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })
    expect(storeState.threads[0]?.allMessages?.[0]).toMatchObject({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })
  })

  test('hydrates edited messages using their persisted attachment source id', async () => {
    storeState.ensureFullImageAttachments.mockResolvedValue({
      id: 'edited-message-id',
      role: 'user',
      content: [{ type: 'text', text: 'retry this' }],
      parentId: null,
      attachmentSourceMessageId: 'persisted-message-1',
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image' as const,
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hello"}',
          'data: {"type":"finish","messageMetadata":{"chatMode":"chat","modelId":"model-1","reasoningEffort":"medium"}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchSpy)

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse(
      [
        {
          id: 'edited-message-id',
          role: 'user',
          content: [{ type: 'text', text: 'retry this' }],
          parentId: null,
          attachmentSourceMessageId: 'persisted-message-1',
          imageAttachments: [
            {
              id: 'att-1',
              type: 'image' as const,
              position: 0,
              imagePreviewBase64: 'preview-1',
              imageDescription: 'attachment',
              hasFullImage: false,
            },
          ],
        },
      ] as any,
      'thread-1'
    )

    expect(storeState.ensureFullImageAttachments).toHaveBeenCalledWith(
      'chatbot-1',
      'thread-1',
      'edited-message-id',
      'persisted-message-1'
    )
  })

  test('sends embedded chat context with the chat request', async () => {
    const context = {
      version: 1,
      source: 'pwa',
      surface: 'practice-quiz',
      locale: 'en',
      courseId: 'course-1',
      activity: { type: 'practiceQuiz', id: 'quiz-1' },
      question: {
        stackId: '10',
        elementInstanceId: 20,
        type: 'SC',
        contentPreview: 'What is opportunity cost?',
        currentStep: 1,
        totalSteps: 3,
      },
    }
    mockUseChatContextStore.mockImplementation((selector: any) =>
      selector({ context })
    )

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hello"}',
          'data: {"type":"finish","messageMetadata":{"chatMode":"chat","modelId":"model-1","reasoningEffort":"medium"}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchSpy)

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse(
      [
        {
          id: 'message-1',
          role: 'user',
          content: [{ type: 'text', text: 'help me' }],
          parentId: null,
        },
      ] as any,
      'thread-1'
    )

    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      chatContext: context,
    })
  })

  test('same-session local full images are sent directly without hydration', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hello"}',
          'data: {"type":"finish","messageMetadata":{"chatMode":"chat","modelId":"model-1","reasoningEffort":"medium"}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchSpy)

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse(
      [
        {
          id: 'local-message-1',
          role: 'user',
          content: [{ type: 'text', text: 'retry this' }],
          parentId: null,
          imageAttachments: [
            {
              type: 'image' as const,
              position: 0,
              imageBase64: 'full-local-1',
              imagePreviewBase64: 'preview-local-1',
              hasFullImage: true,
            },
          ],
        },
      ] as any,
      'thread-1'
    )

    expect(storeState.ensureFullImageAttachments).not.toHaveBeenCalled()
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      images: ['full-local-1'],
    })
  })

  test('failed hydration keeps attachments intact and aborts instead of submitting', async () => {
    storeState.ensureFullImageAttachments.mockResolvedValue({
      id: 'message-1',
      role: 'user',
      content: [{ type: 'text', text: 'retry this' }],
      parentId: null,
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image' as const,
          position: 0,
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: false,
        },
      ],
    })

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const messagesToSend = [
      {
        id: 'message-1',
        role: 'user',
        content: [{ type: 'text', text: 'retry this' }],
        parentId: null,
        imageAttachments: [
          {
            id: 'att-1',
            type: 'image' as const,
            position: 0,
            imagePreviewBase64: 'preview-1',
            imageDescription: 'attachment',
            hasFullImage: false,
          },
        ],
      },
    ]

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse(messagesToSend as any, 'thread-1')

    expect(storeState.ensureFullImageAttachments).toHaveBeenCalledWith(
      'chatbot-1',
      'thread-1',
      'message-1'
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(messagesToSend[0]?.imageAttachments).toEqual([
      {
        id: 'att-1',
        type: 'image',
        position: 0,
        imagePreviewBase64: 'preview-1',
        imageDescription: 'attachment',
        hasFullImage: false,
      },
    ])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not be loaded')
    )
  })
})
