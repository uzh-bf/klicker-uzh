'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import {
  CheckIcon,
  ChevronDownIcon,
  GraduationCapIcon,
  LightbulbIcon,
  ListChecksIcon,
  SparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  formatModeLabel,
  getModeDescription,
  resolveSelectedMode,
} from '@/src/lib/config/modes'
import { useSettingsStore } from '@/src/stores/settingsStore'

function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  if (mode === 'tutor') {
    return <GraduationCapIcon aria-hidden="true" className={className} />
  }

  if (mode === 'explainer') {
    return <LightbulbIcon aria-hidden="true" className={className} />
  }

  if (mode === 'quizzer') {
    return <ListChecksIcon aria-hidden="true" className={className} />
  }

  return <SparklesIcon aria-hidden="true" className={className} />
}

export function ModeSwitcher({
  modeOptions: modeOptionsOverride,
  testIdPrefix = 'chat-mode',
}: {
  modeOptions?: Record<string, string>
  testIdPrefix?: string
} = {}) {
  const t = useTranslations()
  const storeModeOptions = useSettingsStore((state) => state.modeOptions)
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const setSelectedMode = useSettingsStore((state) => state.setSelectedMode)
  const modeOptions = modeOptionsOverride ?? storeModeOptions
  const modeKeys = Object.keys(modeOptions)
  const effectiveSelectedMode = resolveSelectedMode(modeOptions, selectedMode)

  // Nothing to switch between when a chatbot exposes a single mode.
  if (modeKeys.length <= 1) return null

  const selectedLabel = formatModeLabel(t, effectiveSelectedMode)

  return (
    <SelectPrimitive.Root
      value={effectiveSelectedMode}
      onValueChange={setSelectedMode}
    >
      <SelectPrimitive.Trigger
        data-cy={`${testIdPrefix}-switcher`}
        aria-label={`${t('chat.modes.switcherLabel')}: ${selectedLabel}`}
        className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex min-h-11 max-w-40 min-w-0 touch-manipulation items-center gap-1.5 rounded-full border px-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 data-[state=open]:bg-accent fine-pointer:min-h-9"
      >
        <SelectPrimitive.Value aria-label={selectedLabel}>
          <span className="flex min-w-0 items-center gap-1.5">
            <ModeIcon
              mode={effectiveSelectedMode}
              className="size-4 shrink-0"
            />
            <span className="truncate">{selectedLabel}</span>
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground size-3.5 shrink-0"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className="border-border bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-xl border shadow-lg motion-reduce:animate-none"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {modeKeys.map((mode) => {
              const label = formatModeLabel(t, mode)
              const description = getModeDescription(t, mode, modeOptions)
              const descriptionId = `${testIdPrefix}-description-${mode}`

              return (
                <SelectPrimitive.Item
                  key={mode}
                  value={mode}
                  aria-describedby={description ? descriptionId : undefined}
                  data-cy={`${testIdPrefix}-option-${mode}`}
                  className="data-[highlighted]:bg-accent data-[state=checked]:text-primary focus-visible:ring-ring relative flex min-h-11 cursor-pointer select-none items-start gap-2 rounded-lg py-2 pl-9 pr-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus-visible:ring-1"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-3 top-2.5">
                    <CheckIcon aria-hidden="true" className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                  <ModeIcon mode={mode} className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <SelectPrimitive.ItemText className="block font-medium">
                      {label}
                    </SelectPrimitive.ItemText>
                    {description ? (
                      <span
                        id={descriptionId}
                        data-cy={`${testIdPrefix}-description-${mode}`}
                        className="text-muted-foreground mt-0.5 block text-pretty text-xs leading-4"
                      >
                        {description}
                      </span>
                    ) : null}
                  </span>
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
