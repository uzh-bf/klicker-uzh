import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  useChatStore,
  type ExtendedThreadMessageLike,
} from '../src/stores/chatStore'

function buildMessage({
  id,
  imageAttachments,
}: {
  id: string
  imageAttachments?: ExtendedThreadMessageLike['imageAttachments']
}): ExtendedThreadMessageLike {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text: `message-${id}` }],
    createdAt: new Date('2026-04-14T00:00:00.000Z'),
    imageAttachments,
  }
}

function resetStore() {
  useChatStore.setState({
    threads: [],
    activeThreadId: null,
    isLoading: false,
    participationRequired: false,
    participationMessage: null,
  })
}

describe('chatStore hydration', () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  test('hydrated cache hit backfills the other collection without fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Thread',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          isRunning: false,
          messages: [
            buildMessage({
              id: 'message-1',
              imageAttachments: [
                {
                  id: 'att-1',
                  type: 'image',
                  position: 0,
                  imagePreviewBase64: 'preview-1',
                  imageDescription: 'attachment',
                  hasFullImage: false,
                },
              ],
            }),
          ],
          allMessages: [
            buildMessage({
              id: 'message-1',
              imageAttachments: [
                {
                  id: 'att-1',
                  type: 'image',
                  position: 0,
                  imageBase64: 'full-1',
                  imagePreviewBase64: 'preview-1',
                  imageDescription: 'attachment',
                  hasFullImage: true,
                },
              ],
            }),
          ],
        },
      ],
      activeThreadId: 'thread-1',
    })

    const result = await useChatStore
      .getState()
      .ensureFullImageAttachments('chatbot-1', 'thread-1', 'message-1')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result?.imageAttachments?.[0]?.imageBase64).toBe('full-1')
    expect(
      useChatStore.getState().threads[0]?.messages[0]?.imageAttachments?.[0]
    ).toMatchObject({
      id: 'att-1',
      position: 0,
      imageBase64: 'full-1',
      imagePreviewBase64: 'preview-1',
      imageDescription: 'attachment',
      hasFullImage: true,
    })
  })

  test('network hydration updates both allMessages and active-path messages', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'att-2',
          type: 'image',
          position: 1,
          imageBase64: 'full-2',
          imagePreviewBase64: 'preview-2',
          imageDescription: 'second attachment',
          hasFullImage: true,
        },
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'first attachment',
          hasFullImage: true,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchSpy)

    const previewOnlyAttachments = [
      {
        id: 'att-2',
        type: 'image' as const,
        position: 1,
        imagePreviewBase64: 'preview-2',
        imageDescription: 'second attachment',
        hasFullImage: false,
      },
      {
        id: 'att-1',
        type: 'image' as const,
        position: 0,
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
        hasFullImage: false,
      },
    ]

    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Thread',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          isRunning: false,
          messages: [
            buildMessage({
              id: 'message-1',
              imageAttachments: previewOnlyAttachments,
            }),
          ],
          allMessages: [
            buildMessage({
              id: 'message-1',
              imageAttachments: previewOnlyAttachments,
            }),
          ],
        },
      ],
      activeThreadId: 'thread-1',
    })

    await useChatStore
      .getState()
      .ensureFullImageAttachments('chatbot-1', 'thread-1', 'message-1')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/chatbots/chatbot-1/threads/thread-1/messages/message-1/attachments',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )

    const thread = useChatStore.getState().threads[0]
    expect(thread?.messages[0]?.imageAttachments).toMatchObject([
      {
        id: 'att-1',
        position: 0,
        imageBase64: 'full-1',
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
        hasFullImage: true,
      },
      {
        id: 'att-2',
        position: 1,
        imageBase64: 'full-2',
        imagePreviewBase64: 'preview-2',
        imageDescription: 'second attachment',
        hasFullImage: true,
      },
    ])
    expect(thread?.allMessages[0]?.imageAttachments).toMatchObject([
      {
        id: 'att-1',
        position: 0,
        imageBase64: 'full-1',
      },
      {
        id: 'att-2',
        position: 1,
        imageBase64: 'full-2',
      },
    ])
  })

  test('can hydrate an edited local message from a different persisted source message id', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchSpy)

    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Thread',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          isRunning: false,
          messages: [
            buildMessage({
              id: 'edited-message-1',
              imageAttachments: [
                {
                  id: 'att-1',
                  type: 'image',
                  position: 0,
                  imagePreviewBase64: 'preview-1',
                  imageDescription: 'attachment',
                  hasFullImage: false,
                },
              ],
            }),
          ],
          allMessages: [
            buildMessage({
              id: 'persisted-message-1',
              imageAttachments: [
                {
                  id: 'att-1',
                  type: 'image',
                  position: 0,
                  imagePreviewBase64: 'preview-1',
                  imageDescription: 'attachment',
                  hasFullImage: false,
                },
              ],
            }),
            {
              ...buildMessage({
                id: 'edited-message-1',
                imageAttachments: [
                  {
                    id: 'att-1',
                    type: 'image',
                    position: 0,
                    imagePreviewBase64: 'preview-1',
                    imageDescription: 'attachment',
                    hasFullImage: false,
                  },
                ],
              }),
              attachmentSourceMessageId: 'persisted-message-1',
            },
          ],
        },
      ],
      activeThreadId: 'thread-1',
    })

    const result = await useChatStore
      .getState()
      .ensureFullImageAttachments(
        'chatbot-1',
        'thread-1',
        'edited-message-1',
        'persisted-message-1'
      )

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/chatbots/chatbot-1/threads/thread-1/messages/persisted-message-1/attachments',
      expect.any(Object)
    )
    expect(result?.id).toBe('edited-message-1')
    expect(result?.imageAttachments?.[0]).toMatchObject({
      id: 'att-1',
      imageBase64: 'full-1',
      imagePreviewBase64: 'preview-1',
      hasFullImage: true,
    })
    expect(
      useChatStore
        .getState()
        .threads[0]?.allMessages.find(
          (message) => message.id === 'edited-message-1'
        )?.imageAttachments?.[0]
    ).toMatchObject({
      id: 'att-1',
      imageBase64: 'full-1',
      imagePreviewBase64: 'preview-1',
      hasFullImage: true,
    })
  })

  test('cache hit skips fetch path when message is already hydrated everywhere', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const hydratedMessage = buildMessage({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })

    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Thread',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          isRunning: false,
          messages: [hydratedMessage],
          allMessages: [hydratedMessage],
        },
      ],
      activeThreadId: 'thread-1',
    })

    const result = await useChatStore
      .getState()
      .ensureFullImageAttachments('chatbot-1', 'thread-1', 'message-1')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result?.imageAttachments?.[0]?.imageBase64).toBe('full-1')
  })

  test('concurrent hydration calls dedupe the in-flight fetch by message', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchSpy)

    const previewOnlyMessage = buildMessage({
      id: 'message-1',
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: false,
        },
      ],
    })

    useChatStore.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Thread',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          isRunning: false,
          messages: [previewOnlyMessage],
          allMessages: [previewOnlyMessage],
        },
      ],
      activeThreadId: 'thread-1',
    })

    const promiseA = useChatStore
      .getState()
      .ensureFullImageAttachments('chatbot-1', 'thread-1', 'message-1')
    const promiseB = useChatStore
      .getState()
      .ensureFullImageAttachments('chatbot-1', 'thread-1', 'message-1')

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      ok: true,
      json: async () => [
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'attachment',
          hasFullImage: true,
        },
      ],
    })

    const [resultA, resultB] = await Promise.all([promiseA, promiseB])

    expect(resultA?.imageAttachments?.[0]?.imageBase64).toBe('full-1')
    expect(resultB?.imageAttachments?.[0]?.imageBase64).toBe('full-1')
  })
})
