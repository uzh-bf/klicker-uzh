'use client'

import { useSettingsStore } from '@/app/stores/settingsStore'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { type ModelProvider } from '@/lib/models'
import { type ChatbotMode } from '@/lib/prompts'
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
        <span className="text-sm font-medium">Settings</span>
      </div>

      {/* model selection */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs">AI Model</label>
        <Select value={selectedModel} onValueChange={handleModelChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{option.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* mode selection */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs">Chat Mode</label>
        <Select value={selectedMode} onValueChange={handleModeChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            {modeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{option.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* credits display */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="text-xs font-medium">Available Credits</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {credits.current} / {credits.total}
            </span>
            <span className="text-muted-foreground">
              {Math.round(creditsPercentage)}%
            </span>
          </div>
          <Progress value={creditsPercentage} className="h-2" />
        </div>
      </div>
    </div>
  )
}
