import type { Chatbot } from '@klicker-uzh/prisma/client'

type ChatbotWithAuthoringColumns = Pick<
  Chatbot,
  'customModeConfig' | 'draftConfig' | 'standardModeConfig'
>

/**
 * Resolves the mode configuration an owner preview should show. A saved
 * revision is the authoritative authoring state. Revisions and fixtures from
 * before either field existed inherit the live column, while an explicit null
 * remains null so preview applies the same legacy/default rules as runtime.
 */
export function resolveOwnerPreviewModeConfigurations(
  chatbot: ChatbotWithAuthoringColumns
): { customModeConfig: unknown; standardModeConfig: unknown } {
  const draftConfig = chatbot.draftConfig
  if (
    !draftConfig ||
    typeof draftConfig !== 'object' ||
    Array.isArray(draftConfig)
  ) {
    return {
      customModeConfig: chatbot.customModeConfig,
      standardModeConfig: chatbot.standardModeConfig,
    }
  }

  const savedConfig = draftConfig as Record<string, unknown>
  return {
    customModeConfig:
      savedConfig.customModeConfig === undefined
        ? chatbot.customModeConfig
        : savedConfig.customModeConfig,
    standardModeConfig:
      savedConfig.standardModeConfig === undefined
        ? chatbot.standardModeConfig
        : savedConfig.standardModeConfig,
  }
}
