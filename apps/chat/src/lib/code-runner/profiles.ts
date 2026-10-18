// Browser code runtime profiles. Shared by the server policy, the card tool
// contract and the client card, so it must stay free of server-only imports.
export const CODE_CARD_TOOL_NAME = 'open_code_card'

export const CODE_PROFILES = ['python-core', 'r-base'] as const

export type CodeProfile = (typeof CODE_PROFILES)[number]

export const MAX_STARTER_CODE_LENGTH = 8000

/** Upper bound for what a learner can type into the editor. */
export const MAX_CODE_LENGTH = 50_000

export function isCodeProfile(value: unknown): value is CodeProfile {
  return (CODE_PROFILES as readonly unknown[]).includes(value)
}

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
    if (mode === '__proto__' || !Array.isArray(profiles)) continue
    const admitted = CODE_PROFILES.filter((profile) =>
      profiles.includes(profile)
    )
    if (admitted.length > 0) normalized[mode] = admitted
  }
  return normalized
}
