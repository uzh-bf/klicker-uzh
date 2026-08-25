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
