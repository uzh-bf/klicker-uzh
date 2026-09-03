import { verifyResponseExampleReceipt } from '@klicker-uzh/util/response-example-receipt'
import type { UIMessage } from 'ai'
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { issuePreviewResponseExampleReceipt } from '../src/lib/server/responseExampleReceipt'

const OWNER_ID = '6757e679-0452-45fe-9c43-2e3f033e3e18'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const SOURCE_ID = '33ec1c89-f892-4ab6-97cb-27ed037ec33d'
const KEY_ID = 'response-example-test-key'
const ISSUER = 'https://chat.klicker.test'
const AUDIENCE = 'klicker-response-example-test'

let publicKeyPem: string

function userMessage(id: string, text: string): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] }
}

function assistantMessage({
  answer = 'The source explains this result. [1]',
  includeCitation = true,
  includeLineage = true,
}: {
  answer?: string
  includeCitation?: boolean
  includeLineage?: boolean
} = {}): UIMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-KB_doc_query',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { question: 'Why?' },
        output: {
          answer: 'Retrieved answer',
          sources: [
            {
              expert: 'Course source',
              file_name: 'lecture.pdf',
              ...(includeLineage
                ? {
                    source_id: SOURCE_ID,
                    chunk_id: 'chunk-1',
                    content_hash: 'b'.repeat(64),
                    citation_anchor: 'page=3',
                  }
                : {}),
            },
          ],
        },
      },
      {
        type: 'text',
        text: includeCitation ? answer : answer.replace(' [1]', ''),
      },
    ],
  } as UIMessage
}

describe('issuePreviewResponseExampleReceipt', () => {
  beforeEach(async () => {
    const keyPair = await generateKeyPair('ES256')
    publicKeyPem = await exportSPKI(keyPair.publicKey)
    vi.stubEnv(
      'RESPONSE_EXAMPLE_RECEIPT_PRIVATE_KEY',
      await exportPKCS8(keyPair.privateKey)
    )
    vi.stubEnv('RESPONSE_EXAMPLE_RECEIPT_KID', KEY_ID)
    vi.stubEnv('RESPONSE_EXAMPLE_RECEIPT_ISSUER', ISSUER)
    vi.stubEnv('RESPONSE_EXAMPLE_RECEIPT_AUDIENCE', AUDIENCE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('issues a receipt for a completed, grounded first answer', async () => {
    const receipt = await issuePreviewResponseExampleReceipt({
      requestMessages: [userMessage('user-1', 'Why?')],
      responseMessage: assistantMessage(),
      finishReason: 'stop',
      isAborted: false,
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      kbId: KB_ID,
      chatMode: 'tutor',
    })

    expect(receipt).not.toBeNull()
    const claims = await verifyResponseExampleReceipt({
      token: receipt!.token,
      publicKeyPem,
      keyId: KEY_ID,
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    expect(claims).toMatchObject({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      kbId: KB_ID,
      chatMode: 'tutor',
      evidenceReferences: [
        {
          citationIndex: 1,
          sourceId: SOURCE_ID,
          chunkId: 'chunk-1',
          contentHash: 'b'.repeat(64),
          citationAnchor: 'page=3',
        },
      ],
    })
  })

  it.each([
    {
      name: 'an aborted answer',
      finishReason: 'stop' as const,
      isAborted: true,
    },
    {
      name: 'an incomplete answer',
      finishReason: 'length' as const,
      isAborted: false,
    },
  ])('does not issue for $name', async ({ finishReason, isAborted }) => {
    await expect(
      issuePreviewResponseExampleReceipt({
        requestMessages: [userMessage('user-1', 'Why?')],
        responseMessage: assistantMessage(),
        finishReason,
        isAborted,
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        kbId: KB_ID,
        chatMode: 'tutor',
      })
    ).resolves.toBeNull()
  })

  it('does not issue after the first exchange', async () => {
    await expect(
      issuePreviewResponseExampleReceipt({
        requestMessages: [
          userMessage('user-1', 'Why?'),
          assistantMessage(),
          userMessage('user-2', 'Can you clarify?'),
        ],
        responseMessage: assistantMessage(),
        finishReason: 'stop',
        isAborted: false,
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        kbId: KB_ID,
        chatMode: 'tutor',
      })
    ).resolves.toBeNull()
  })

  it.each([
    {
      name: 'no citation',
      message: assistantMessage({ includeCitation: false }),
    },
    {
      name: 'incomplete lineage',
      message: assistantMessage({ includeLineage: false }),
    },
  ])('does not issue with $name', async ({ message }) => {
    await expect(
      issuePreviewResponseExampleReceipt({
        requestMessages: [userMessage('user-1', 'Why?')],
        responseMessage: message,
        finishReason: 'stop',
        isAborted: false,
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        kbId: KB_ID,
        chatMode: 'tutor',
      })
    ).resolves.toBeNull()
  })
})
