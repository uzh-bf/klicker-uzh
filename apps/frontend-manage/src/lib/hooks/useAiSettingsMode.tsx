import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

export type AiSettingsMode = 'simple' | 'advanced'

const AI_SETTINGS_MODE_STORAGE_KEY = 'klicker-manage-ai-settings-mode'

/**
 * The lecturer's choice between the simple and the advanced AI settings,
 * remembered in this browser. Simple is shown until the stored value has been
 * read, so server and first client render agree.
 */
export function useAiSettingsMode(): [
  AiSettingsMode,
  (mode: AiSettingsMode) => void,
] {
  const [mode, setModeState] = useState<AiSettingsMode>('simple')

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem(AI_SETTINGS_MODE_STORAGE_KEY) === 'advanced'
      ) {
        setModeState('advanced')
      }
    } catch {
      // Storage can be unavailable; the choice then lasts for this page view.
    }
  }, [])

  const setMode = useCallback((next: AiSettingsMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(AI_SETTINGS_MODE_STORAGE_KEY, next)
    } catch {
      // See above.
    }
  }, [])

  return [mode, setMode]
}

export function AiSettingsModeSwitch({
  mode,
  onChange,
}: {
  mode: AiSettingsMode
  onChange: (mode: AiSettingsMode) => void
}) {
  const t = useTranslations()
  const options: { value: AiSettingsMode; label: string }[] = [
    { value: 'simple', label: t('manage.resources.aiSettingsModeSimple') },
    { value: 'advanced', label: t('manage.resources.aiSettingsModeAdvanced') },
  ]

  return (
    <fieldset
      className="inline-flex rounded-md border border-gray-300 bg-white p-0.5"
      data-cy="ai-settings-mode"
    >
      <legend className="sr-only">
        {t('manage.resources.aiSettingsModeLabel')}
      </legend>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          className={`focus-visible:ring-primary-80 rounded px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 ${
            mode === value
              ? 'bg-primary-100 text-white'
              : 'hover:bg-primary-20 text-gray-700'
          }`}
          onClick={() => onChange(value)}
          data-cy={`ai-settings-mode-${value}`}
        >
          {label}
        </button>
      ))}
    </fieldset>
  )
}
