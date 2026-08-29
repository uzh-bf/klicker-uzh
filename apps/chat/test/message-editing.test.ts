import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useThreadManagement } from '../src/hooks/useThreadManagement'
import { getEditedMessageSource } from '../src/lib/attachments/attachmentState'
import { useComposerStore } from '../src/stores/composerStore'

const { mockUseChatStore } = vi.hoisted(() => ({
  mockUseChatStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'chatbot-1' }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ toString: () => '' }),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  return {
    ...actual,
    useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
  }
})

vi.mock('../src/lib/utils/chatUtils', () => ({
  generateId: () => 'edited-message-id',
}))

vi.mock('../src/stores/settingsStore', () => ({
  useSettingsStore: (selector?: (state: any) => unknown) => {
    const state = {
      selectedMode: 'chat',
      selectedModel: 'gpt-test',
      selectedReasoningEffort: 'medium',
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../src/stores/chatStore', () => ({
  useChatStore: mockUseChatStore,
}))

type MockState = {
  activeThreadId: string | null
  threads: Array<{
    id: string
    messages: any[]
    allMessages: any[]
  }>
}

let storeState: MockState
let chatActions: {
  createThread: ReturnType<typeof vi.fn>
  addMessage: ReturnType<typeof vi.fn>
  setIsRunning: ReturnType<typeof vi.fn>
}

describe('getEditedMessageSource', () => {
  beforeEach(() => {
    useComposerStore.setState({ editRemovedAttachmentKeysByMessageId: {} })
    storeState = {
      activeThreadId: null,
      threads: [],
    }

    mockUseChatStore.mockReset()
    chatActions = {
      createThread: vi.fn(),
      addMessage: vi.fn(),
      setIsRunning: vi.fn(),
    }
    mockUseChatStore.mockImplementation(
      (selector?: (state: any) => unknown) => {
        const state = { ...storeState, ...chatActions }
        return selector ? selector(state) : state
      }
    )
    mockUseChatStore.getState.mockImplementation(() => storeState)
    mockUseChatStore.setState.mockImplementation((updater: any) => {
      const partial =
        typeof updater === 'function' ? updater(storeState) : updater

      storeState = {
        ...storeState,
        ...partial,
      }
    })
  })

  test('resolves the edited root message directly by editedMessageId', () => {
    const source = getEditedMessageSource({
      editedMessageId: 'root-user',
      messages: [
        {
          id: 'root-user',
          role: 'user',
          imageAttachments: [
            {
              id: 'att-1',
              type: 'image' as const,
              position: 0,
              imagePreviewBase64: 'preview-1',
            },
          ],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
        },
      ],
    })

    expect(source).toEqual({
      id: 'root-user',
      role: 'user',
      imageAttachments: [
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imagePreviewBase64: 'preview-1',
        },
      ],
    })
  })

  test('root user edit keeps, removes, and adds only the selected attachments', async () => {
    const originalAttachments = [
      {
        id: 'att-1',
        type: 'image' as const,
        position: 0,
        imageBase64: 'full-1',
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
        hasFullImage: true,
      },
      {
        id: 'att-2',
        type: 'image' as const,
        position: 1,
        imagePreviewBase64: 'preview-2',
        imageDescription: 'second attachment',
        hasFullImage: false,
      },
    ]

    storeState = {
      activeThreadId: 'thread-1',
      threads: [
        {
          id: 'thread-1',
          messages: [
            {
              id: 'root-user',
              role: 'user',
              content: [{ type: 'text', text: 'original' }],
              createdAt: new Date('2026-04-14T00:00:00.000Z'),
              parentId: null,
              imageAttachments: originalAttachments,
            },
            {
              id: 'assistant-1',
              role: 'assistant',
              content: [{ type: 'text', text: 'reply' }],
              createdAt: new Date('2026-04-14T00:00:01.000Z'),
              parentId: 'root-user',
            },
          ],
          allMessages: [
            {
              id: 'root-user',
              role: 'user',
              content: [{ type: 'text', text: 'original' }],
              createdAt: new Date('2026-04-14T00:00:00.000Z'),
              parentId: null,
              imageAttachments: originalAttachments,
            },
            {
              id: 'assistant-1',
              role: 'assistant',
              content: [{ type: 'text', text: 'reply' }],
              createdAt: new Date('2026-04-14T00:00:01.000Z'),
              parentId: 'root-user',
            },
          ],
        },
      ],
    }

    const generateChatResponse = vi.fn().mockResolvedValue(undefined)
    const { onEdit } = useThreadManagement(generateChatResponse, {
      current: null,
    } as React.MutableRefObject<AbortController | null>)

    useComposerStore
      .getState()
      .addEditRemovedAttachmentKey('root-user', 'id:att-2')
    await onEdit({
      id: 'root-user',
      parentId: null,
      content: [{ type: 'text', text: 'edited root message' }],
      attachments: [
        {
          content: [
            {
              type: 'image',
              image: 'data:image/png;base64,NEW',
              imagePreview: 'data:image/png;base64,NEW_PREVIEW',
            },
          ],
        },
      ],
    } as any)

    const expectedAttachments = [
      originalAttachments[0],
      {
        type: 'image',
        imageBase64: 'data:image/png;base64,NEW',
        imagePreviewBase64: 'data:image/png;base64,NEW_PREVIEW',
        imageDescription: null,
      },
    ]
    const editedMessage = storeState.threads[0]?.messages[0]
    expect(editedMessage).toMatchObject({
      id: 'edited-message-id',
      parentId: null,
      imageAttachments: expectedAttachments,
    })
    expect(storeState.threads[0]?.allMessages.at(-1)).toMatchObject({
      id: 'edited-message-id',
      imageAttachments: expectedAttachments,
    })
    expect(generateChatResponse).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'edited-message-id',
          attachmentSourceMessageId: 'root-user',
          imageAttachments: expectedAttachments,
        }),
      ],
      'thread-1'
    )
  })

  test('new user message preserves attachment previews from composer attachments', async () => {
    const addMessage = vi.fn().mockResolvedValue('thread-1')

    chatActions = {
      createThread: vi.fn(),
      addMessage,
      setIsRunning: vi.fn(),
    }

    storeState = {
      activeThreadId: 'thread-1',
      threads: [
        {
          id: 'thread-1',
          messages: [],
          allMessages: [],
        },
      ],
    }

    const generateChatResponse = vi.fn().mockResolvedValue(undefined)
    const { onNew } = useThreadManagement(generateChatResponse, {
      current: null,
    } as React.MutableRefObject<AbortController | null>)

    await onNew({
      content: [{ type: 'text', text: 'new message' }],
      attachments: [
        {
          content: [
            {
              type: 'image',
              image: 'data:image/png;base64,FULL',
              imagePreview: 'data:image/png;base64,PREVIEW',
            },
          ],
        },
      ],
    } as any)

    expect(addMessage).toHaveBeenCalledWith(
      'chatbot-1',
      expect.objectContaining({
        imageAttachments: [
          expect.objectContaining({
            imageBase64: 'data:image/png;base64,FULL',
            imagePreviewBase64: 'data:image/png;base64,PREVIEW',
          }),
        ],
      }),
      'thread-1'
    )
  })
})
