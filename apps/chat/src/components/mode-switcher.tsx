'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { getModeIcon, isKnownMode } from '../lib/config/modes'
import { useSettingsStore } from '../stores/settingsStore'

export function ModeSwitcher() {
  const t = useTranslations()
  const { modeOptions, selectedMode, setSelectedMode } = useSettingsStore()
  const modeKeys = Object.keys(modeOptions)

  // Nothing to switch between when a chatbot exposes a single mode.
  if (modeKeys.length <= 1) return null

  return (
    <div
      role="group"
      aria-label={t('chat.modes.switcherLabel')}
      data-cy="chat-mode-switcher"
      className="bg-muted scrollbar-none flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-0.5"
    >
      {modeKeys.map((mode) => {
        const Icon = getModeIcon(mode)
        const label = isKnownMode(mode)
          ? t(`chat.modes.${mode}`)
          : mode.charAt(0).toUpperCase() + mode.slice(1)
        const isActive = mode === selectedMode

        return (
          <button
            key={mode}
            type="button"
            aria-pressed={isActive}
            data-cy={`chat-mode-option-${mode}`}
            title={modeOptions[mode] || label}
            onClick={() => setSelectedMode(mode)}
            className={twMerge(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : // Full foreground rather than muted-foreground: the inactive
                  // tab sits on bg-muted, where muted-foreground only reaches
                  // ~4.4:1 and misses the WCAG 1.4.3 AA floor for this text
                  // size. The active state is carried by the filled pill, not
                  // by the label colour.
                  'text-foreground hover:bg-background/60'
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
