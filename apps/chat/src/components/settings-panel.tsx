'use client'

import { useState } from 'react'
import { type ModelID } from '../lib/config/models'
import {
  REASONING_EFFORT_OPTIONS,
  type ReasoningEffort,
} from '../lib/config/reasoning'
import { useSettingsStore } from '../stores/settingsStore'

import { Progress, Select } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react'

export function SettingsPanel() {
  const {
    selectedModel,
    selectedMode,
    selectedReasoningEffort,
    credits,
    modelOptions,
    modeOptions,
    modelSelectionEnabled,
    setSelectedModel,
    setSelectedMode,
    setSelectedReasoningEffort,
  } = useSettingsStore()
  const [open, setOpen] = useState(true)

  const creditsPercentage =
    credits.total > 0 ? (credits.current / credits.total) * 100 : 0

  const handleModelChange = (value: string) => {
    setSelectedModel(value as ModelID)
  }

  const handleModeChange = (value: string) => {
    setSelectedMode(value as string)
  }

  const handleReasoningEffortChange = (value: string) => {
    setSelectedReasoningEffort(value as ReasoningEffort)
  }

  const selectedModelOption = modelOptions.find(
    (option) => option.id === selectedModel
  )
  const showReasoningEffortSelector =
    modelSelectionEnabled && !!selectedModelOption?.supportsReasoning

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
        <div className="border-muted space-y-4 border-t px-4 pb-4">
          <div>
            {/* mode selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold">Chat Mode</label>
              <Select
                placeholder="Select Chat Mode"
                items={
                  Object.keys(modeOptions).length > 0
                    ? Object.entries(modeOptions).map(([key]) => ({
                        value: key,
                        label: key.charAt(0).toUpperCase() + key.slice(1),
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

            {/* model selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold">AI Model</label>
              {modelSelectionEnabled ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="rounded-md border px-3 py-2 text-sm">
                    {modelOptions.find((option) => option.id === selectedModel)
                      ?.name || selectedModel}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Automatic selection based on credit availability.
                    {credits.current > 0
                      ? ' Using primary model with available credits.'
                      : ' Using fallback model (no credits remaining).'}
                  </p>
                </>
              )}
            </div>

            {showReasoningEffortSelector ? (
              <div className="space-y-2">
                <label className="text-sm font-bold">Reasoning Effort</label>
                <Select
                  placeholder="Select reasoning effort"
                  items={REASONING_EFFORT_OPTIONS.map((value) => ({
                    value,
                    label: value.charAt(0).toUpperCase() + value.slice(1),
                  }))}
                  onChange={(newValue) => {
                    handleReasoningEffortChange(newValue)
                  }}
                  value={selectedReasoningEffort}
                />
                <p className="text-muted-foreground text-sm">
                  Higher effort can improve difficult responses at the cost of
                  additional latency.
                </p>
              </div>
            ) : null}
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
            {credits.current === 0 ? (
              <div className="text-muted-foreground text-sm">
                You have used up all your credits. However, you can still use
                the smaller model.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
