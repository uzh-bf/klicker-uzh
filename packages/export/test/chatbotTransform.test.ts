import { describe, expect, it } from 'vitest'

import {
  buildChatbotExportDocument,
  createHashedKeyMap,
  type RawChatbotExportRow,
} from '../src/chatbotTransform.js'

const exportedAt = '2026-08-04T12:00:00.000Z'
const expectedIds = {
  chatbotA:
    'chatbot_8b1af2d86812af60213f5b7092c8ebb07fc7c5e77b5bcca1e4faecdfe8cc7422',
  chatbotB:
    'chatbot_448c5fabc1c4ff867b75e4fbb66ff098521a12a7d3ea96df2deacf390cdb5327',
  participantA:
    'participant_a0aa14b0a5b8dc7d5edcf53f0e43329b7972cc1974a82d0ee2cb8edefe13a115',
  threadA:
    'thread_2af2a78c9fae773d421456326461d840adae2b9d79916c2f7b49a61190f6cd8d',
  threadB:
    'thread_3d779df4ce9d3f7c323be2154e3ecc251a6fce8bfecfa637600ebcf82fe094d0',
  messageA:
    'message_ae067212f643e9704d7b5343cee469a763dd9eb141adbafbd1b739c3d02a52db',
  messageB:
    'message_c764788420b4cb93d33f7ca8102a06110daad89ad5683e408fa83415fbe0cde8',
  attachmentA:
    'attachment_8e57bdbd6dc06c9635bbf16cde1fa2a2c5446f20190d032049905ca66e6ceb51',
  toolCallA:
    'tool_call_c3a338a8b3ae4c26b81baa2b977220828c6616919a8b629c3f22b1386b0e1e0c',
} as const

function rawChatbot(
  overrides: Partial<RawChatbotExportRow> = {}
): RawChatbotExportRow {
  return {
    id: 'source-chatbot-a',
    name: 'Evaluation chatbot',
    description: null,
    systemPrompts: { tutor: { prompt: 'Be helpful' } },
    creditInitialCredits: 10,
    creditResetPeriod: 'WEEKLY',
    creditResetAmount: 5,
    creditMaxCredits: 20,
    modelSelection: true,
    allowedModelIds: ['semantic-model-id'],
    allowedReasoningEffortsByModel: {
      'semantic-model-id': ['medium'],
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    threads: [],
    ...overrides,
  }
}

type RawThread = RawChatbotExportRow['threads'][number]
type RawMessage = RawThread['messages'][number]

function rawMessage(
  id: string,
  overrides: Partial<RawMessage> = {}
): RawMessage {
  return {
    id,
    parentId: null,
    role: 'user',
    content: [],
    chatMode: null,
    modelId: null,
    reasoningEffort: null,
    reasoningContent: null,
    creditsUsed: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    attachments: [],
    ...overrides,
  }
}

function rawThread(
  id: string,
  messages: RawMessage[],
  overrides: Partial<RawThread> = {}
): RawThread {
  return {
    id,
    title: null,
    participantId: `participant-${id}`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    messages,
    ...overrides,
  }
}

describe('chatbot export transformation', () => {
  it('creates deterministic SHA-256 export keys', () => {
    const keys = createHashedKeyMap(
      ['source-b', 'source-a', 'source-b'],
      'message'
    )

    expect(keys.size).toBe(2)
    expect(keys.get('source-a')).toBe(
      'message_0f9f5ce47831e099e77e295ed8bb627f089efa8672ee6fbdc49eac6f0d7f5275'
    )
    expect(keys.get('source-b')).toBe(
      'message_3fed13457ee26a4f5b27c42544aa57045981a075a6103aab87e0b81c032e9d01'
    )
  })

  it('keeps participant ids stable across independent exports', () => {
    const firstDocument = buildChatbotExportDocument(
      [
        rawChatbot({
          threads: [
            rawThread('source-thread-z', [], {
              participantId: 'source-participant-shared',
            }),
          ],
        }),
      ],
      exportedAt
    )
    const secondDocument = buildChatbotExportDocument(
      [
        rawChatbot({
          id: 'source-chatbot-b',
          threads: [
            rawThread('source-thread-a', [], {
              participantId: 'aaa-participant',
            }),
            rawThread('source-thread-z', [], {
              participantId: 'source-participant-shared',
            }),
          ],
        }),
      ],
      exportedAt
    )

    const expectedParticipantId =
      'participant_8feed6321dd888ca3e8011d7d9c489601d924fb03be2617e0536aac2c651a9d9'
    expect(firstDocument.chatbots[0]!.threads[0]!.participantId).toBe(
      expectedParticipantId
    )
    expect(secondDocument.chatbots[0]!.threads[1]!.participantId).toBe(
      expectedParticipantId
    )
  })

  it('pseudonymizes known ids and nests canonically ordered conversations', () => {
    const rawChatbotA = rawChatbot({
      threads: [
        {
          id: 'source-thread-a',
          title: 'Thread A',
          participantId: 'source-participant-a',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          updatedAt: new Date('2026-02-02T00:00:00.000Z'),
          messages: [
            {
              id: 'source-message-b',
              parentId: 'source-message-a',
              role: 'assistant',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'source-tool-call-a',
                  result: { participant: 'source-participant-a' },
                },
              ],
              chatMode: 'tutor',
              modelId: 'semantic-model-id',
              reasoningEffort: 'medium',
              reasoningContent: 'Reasoning remains unchanged.',
              creditsUsed: { toString: () => '0.500000' },
              createdAt: new Date('2026-02-01T00:02:00.000Z'),
              updatedAt: new Date('2026-02-01T00:03:00.000Z'),
              attachments: [],
            },
            {
              id: 'source-message-a',
              parentId: null,
              role: 'user',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'source-tool-call-a',
                  input: {
                    chatbot: 'source-chatbot-a',
                    thread: 'source-thread-a',
                    message: 'source-message-b',
                    attachment: 'source-attachment-a',
                  },
                },
                {
                  type: 'text',
                  text: 'Keep source-chatbot-a inside this sentence.',
                },
                {
                  type: 'text',
                  text: 'source-chatbot-a',
                },
              ],
              chatMode: null,
              modelId: 'semantic-model-id',
              reasoningEffort: null,
              reasoningContent: null,
              creditsUsed: { toString: () => '1.250000' },
              createdAt: new Date('2026-02-01T00:01:00.000Z'),
              updatedAt: new Date('2026-02-01T00:01:30.000Z'),
              attachments: [
                {
                  id: 'source-attachment-a',
                  type: 'IMAGE',
                  position: 0,
                  imageDescription: 'A chart',
                  createdAt: new Date('2026-02-01T00:01:10.000Z'),
                  updatedAt: new Date('2026-02-01T00:01:20.000Z'),
                },
              ],
            },
          ],
        },
      ],
    })
    Object.assign(rawChatbotA, {
      ownerId: 'private-owner-id',
      openaiApiKey: 'private-api-key',
      mcpConfigurations: [{ authSecret: 'private-mcp-secret' }],
    })
    Object.assign(rawChatbotA.threads[0]!.messages[1]!.attachments[0]!, {
      imageBase64: 'data:image/png;base64,full-image',
      imagePreviewBase64: 'data:image/png;base64,preview-image',
    })

    const rawChatbotB = rawChatbot({
      id: 'source-chatbot-b',
      name: 'Second chatbot',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      threads: [
        {
          id: 'source-thread-b',
          title: null,
          participantId: 'source-participant-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          messages: [
            {
              id: 'source-message-c',
              parentId: null,
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Model ids and ordinary prose remain unchanged.',
                },
              ],
              chatMode: null,
              modelId: 'semantic-model-id',
              reasoningEffort: null,
              reasoningContent: null,
              creditsUsed: null,
              createdAt: new Date('2026-01-01T00:00:01.000Z'),
              updatedAt: new Date('2026-01-01T00:00:02.000Z'),
              attachments: [],
            },
          ],
        },
      ],
    })

    const document = buildChatbotExportDocument(
      [rawChatbotB, rawChatbotA],
      exportedAt
    )

    expect(document.chatbots.map((chatbot) => chatbot.id)).toEqual([
      expectedIds.chatbotA,
      expectedIds.chatbotB,
    ])
    const firstThread = document.chatbots[0]!.threads[0]!
    expect(firstThread.id).toBe(expectedIds.threadA)
    expect(firstThread.participantId).toBe(expectedIds.participantA)
    expect(firstThread.messages.map((message) => message.id)).toEqual([
      expectedIds.messageA,
      expectedIds.messageB,
    ])
    expect(firstThread.messages[1]!.parentId).toBe(expectedIds.messageA)
    expect(firstThread.messages[0]!.content).toEqual([
      {
        type: 'tool-call',
        toolCallId: expectedIds.toolCallA,
        input: {
          chatbot: expectedIds.chatbotA,
          thread: expectedIds.threadA,
          message: expectedIds.messageB,
          attachment: expectedIds.attachmentA,
        },
      },
      {
        type: 'text',
        text: 'Keep source-chatbot-a inside this sentence.',
      },
      {
        type: 'text',
        text: 'source-chatbot-a',
      },
    ])
    expect(firstThread.messages[1]!.content).toEqual([
      {
        type: 'tool-result',
        toolCallId: expectedIds.toolCallA,
        result: { participant: expectedIds.participantA },
      },
    ])
    expect(firstThread.messages[0]!.modelId).toBe('semantic-model-id')
    expect(document.chatbots[0]!.allowedModelIds).toEqual(['semantic-model-id'])
    expect(firstThread.messages[0]!.creditsUsed).toBe('1.250000')
    expect(firstThread.messages[0]!.createdAt).toBe('2026-02-01T00:01:00.000Z')
    expect(firstThread.messages[0]!.attachments).toEqual([
      {
        id: expectedIds.attachmentA,
        type: 'IMAGE',
        position: 0,
        imageDescription: 'A chart',
        createdAt: '2026-02-01T00:01:10.000Z',
        updatedAt: '2026-02-01T00:01:20.000Z',
      },
    ])

    const serialized = JSON.stringify(document)
    expect(serialized).not.toContain('full-image')
    expect(serialized).not.toContain('preview-image')
    expect(serialized).not.toContain('private-owner-id')
    expect(serialized).not.toContain('private-api-key')
    expect(serialized).not.toContain('private-mcp-secret')
    expect(document.counts).toEqual({
      chatbots: 2,
      participants: 1,
      threads: 2,
      messages: 3,
      attachments: 1,
    })
    expect(document.scope).toEqual({
      includedModels: [
        'Chatbot',
        'ChatThread',
        'ChatMessage',
        'ChatAttachment',
      ],
      excludedModels: [
        'ChatUsageCredits',
        'ChatbotDisclaimer',
        'ChatbotMCPConfig',
        'ChatbotMCPServer',
        'User',
        'Course',
        'Participant',
      ],
      attachmentImagesIncluded: false,
    })
    expect(document.privacy).toEqual({
      mode: 'pseudonymized',
      warning:
        'Conversation text and attachment descriptions are unchanged; this export is not anonymized.',
    })
    expect(document.warnings).toEqual({ invalidParentReferences: [] })
  })

  it('normalizes unresolved parent message ids without exposing them', () => {
    const orphanParentRow = rawChatbot({
      threads: [
        {
          id: 'source-thread-a',
          title: null,
          participantId: 'source-participant-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          messages: [
            {
              id: 'source-message-a',
              parentId: 'missing-message',
              role: 'assistant',
              content: [],
              chatMode: null,
              modelId: null,
              reasoningEffort: null,
              reasoningContent: null,
              creditsUsed: null,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              attachments: [],
            },
          ],
        },
      ],
    })

    const document = buildChatbotExportDocument([orphanParentRow], exportedAt)

    expect(document.chatbots[0]!.threads[0]!.messages[0]!.parentId).toBeNull()
    expect(document.warnings.invalidParentReferences).toEqual([
      {
        threadId: expectedIds.threadA,
        messageId: expectedIds.messageA,
        reason: 'not_in_thread',
      },
    ])
    expect(JSON.stringify(document)).not.toContain('missing-message')
  })

  it('scopes repeated tool call ids to their thread', () => {
    const row = rawChatbot({
      threads: [
        rawThread('source-thread-a', [
          rawMessage('source-message-a', {
            content: [
              { type: 'tool-call', toolCallId: 'provider-tool-call-id' },
            ],
          }),
        ]),
        rawThread('source-thread-b', [
          rawMessage('source-message-b', {
            content: [
              { type: 'tool-call', toolCallId: 'provider-tool-call-id' },
            ],
          }),
        ]),
      ],
    })

    const document = buildChatbotExportDocument([row], exportedAt)
    const firstToolCallId = (
      document.chatbots[0]!.threads[0]!.messages[0]!.content as Array<{
        toolCallId: string
      }>
    )[0]!.toolCallId
    const secondToolCallId = (
      document.chatbots[0]!.threads[1]!.messages[0]!.content as Array<{
        toolCallId: string
      }>
    )[0]!.toolCallId

    expect(firstToolCallId).toBe(
      'tool_call_3b64ae0994e6fd79038dc97282511c7f31d526ab3f0d081fb58a271a4d4bda6f'
    )
    expect(secondToolCallId).toBe(
      'tool_call_84db698f38c829673cd4066d86d7093992f5c41d5ae04cd15b538b81b30a430d'
    )
  })

  it('normalizes parent ids that point into another thread', () => {
    const row = rawChatbot({
      threads: [
        rawThread('source-thread-a', [rawMessage('source-message-a')]),
        rawThread('source-thread-b', [
          rawMessage('source-message-b', {
            parentId: 'source-message-a',
          }),
        ]),
      ],
    })

    const document = buildChatbotExportDocument([row], exportedAt)

    expect(document.chatbots[0]!.threads[1]!.messages[0]!.parentId).toBeNull()
    expect(document.warnings.invalidParentReferences).toEqual([
      {
        threadId: expectedIds.threadB,
        messageId: expectedIds.messageB,
        reason: 'not_in_thread',
      },
    ])
  })

  it('rejects self-referencing parent ids', () => {
    const row = rawChatbot({
      threads: [
        rawThread('source-thread-a', [
          rawMessage('source-message-a', {
            parentId: 'source-message-a',
          }),
        ]),
      ],
    })

    expect(() => buildChatbotExportDocument([row], exportedAt)).toThrow(
      'Self-referencing parent message id in thread source-thread-a: source-message-a'
    )
  })

  it('rejects cyclic parent chains', () => {
    const row = rawChatbot({
      threads: [
        rawThread('source-thread-a', [
          rawMessage('source-message-a', {
            parentId: 'source-message-b',
          }),
          rawMessage('source-message-b', {
            parentId: 'source-message-a',
          }),
        ]),
      ],
    })

    expect(() => buildChatbotExportDocument([row], exportedAt)).toThrow(
      'Cyclic parent message chain in thread source-thread-a'
    )
  })

  it('rejects source identifiers reused across record types', () => {
    const reusedIdRow = rawChatbot({
      id: 'reused-source-id',
      threads: [
        {
          id: 'reused-source-id',
          title: null,
          participantId: 'source-participant-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          messages: [],
        },
      ],
    })

    expect(() => buildChatbotExportDocument([reusedIdRow], exportedAt)).toThrow(
      'Ambiguous source identifier: reused-source-id'
    )
  })

  it('supports empty exports, chatbots, and threads', () => {
    expect(buildChatbotExportDocument([], exportedAt)).toMatchObject({
      counts: {
        chatbots: 0,
        participants: 0,
        threads: 0,
        messages: 0,
        attachments: 0,
      },
      chatbots: [],
    })
    expect(
      buildChatbotExportDocument([rawChatbot()], exportedAt).chatbots[0]!
        .threads
    ).toEqual([])

    const emptyThreadRow = rawChatbot({
      threads: [
        {
          id: 'source-thread-a',
          title: null,
          participantId: 'source-participant-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          messages: [],
        },
      ],
    })
    expect(
      buildChatbotExportDocument([emptyThreadRow], exportedAt).chatbots[0]!
        .threads[0]!.messages
    ).toEqual([])
  })
})
