'use client'

import { useState } from 'react'
import { type ModelID } from '../lib/config/models'
import {
  formatReasoningEffort,
  type ReasoningEffort,
} from '../lib/config/reasoning'
import type { DictationStatus } from '../lib/speech/dictation-state'
import { useSettingsStore } from '../stores/settingsStore'
import { useDictationContext } from './dictation-context'

import { Select } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

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
  const locale = useLocale()
  const { openInstallSheet, status: dictationStatus } = useDictationContext()
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
  const selectedModelDescription = selectedModelOption
    ? selectedModelOption.id === 'auto'
      ? t('chat.settingsPanel.autoModelDescription')
      : selectedModelOption.fallback
        ? t('chat.settingsPanel.fallbackModelDescription')
        : selectedModelOption.supportsReasoning
          ? t('chat.settingsPanel.reasoningModelDescription')
          : t('chat.settingsPanel.standardModelDescription')
    : null

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
        {/* Chevron points down while closed (more to reveal) and flips up
            once open (collapse), matching the universal disclosure
            convention and GroupedDisclosure's own chevron direction. */}
        <span className="ml-auto">
          {!open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </span>
      </button>
      {open && (
        <div
          data-cy="chat-settings-panel"
          className="border-border space-y-3 border-t px-3 pb-2 pt-2"
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
                  {selectedModelDescription ? (
                    <p className="text-muted-foreground text-sm">
                      {selectedModelDescription}
                    </p>
                  ) : null}
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

            <DictationStatusLine
              onOpenInstallSheet={openInstallSheet}
              status={dictationStatus}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function DictationStatusLine({
  locale,
  onOpenInstallSheet,
  status,
}: {
  locale: string
  onOpenInstallSheet: () => void
  status: DictationStatus
}) {
  const t = useTranslations()
  const statusLabel = {
    unsupported: t('chat.settingsPanel.dictationStatusUnsupported'),
    unavailable: t('chat.settingsPanel.dictationStatusUnavailable'),
    'needs-install': t('chat.settingsPanel.dictationStatusNeedsInstall'),
    installing: t('chat.settingsPanel.dictationStatusInstalling'),
    ready: t('chat.settingsPanel.dictationStatusReady'),
    listening: t('chat.settingsPanel.dictationStatusListening'),
    error: t('chat.settingsPanel.dictationStatusError'),
  }[status]

  return (
    <div
      data-cy="chat-dictation-status"
      className="mt-3 space-y-1 border-t pt-3"
      role="status"
    >
      <p className="text-sm font-bold">
        {t('chat.settingsPanel.dictationLabel')}
      </p>
      {status === 'needs-install' ? (
        <button
          type="button"
          data-cy="chat-dictation-status-install"
          className="text-primary text-start text-sm underline underline-offset-2"
          onClick={onOpenInstallSheet}
        >
          {statusLabel}
        </button>
      ) : (
        <p className="text-muted-foreground text-sm">{statusLabel}</p>
      )}
      {locale.toLowerCase().startsWith('de') ? (
        <p className="text-muted-foreground text-xs">
          {t('chat.settingsPanel.dictationLanguageHint')}
        </p>
      ) : null}
    </div>
  )
}
