import type { useTranslations } from 'next-intl'

export type ReasoningEffort = string

// Reasoning efforts are configured per chatbot and per model, so the value is a
// free-form string. Only the well-known ones get a localized label; anything
// else falls back to its raw name — same contract as `modes.ts`.
const KNOWN_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const

type KnownReasoningEffort = (typeof KNOWN_REASONING_EFFORTS)[number]

function isKnownReasoningEffort(
  effort: string
): effort is KnownReasoningEffort {
  return (KNOWN_REASONING_EFFORTS as readonly string[]).includes(effort)
}

/**
 * Localized name for a reasoning effort. Used by both the selector and the
 * caption under an answer so they cannot drift apart; the import is type-only,
 * so this stays usable from server code that only wants `ReasoningEffort`.
 */
export function formatReasoningEffort(
  // `<never>` is the root-namespace instantiation, i.e. the one every caller
  // gets from a bare `useTranslations()`. Without it the generic resolves to a
  // union over every namespace and only relative keys typecheck.
  t: ReturnType<typeof useTranslations<never>>,
  effort: string
) {
  return isKnownReasoningEffort(effort)
    ? t(`chat.settingsPanel.reasoningEfforts.${effort}`)
    : effort.charAt(0).toUpperCase() + effort.slice(1)
}
