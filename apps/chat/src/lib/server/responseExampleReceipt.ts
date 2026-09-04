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
  question: string
  answer: string
}

export type PreviewResponseExampleCaptureData =
  | PreviewResponseExampleReceiptData
  | { unavailable: true }

function getReceiptEnvironment() {
  const privateKeyPem = process.env.RESPONSE_EXAMPLE_RECEIPT_PRIVATE_KEY?.trim()
  const keyId = process.env.RESPONSE_EXAMPLE_RECEIPT_KID?.trim()
  const issuer = process.env.RESPONSE_EXAMPLE_RECEIPT_ISSUER?.trim()
  const audience = process.env.RESPONSE_EXAMPLE_RECEIPT_AUDIENCE?.trim()
  if (!privateKeyPem || !keyId || !issuer || !audience) return null
  return { privateKeyPem, keyId, issuer, audience }
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
}): Promise<PreviewResponseExampleCaptureData | null> {
  if (
    isAborted ||
    finishReason !== 'stop' ||
    requestMessages.length !== 1 ||
    requestMessages[0]?.role !== 'user'
  ) {
    return null
  }

  const question = messageText(requestMessages[0])
  const answer = messageText(responseMessage)
  if (!question || !answer) return null

  if (!kbId) return { unavailable: true }

  const evidenceReferences = normalizeResponseExampleEvidenceFromParts(
    sourceParts(responseMessage),
    answer
  )
  if (!evidenceReferences) return { unavailable: true }

  const environment = getReceiptEnvironment()
  if (!environment) return { unavailable: true }

  const signedReceipt = await signResponseExampleReceipt({
    ...environment,
    ownerId,
    chatbotId,
    kbId,
    chatMode,
    question,
    answer,
    evidenceReferences,
  })

  // The signed token remains the authority at capture time. The normalized
  // text travels alongside it only so the preview action can submit exactly
  // the content that was checked before signing, without reconstructing it
  // from rendered assistant-ui parts.
  return { ...signedReceipt, question, answer }
}
