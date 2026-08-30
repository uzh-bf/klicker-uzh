import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    chatAttachment: {
      findMany: vi.fn(),
    },
  },
  transaction: {
    chatMessage: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    chatAttachment: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    chatThread: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  withTransaction: vi.fn(),
  ensureImagePreviewBase64: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('../src/utils/transactions', () => ({
  withTransaction: mocks.withTransaction,
}))

vi.mock('../src/lib/server/imagePreview', () => ({
  ensureImagePreviewBase64: mocks.ensureImagePreviewBase64,
}))

import {
  AuthoritativeConversationError,
  MAX_MODEL_HISTORY_ROWS,
  MAX_VALIDATED_HISTORY_ROWS,
  prepareAuthoritativeConversation,
} from '../src/lib/server/authoritativeHistory'

const input = {
  participantId: 'participant-1',
  ownerId: 'owner-1',
  chatbotId: 'chatbot-1',
  threadId: 'thread-1',
  trigger: {
    id: 'trigger-1',
    parentId: null,
    text: 'Question',
    attachments: [],
  },
  usedLegacyAdapter: false,
  metadata: {
    chatMode: 'tutor',
    modelId: 'model-1',
    reasoningEffort: null,
  },
}

type Header = {
  id: string
  threadId: string
  parentId: string | null
  role: string
  lifecycleStatus: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  depth: number
  cycle: boolean
}

function header(overrides: Partial<Header> = {}): Header {
  return {
    id: 'trigger-1',
    threadId: 'thread-1',
    parentId: null,
    role: 'user',
    lifecycleStatus: 'COMPLETED',
    depth: 1,
    cycle: false,
    ...overrides,
  }
}

function projectedMessage(row: Header) {
  return {
    id: row.id,
    role: row.role,
    content: [{ type: 'text', text: row.id }],
    attachments: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.withTransaction.mockImplementation(async (operation) =>
    operation(mocks.transaction)
  )
  mocks.prisma.chatAttachment.findMany.mockResolvedValue([])
  mocks.ensureImagePreviewBase64.mockImplementation(async (image) => ({
    ...image,
    imagePreviewBase64:
      image.imagePreviewBase64 ?? 'data:image/jpeg;base64,PREVIEW',
  }))
  mocks.transaction.chatThread.findFirst.mockResolvedValue({ id: 'thread-1' })
  mocks.transaction.chatMessage.createMany.mockResolvedValue({ count: 1 })
  mocks.transaction.chatAttachment.findMany.mockResolvedValue([])
  mocks.transaction.chatAttachment.createMany.mockResolvedValue({ count: 0 })
  mocks.transaction.$queryRaw.mockResolvedValue([header()])
  mocks.transaction.chatMessage.findMany.mockResolvedValue([
    projectedMessage(header()),
  ])
})

describe('authoritative conversation history', () => {
  test('creates one completed trigger and returns persisted model text', async () => {
    await expect(prepareAuthoritativeConversation(input)).resolves.toEqual({
      triggerText: 'Question',
      modelMessages: [{ id: 'trigger-1', role: 'user', content: 'trigger-1' }],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: true,
      currentAttachments: [],
    })

    expect(mocks.transaction.chatMessage.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'trigger-1',
        threadId: 'thread-1',
        parentId: null,
        role: 'user',
        lifecycleStatus: 'COMPLETED',
      }),
      skipDuplicates: true,
    })
  })

  test('prepares image previews before opening the transaction', async () => {
    const imageBase64 = 'data:image/png;base64,AAAA'
    const imagePreviewBase64 = 'data:image/jpeg;base64,PREVIEW'
    mocks.transaction.chatAttachment.findMany.mockResolvedValue([
      {
        id: 'attachment-1',
        type: 'IMAGE',
        position: 0,
        imageBase64,
        imagePreviewBase64,
        imageDescription: null,
      },
    ])
    mocks.ensureImagePreviewBase64.mockImplementationOnce(async (image) => {
      expect(mocks.withTransaction).not.toHaveBeenCalled()
      return { ...image, imagePreviewBase64 }
    })

    await prepareAuthoritativeConversation({
      ...input,
      trigger: {
        ...input.trigger,
        attachments: [{ type: 'new-image', imageBase64 }],
      },
    })

    expect(mocks.ensureImagePreviewBase64).toHaveBeenCalledOnce()
    expect(
      mocks.ensureImagePreviewBase64.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.withTransaction.mock.invocationCallOrder[0])
    expect(mocks.transaction.chatAttachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          imageBase64,
          imagePreviewBase64,
        }),
      ],
    })
  })

  test('revalidates a persisted image source inside the transaction', async () => {
    const sourceId = 'source-attachment'
    const imageBase64 = 'data:image/png;base64,AAAA'
    const imagePreviewBase64 = 'data:image/jpeg;base64,PREVIEW'
    const source = {
      id: sourceId,
      type: 'IMAGE',
      position: 0,
      imageBase64,
      imagePreviewBase64,
      imageDescription: 'Persisted description',
    }
    mocks.prisma.chatAttachment.findMany.mockResolvedValueOnce([source])
    mocks.transaction.chatAttachment.findMany
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([
        {
          ...source,
          id: 'current-binding',
        },
      ])

    await prepareAuthoritativeConversation({
      ...input,
      trigger: {
        ...input.trigger,
        attachments: [{ type: 'persisted-image', id: sourceId }],
      },
    })

    const expectedScope = {
      id: { in: [sourceId] },
      type: 'IMAGE',
      message: {
        threadId: 'thread-1',
        role: 'user',
        lifecycleStatus: 'COMPLETED',
        thread: {
          participantId: 'participant-1',
          chatbotId: 'chatbot-1',
          chatbot: { ownerId: 'owner-1' },
        },
      },
    }
    expect(mocks.prisma.chatAttachment.findMany).toHaveBeenCalledWith({
      where: expectedScope,
      select: expect.any(Object),
    })
    expect(mocks.transaction.chatAttachment.findMany).toHaveBeenNthCalledWith(
      1,
      {
        where: expectedScope,
        select: expect.any(Object),
      }
    )
    expect(mocks.transaction.chatAttachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          imageBase64,
          imagePreviewBase64,
          imageDescription: 'Persisted description',
        }),
      ],
    })
  })

  test('preserves an unexpected preview failure as a server error', async () => {
    const error = new Error('preview failed')
    mocks.ensureImagePreviewBase64.mockRejectedValueOnce(error)

    await expect(
      prepareAuthoritativeConversation({
        ...input,
        trigger: {
          ...input.trigger,
          attachments: [
            {
              type: 'new-image',
              imageBase64: 'data:image/png;base64,AAAA',
            },
          ],
        },
      })
    ).rejects.toBe(error)

    expect(mocks.withTransaction).not.toHaveBeenCalled()
  })

  test('accepts only an exact normalized retry and does not rewrite it', async () => {
    mocks.transaction.chatMessage.createMany.mockResolvedValue({ count: 0 })
    mocks.transaction.chatMessage.findUnique.mockResolvedValue({
      threadId: 'thread-1',
      parentId: null,
      role: 'user',
      content: [{ type: 'text', text: '  Question\r\n' }],
      lifecycleStatus: 'COMPLETED',
    })

    await expect(
      prepareAuthoritativeConversation(input)
    ).resolves.toMatchObject({ createdTrigger: false })
    expect(mocks.transaction.chatThread.update).not.toHaveBeenCalled()

    mocks.transaction.chatMessage.findUnique.mockResolvedValue({
      threadId: 'thread-1',
      parentId: 'different-parent',
      role: 'user',
      content: [{ type: 'text', text: 'Question' }],
      lifecycleStatus: 'COMPLETED',
    })
    await expect(
      prepareAuthoritativeConversation(input)
    ).rejects.toBeInstanceOf(AuthoritativeConversationError)
  })

  test('projects only the selected root-to-trigger text and prior descriptions', async () => {
    const rows = [
      header({ id: 'trigger', parentId: 'marker', depth: 1, role: 'user' }),
      header({ id: 'marker', parentId: 'root', depth: 2, role: 'assistant' }),
      header({ id: 'root', parentId: null, depth: 3, role: 'user' }),
    ]
    mocks.transaction.$queryRaw.mockResolvedValue(rows)
    mocks.transaction.chatMessage.findMany.mockResolvedValue([
      {
        id: 'marker',
        role: 'assistant',
        content: [{ type: 'tool-call', toolName: 'render-only' }],
        attachments: [],
      },
      {
        id: 'root',
        role: 'user',
        content: [{ type: 'text', text: 'Root question' }],
        attachments: [{ imageDescription: 'A synthetic diagram.' }],
      },
      {
        id: 'trigger',
        role: 'user',
        content: [{ type: 'text', text: 'Follow-up' }],
        attachments: [],
      },
    ])

    await expect(
      prepareAuthoritativeConversation({
        ...input,
        trigger: { ...input.trigger, id: 'trigger', parentId: 'marker' },
      })
    ).resolves.toMatchObject({
      modelMessages: [
        {
          id: 'root',
          role: 'user',
          content:
            'Root question\n\n[Attached image description: A synthetic diagram.]',
        },
        { id: 'trigger', role: 'user', content: 'Follow-up' },
      ],
    })
  })

  test('keeps attachment-only history truthful and omits truly empty rows', async () => {
    const rows = [
      header({
        id: 'trigger',
        parentId: 'marker-1',
        depth: 1,
        role: 'user',
      }),
      header({
        id: 'marker-1',
        parentId: 'image-only',
        depth: 2,
        role: 'assistant',
      }),
      header({
        id: 'image-only',
        parentId: 'marker-2',
        depth: 3,
        role: 'user',
      }),
      header({
        id: 'marker-2',
        parentId: 'empty-root',
        depth: 4,
        role: 'assistant',
      }),
      header({
        id: 'empty-root',
        parentId: null,
        depth: 5,
        role: 'user',
      }),
    ]
    mocks.transaction.$queryRaw.mockResolvedValue(rows)
    mocks.transaction.chatMessage.findMany.mockResolvedValue([
      {
        id: 'trigger',
        role: 'user',
        content: [{ type: 'text', text: 'Question' }],
        attachments: [],
      },
      {
        id: 'marker-1',
        role: 'assistant',
        content: [],
        attachments: [],
      },
      {
        id: 'image-only',
        role: 'user',
        content: [],
        attachments: [{ imageDescription: null }],
      },
      {
        id: 'marker-2',
        role: 'assistant',
        content: [],
        attachments: [],
      },
      {
        id: 'empty-root',
        role: 'user',
        content: [],
        attachments: [],
      },
    ])

    await expect(
      prepareAuthoritativeConversation({
        ...input,
        trigger: {
          ...input.trigger,
          id: 'trigger',
          parentId: 'marker-1',
        },
      })
    ).resolves.toMatchObject({
      modelMessages: [
        {
          id: 'image-only',
          role: 'user',
          content:
            '[The user attached an image without an available description.]',
        },
        { id: 'trigger', role: 'user', content: 'Question' },
      ],
    })
  })

  test.each([
    ['missing parent', [header({ parentId: 'missing' })]],
    ['cycle', [header({ cycle: true })]],
    ['cross-thread row', [header({ threadId: 'thread-2' })]],
    ['incomplete row', [header({ lifecycleStatus: 'IN_PROGRESS' as const })]],
    [
      'same-role edge',
      [
        header({ id: 'child', parentId: 'root', role: 'user' }),
        header({ id: 'root', depth: 2, role: 'user' }),
      ],
    ],
    ['assistant database root', [header({ role: 'assistant' })]],
    ['invalid role', [header({ role: 'system' })]],
    ['non-contiguous depth', [header({ depth: 2 })]],
  ])('rejects an invalid %s', async (_label, rows) => {
    mocks.transaction.$queryRaw.mockResolvedValue(rows)

    await expect(
      prepareAuthoritativeConversation(input)
    ).rejects.toBeInstanceOf(AuthoritativeConversationError)
  })

  test('accepts an assistant effective root and projects only the closest 64 rows', async () => {
    const rows = Array.from(
      { length: MAX_VALIDATED_HISTORY_ROWS },
      (_, index) =>
        header({
          id: `message-${index + 1}`,
          parentId:
            index === MAX_VALIDATED_HISTORY_ROWS - 1
              ? 'older-than-window'
              : `message-${index + 2}`,
          role: index % 2 === 0 ? 'user' : 'assistant',
          depth: index + 1,
        })
    )
    mocks.transaction.$queryRaw.mockResolvedValue(rows)
    mocks.transaction.chatMessage.findMany.mockResolvedValue(
      rows.slice(0, MAX_MODEL_HISTORY_ROWS).map(projectedMessage)
    )

    const result = await prepareAuthoritativeConversation({
      ...input,
      trigger: {
        ...input.trigger,
        id: rows[0].id,
        parentId: rows[0].parentId,
      },
    })

    expect(result).toMatchObject({
      validatedRowCount: MAX_VALIDATED_HISTORY_ROWS,
      modelRowCount: MAX_MODEL_HISTORY_ROWS,
      truncated: true,
    })
    expect(result.modelMessages).toHaveLength(MAX_MODEL_HISTORY_ROWS)
    expect(result.modelMessages[0]).toMatchObject({
      id: `message-${MAX_MODEL_HISTORY_ROWS}`,
      role: 'assistant',
    })
    expect(result.modelMessages.at(-1)).toMatchObject({
      id: 'message-1',
      role: 'user',
    })
  })
})
