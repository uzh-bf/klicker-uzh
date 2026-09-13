'use client'

import { ChevronDown, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { isKnownMode } from '../lib/config/modes'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatUi } from './chat-ui-context'

/**
 * Whether the embedded mode select has anything to offer. Shared by the bar
 * that decides whether it has any content at all and by the select itself, so
 * the two can never disagree about the empty state.
 */
export function hasEmbeddedModeSettings(
  showMinimalSettings: boolean,
  modeOptions: Record<string, string>
) {
  return showMinimalSettings && Object.keys(modeOptions).length > 1
}

export function EmbeddedSettings() {
  const t = useTranslations()
  const { showMinimalSettings } = useChatUi()
  const { selectedMode, modeOptions, setSelectedMode } = useSettingsStore()

  if (!hasEmbeddedModeSettings(showMinimalSettings, modeOptions)) return null
  const modeKeys = Object.keys(modeOptions)

  return (
    <div className="relative ml-auto min-w-0 max-w-[12rem] shrink sm:max-w-xs">
      <select
        value={selectedMode}
        onChange={(e) => setSelectedMode(e.target.value)}
        aria-label={t('chat.modes.switcherLabel')}
        className="border-input bg-background text-foreground hover:border-ring focus-visible:ring-ring w-full cursor-pointer appearance-none truncate rounded-md border py-1 pl-2 pr-6 text-xs outline-none transition-colors focus-visible:ring-1"
      >
        {/* Same localized-label source as mode-switcher.tsx (`chat.modes.*`
            + isKnownMode, D3-pattern for unknown modes) — labels here must
            not fall back to `modeOptions[key]`, which is the English-only
            registry description, or the DE select leaks raw English. */}
        {modeKeys.map((key) => {
          const label = isKnownMode(key)
            ? t(`chat.modes.${key}`)
            : key.charAt(0).toUpperCase() + key.slice(1)
          return (
            <option key={key} value={key}>
              {label}
            </option>
          )
        })}
      </select>
      {/* `appearance-none` above drops the browser-default arrow, so we draw
          our own — purely decorative, the select itself stays keyboard/AT
          accessible as a native control. */}
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2"
      />
    </div>
  )
}

/**
 * Compact embedded credits readout for embedded mode. Reads the same
 * `useSettingsStore` state (and its existing fetch) that `CreditsFooter` uses
 * for the sidebar — no separate fetching logic. Deliberately trimmed down
 * from `CreditsFooter` (no progress bar, no cost-hint/reset copy): a small
 * embed has little vertical room, and `chat.credits.exhausted` already states
 * that model availability may change, so no separate
 * `settingsPanel.usingFallbackModel` text is needed.
 */
export function EmbeddedCreditsBar() {
  const t = useTranslations()
  const credits = useSettingsStore((state) => state.credits)
  const creditsLoaded = useSettingsStore((state) => state.creditsLoaded)

  // Same reasoning as CreditsFooter: say nothing before the fetch resolves
  // (or if it fails) rather than show a placeholder that could claim 0
  // credits when the real number just hasn't loaded yet.
  if (!creditsLoaded) return null

  const exhausted = credits.current === 0

  return (
    <div data-cy="chat-embedded-credits-bar" className="min-w-0 text-xs">
      <div className="flex items-center gap-1.5">
        <Zap className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground truncate">
          {t('chat.credits.title')}
        </span>
        <span
          data-cy="chat-embedded-credits-display"
          className={twMerge(
            'ml-auto shrink-0 font-medium tabular-nums',
            exhausted && 'text-destructive'
          )}
        >
          {Math.round(credits.current)} / {credits.total}
        </span>
      </div>
      {exhausted && (
        <p
          data-cy="chat-embedded-credits-empty-message"
          className="text-muted-foreground mt-0.5"
        >
          {t('chat.credits.exhausted')}
        </p>
      )}
    </div>
  )
}
