'use client'

import { useState } from 'react'
import { type ModelID } from '../lib/config/models'
import { type ReasoningEffort } from '../lib/config/reasoning'
import { useSettingsStore } from '../stores/settingsStore'

import { Progress, Select } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function SettingsPanel() {
  const t = useTranslations()
  const {
    selectedModel,
    selectedReasoningEffort,
    credits,
    modelOptions,
    modelSelectionEnabled,
    setSelectedModel,
    setSelectedReasoningEffort,
  } = useSettingsStore()
  const [open, setOpen] = useState(false)

  const creditsPercentage =
    credits.total > 0 ? (credits.current / credits.total) * 100 : 0

  const handleModelChange = (value: string) => {
    setSelectedModel(value as ModelID)
  }

  const handleReasoningEffortChange = (value: string) => {
    setSelectedReasoningEffort(value as ReasoningEffort)
  }

  const selectedModelOption = modelOptions.find(
    (option) => option.id === selectedModel
  )
  const availableReasoningEfforts =
    selectedModelOption?.supportsReasoning === true
      ? selectedModelOption.allowedReasoningEfforts
      : []
  const showReasoningEffortSelector = availableReasoningEfforts.length > 1

  return (
    <div>
      <div
        data-cy="chat-settings-toggle"
        className="flex cursor-pointer items-center gap-2 border-t px-3 py-2 hover:bg-gray-100"
        onClick={() => setOpen(!open)}
      >
        <Settings2 className="h-4 w-4" />
        <span className="text-basefont-medium">
          {t('chat.settingsPanel.title')}
        </span>
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
        <div
          data-cy="chat-settings-panel"
          className="border-muted space-y-3 border-t px-3 pb-2 pt-2"
        >
          <div>
            {/* model selection */}
            <div data-cy="chat-model-selection" className="space-y-1">
              <label className="text-sm font-bold">
                {t('chat.settingsPanel.aiModelLabel')}
              </label>
              {modelSelectionEnabled ? (
                <>
                  <Select
                    data={{ cy: 'chat-model-select' }}
                    placeholder={t('chat.settingsPanel.selectAiModel')}
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
                  <div
                    data-cy="chat-model-display"
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    {modelOptions.find((option) => option.id === selectedModel)
                      ?.name || selectedModel}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t('chat.settingsPanel.autoSelectionInfo')}{' '}
                    {credits.current > 0
                      ? t('chat.settingsPanel.usingPrimaryModel')
                      : t('chat.settingsPanel.usingFallbackModel')}
                  </p>
                </>
              )}
            </div>

            {showReasoningEffortSelector ? (
              <div
                data-cy="chat-reasoning-effort-selection"
                className="mt-2 space-y-1"
              >
                <label className="text-sm font-bold">
                  {t('chat.settingsPanel.reasoningEffortLabel')}
                </label>
                <Select
                  data={{ cy: 'chat-reasoning-effort-select' }}
                  placeholder={t('chat.settingsPanel.selectReasoningEffort')}
                  items={availableReasoningEfforts.map((value) => ({
                    value,
                    label: value.charAt(0).toUpperCase() + value.slice(1),
                  }))}
                  onChange={(newValue) => {
                    handleReasoningEffortChange(newValue)
                  }}
                  value={selectedReasoningEffort}
                />
                <p className="text-muted-foreground text-sm">
                  {t('chat.settingsPanel.reasoningEffortHint')}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div data-cy="chat-credits-section" className="border-t px-3 py-2">
        {/* credits display */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('chat.settingsPanel.availableCredits')}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span
                data-cy="chat-credits-display"
                className="text-muted-foreground"
              >
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
              <div
                data-cy="chat-credits-empty-message"
                className="text-muted-foreground text-sm"
              >
                {t('chat.settingsPanel.creditsExhausted')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
