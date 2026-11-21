'use client'

import { Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { createElement, useId } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type ChatModeOptions,
  formatModeLabel,
  getModeDescription,
  getModeIcon,
  resolveSelectedMode,
} from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'

function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  return createElement(getModeIcon(mode), {
    'aria-hidden': true,
    className,
  })
}

// The mode menu uses the design-system Select, like the settings panel. Each
// option shows its icon and description; the trigger shows only the short
// label, so it stays as compact as the other selects.
export function ModeSwitcher({
  modeOptions: modeOptionsOverride,
  testIdPrefix = 'chat-mode',
  className,
  fullWidth = false,
}: {
  modeOptions?: ChatModeOptions
  testIdPrefix?: string
  className?: string
  fullWidth?: boolean
} = {}) {
  const t = useTranslations()
  const selectId = useId()
  const storeModeOptions = useSettingsStore((state) => state.modeOptions)
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const modeOptions = modeOptionsOverride ?? storeModeOptions
  const modeKeys = Object.keys(modeOptions)
  const effectiveSelectedMode = resolveSelectedMode(modeOptions, selectedMode)

  // Nothing to switch between when a chatbot exposes a single mode.
  if (modeKeys.length <= 1) return null

  const selectedLabel = formatModeLabel(t, effectiveSelectedMode, modeOptions)

  return (
    <div className={twMerge('min-w-0', className)}>
      {/* The design-system Select takes no aria-label; a hidden label names
          the combobox with both its purpose and the current mode. */}
      <label htmlFor={selectId} className="sr-only">
        {`${t('chat.modes.switcherLabel')}: ${selectedLabel}`}
      </label>
      <Select
        id={selectId}
        data={{ cy: `${testIdPrefix}-switcher` }}
        value={effectiveSelectedMode}
        onChange={setSelectedMode}
        contentPosition="popper"
        className={{
          root: 'min-w-0',
          trigger: twMerge(
            'h-11 w-auto min-w-28 max-w-48 gap-1.5 text-sm font-medium fine-pointer:h-8',
            fullWidth && 'w-full'
          ),
          content: 'w-[min(22rem,calc(100vw-1rem))]',
          item: 'min-h-11 py-2 text-sm',
        }}
        items={modeKeys.map((mode) => {
          const label = formatModeLabel(t, mode, modeOptions)
          const description = getModeDescription(t, mode, modeOptions)
          return {
            value: mode,
            shortLabel: label,
            data: { cy: `${testIdPrefix}-option-${mode}` },
            className: { item: 'items-start', label: 'min-w-0' },
            label: (
              <span className="flex items-start gap-2">
                <ModeIcon mode={mode} className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">{label}</span>
                  {description ? (
                    <span
                      data-cy={`${testIdPrefix}-description-${mode}`}
                      className="text-muted-foreground mt-0.5 block text-pretty text-xs leading-4"
                    >
                      {description}
                    </span>
                  ) : null}
                </span>
              </span>
            ),
          }
        })}
      />
    </div>
  )
}
