// Chat's browser code execution policy and card tool contract. Shared by the
// server and the client card, so it must stay free of server-only imports.
import { CODE_PROFILES, type CodeProfile } from '@klicker-uzh/code-runner'

export const CODE_CARD_TOOL_NAME = 'open_code_card'

export const MAX_STARTER_CODE_LENGTH = 8000

/**
 * Reads the platform-owned `Chatbot.codeExecutionConfig` column. Anything
 * malformed fails closed: an unknown mode shape, a non-list value or an
 * unknown profile simply admits nothing for that entry.
 */
export function normalizeCodeExecutionConfig(
  value: unknown
): Record<string, CodeProfile[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const modes = (value as { modes?: unknown }).modes
  if (!modes || typeof modes !== 'object' || Array.isArray(modes)) return {}

  const normalized: Record<string, CodeProfile[]> = {}
  for (const [mode, profiles] of Object.entries(modes)) {
    if (!Array.isArray(profiles)) continue
    const admitted = CODE_PROFILES.filter((profile) =>
      profiles.includes(profile)
    )
    if (admitted.length > 0) normalized[mode] = admitted
  }
  return normalized
}
