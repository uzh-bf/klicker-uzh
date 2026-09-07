import {
  GraduationCap,
  Lightbulb,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { useTranslations } from 'next-intl'

// Presentation metadata for the chatbot mode keys exposed via `systemPrompts`.
// Modes are configured per chatbot, so only the well-known keys get a dedicated
// icon and localized label; any other key falls back to a neutral icon and its
// raw name.
const MODE_ICONS = {
  tutor: GraduationCap,
  explainer: Lightbulb,
  quizzer: ListChecks,
} as const

export type KnownMode = keyof typeof MODE_ICONS

export function isKnownMode(mode: string): mode is KnownMode {
  return Object.prototype.hasOwnProperty.call(MODE_ICONS, mode)
}

export function parseModeOptions(
  value: unknown
): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const entries = Object.entries(value)
  if (
    entries.some(
      ([mode, description]) =>
        mode.trim().length === 0 || typeof description !== 'string'
    )
  ) {
    return null
  }
  return Object.fromEntries(entries) as Record<string, string>
}

export function resolveSelectedMode(
  modeOptions: Record<string, string>,
  selectedMode: string
): string {
  const firstMode = Object.keys(modeOptions)[0]
  if (!firstMode) return ''

  return Object.prototype.hasOwnProperty.call(modeOptions, selectedMode)
    ? selectedMode
    : firstMode
}

export function hasAvailableChatMode(
  modeOptions: Record<string, string>
): boolean {
  return Object.keys(modeOptions).length > 0
}

export function getComposerSubmitMode(
  hasAvailableMode: boolean
): 'enter' | 'none' {
  return hasAvailableMode ? 'enter' : 'none'
}

export function getModeDescription(
  t: ReturnType<typeof useTranslations<never>>,
  mode: string,
  modeOptions: Record<string, string>
): string {
  return isKnownMode(mode)
    ? t(`chat.modes.${mode}Description`)
    : (modeOptions[mode]?.trim() ?? '')
}

export function getModeIcon(mode: string): LucideIcon {
  return isKnownMode(mode) ? MODE_ICONS[mode] : Sparkles
}

/**
 * Localized label for a chat mode, e.g. for the sidebar thread-list mode
 * line. Same contract as `mode-switcher.tsx` / `embedded-settings.tsx`
 * (isKnownMode + `chat.modes.*`, capitalized raw name otherwise) and
 * `lib/config/reasoning.ts`'s `formatReasoningEffort` — pulled out here so a
 * new call site doesn't have to re-inline the ternary.
 */
export function formatModeLabel(
  // `<never>` is the root-namespace instantiation, i.e. the one every caller
  // gets from a bare `useTranslations()`. Without it the generic resolves to a
  // union over every namespace and only relative keys typecheck.
  t: ReturnType<typeof useTranslations<never>>,
  mode: string
): string {
  return isKnownMode(mode)
    ? t(`chat.modes.${mode}`)
    : mode.charAt(0).toUpperCase() + mode.slice(1)
}
