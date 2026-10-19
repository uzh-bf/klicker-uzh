import {
  GraduationCap,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  Sparkles,
} from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { type CodeProfile, isCodeProfile } from '@/src/lib/code-runner/profiles'

// Presentation metadata for the chatbot mode keys exposed via `systemPrompts`
// and `customModeConfig`.
// Modes are configured per chatbot, so only the well-known keys get a dedicated
// icon and localized label; any other key falls back to a neutral icon and its
// authored name, a generic label for a custom-mode key, or its raw name.
const MODE_ICONS = {
  tutor: GraduationCap,
  explainer: Lightbulb,
  quizzer: ListChecks,
} as const

export type KnownMode = keyof typeof MODE_ICONS

export function isKnownMode(mode: string): mode is KnownMode {
  return Object.prototype.hasOwnProperty.call(MODE_ICONS, mode)
}

export interface ChatModeOption {
  description: string
  name?: string
  welcomeMessage?: string
  starterPrompts?: string[]
  /** Browser code profiles this mode may open, derived on the server. */
  codeProfiles?: CodeProfile[]
}

export type ChatModeOptions = Record<string, ChatModeOption>

export function parseModeOptions(value: unknown): ChatModeOptions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const entries: [string, ChatModeOption][] = []
  if (Object.entries(value).some(([mode]) => mode.trim().length === 0)) {
    return null
  }

  for (const [mode, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      // Older deployments sent the mode description directly; keep accepting
      // that wire shape so a stale participant tab can still resolve modes.
      entries.push([mode, { description: entry }])
      continue
    }

    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof (entry as Record<string, unknown>).description !== 'string' ||
      ((entry as Record<string, unknown>).name !== undefined &&
        typeof (entry as Record<string, unknown>).name !== 'string')
    ) {
      return null
    }

    const option = entry as Record<string, unknown>
    const starterPrompts = Array.isArray(option.starterPrompts)
      ? option.starterPrompts.filter(
          (prompt): prompt is string =>
            typeof prompt === 'string' && prompt.trim().length > 0
        )
      : []
    const codeProfiles = Array.isArray(option.codeProfiles)
      ? option.codeProfiles.filter(isCodeProfile)
      : []
    entries.push([
      mode,
      {
        description: option.description as string,
        ...(typeof option.name === 'string' ? { name: option.name } : {}),
        ...(typeof option.welcomeMessage === 'string' &&
        option.welcomeMessage.trim()
          ? { welcomeMessage: option.welcomeMessage }
          : {}),
        ...(starterPrompts.length > 0 ? { starterPrompts } : {}),
        ...(codeProfiles.length > 0 ? { codeProfiles } : {}),
      },
    ])
  }

  return Object.fromEntries(entries)
}

export function resolveSelectedMode(
  modeOptions: ChatModeOptions,
  selectedMode: string
): string {
  const firstMode = Object.keys(modeOptions)[0]
  if (!firstMode) return ''

  return Object.prototype.hasOwnProperty.call(modeOptions, selectedMode)
    ? selectedMode
    : firstMode
}

export function hasAvailableChatMode(modeOptions: ChatModeOptions): boolean {
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
  modeOptions: ChatModeOptions
): string {
  return isKnownMode(mode)
    ? t(`chat.modes.${mode}Description`)
    : (modeOptions[mode]?.description.trim() ?? '')
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
  mode: string,
  modeOptions?: ChatModeOptions
): string {
  const authoredName = modeOptions?.[mode]?.name?.trim()
  if (authoredName) return authoredName
  // A custom-mode key (`cm_` + random id) is meaningless to participants. It
  // has no authored name here once its mode is no longer approved, e.g. on an
  // older answer or thread, so it gets a generic label instead.
  if (mode.startsWith('cm_')) return t('chat.modes.custom')
  return isKnownMode(mode)
    ? t(`chat.modes.${mode}`)
    : mode.charAt(0).toUpperCase() + mode.slice(1)
}
