'use client'

import {
  useSettingsStore,
  type ModelProvider,
} from '@/app/stores/settingsStore'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Settings2, Zap } from 'lucide-react'

export function SettingsPanel() {
  const {
    selectedModel,
    selectedMode,
    credits,
    modelOptions,
    setSelectedModel,
    setSelectedMode,
  } = useSettingsStore()

  const creditsPercentage = (credits.current / credits.total) * 100

  const handleModelChange = (value: string) => {
    setSelectedModel(value as ModelProvider)
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span
              className={`text-xs ${selectedMode === 'tutor' ? 'font-medium' : 'text-muted-foreground'}`}
            >
              Tutor
            </span>
            <Switch
              checked={selectedMode === 'explainer'}
              onCheckedChange={(checked) =>
                setSelectedMode(checked ? 'explainer' : 'tutor')
              }
            />
            <span
              className={`text-xs ${selectedMode === 'explainer' ? 'font-medium' : 'text-muted-foreground'}`}
            >
              Explainer
            </span>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {selectedMode === 'tutor'
            ? 'Step-by-step learning guidance'
            : 'Clear and comprehensive explanations'}
        </p>
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
