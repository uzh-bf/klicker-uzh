'use client'

import { useState } from 'react'
import { type ModelID } from '../../lib/config/models'
import { useSettingsStore } from '../../stores/settingsStore'

import { Progress, Select } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react'

export function SettingsPanel() {
  const {
    selectedModel,
    selectedMode,
    credits,
    modelOptions,
    modeOptions,
    setSelectedModel,
    setSelectedMode,
  } = useSettingsStore()
  const [open, setOpen] = useState(false)

  const creditsPercentage =
    credits.total > 0 ? (credits.current / credits.total) * 100 : 0

  const handleModelChange = (value: string) => {
    setSelectedModel(value as ModelID)
  }

  const handleModeChange = (value: string) => {
    setSelectedMode(value as string)
  }

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 border-t p-4 hover:bg-gray-100"
        onClick={() => setOpen(!open)}
      >
        <Settings2 className="h-4 w-4" />
        <span className="text-basefont-medium">Settings</span>
        {/* up and down arrow on the right based on whether is opened or not */}
        <span className="ml-auto">
          {!open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </div>
      {open && (
        <div className="border-muted space-y-4 border-t p-4">
          <div>
            {/* model selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold">AI Model</label>
              <Select
                placeholder="Select AI Model"
                items={modelOptions.map((option) => ({
                  value: option.id,
                  label: option.name,
                }))}
                onChange={(newValue) => {
                  handleModelChange(newValue)
                }}
                value={selectedModel}
              />
              <p className="text-muted-foreground text-sm">
                {
                  modelOptions.find((option) => option.id === selectedModel)
                    ?.description
                }
              </p>
            </div>

            {/* mode selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold">Chat Mode</label>
              <Select
                placeholder="Select Chat Mode"
                items={
                  Object.keys(modeOptions).length > 0
                    ? Object.entries(modeOptions).map(([key]) => ({
                        value: key,
                        label: key,
                      }))
                    : []
                }
                onChange={(newValue) => {
                  handleModeChange(newValue)
                }}
                value={selectedMode}
              />
              <p className="text-muted-foreground text-sm">
                {selectedMode
                  ? modeOptions[selectedMode] || 'No description available.'
                  : 'No mode selected.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border-t p-4">
        {/* credits display */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Available Credits</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {Math.round(credits.current)} / {credits.total}
              </span>
              <span className="text-muted-foreground">
                {Math.round(creditsPercentage)}%
              </span>
            </div>
            <Progress
              value={creditsPercentage}
              max={100}
              className={{
                root: 'h-2 font-bold',
                indicator: `h-2 ${creditsPercentage < 10 ? 'bg-red-600' : creditsPercentage < 20 ? 'bg-yellow-400' : 'bg-blue-400'}`,
              }}
              formatter={() => null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
