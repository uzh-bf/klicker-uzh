'use client'

import { Select } from '@uzh-bf/design-system'
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
      <Select
        placeholder="Select Chat Mode"
        items={modeEntries.map(([key, description]) => ({
          value: key,
          label: description || key.charAt(0).toUpperCase() + key.slice(1),
        }))}
        onChange={(newValue) => setSelectedMode(newValue)}
        value={selectedMode}
      />
    </div>
  )
}
