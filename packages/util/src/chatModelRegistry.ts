export const CHAT_BASE_MODEL_ID = 'gpt-5.6-luna'

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

  if (autoModel.model.usageClass !== 'ADVANCED') {
    issues.push({
      path: [autoModel.index, 'usageClass'],
      message: 'Model "auto" must be classified as ADVANCED.',
    })
  }
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
  const baseModels = models.filter((model) => model.usageClass === 'BASE')
  const issues: ChatModelBasePolicyIssue[] = []

  if (baseModels.length !== 1 || baseModels[0]?.id !== CHAT_BASE_MODEL_ID) {
    issues.push({
      message: `Model "${CHAT_BASE_MODEL_ID}" must be the registry's only BASE model.`,
    })
  }

  const baseModelIndex = models.findIndex(
    (model) => model.id === CHAT_BASE_MODEL_ID
  )
  if (baseModelIndex >= 0 && !models[baseModelIndex]?.fallback) {
    issues.push({
      path: [baseModelIndex, 'fallback'],
      message: `Model "${CHAT_BASE_MODEL_ID}" must be a participant-credit fallback.`,
    })
  }

  return issues
}
