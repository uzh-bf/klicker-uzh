import {
  CHAT_ENGINE_CONTRACT_V2,
  type EngineV2ChatRequest,
  type EngineV2StreamPart,
  engineV2MessageSchema,
  type ImageAttachment,
  type ImageV2Attachment,
} from '@klicker-uzh/chat-engine-contract'
import { signJWT } from '@klicker-uzh/util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineClient } from '../src/engine/client.js'

const { findMany, findFirst, transaction, ensurePreview } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  ensurePreview: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { chatMessage: { findMany, findFirst }, $transaction: transaction },
}))
vi.mock('../src/host/lib/server/imagePreview.js', () => ({
  ensureImagePreviewBase64: ensurePreview,
}))
vi.mock('../src/host/lib/server/systemPromptCompiler.js', () => ({
  compileSystemPrompt: vi.fn(),
}))
vi.mock('../src/host/services/credits.js', () => ({ CreditsService: {} }))
vi.mock('../src/host/services/disclaimers.js', () => ({
  DisclaimersService: {},
}))
vi.mock('../src/host/services/accountUsage.js', () => ({
  finalizeChatTurn: vi.fn(),
}))

import {
  loadEngineMessages,
  loadTurnContext,
  type PersistedMessage,
  persistUserMessage,
  prepareAttachmentContext,
} from '../src/runtime/defaultDependencies.js'

const threadId = 'thread-test'
const imageData = (payload: string) => `data:image/png;base64,${payload}`
const storedImage = (
  id: string,
  imageBase64: string | null,
  imageDescription: string | null = null,
  imagePreviewBase64: string | null = null
): PersistedMessage['attachments'][number] => ({
  id,
  imageBase64,
  imagePreviewBase64,
  imageDescription,
})
const storedMessage = (
  id: string,
  role: 'user' | 'assistant',
  content: unknown,
  attachments: PersistedMessage['attachments'] = []
): PersistedMessage => ({
  id,
  threadId,
  parentId: null,
  role,
  content,
  attachments,
})
const bodyMessage = (id: string, role: 'user' | 'assistant', content = '') => ({
  id,
  role,
  content,
})
const suppliedImage = (
  id: string,
  payload: string,
  description?: string
): ImageAttachment => ({
  id,
  type: 'image',
  mediaType: 'image/png',
  dataUrl: imageData(payload),
  ...(description === undefined ? {} : { description }),
})

beforeEach(() => {
  findMany.mockReset()
  findFirst.mockReset()
  transaction.mockReset()
  ensurePreview.mockReset()
})

describe('loadEngineMessages', () => {
  it('uses thread-scoped persisted parts and removes only incomplete tool calls', async () => {
    findMany.mockResolvedValue([
      storedMessage('saved-user', 'user', [{ type: 'text', text: 'stored' }]),
      storedMessage('saved-assistant', 'assistant', [
        { type: 'text', text: 'before' },
        { type: 'tool-call', toolCallId: 'incomplete', toolName: 'search' },
        { type: 'reasoning', text: 'between' },
        {
          type: 'tool-call',
          toolCallId: 'completed',
          toolName: 'search',
          args: { query: 'synthetic' },
          result: null,
        },
        {
          type: 'tool-call',
          toolCallId: 'output',
          toolName: 'calculate',
          input: 1,
          output: false,
          isError: true,
        },
        { type: 'text', text: 'after' },
      ]),
    ])

    const messages = await loadEngineMessages(
      threadId,
      [
        bodyMessage('saved-user', 'user', 'client substitution'),
        bodyMessage('saved-assistant', 'assistant', 'client substitution'),
        bodyMessage('current', 'user', 'new text'),
      ],
      []
    )

    expect(findMany).toHaveBeenCalledOnce()
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        threadId,
        id: { in: ['saved-user', 'saved-assistant', 'current'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        attachments: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            imageBase64: true,
            imagePreviewBase64: true,
            imageDescription: true,
          },
        },
      },
    })
    expect(messages).toEqual([
      {
        id: 'saved-user',
        role: 'user',
        parts: [{ type: 'text', text: 'stored' }],
      },
      {
        id: 'saved-assistant',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'before' },
          { type: 'reasoning', text: 'between' },
          {
            type: 'tool-call',
            toolCallId: 'completed',
            toolName: 'search',
            input: { query: 'synthetic' },
            output: null,
          },
          {
            type: 'tool-call',
            toolCallId: 'output',
            toolName: 'calculate',
            input: 1,
            output: false,
            isError: true,
          },
          { type: 'text', text: 'after' },
        ],
      },
      {
        id: 'current',
        role: 'user',
        parts: [{ type: 'text', text: 'new text' }],
      },
    ])
    for (const message of messages)
      expect(engineV2MessageSchema.parse(message)).toEqual(message)
  })

  it('does not substitute supplied text when saved content is empty or only incomplete tools', async () => {
    findMany.mockResolvedValue([
      storedMessage('saved', 'assistant', [
        { type: 'tool-call', toolCallId: 'pending', toolName: 'search' },
      ]),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'assistant', 'untrusted')],
      []
    )
    expect(message?.parts).toEqual([{ type: 'text', text: '' }])
  })

  it('keeps current text when its saved content is null without trusting null history', async () => {
    findMany.mockResolvedValue([
      storedMessage('history', 'user', null),
      storedMessage('current', 'user', null),
    ])
    const messages = await loadEngineMessages(
      threadId,
      [
        bodyMessage('history', 'user', 'untrusted'),
        bodyMessage('current', 'user', 'current text'),
      ],
      []
    )
    expect(messages[0]?.parts).toEqual([{ type: 'text', text: '' }])
    expect(messages[1]?.parts).toEqual([{ type: 'text', text: 'current text' }])
  })

  it('rejects missing history, a missing final assistant, role mismatches, and duplicate IDs', async () => {
    findMany.mockResolvedValue([])
    await expect(
      loadEngineMessages(
        threadId,
        [bodyMessage('missing', 'assistant'), bodyMessage('current', 'user')],
        []
      )
    ).rejects.toThrow()
    await expect(
      loadEngineMessages(threadId, [bodyMessage('missing', 'assistant')], [])
    ).rejects.toThrow()

    findMany.mockResolvedValue([storedMessage('saved', 'assistant', [])])
    await expect(
      loadEngineMessages(threadId, [bodyMessage('saved', 'user')], [])
    ).rejects.toThrow()
    await expect(
      loadEngineMessages(
        threadId,
        [bodyMessage('saved', 'assistant'), bodyMessage('saved', 'assistant')],
        []
      )
    ).rejects.toThrow()

    findMany.mockResolvedValue([
      { ...storedMessage('saved', 'user', []), threadId: 'other-thread' },
    ])
    await expect(
      loadEngineMessages(threadId, [bodyMessage('saved', 'user')], [])
    ).rejects.toThrow()
  })

  it('selects at most three original images from the newest saved messages', async () => {
    findMany.mockResolvedValue([
      storedMessage(
        'older',
        'user',
        [],
        [storedImage('old', imageData('AQ=='), 'old description')]
      ),
      storedMessage(
        'middle',
        'user',
        [],
        [
          storedImage('middle-1', imageData('Ag=='), 'middle description'),
          storedImage('middle-2', imageData('Aw=='), 'other description'),
        ]
      ),
      storedMessage(
        'newer',
        'user',
        [],
        [
          storedImage('new-1', imageData('BA=='), 'new description'),
          storedImage('new-2', imageData('BQ==')),
        ]
      ),
    ])
    const messages = await loadEngineMessages(
      threadId,
      [
        bodyMessage('older', 'user'),
        bodyMessage('middle', 'user'),
        bodyMessage('newer', 'user'),
      ],
      []
    )

    const images = messages.flatMap((message) =>
      message.parts.filter((part) => part.type === 'image')
    )
    expect(images).toEqual([
      {
        id: 'middle-1',
        type: 'image',
        source: 'attachment',
        mediaType: 'image/png',
        dataUrl: imageData('Ag=='),
        description: 'middle description',
      },
      {
        id: 'new-1',
        type: 'image',
        source: 'attachment',
        mediaType: 'image/png',
        dataUrl: imageData('BA=='),
        description: 'new description',
      },
      {
        id: 'new-2',
        type: 'image',
        source: 'attachment',
        mediaType: 'image/png',
        dataUrl: imageData('BQ=='),
      },
    ])
    const olderText = messages[0]?.parts.filter((part) => part.type === 'text')
    expect(olderText).toHaveLength(1)
    expect(olderText?.[0]?.text).toContain('old description')
    expect(messages[1]?.parts).toEqual([
      images[0],
      expect.objectContaining({ type: 'text', text: expect.any(String) }),
    ])
    for (const message of messages)
      expect(engineV2MessageSchema.parse(message)).toEqual(message)
  })

  it('prioritizes supplied current images without replaying same-message stored images', async () => {
    findMany.mockResolvedValue([
      storedMessage(
        'old',
        'user',
        [],
        [
          storedImage('old-image', imageData('AQ==')),
          storedImage('old-image-2', imageData('BQ=='), 'older fallback'),
        ]
      ),
      storedMessage(
        'current',
        'user',
        [{ type: 'text', text: 'stored current' }],
        [storedImage('stored-current-image', imageData('Ag=='))]
      ),
    ])
    const messages = await loadEngineMessages(
      threadId,
      [bodyMessage('old', 'user'), bodyMessage('current', 'user', 'changed')],
      [
        suppliedImage('new-1', 'Aw==', 'supplied'),
        suppliedImage('new-2', 'BA=='),
      ]
    )
    expect(messages[1]?.parts).toEqual([
      { type: 'text', text: 'stored current' },
      {
        ...suppliedImage('new-1', 'Aw==', 'supplied'),
        source: 'attachment',
      },
      { ...suppliedImage('new-2', 'BA=='), source: 'attachment' },
    ])
    expect(messages[0]?.parts).toEqual([
      {
        id: 'old-image',
        type: 'image',
        source: 'attachment',
        mediaType: 'image/png',
        dataUrl: imageData('AQ=='),
      },
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('older fallback'),
      }),
    ])
  })

  it('uses retained current attachments on regeneration and falls back for unavailable originals', async () => {
    findMany.mockResolvedValue([
      storedMessage(
        'current',
        'user',
        [{ type: 'text', text: 'saved' }],
        [
          storedImage('valid', imageData('AQ=='), 'kept description'),
          storedImage('invalid', 'not an image', 'available description'),
          storedImage('unavailable', null, null, imageData('Ag==')),
        ]
      ),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('current', 'user', 'replaced')],
      []
    )
    expect(message?.parts[0]).toEqual({ type: 'text', text: 'saved' })
    expect(message?.parts[1]).toEqual({
      id: 'valid',
      type: 'image',
      source: 'attachment',
      mediaType: 'image/png',
      dataUrl: imageData('AQ=='),
      description: 'kept description',
    })
    const fallback = message?.parts[2]
    expect(fallback).toEqual(
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('available description'),
      })
    )
    expect(fallback).toEqual(
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('unavailable'),
      })
    )
    expect(engineV2MessageSchema.parse(message)).toEqual(message)
  })

  it('restores document summaries separately from ordinary images and ignores empty summary rows', async () => {
    const attachments = [
      storedImage('summary', null, 'synthetic-document-summary'),
      storedImage('original-1', imageData('AQ==')),
      storedImage('original-2', imageData('Ag==')),
      storedImage('original-3', imageData('Aw==')),
    ]
    findMany.mockResolvedValue([
      storedMessage('saved', 'user', [], attachments),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'user')],
      []
    )
    expect(
      message?.parts
        .filter((part) => part.type === 'image')
        .map((part) => part.id)
    ).toEqual(['original-1', 'original-2', 'original-3'])
    expect(message?.parts.filter((part) => part.type === 'text')).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('synthetic-document-summary'),
      }),
    ])

    findMany.mockResolvedValue([
      storedMessage(
        'saved',
        'user',
        [],
        [...attachments, storedImage('empty-summary', null)]
      ),
    ])
    expect(
      await loadEngineMessages(threadId, [bodyMessage('saved', 'user')], [])
    ).toEqual([message])

    const [regenerated] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'user')],
      [suppliedImage('replacement', 'BA==')]
    )
    expect(
      regenerated?.parts
        .filter((part) => part.type === 'image')
        .map((part) => part.id)
    ).toEqual(['replacement'])
    expect(regenerated?.parts.filter((part) => part.type === 'text')).toEqual(
      message?.parts.filter((part) => part.type === 'text')
    )
  })

  it('preserves an oversized stored description alongside the original image', async () => {
    const description = 'd'.repeat(200_001)
    findMany.mockResolvedValue([
      storedMessage(
        'current',
        'user',
        [],
        [storedImage('image', imageData('AQ=='), description)]
      ),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('current', 'user')],
      []
    )
    expect(message?.parts[0]).toEqual({
      id: 'image',
      type: 'image',
      source: 'attachment',
      mediaType: 'image/png',
      dataUrl: imageData('AQ=='),
    })
    const text = message?.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    expect(text?.endsWith(description)).toBe(true)
    expect(engineV2MessageSchema.parse(message)).toEqual(message)
  })

  it('preserves long text and reasoning in bounded parts without splitting a surrogate pair', async () => {
    const text = `${'x'.repeat(199_999)}😀y`
    const reasoning = 'r'.repeat(200_001)
    findMany.mockResolvedValue([
      storedMessage('saved', 'assistant', [
        { type: 'text', text },
        { type: 'reasoning', text: reasoning },
      ]),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'assistant')],
      []
    )
    const textParts =
      message?.parts.filter((part) => part.type === 'text') ?? []
    const reasoningParts =
      message?.parts.filter((part) => part.type === 'reasoning') ?? []
    expect(textParts.map((part) => part.text).join('')).toBe(text)
    expect(reasoningParts.map((part) => part.text).join('')).toBe(reasoning)
    expect(textParts.map((part) => part.text.length)).toEqual([199_999, 3])
    expect(reasoningParts.map((part) => part.text.length)).toEqual([200_000, 1])
    expect(engineV2MessageSchema.parse(message)).toEqual(message)
  })

  it('accepts 256 parts and rejects a true overflow', async () => {
    const content = Array.from({ length: 256 }, (_, index) => ({
      type: index % 2 === 0 ? 'text' : 'reasoning',
      text: 'x',
    }))
    findMany.mockResolvedValue([storedMessage('saved', 'assistant', content)])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'assistant')],
      []
    )
    expect(message?.parts).toHaveLength(256)
    expect(engineV2MessageSchema.parse(message)).toEqual(message)

    findMany.mockResolvedValue([
      storedMessage('saved', 'assistant', [
        ...content,
        { type: 'text', text: 'y' },
      ]),
    ])
    await expect(
      loadEngineMessages(threadId, [bodyMessage('saved', 'assistant')], [])
    ).rejects.toThrow()
  })

  it('combines adjacent text fragments before applying the part limit', async () => {
    findMany.mockResolvedValue([
      storedMessage(
        'saved',
        'assistant',
        Array.from({ length: 257 }, () => ({ type: 'text', text: 'x' }))
      ),
    ])
    const [message] = await loadEngineMessages(
      threadId,
      [bodyMessage('saved', 'assistant')],
      []
    )
    expect(message?.parts).toEqual([{ type: 'text', text: 'x'.repeat(257) }])
  })

  it('does not trim the caller-selected history', async () => {
    const saved = Array.from({ length: 101 }, (_, index) =>
      storedMessage(`message-${index}`, 'user', [
        { type: 'text', text: `${index}` },
      ])
    )
    findMany.mockResolvedValue(saved)
    const messages = await loadEngineMessages(
      threadId,
      saved.map((message) => bodyMessage(message.id, 'user')),
      []
    )
    expect(messages).toHaveLength(101)
    expect(messages[0]?.parts).toEqual([{ type: 'text', text: '0' }])
    expect(messages[100]?.parts).toEqual([{ type: 'text', text: '100' }])
  })
})

describe('prepareAttachmentContext', () => {
  const request: EngineV2ChatRequest = {
    contractVersion: CHAT_ENGINE_CONTRACT_V2,
    requestId: 'request-test',
    participantId: 'participant-test',
    courseId: 'course-test',
    chatbotId: 'chatbot-test',
    threadId,
    userMessageId: 'current',
    assistantMessageId: 'assistant-test',
    runId: 'run-test',
    locale: 'en',
    systemPrompt: '',
    generation: {
      modelId: 'model-test',
      deploymentId: 'deployment-test',
      reasoningEffort: 'none',
      reasoningSummary: 'none',
      responseStorage: false,
      credentialMode: { mode: 'deployment' },
    },
    messages: [
      {
        id: 'current',
        role: 'user',
        parts: [{ type: 'text', text: 'synthetic-input' }],
      },
    ],
    tools: [],
  }
  const cost = { input: 2, output: 3 }
  const callCost = (100 * cost.input + 40 * cost.output) / 1_000_000
  const response = (
    call: Parameters<EngineClient['chat']>[0],
    text: string,
    aborted = false
  ) => {
    const metadata = {
      contractVersion: CHAT_ENGINE_CONTRACT_V2,
      engineId: 'engine-test',
      runId: call.runId,
      modelId: call.generation.modelId,
      deploymentId: call.generation.deploymentId,
      usage: {
        inputTokens: 100,
        outputTokens: 40,
        totalTokens: 140,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
      reasoningContent: null,
      aborted,
    }
    const parts: EngineV2StreamPart[] = [
      { type: 'start', messageId: call.assistantMessageId },
      { type: 'text-start', id: 'text-test' },
      { type: 'text-delta', id: 'text-test', delta: text },
      { type: 'text-end', id: 'text-test' },
      ...(aborted
        ? [
            { type: 'message-metadata' as const, messageMetadata: metadata },
            { type: 'abort' as const },
          ]
        : [
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              messageMetadata: metadata,
            },
          ]),
    ]
    return new Response(
      parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')
    )
  }
  const engine = () => ({
    manifest: vi.fn<EngineClient['manifest']>(),
    chat: vi.fn<EngineClient['chat']>(),
  })
  const input = (
    client: EngineClient,
    signal = new AbortController().signal
  ) => ({
    request: {
      ...request,
      tools: [
        {
          name: 'doc_query',
          serverId: 'host',
          inputSchema: { type: 'object' },
        },
      ],
      stepPolicy: {
        firstToolName: 'doc_query',
        trailingSystemMessage: 'test-policy-1',
      },
    },
    images: [suppliedImage('image-test', 'AQ==')],
    documentPages: ['data:image/jpeg;base64,Ag=='],
    engine: client,
    signal,
    engineId: 'engine-test',
    cost,
  })

  it('uses the real stream validator for image descriptions and transient document summaries', async () => {
    const client = engine()
    client.chat.mockImplementation(async (call) =>
      response(
        call,
        client.chat.mock.calls.length === 1
          ? 'described-image'
          : 'described-pages'
      )
    )
    const result = await prepareAttachmentContext(input(client))
    expect(result).toEqual({
      images: [
        {
          ...suppliedImage('image-test', 'AQ=='),
          description: 'described-image',
        },
      ],
      documentPageSummary: 'described-pages',
      creditsUsed: callCost * 2,
      aborted: false,
    })
    expect(client.chat).toHaveBeenCalledTimes(2)
    const calls = client.chat.mock.calls.map(([call]) => call)
    expect(
      calls.every(
        (call) => !('stepPolicy' in call) || call.stepPolicy === undefined
      )
    ).toBe(true)
    expect(calls[0]?.messages[0]?.parts[0]).toMatchObject({
      source: 'attachment',
      dataUrl: imageData('AQ=='),
    })
    expect(calls[1]?.messages[0]?.parts[0]).toMatchObject({
      source: 'document-page',
      dataUrl: 'data:image/jpeg;base64,Ag==',
    })
    expect(calls.map((call) => call.generation.maxOutputTokens)).toEqual([
      1000, 1500,
    ])
    expect(calls.every((call) => call.tools.length === 0)).toBe(true)
  })

  it.each([
    'transport',
    'reader',
    'terminal',
    'signal',
  ] as const)('retains known costs and skips remaining calls after a later %s abort', async (failure) => {
    const client = engine()
    const controller = new AbortController()
    client.chat.mockImplementationOnce(async (call) =>
      response(call, 'completed-description')
    )
    client.chat.mockImplementationOnce(async (call) => {
      if (failure === 'transport')
        throw new DOMException('synthetic-stop', 'AbortError')
      if (failure === 'signal') {
        controller.abort()
        throw new DOMException('synthetic-stop', 'AbortError')
      }
      if (failure === 'reader') {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.error(new DOMException('synthetic-stop', 'AbortError'))
            },
          })
        )
      }
      return response(call, '', true)
    })
    const images = [
      suppliedImage('first', 'AQ=='),
      suppliedImage('second', 'Ag==', 'saved-second-description'),
      suppliedImage('third', 'Aw==', 'saved-third-description'),
    ]
    const result = await prepareAttachmentContext({
      ...input(client, controller.signal),
      images,
    })
    expect(result.creditsUsed).toBe(callCost * (failure === 'terminal' ? 2 : 1))
    expect(result.aborted).toBe(true)
    expect(result.documentPageSummary).toBeNull()
    expect(result.images.map((image) => image.dataUrl)).toEqual(
      images.map((image) => image.dataUrl)
    )
    expect(result.images.map((image) => image.description)).toEqual([
      'completed-description',
      'saved-second-description',
      'saved-third-description',
    ])
    expect(client.chat).toHaveBeenCalledTimes(2)
  })

  it('does not start auxiliary calls when the signal is already aborted', async () => {
    const client = engine()
    const controller = new AbortController()
    controller.abort()
    const result = await prepareAttachmentContext(
      input(client, controller.signal)
    )
    expect(result.aborted).toBe(true)
    expect(result.creditsUsed).toBe(0)
    expect(result.images[0]?.dataUrl).toBe(imageData('AQ=='))
    expect(client.chat).not.toHaveBeenCalled()
  })

  it('keeps completed image costs when document summarization fails', async () => {
    const client = engine()
    client.chat.mockImplementationOnce(async (call) =>
      response(call, 'completed-description')
    )
    client.chat.mockRejectedValueOnce(new Error('synthetic-summary-failure'))
    const result = await prepareAttachmentContext(input(client))
    expect(result.creditsUsed).toBe(callCost)
    expect(result.documentPageSummary).toBeNull()
    expect(result.images[0]?.description).toBe('completed-description')
    expect(result.aborted).toBe(false)
  })
})

describe('attachment persistence', () => {
  type Row = PersistedMessage['attachments'][number] & {
    messageId: string
    position: number
    type: 'IMAGE'
  }
  let rows: Row[]
  let nextId: number
  const input = {
    threadId,
    messageId: 'current',
    parentId: null,
    content: 'synthetic-question',
    chatMode: 'tutor',
    modelId: 'model-test',
    reasoningEffort: null,
    attachments: [suppliedImage('client-image', 'AQ==')],
  }

  beforeEach(() => {
    rows = []
    nextId = 0
    ensurePreview.mockImplementation(
      async (image: {
        imageBase64: string
        imagePreviewBase64: string | null
      }) => ({
        ...image,
        imagePreviewBase64:
          image.imagePreviewBase64 ?? 'data:image/jpeg;base64,Aw==',
      })
    )
    const tx = {
      chatMessage: {
        findUnique: vi.fn().mockResolvedValue({ threadId, role: 'user' }),
        create: vi.fn(),
      },
      chatAttachment: {
        findMany: vi.fn(async ({ where }: { where: { messageId: string } }) =>
          rows
            .filter((row) => row.messageId === where.messageId)
            .sort((left, right) => left.position - right.position)
            .map((row) => ({ ...row }))
        ),
        create: vi.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
          const row = { ...data, id: `stored-${++nextId}` }
          rows.push(row)
          return row
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string }
            data: Omit<Row, 'id'>
          }) => {
            const row = rows.find((candidate) => candidate.id === where.id)
            if (!row) throw new Error('Synthetic row missing')
            Object.assign(row, data)
            return row
          }
        ),
        deleteMany: vi.fn(
          async ({
            where,
          }: {
            where: { messageId: string; id: { in: string[] } }
          }) => {
            rows = rows.filter(
              (row) =>
                row.messageId !== where.messageId ||
                !where.id.in.includes(row.id)
            )
          }
        ),
      },
      chatThread: { update: vi.fn() },
    }
    transaction.mockImplementation(
      async (operation: (client: typeof tx) => Promise<void>) => operation(tx)
    )
    findMany.mockImplementation(async () => [
      storedMessage(
        'current',
        'user',
        [{ type: 'text', text: input.content }],
        rows
      ),
    ])
  })

  it('updates image descriptions in place and retains originals and previews across retries', async () => {
    const preview = 'data:image/jpeg;base64,BA=='
    await persistUserMessage({ ...input, imagePreviews: [preview] })
    const originalId = rows[0]?.id
    await persistUserMessage({
      ...input,
      attachments: [
        { ...input.attachments[0]!, description: 'completed-description' },
      ],
    })
    await persistUserMessage({ ...input, attachments: [] })
    await persistUserMessage(input)
    expect(rows).toEqual([
      {
        id: originalId,
        type: 'IMAGE',
        messageId: input.messageId,
        position: 0,
        imageBase64: imageData('AQ=='),
        imagePreviewBase64: preview,
        imageDescription: 'completed-description',
      },
    ])
    expect(
      ensurePreview.mock.calls.every(
        ([image]) => image.imageBase64 === imageData('AQ==')
      )
    ).toBe(true)
  })

  it('restores and updates document summaries while retaining saved originals', async () => {
    await persistUserMessage({ ...input, documentPageSummary: 'first-summary' })
    const imageId = rows[0]?.id
    const summaryId = rows[1]?.id
    await persistUserMessage({
      ...input,
      attachments: [],
      documentPageSummary: null,
    })
    const [restored] = await loadEngineMessages(
      threadId,
      [bodyMessage('current', 'user')],
      []
    )
    expect(
      restored?.parts
        .filter((part) => part.type === 'image')
        .map((part) => part.id)
    ).toEqual([imageId])
    expect(
      restored?.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
    ).toContain('first-summary')
    await persistUserMessage({
      ...input,
      attachments: [],
      documentPageSummary: 'updated-summary',
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.id).toBe(imageId)
    expect(rows[1]).toEqual({
      id: summaryId,
      type: 'IMAGE',
      messageId: 'current',
      position: 1,
      imageBase64: null,
      imagePreviewBase64: null,
      imageDescription: 'updated-summary',
    })
  })

  it('never persists transient document-page bytes and keeps supplied image previews aligned', async () => {
    const page: ImageV2Attachment = {
      id: 'page',
      type: 'image',
      source: 'document-page',
      mediaType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,Ag==',
    }
    await persistUserMessage({
      ...input,
      attachments: [page, ...input.attachments],
      imagePreviews: [
        'data:image/jpeg;base64,Ag==',
        'data:image/jpeg;base64,BA==',
      ],
      documentPageSummary: 'synthetic-summary',
    })
    expect(rows.map((row) => row.imageBase64)).toEqual([
      imageData('AQ=='),
      null,
    ])
    expect(rows[0]?.imagePreviewBase64).toBe('data:image/jpeg;base64,BA==')
    expect(rows[1]?.position).toBe(1)
  })

  it('preserves an original and its description when preview generation fails', async () => {
    ensurePreview.mockRejectedValueOnce(new Error('synthetic-preview-failure'))
    await persistUserMessage({
      ...input,
      attachments: [
        { ...input.attachments[0]!, description: 'known-description' },
      ],
    })
    expect(rows[0]).toMatchObject({
      imageBase64: imageData('AQ=='),
      imageDescription: 'known-description',
      imagePreviewBase64: null,
    })
  })
})

afterEach(() => vi.unstubAllEnvs())

describe('admitted learning context', () => {
  const chatbotId = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
  const courseId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  const secret = 'synthetic-context-key'
  const snapshot = (id: string) => ({
    snapshotId: id,
    observedAt: '2026-10-29T12:00:00Z',
    locale: 'en',
    location: { surface: 'block' },
    material: { availability: 'full-text', excerpt: id.repeat(100) },
  })
  const input = {
    chatbotId,
    courseId,
    threadId,
    origin: 'elearning',
    learnerBinding: 'learner',
    userMessageId: 'current',
    messages: [bodyMessage('current', 'user', 'synthetic')],
  }
  const envelope = async () => {
    vi.stubEnv('ELEARNING_CHAT_HANDOFF_SECRET', secret)
    const now = Math.floor(Date.now() / 1000)
    return signJWT(
      {
        scope: 'ELEARNING_SNAPSHOT',
        purpose: 'learning-context',
        aud: 'klicker-chat',
        sub: 'learner',
        chatbotId,
        klickerCourseId: courseId,
        iat: now,
        exp: now + 300,
        snapshot: snapshot('live'),
      },
      secret,
      { issuer: 'elearning' }
    )
  }
  beforeEach(() => {
    findMany.mockResolvedValue([
      {
        id: 'current',
        role: 'user',
        content: [{ type: 'text', text: 'synthetic' }],
      },
    ])
  })

  it('keeps a saved null snapshot when the live page changes', async () => {
    findFirst.mockResolvedValue({ learningContext: null })
    const result = await loadTurnContext({
      ...input,
      rawContext: {
        version: 1,
        source: 'elearning',
        locale: 'en',
        envelope: await envelope(),
      },
    })
    if ('error' in result) throw new Error(result.error)
    expect(result.learningContext).toBeNull()
    expect(result.prompt).not.toContain(snapshot('live').material.excerpt)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'current', threadId, role: 'user' },
      select: { learningContext: true },
    })
  })

  it('inherits the source snapshot for an edited question and refuses a foreign source', async () => {
    findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'source' ? { learningContext: snapshot('saved') } : null
    )
    const result = await loadTurnContext({
      ...input,
      sourceMessageId: 'source',
      rawContext: {
        version: 1,
        source: 'elearning',
        locale: 'en',
        envelope: await envelope(),
      },
    })
    if ('error' in result) throw new Error(result.error)
    expect(result.learningContext).toMatchObject({ snapshotId: 'saved' })
    expect(result.prompt).not.toContain(snapshot('live').material.excerpt)
    expect(
      await loadTurnContext({ ...input, sourceMessageId: 'foreign' })
    ).toEqual({ error: 'SOURCE_MESSAGE_NOT_FOUND' })
  })

  it('persists a verified snapshot only for a genuinely new turn', async () => {
    findFirst.mockResolvedValue(null)
    const result = await loadTurnContext({
      ...input,
      rawContext: {
        version: 1,
        source: 'elearning',
        locale: 'en',
        envelope: await envelope(),
      },
    })
    if ('error' in result) throw new Error(result.error)
    expect(result.learningContext).toMatchObject({ snapshotId: 'live' })
  })

  it('rejects untrusted learning transports and modified canonical history', async () => {
    const token = await envelope()
    const parts = token.split('.')
    parts[2] = (parts[2]![0] === 'a' ? 'b' : 'a') + parts[2]!.slice(1)
    expect(
      await loadTurnContext({
        ...input,
        rawContext: {
          version: 1,
          source: 'elearning',
          locale: 'en',
          envelope: parts.join('.'),
        },
      })
    ).toEqual({ error: 'INVALID_CHAT_CONTEXT' })
    expect(
      await loadTurnContext({
        ...input,
        learnerBinding: 'foreign',
        rawContext: {
          version: 1,
          source: 'elearning',
          locale: 'en',
          envelope: token,
        },
      })
    ).toEqual({ error: 'INVALID_CHAT_CONTEXT' })
    expect(
      await loadTurnContext({
        ...input,
        rawContext: {
          version: 1,
          source: 'pwa',
          surface: 'course-home',
          locale: 'en',
          courseId,
        },
      })
    ).toEqual({ error: 'INVALID_CHAT_CONTEXT' })
    findMany.mockResolvedValue([
      {
        id: 'current',
        role: 'user',
        content: [{ type: 'text', text: 'changed' }],
      },
    ])
    expect(await loadTurnContext(input)).toEqual({
      error: 'INVALID_CHAT_HISTORY',
    })
    expect(findFirst).not.toHaveBeenCalled()
  })
})
