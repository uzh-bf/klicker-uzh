import type { EngineV2Message } from '@klicker-uzh/chat-engine-contract'
import { estimateTokens } from '../host/lib/attachments/documentText.js'
import type { ChatModelConfig } from '../host/lib/server/chatModelRegistry.js'
export function calculateCost(
  cost: ChatModelConfig['cost'],
  inputTokens: number,
  outputTokens: number
) {
  return (
    (cost.input * Math.max(0, inputTokens) +
      cost.output * Math.max(0, outputTokens)) /
    1_000_000
  )
}
export type { ChatModelConfig } from '../host/lib/server/chatModelRegistry.js'
export {
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getChatModelRegistry,
  getParticipantFallbackModelId,
} from '../host/lib/server/chatModelRegistry.js'

export function selectReplyContext(
  messages: EngineV2Message[],
  options: {
    maxInputTokens: number
    systemPrompt: string
    tools: unknown
    maxOutputTokens: number
  }
): {
  messages: EngineV2Message[]
  omittedMessages: number
  estimatedTokens: number
} | null {
  const fixedTokens =
    estimateTokens(options.systemPrompt) +
    estimateTokens(JSON.stringify(options.tools)) +
    options.maxOutputTokens
  const messageTokens = (message: EngineV2Message) =>
    16 +
    message.parts.reduce(
      (sum, part) =>
        sum +
        (part.type === 'image'
          ? 2048
          : part.type === 'tool-call'
            ? estimateTokens(
                JSON.stringify(part.modelOutput ?? part.output) ?? ''
              ) + estimateTokens(JSON.stringify(part.input) ?? '')
            : estimateTokens(part.text)),
      0
    )
  let start = messages.length - 1
  if (start < 0 || messages[start]?.role !== 'user') return null
  let estimatedTokens = fixedTokens + messageTokens(messages[start]!)
  if (estimatedTokens > options.maxInputTokens) return null
  while (start > 0) {
    let previous = start - 1
    while (previous >= 0 && messages[previous]?.role !== 'user') previous--
    if (previous < 0 || messages.length - previous > 100) break
    const addedTokens = messages
      .slice(previous, start)
      .reduce((sum, message) => sum + messageTokens(message), 0)
    if (estimatedTokens + addedTokens > options.maxInputTokens) break
    estimatedTokens += addedTokens
    start = previous
  }
  return {
    messages: messages.slice(start),
    omittedMessages: start,
    estimatedTokens,
  }
}
