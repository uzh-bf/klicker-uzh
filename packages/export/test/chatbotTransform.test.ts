import { describe, expect, it } from 'vitest'

import {
  buildChatbotExportDocument,
  createKeyMap,
  type RawChatbotExportRow,
} from '../src/chatbotTransform.js'

const exportedAt = '2026-08-04T12:00:00.000Z'

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

describe('chatbot export transformation', () => {
  it('creates deterministic, sorted, one-based export keys', () => {
    expect(
      createKeyMap(['source-b', 'source-a', 'source-b'], 'message')
    ).toEqual(
      new Map([
        ['source-a', 'message_00001'],
        ['source-b', 'message_00002'],
      ])
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
      'chatbot_00001',
      'chatbot_00002',
    ])
    const firstThread = document.chatbots[0]!.threads[0]!
    expect(firstThread.id).toBe('thread_00001')
    expect(firstThread.participantId).toBe('participant_00001')
    expect(firstThread.messages.map((message) => message.id)).toEqual([
      'message_00001',
      'message_00002',
    ])
    expect(firstThread.messages[1]!.parentId).toBe('message_00001')
    expect(firstThread.messages[0]!.content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'tool_call_00001',
        input: {
          chatbot: 'chatbot_00001',
          thread: 'thread_00001',
          message: 'message_00002',
          attachment: 'attachment_00001',
        },
      },
      {
        type: 'text',
        text: 'Keep source-chatbot-a inside this sentence.',
      },
    ])
    expect(firstThread.messages[1]!.content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'tool_call_00001',
        result: { participant: 'participant_00001' },
      },
    ])
    expect(firstThread.messages[0]!.modelId).toBe('semantic-model-id')
    expect(document.chatbots[0]!.allowedModelIds).toEqual(['semantic-model-id'])
    expect(firstThread.messages[0]!.creditsUsed).toBe('1.250000')
    expect(firstThread.messages[0]!.createdAt).toBe('2026-02-01T00:01:00.000Z')
    expect(firstThread.messages[0]!.attachments).toEqual([
      {
        id: 'attachment_00001',
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
    expect(serialized).not.toContain('"source-chatbot-a"')
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
  })

  it('rejects unresolved parent message ids', () => {
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

    expect(() =>
      buildChatbotExportDocument([orphanParentRow], exportedAt)
    ).toThrow('Unresolved parent message id: missing-message')
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
