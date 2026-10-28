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
export {
  getChatModelRegistry,
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getParticipantFallbackModelId,
} from '../host/lib/server/chatModelRegistry.js'
export type { ChatModelConfig } from '../host/lib/server/chatModelRegistry.js'
