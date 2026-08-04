import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useChatResponse } from '../src/hooks/useChatResponse'

const { mockUseChatStore } = vi.hoisted(() => ({
  mockUseChatStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
  }),
}))

const loadCreditsMock = vi.fn().mockResolvedValue(undefined)

vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'chatbot-1' }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

  test('network-level send failure shows a localized error bubble instead of failing silently', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'))
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
          content: [{ type: 'text', text: 'hello' }],
          parentId: null,
        },
      ] as any,
      'thread-1'
    )

    const messages = storeState.threads[0]?.messages ?? []
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      id: 'assistant-message-id',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: expect.stringContaining('chat.response.networkError'),
        },
      ],
    })
  })

  test('a stream error part stops the read loop cleanly instead of stacking a connection-interrupted suffix', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"partial answer"}',
          'data: {"type":"error","errorText":"boom"}',
          'data: {"type":"text-delta","delta":" should not be appended"}',
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
          content: [{ type: 'text', text: 'hello' }],
          parentId: null,
        },
      ] as any,
      'thread-1'
    )

    const finalMessage = storeState.threads[0]?.messages.at(-1)
    const content = finalMessage?.content as Array<{
      type: string
      text?: string
    }>

    // exactly one error part landed — the interrupted-connection suffix must
    // not also stack on top of it
    const errorParts = content.filter((part) =>
      part.text?.includes('chat.response.genericError')
    )
    expect(errorParts).toHaveLength(1)

    const interruptedParts = content.filter((part) =>
      part.text?.includes('chat.response.connectionInterrupted')
    )
    expect(interruptedParts).toHaveLength(0)

    // the text-delta received after the error part must not have been
    // processed
    expect(
      content.some((part) => part.text?.includes('should not be appended'))
    ).toBe(false)
  })
})
