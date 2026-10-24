import type { ModelOption } from './config/models'
import type { ReasoningEffort } from './config/reasoning'

type PreviewModelCapabilities = Pick<
  ModelOption,
  'id' | 'supportsReasoning' | 'allowedReasoningEfforts'
>

export type OwnerPreviewModelResolution<T> =
  | {
      model: T
      reasoningEffort: ReasoningEffort | null
    }
  | {
      model: null
      reason:
        | 'MODEL_UNAVAILABLE'
        | 'REASONING_EFFORT_UNAVAILABLE'
        | 'REASONING_EFFORT_NOT_SUPPORTED'
    }

/**
 * Keeps the fixed-model default aligned with the participant route. A saved
 * effort is already narrowed by the server registry before this helper runs.
 */
export function getDefaultReasoningEffort(
  allowedReasoningEfforts: readonly ReasoningEffort[]
): ReasoningEffort | null {
  if (allowedReasoningEfforts.length === 0) return null
  return allowedReasoningEfforts.includes('medium')
    ? 'medium'
    : (allowedReasoningEfforts[0] ?? null)
}

export function toOwnerPreviewModelOption(
  model: Pick<
    ModelOption,
    | 'id'
    | 'name'
    | 'description'
    | 'fallback'
    | 'supportsReasoning'
    | 'supportsImageAttachments'
  > & {
    supportedReasoningEfforts: readonly ReasoningEffort[]
  }
): ModelOption {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    fallback: model.fallback,
    supportsReasoning: model.supportsReasoning,
    allowedReasoningEfforts: [...model.supportedReasoningEfforts],
    supportsImageAttachments: model.supportsImageAttachments,
  }
}

/**
 * Applies the saved owner-preview model policy to the request's optional
 * selections. Fixed chatbots never trust either client selection. Participant
 * selection only accepts models and efforts in the server-derived allow-list.
 */
export function resolveOwnerPreviewModel<T extends PreviewModelCapabilities>({
  modelSelection,
  models,
  automaticModelId,
  requestedModelId,
  requestedReasoningEffort,
}: {
  modelSelection: boolean
  models: readonly T[]
  automaticModelId: string | null
  requestedModelId?: string
  requestedReasoningEffort?: string | null
}): OwnerPreviewModelResolution<T> {
  if (!modelSelection) {
    const fixedModel = models.find((model) => model.id === automaticModelId)
    if (!fixedModel) return { model: null, reason: 'MODEL_UNAVAILABLE' }

    return {
      model: fixedModel,
      reasoningEffort: fixedModel.supportsReasoning
        ? getDefaultReasoningEffort(fixedModel.allowedReasoningEfforts)
        : null,
    }
  }

  const selectedModel =
    requestedModelId === undefined
      ? (models.find((model) => model.id === automaticModelId) ?? models[0])
      : models.find((model) => model.id === requestedModelId)

  if (!selectedModel) return { model: null, reason: 'MODEL_UNAVAILABLE' }

  const allowedReasoningEfforts = selectedModel.allowedReasoningEfforts
  if (allowedReasoningEfforts.length === 0) {
    return requestedReasoningEffort == null
      ? { model: selectedModel, reasoningEffort: null }
      : {
          model: null,
          reason: 'REASONING_EFFORT_NOT_SUPPORTED',
        }
  }

  if (requestedReasoningEffort === null) {
    return { model: null, reason: 'REASONING_EFFORT_UNAVAILABLE' }
  }

  if (
    requestedReasoningEffort !== undefined &&
    !allowedReasoningEfforts.includes(requestedReasoningEffort)
  ) {
    return { model: null, reason: 'REASONING_EFFORT_UNAVAILABLE' }
  }

  return {
    model: selectedModel,
    reasoningEffort:
      requestedReasoningEffort ??
      getDefaultReasoningEffort(allowedReasoningEfforts),
  }
}
