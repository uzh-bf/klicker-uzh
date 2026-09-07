'use client'

import { Progress } from '@uzh-bf/design-system'
import { Zap } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useSettingsStore } from '../stores/settingsStore'
import { formatCredits } from './thread-credits-format'

function CreditBalance({ current, total }: { current: number; total: number }) {
  return (
    <>
      {formatCredits(current)} / {formatCredits(total)}
    </>
  )
}

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
          <CreditBalance current={credits.current} total={credits.total} />
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

  // Say nothing rather than something false: before the fetch resolves (or if
  // it fails) the placeholder state would claim "0 left, never refills".
  if (!creditsLoaded) return null

  const percentage =
    credits.total > 0 ? (credits.current / credits.total) * 100 : 0

  // Warn while there is still room to change course, not once the budget is
  // gone. UZH yellow sits at ~1.2:1 against the grey track, so the warning tier
  // uses the destructive red too rather than a fill nobody can see.
  const indicatorColor = percentage < 20 ? 'bg-destructive' : 'bg-primary'

  return (
    <div
      data-cy="chat-credits-section"
      className="space-y-1.5 border-t px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <Zap className="size-4" />
        <span className="text-sm font-medium">{t('chat.credits.title')}</span>
        <span
          data-cy="chat-credits-display"
          className="text-muted-foreground ml-auto text-sm tabular-nums"
        >
          {Math.round(credits.current)} / {credits.total}
        </span>
      </div>

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
          root: 'h-1.5',
          background: 'bg-muted',
          indicator: `h-1.5 ${indicatorColor}`,
        }}
        formatter={() => null}
      />

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
  )
}
