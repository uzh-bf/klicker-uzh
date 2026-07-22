'use client'

import { useState } from 'react'
import { type ModelID } from '../lib/config/models'
import {
  formatReasoningEffort,
  type ReasoningEffort,
} from '../lib/config/reasoning'
import { useSettingsStore } from '../stores/settingsStore'

import { Select } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Ids that tie each visible label to the control it names. The design system
 * leaks the `id` onto every `SelectItem` as well as the trigger, so while a
 * popover is open these ids are duplicated; the trigger still wins `htmlFor`
 * because the popover content is portaled to the end of the document.
 */
const MODEL_SELECT_ID = 'chat-model-select'
const REASONING_EFFORT_SELECT_ID = 'chat-reasoning-effort-select'

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
      {/* A real button, not a clickable div: this toggle is the only way to
          reach the model and reasoning-effort selectors, so keyboard and switch
          users must be able to focus and activate it (WCAG 2.1.1 / 4.1.2). */}
      <button
        type="button"
        data-cy="chat-settings-toggle"
        aria-expanded={open}
        className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 border-t px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-1"
        onClick={() => setOpen(!open)}
      >
        <Settings2 className="h-4 w-4" />
        <span className="text-base font-medium">
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
      </button>
      {open && (
        <div
          data-cy="chat-settings-panel"
          className="border-muted space-y-3 border-t px-3 pb-2 pt-2"
        >
          <div>
            {/* model selection */}
            <div data-cy="chat-model-selection" className="space-y-1">
              {/* htmlFor, not just visual proximity: the design-system Select
                  renders a Radix combobox whose accessible name would otherwise
                  be the currently selected value, leaving two comboboxes that
                  screen readers cannot tell apart (WCAG 1.3.1 / 4.1.2). */}
              <label
                // Only the `modelSelectionEnabled` branch renders a control;
                // the read-only branch is a plain div, and a `for` pointing at
                // an element that is not in the DOM is worse than none.
                htmlFor={modelSelectionEnabled ? MODEL_SELECT_ID : undefined}
                className="text-sm font-bold"
              >
                {t('chat.settingsPanel.aiModelLabel')}
              </label>
              {modelSelectionEnabled ? (
                <>
                  <Select
                    id={MODEL_SELECT_ID}
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
                <label
                  htmlFor={REASONING_EFFORT_SELECT_ID}
                  className="text-sm font-bold"
                >
                  {t('chat.settingsPanel.reasoningEffortLabel')}
                </label>
                <Select
                  id={REASONING_EFFORT_SELECT_ID}
                  data={{ cy: 'chat-reasoning-effort-select' }}
                  placeholder={t('chat.settingsPanel.selectReasoningEffort')}
                  items={availableReasoningEfforts.map((value) => ({
                    value,
                    label: formatReasoningEffort(t, value),
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
    </div>
  )
}
