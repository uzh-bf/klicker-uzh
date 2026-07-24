'use client'

import { Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { isKnownMode } from '../lib/config/modes'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatUi } from './chat-ui-context'

export function EmbeddedSettings() {
  const t = useTranslations()
  const { showMinimalSettings } = useChatUi()
  const { selectedMode, modeOptions, setSelectedMode } = useSettingsStore()

  if (!showMinimalSettings) return null

  const modeKeys = Object.keys(modeOptions)
  if (modeKeys.length <= 1) return null

  return (
    <div className="min-w-0 max-w-[12rem] shrink sm:max-w-xs">
      <select
        value={selectedMode}
        onChange={(e) => setSelectedMode(e.target.value)}
        className="border-input bg-background text-foreground w-full cursor-pointer truncate rounded-md border px-2 py-1 text-xs outline-none"
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
    </div>
  )
}

/**
 * Compact bottom-of-embed credits readout for embedded mode. Reads the same
 * `useSettingsStore` state (and its existing fetch) that `CreditsFooter` uses
 * for the sidebar — no separate fetching logic. Deliberately trimmed down
 * from `CreditsFooter` (no progress bar, no cost-hint/reset copy): a small
 * embed has little vertical room, and `chat.credits.exhausted` already
 * doubles as the fallback-model notice ("you can still use the smaller
 * model"), so no separate `settingsPanel.usingFallbackModel` text is needed.
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
    <div
      data-cy="chat-embedded-credits-bar"
      className="border-t px-3 py-1.5 text-xs"
    >
      <div className="flex items-center gap-1.5">
        <Zap className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground truncate">
          {t('chat.credits.title')}
        </span>
        <span
          data-cy="chat-embedded-credits-display"
          className={twMerge(
            'ml-auto shrink-0 tabular-nums font-medium',
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
