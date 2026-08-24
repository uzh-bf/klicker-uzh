import type { PromptCatalogModeInput } from './chatbotPromptCatalog.js'
import { DEFAULT_TUTOR_PROMPT } from './chatbotPromptDefaults.js'

/**
 * Deterministic projection of the legacy systemPrompts JSON into catalog
 * inputs. Null/empty JSON projects the tutor fallback; malformed entries
 * return invalid instead of silently materializing empty text.
 */
export type ChatbotPromptProjection =
  | { isValid: false }
  | { isValid: true; modes: PromptCatalogModeInput[] }

export function projectLegacySystemPrompts(
  systemPrompts: unknown
): ChatbotPromptProjection {
  if (systemPrompts == null) {
    return {
      isValid: true,
      modes: [{ key: 'tutor', prompt: DEFAULT_TUTOR_PROMPT }],
    }
  }

  if (typeof systemPrompts !== 'object' || Array.isArray(systemPrompts)) {
    return { isValid: false }
  }

  const modes: PromptCatalogModeInput[] = []
  for (const [key, value] of Object.entries(systemPrompts)) {
    if (value != null && (typeof value !== 'object' || Array.isArray(value))) {
      return { isValid: false }
    }

    const entry = (value ?? {}) as { prompt?: unknown; description?: unknown }
    if (entry.prompt != null && typeof entry.prompt !== 'string') {
      return { isValid: false }
    }
    if (entry.description != null && typeof entry.description !== 'string') {
      return { isValid: false }
    }

    const prompt =
      key === 'tutor' && (entry.prompt === '' || entry.prompt === undefined)
        ? DEFAULT_TUTOR_PROMPT
        : (entry.prompt ?? '')
    modes.push({
      key,
      prompt,
      description: entry.description == null ? null : entry.description,
    })
  }

  if (modes.length === 0) {
    return {
      isValid: true,
      modes: [{ key: 'tutor', prompt: DEFAULT_TUTOR_PROMPT }],
    }
  }
  return { isValid: true, modes }
}
