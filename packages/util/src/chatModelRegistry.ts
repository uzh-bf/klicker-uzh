export const CHAT_BASE_MODEL_ID = 'gpt-6-luna'

export type ChatModelBasePolicyModel = {
  id: string
  usageClass: 'BASE' | 'ADVANCED'
  fallback: boolean
}

export type ChatModelBasePolicyIssue = {
  path?: (string | number)[]
  message: string
}

export type ChatModelAutoPolicyModel = {
  id: string
  usageClass: 'BASE' | 'ADVANCED'
  fallback: boolean
  supportsReasoning: boolean
}

export type ChatModelAutoPolicyIssue = {
  path?: (string | number)[]
  message: string
}

/** Returns the validation issues for the shared automatic model policy. */
export function getChatModelAutoPolicyIssues(
  models: readonly ChatModelAutoPolicyModel[]
): ChatModelAutoPolicyIssue[] {
  const autoModels = models
    .map((model, index) => ({ model, index }))
    .filter(({ model }) => model.id === 'auto')
  const issues: ChatModelAutoPolicyIssue[] = []

  if (autoModels.length !== 1) {
    issues.push({
      message: 'Model "auto" must appear exactly once in the registry.',
    })
  }

  const autoModel = autoModels[0]
  if (!autoModel) return issues

  if (autoModel.model.supportsReasoning) {
    issues.push({
      path: [autoModel.index, 'supportsReasoning'],
      message: 'Model "auto" must not support reasoning.',
    })
  }
  if (autoModel.model.fallback) {
    issues.push({
      path: [autoModel.index, 'fallback'],
      message: 'Model "auto" must not be a participant-credit fallback.',
    })
  }

  return issues
}

/** Returns the validation issues for the shared participant-credit base policy. */
export function getChatModelBasePolicyIssues(
  models: readonly ChatModelBasePolicyModel[]
): ChatModelBasePolicyIssue[] {
  const issues: ChatModelBasePolicyIssue[] = []

  // Other models may also be BASE; this one is the participant-credit
  // fallback every chatbot can always reach.
  const baseModelIndex = models.findIndex(
    (model) => model.id === CHAT_BASE_MODEL_ID
  )
  if (baseModelIndex < 0 || models[baseModelIndex]?.usageClass !== 'BASE') {
    issues.push({
      message: `Model "${CHAT_BASE_MODEL_ID}" must be a BASE model in the registry.`,
    })
  }

  if (baseModelIndex >= 0 && !models[baseModelIndex]?.fallback) {
    issues.push({
      path: [baseModelIndex, 'fallback'],
      message: `Model "${CHAT_BASE_MODEL_ID}" must be a participant-credit fallback.`,
    })
  }

  return issues
}
