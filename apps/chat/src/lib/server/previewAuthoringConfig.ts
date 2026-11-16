import type { Chatbot } from '@klicker-uzh/prisma/client'

type ChatbotWithAuthoringColumns = Pick<
  Chatbot,
  'customModeConfig' | 'draftConfig'
>

/**
 * Resolves the custom-mode configuration an owner preview should show. A
 * saved revision is the authoritative authoring state, but revisions saved
 * before custom modes existed (and fixtures without the column) may lack the
 * field, so the live custom-mode column remains the fallback.
 */
export function resolveOwnerPreviewModeConfiguration(
  chatbot: ChatbotWithAuthoringColumns
): unknown {
  const draftConfig = chatbot.draftConfig
  if (
    !draftConfig ||
    typeof draftConfig !== 'object' ||
    Array.isArray(draftConfig)
  ) {
    return chatbot.customModeConfig
  }

  const customModeConfig = (draftConfig as Record<string, unknown>)
    .customModeConfig
  return customModeConfig === undefined
    ? chatbot.customModeConfig
    : customModeConfig
}
