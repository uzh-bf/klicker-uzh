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

export type ChatModelPolicyOptions = {
  primaryModelId?: string
  fallbackModelId?: string
  newChatbotModelPolicyJson?: string
}

export type ChatModelNewChatbotPolicy = {
  modelSelection: boolean
  allowedModelIds: string[]
}

export type ChatModelPolicy = {
  primaryModelId: string
  fallbackModelId: string
  newChatbotModelPolicy: ChatModelNewChatbotPolicy
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

  if (!models.some((model) => model.usageClass === 'BASE' && model.fallback)) {
    issues.push({
      message:
        'At least one BASE model with "fallback: true" is required for participant-credit fallback.',
    })
  }

  return issues
}

/** Parses and validates the optional JSON policy for newly created chatbots. */
function resolveNewChatbotModelPolicy(
  models: readonly ChatModelBasePolicyModel[],
  policyJson: string | undefined,
  fallbackModelId: string
): ChatModelNewChatbotPolicy {
  if (!policyJson) {
    return { modelSelection: false, allowedModelIds: [fallbackModelId] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(policyJson)
  } catch {
    throw new Error('Configured new-chatbot model policy is not valid JSON.')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'Configured new-chatbot model policy must be a JSON object.'
    )
  }

  const policy = parsed as Record<string, unknown>
  const unknownKeys = Object.keys(policy).filter(
    (key) => key !== 'modelSelection' && key !== 'allowedModelIds'
  )
  if (unknownKeys.length > 0) {
    throw new Error(
      `Configured new-chatbot model policy has unknown fields: ${unknownKeys.join(', ')}.`
    )
  }
  if (typeof policy.modelSelection !== 'boolean') {
    throw new Error(
      'Configured new-chatbot model policy requires a boolean "modelSelection".'
    )
  }

  const allowedModelIds = policy.allowedModelIds
  if (!Array.isArray(allowedModelIds) || allowedModelIds.length === 0) {
    throw new Error(
      'Configured new-chatbot model policy requires a nonempty "allowedModelIds" list.'
    )
  }
  if (!allowedModelIds.every((id): id is string => typeof id === 'string')) {
    throw new Error(
      'Configured new-chatbot model policy requires string model IDs.'
    )
  }
  if (new Set(allowedModelIds).size !== allowedModelIds.length) {
    throw new Error(
      'Configured new-chatbot model policy requires unique model IDs.'
    )
  }
  const unknownModelIds = allowedModelIds.filter(
    (id) => !models.some((model) => model.id === id)
  )
  if (unknownModelIds.length > 0) {
    throw new Error(
      `Configured new-chatbot model policy references unknown models: ${unknownModelIds.join(', ')}.`
    )
  }
  if (!policy.modelSelection && allowedModelIds.length !== 1) {
    throw new Error(
      'Configured new-chatbot model policy requires exactly one allowed model when "modelSelection" is false.'
    )
  }

  return {
    modelSelection: policy.modelSelection,
    allowedModelIds: [...allowedModelIds],
  }
}

/** Resolves the shared automatic, fallback, and new-chatbot model policy. */
export function resolveChatModelPolicy(
  models: readonly ChatModelBasePolicyModel[],
  options: ChatModelPolicyOptions = {}
): ChatModelPolicy {
  const primaryModelId = options.primaryModelId || 'auto'
  if (!models.some((model) => model.id === primaryModelId)) {
    throw new Error(
      `Configured primary model "${primaryModelId}" does not exist in the registry.`
    )
  }

  const isEligibleFallback = (model: ChatModelBasePolicyModel) =>
    model.usageClass === 'BASE' && model.fallback

  let fallbackModelId: string
  if (options.fallbackModelId) {
    const configuredFallback = models.find(
      (model) => model.id === options.fallbackModelId
    )
    if (!configuredFallback) {
      throw new Error(
        `Configured fallback model "${options.fallbackModelId}" does not exist in the registry.`
      )
    }
    if (!isEligibleFallback(configuredFallback)) {
      throw new Error(
        `Configured fallback model "${options.fallbackModelId}" must be a BASE model with "fallback: true".`
      )
    }
    fallbackModelId = configuredFallback.id
  } else {
    const legacyFallback = models.find(
      (model) => model.id === CHAT_BASE_MODEL_ID && isEligibleFallback(model)
    )
    if (legacyFallback) {
      fallbackModelId = legacyFallback.id
    } else {
      const eligibleFallbacks = models.filter(isEligibleFallback)
      const [onlyEligibleFallback] = eligibleFallbacks
      if (!onlyEligibleFallback) {
        throw new Error(
          'Chat model policy requires at least one BASE model with "fallback: true".'
        )
      }
      if (eligibleFallbacks.length !== 1) {
        throw new Error(
          'Chat model policy requires exactly one BASE model with "fallback: true" when no fallback model is configured.'
        )
      }
      fallbackModelId = onlyEligibleFallback.id
    }
  }

  const newChatbotModelPolicy = resolveNewChatbotModelPolicy(
    models,
    options.newChatbotModelPolicyJson,
    fallbackModelId
  )

  return { primaryModelId, fallbackModelId, newChatbotModelPolicy }
}
