import { signResponseExampleReceipt } from '@klicker-uzh/util/response-example-receipt'
import {
  type FinishReason,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from 'ai'
import {
  type ChatSourcePart,
  normalizeResponseExampleEvidenceFromParts,
} from '../sources/normalizeSources'

export const RESPONSE_EXAMPLE_RECEIPT_DATA_PART =
  'data-response-example-receipt'

export interface PreviewResponseExampleReceiptData {
  token: string
  expiresAt: number
}

function requireReceiptEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter(
      (
        part
      ): part is Extract<(typeof message.parts)[number], { type: 'text' }> =>
        part.type === 'text'
    )
    .map((part) => part.text)
    .join('')
    .trim()
}

function sourceParts(message: UIMessage): ChatSourcePart[] {
  return message.parts.flatMap((part): ChatSourcePart[] => {
    if (!isToolUIPart(part)) return []
    return [
      {
        type: 'tool-call',
        toolName: getToolName(part),
        result: part.state === 'output-available' ? part.output : undefined,
        isError:
          part.state === 'output-error' || part.state === 'output-denied',
      },
    ]
  })
}

export async function issuePreviewResponseExampleReceipt({
  requestMessages,
  responseMessage,
  finishReason,
  isAborted,
  ownerId,
  chatbotId,
  kbId,
  chatMode,
}: {
  requestMessages: readonly UIMessage[]
  responseMessage: UIMessage
  finishReason: FinishReason | undefined
  isAborted: boolean
  ownerId: string
  chatbotId: string
  kbId: string | undefined
  chatMode: string
}): Promise<PreviewResponseExampleReceiptData | null> {
  if (
    isAborted ||
    finishReason !== 'stop' ||
    !kbId ||
    requestMessages.length !== 1 ||
    requestMessages[0]?.role !== 'user'
  ) {
    return null
  }

  const question = messageText(requestMessages[0])
  const answer = messageText(responseMessage)
  if (!question || !answer) return null

  const evidenceReferences = normalizeResponseExampleEvidenceFromParts(
    sourceParts(responseMessage),
    answer
  )
  if (!evidenceReferences) return null

  return await signResponseExampleReceipt({
    privateKeyPem: requireReceiptEnvironment(
      'RESPONSE_EXAMPLE_RECEIPT_PRIVATE_KEY'
    ),
    keyId: requireReceiptEnvironment('RESPONSE_EXAMPLE_RECEIPT_KID'),
    issuer: requireReceiptEnvironment('RESPONSE_EXAMPLE_RECEIPT_ISSUER'),
    audience: requireReceiptEnvironment('RESPONSE_EXAMPLE_RECEIPT_AUDIENCE'),
    ownerId,
    chatbotId,
    kbId,
    chatMode,
    question,
    answer,
    evidenceReferences,
  })
}
