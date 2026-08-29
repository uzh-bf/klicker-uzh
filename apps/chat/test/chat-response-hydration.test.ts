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
  useSettingsStore: (selector?: (state: any) => unknown) => {
    const state = { loadCredits: loadCreditsMock }
    return selector ? selector(state) : state
  },
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

describe('useChatResponse authoritative attachment requests', () => {
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

  test('sends a historical preview-only image as a persisted reference', async () => {
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

    expect(storeState.ensureFullImageAttachments).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      trigger: {
        id: 'message-1',
        parentId: null,
        text: 'retry this',
        attachments: [{ type: 'persisted-image', id: 'att-1' }],
      },
    })
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty(
      'messages'
    )
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty(
      'images'
    )
    expect(storeState.threads[0]?.messages[0]).toMatchObject({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: false,
        },
      ],
    })
    expect(storeState.threads[0]?.allMessages?.[0]).toMatchObject({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: false,
        },
      ],
    })
  })

  test('sends edited retained images as persisted references', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hello"}',
          'data: {"type":"finish","messageMetadata":{"chatMode":"chat","modelId":"model-1","reasoningEffort":"medium","imageAttachments":[{"id":"new-binding-1","type":"image","position":0,"imagePreviewBase64":"preview-1","imageDescription":"attachment","hasFullImage":true}]}}',
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

    expect(storeState.ensureFullImageAttachments).not.toHaveBeenCalled()
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      trigger: {
        id: 'edited-message-id',
        attachments: [{ type: 'persisted-image', id: 'att-1' }],
      },
    })
    expect(storeState.threads[0]?.messages[0]).toMatchObject({
      id: 'edited-message-id',
      attachmentSourceMessageId: null,
      imageAttachments: [{ id: 'new-binding-1', position: 0 }],
    })
  })

  test('sends a same-session local image as a new raw binding', async () => {
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
      trigger: {
        id: 'local-message-1',
        attachments: [{ type: 'new-image', imageBase64: 'full-local-1' }],
      },
    })
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
          type: 'data',
          name: 'chat-error',
          data: {
            errorLabel: 'chat.response.errorLabel',
            message: 'chat.response.networkError',
          },
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
      name?: string
      data?: { errorLabel: string; message: string }
    }>

    // exactly one error part landed — the interrupted-connection suffix must
    // not also stack on top of it
    const errorParts = content.filter(
      (part) =>
        part.type === 'data' &&
        part.name === 'chat-error' &&
        part.data?.message === 'chat.response.genericError'
    )
    expect(errorParts).toHaveLength(1)

    const interruptedParts = content.filter((part) =>
      part.text?.includes('chat.response.connectionInterrupted')
    )
    expect(interruptedParts).toHaveLength(0)

    // the partial answer that streamed before the error must remain visible
    expect(
      content.some(
        (part) => part.type === 'text' && part.text === 'partial answer'
      )
    ).toBe(true)

    // the text-delta received after the error part must not have been
    // processed, and must not have been duplicated after the error block
    // either (see the `!hasStreamError` guard on the finalize-text step)
    expect(
      content.some((part) => part.text?.includes('should not be appended'))
    ).toBe(false)
    expect(content.filter((part) => part.type === 'text')).toHaveLength(1)
  })

  test('a non-ok response shows the localized error as a distinct data part, not markdown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    })
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
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: [
        {
          type: 'data',
          name: 'chat-error',
          data: {
            errorLabel: 'chat.response.errorLabel',
            message: 'chat.response.genericError',
          },
        },
      ],
    })
  })

  test('a truncated response (finishReason "length") appends the localized truncation notice', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"a long answer"}',
          'data: {"type":"finish","messageMetadata":{"finishReason":"length"}}',
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

    const truncationPart = content.find((part) =>
      part.text?.includes('chat.response.truncated')
    )
    expect(truncationPart).toBeDefined()
    // the hardcoded English literal this replaces must be gone
    expect(
      content.some((part) => part.text?.includes('Response truncated'))
    ).toBe(false)
  })

  test('an aborted request writes the stopped turn to both message arrays after the cancel resync', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(
      Object.assign(new Error('The user aborted a request.'), {
        name: 'AbortError',
      })
    )
    vi.stubGlobal('fetch', fetchSpy)

    const userMessage = {
      id: 'message-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
      parentId: null,
    }
    storeState.threads[0]!.messages = [userMessage]
    storeState.threads[0]!.allMessages = [userMessage]

    const { generateChatResponse } = useChatResponse(
      'model-1',
      'chat',
      'medium'
    )

    await generateChatResponse([userMessage] as any, 'thread-1')

    // The stopped-turn write is intentionally deferred one macrotask past
    // assistant-ui's own cancel resync; nothing may land synchronously.
    const messagesBeforeFlush = storeState.threads[0]?.messages ?? []
    expect(
      messagesBeforeFlush.some((message) => message.role === 'assistant')
    ).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 0))

    const stoppedTurn = {
      role: 'assistant',
      content: [{ type: 'data', name: 'chat-stopped', data: {} }],
    }
    expect(storeState.threads[0]?.messages).toEqual([
      expect.objectContaining({ id: 'message-1' }),
      expect.objectContaining(stoppedTurn),
    ])
    expect(storeState.threads[0]?.allMessages).toEqual([
      expect.objectContaining({ id: 'message-1' }),
      expect.objectContaining(stoppedTurn),
    ])
  })

  test('browser history is omitted from the canonical request body', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        createStreamingResponse([
          'data: {"type":"text-delta","delta":"hi"}',
          'data: {"type":"finish","messageMetadata":{}}',
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
          content: [{ type: 'text', text: 'first question' }],
          parentId: null,
        },
        {
          id: 'assistant-stopped',
          role: 'assistant',
          content: [{ type: 'data', name: 'chat-stopped', data: {} }],
          parentId: 'message-1',
        },
        {
          id: 'message-2',
          role: 'user',
          content: [{ type: 'text', text: 'second question' }],
          parentId: 'assistant-stopped',
        },
      ] as any,
      'thread-1'
    )

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('messages')
    expect(body.trigger).toMatchObject({
      id: 'message-2',
      parentId: 'assistant-stopped',
      text: 'second question',
    })
  })
})
