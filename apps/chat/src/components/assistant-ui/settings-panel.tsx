'use client'

import { useSettingsStore } from '../../app/stores/settingsStore'
import { type ModelProvider } from '../../lib/config/models'
import { type ChatbotMode } from '../../lib/config/prompts'

import { Progress, Select, Separator } from '@uzh-bf/design-system'
import { Settings2, Zap } from 'lucide-react'

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

  const creditsPercentage = (credits.current / credits.total) * 100

  const handleModelChange = (value: string) => {
    setSelectedModel(value as ModelProvider)
  }

  const handleModeChange = (value: string) => {
    setSelectedMode(value as ChatbotMode)
  }

  return (
    <div className="space-y-4 border-t p-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4" />
        <span className="text-basefont-medium">Settings</span>
      </div>

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
          defaultValue={selectedModel}
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
          items={modeOptions.map((option) => ({
            value: option.id,
            label: option.name,
          }))}
          onChange={(newValue) => {
            handleModeChange(newValue)
          }}
          defaultValue={selectedMode}
        />
        <p className="text-muted-foreground text-sm">
          {
            modeOptions.find((option) => option.id === selectedMode)
              ?.description
          }
        </p>
      </div>

      <Separator />

      {/* credits display */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="text-sm font-medium">Available Credits</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {credits.current} / {credits.total}
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
  )
}
