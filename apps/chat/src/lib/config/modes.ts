import {
  GraduationCap,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// Presentation metadata for the chatbot mode keys exposed via `systemPrompts`.
// Modes are configured per chatbot, so only the well-known keys get a dedicated
// icon and localized label; any other key falls back to a neutral icon and its
// raw name.
const MODE_ICONS = {
  tutor: GraduationCap,
  explainer: Lightbulb,
} as const

export type KnownMode = keyof typeof MODE_ICONS

export function isKnownMode(mode: string): mode is KnownMode {
  return mode in MODE_ICONS
}

export function getModeIcon(mode: string): LucideIcon {
  return isKnownMode(mode) ? MODE_ICONS[mode] : Sparkles
}
