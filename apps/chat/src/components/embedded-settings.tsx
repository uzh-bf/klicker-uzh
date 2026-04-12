'use client'

import { useSettingsStore } from '../stores/settingsStore'
import { useChatUi } from './chat-ui-context'

export function EmbeddedSettings() {
  const { showMinimalSettings } = useChatUi()
  const { selectedMode, modeOptions, setSelectedMode } = useSettingsStore()

  if (!showMinimalSettings) return null

  const modeEntries = Object.entries(modeOptions)
  if (modeEntries.length <= 1) return null

  return (
    <div className="min-w-0 max-w-[12rem] shrink sm:max-w-xs">
      <select
        value={selectedMode}
        onChange={(e) => setSelectedMode(e.target.value)}
        className="border-input bg-background text-foreground w-full cursor-pointer truncate rounded-md border px-2 py-1 text-xs outline-none"
      >
        {modeEntries.map(([key, description]) => (
          <option key={key} value={key}>
            {description || key.charAt(0).toUpperCase() + key.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
