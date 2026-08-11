'use client'

import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  getModeDescription,
  getModeIcon,
  isKnownMode,
} from '../lib/config/modes'
import { useSettingsStore } from '../stores/settingsStore'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function ModeSwitcher() {
  const t = useTranslations()
  const { modeOptions, selectedMode, setSelectedMode } = useSettingsStore()
  const modeKeys = Object.keys(modeOptions)

  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  // M7: sliding thumb behind the active segment. `null` until the first
  // measurement lands, so the thumb never flashes at the wrong size/position.
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null
  )

  useLayoutEffect(() => {
    const measure = () => {
      const activeButton = buttonRefs.current.get(selectedMode)
      if (!activeButton) return
      setThumb({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      })
    }

    measure()

    // Segments can vary in width per locale/label (no fixed column grid), so
    // re-measure if a segment's own size changes (e.g. a locale switch
    // re-renders the same mode with a wider/narrower label) without
    // `selectedMode` itself changing.
    const observer = new ResizeObserver(measure)
    buttonRefs.current.forEach((button) => observer.observe(button))
    return () => observer.disconnect()
  }, [selectedMode, modeKeys.join('|')])

  // Nothing to switch between when a chatbot exposes a single mode.
  if (modeKeys.length <= 1) return null

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t('chat.modes.switcherLabel')}
      data-cy="chat-mode-switcher"
      className="bg-muted scrollbar-none relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-0.5"
    >
      {thumb && (
        <div
          aria-hidden="true"
          className="bg-primary absolute inset-y-0.5 rounded-full shadow-sm transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: thumb.width,
            transform: `translateX(${thumb.left}px)`,
          }}
        />
      )}
      {modeKeys.map((mode) => {
        const Icon = getModeIcon(mode)
        const label = isKnownMode(mode)
          ? t(`chat.modes.${mode}`)
          : mode.charAt(0).toUpperCase() + mode.slice(1)
        const description = getModeDescription(t, mode, modeOptions)
        const isActive = mode === selectedMode

        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <button
                ref={(el) => {
                  if (el) buttonRefs.current.set(mode, el)
                  else buttonRefs.current.delete(mode)
                }}
                type="button"
                aria-pressed={isActive}
                aria-label={description ? `${label}: ${description}` : label}
                data-cy={`chat-mode-option-${mode}`}
                onClick={() => setSelectedMode(mode)}
                className={twMerge(
                  'relative z-10 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors touch-manipulation fine-pointer:min-h-8',
                  isActive
                    ? 'text-primary-foreground'
                    : // Full foreground rather than muted-foreground: the inactive
                      // tab sits on bg-muted, where muted-foreground only reaches
                      // ~4.4:1 and misses the WCAG 1.4.3 AA floor for this text
                      // size. The active state is carried by the sliding thumb,
                      // not by the label colour.
                      'text-foreground hover:bg-background/60'
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-left text-pretty">
              <p className="font-medium">{label}</p>
              {description ? (
                <p data-cy={`chat-mode-description-${mode}`} className="mt-1">
                  {description}
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
