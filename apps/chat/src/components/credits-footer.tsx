'use client'

import { Progress } from '@uzh-bf/design-system'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { formatCreditPercent } from './thread-credits-format'

/**
 * Keeps the balance and exhausted state visible in the main mobile layout
 * while the sidebar is closed. The embedded layout has its own
 * `EmbeddedCreditsBar`, so this is rendered only by `SidebarMain`.
 */
export function MobileCreditsBar() {
  const t = useTranslations()
  const credits = useSettingsStore((state) => state.credits)
  const creditsLoaded = useSettingsStore((state) => state.creditsLoaded)

  if (!creditsLoaded) return null

  return (
    <div
      data-cy="chat-mobile-credits-bar"
      className="bg-background border-b px-3 py-1.5 md:hidden"
    >
      <div className="flex items-center gap-1.5 text-xs">
        <Zap className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground truncate">
          {t('chat.credits.title')}
        </span>
        <span
          data-cy="chat-mobile-credits-display"
          className="ml-auto shrink-0 font-medium tabular-nums"
        >
          {formatCreditPercent(credits.current, credits.total)}%
        </span>
      </div>
      {credits.current === 0 ? (
        <p
          data-cy="chat-mobile-fallback-notice"
          className="text-muted-foreground mt-0.5 text-xs text-pretty"
        >
          {t('chat.credits.fallbackNotice')}
        </p>
      ) : null}
    </div>
  )
}

export function CreditsFooter() {
  const t = useTranslations()
  const format = useFormatter()
  const credits = useSettingsStore((state) => state.credits)
  const creditsLoaded = useSettingsStore((state) => state.creditsLoaded)
  // `null` until the participant toggles: the details then follow the
  // balance, open while it is low and closed otherwise.
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const detailsId = useId()

  // Say nothing rather than something false: before the fetch resolves (or if
  // it fails) the placeholder state would claim "0 left, never refills".
  if (!creditsLoaded) return null

  const percentage =
    credits.total > 0 ? (credits.current / credits.total) * 100 : 0

  // Warn while there is still room to change course, not once the budget is
  // gone. UZH yellow sits at ~1.2:1 against the grey track, so the warning tier
  // uses the destructive red too rather than a fill nobody can see.
  const low = percentage < 20
  const indicatorColor = low ? 'bg-destructive' : 'bg-primary'
  // The explanation and refill date take four lines of a sidebar that should
  // mostly show the conversation history, so they stay behind the row until
  // they matter: once the balance runs low they open on their own.
  const open = expanded ?? low

  return (
    <div data-cy="chat-credits-section" className="border-t px-3 py-1.5">
      {/* A real button so the details are reachable by keyboard; the progress
          bar stays outside it so its progressbar semantics survive. */}
      <button
        type="button"
        data-cy="chat-credits-toggle"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setExpanded(!open)}
        className="hover:bg-accent focus-visible:ring-ring -mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-1 fine-pointer:min-h-7"
      >
        <Zap aria-hidden="true" className="size-4 shrink-0" />
        <span className="text-sm font-medium">{t('chat.credits.title')}</span>
        <span
          data-cy="chat-credits-display"
          className="text-muted-foreground ml-auto text-sm tabular-nums"
        >
          {formatCreditPercent(credits.current, credits.total)}%
        </span>
        {open ? (
          <ChevronUp aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        )}
      </button>

      <Progress
        value={percentage}
        max={100}
        // The visible title above isn't programmatically associated with the
        // progress bar (it's a plain <span>, not a <label>/id pair), so
        // assistive tech would otherwise announce this Progress with no name
        // at all. BaseProgressProps spreads unknown props onto
        // RadixProgress.Root, so aria-label reaches the actual progressbar
        // element; reuse the same i18n key as the visible title.
        aria-label={t('chat.credits.title')}
        className={{
          root: 'mt-0.5 h-1',
          background: 'bg-muted',
          indicator: `h-1 ${indicatorColor}`,
        }}
        formatter={() => null}
        // The indicator otherwise keeps a 40px minimum width for its (unused)
        // label, so a nearly empty or exhausted balance would still look like
        // a sizable bar. Each message moves the balance by a fraction of a
        // credit, and the bar has to show that.
        noMinWidth
      />

      <div id={detailsId} hidden={!open} className="mt-1.5 space-y-1">
        <p className="text-muted-foreground text-xs">
          {t('chat.credits.costHint')}{' '}
          {credits.nextResetAt
            ? t('chat.credits.resetAt', {
                date: format.dateTime(new Date(credits.nextResetAt), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            : t('chat.credits.resetNone')}
        </p>

        {credits.current === 0 ? (
          <p
            data-cy="chat-credits-empty-message"
            className="text-muted-foreground text-xs"
          >
            {t('chat.credits.exhausted')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
