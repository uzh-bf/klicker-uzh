'use client'

import { Markdown } from '@klicker-uzh/markdown'
import { Modal } from '@uzh-bf/design-system'
import { X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'

export interface ChatProductUpdateView {
  id: string
  publishedAt: string
  title: string
  summary: string
  bodyMarkdown?: string
  detailsUrl?: string
  readAt: string | null
  dismissedAt: string | null
}

interface ProductUpdatesModalProps {
  updates: ChatProductUpdateView[]
  isOpen: boolean
  onClose: () => void
  onSeen: (update: ChatProductUpdateView) => void
  onDismiss: (updateId: string) => void
}

function UpdateCard({
  update,
  onSeen,
  onDismiss,
}: {
  update: ChatProductUpdateView
  onSeen: (update: ChatProductUpdateView) => void
  onDismiss: (updateId: string) => void
}) {
  const t = useTranslations()
  const format = useFormatter()
  const cardRef = useRef<HTMLLIElement>(null)
  // One report per card and per opening of the feed. The cards only exist while
  // the modal is open, so unmounting resets this on its own — reopening the feed
  // is a new presentation, which is exactly what the counter is meant to record.
  const reported = useRef(false)

  // A card counts as presented once it is actually on screen, not when the feed
  // is fetched: the participant must have opened the feed and scrolled far
  // enough for this entry to be visible. Half of the card is the threshold so
  // that a card grazing the edge of the scroll container does not count.
  useEffect(() => {
    const node = cardRef.current
    if (!node || reported.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || reported.current) continue
          reported.current = true
          onSeen(update)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [onSeen, update])

  return (
    <li
      ref={cardRef}
      data-cy="chat-product-update-card"
      className="space-y-2 rounded-lg border p-3"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h3 className="text-foreground text-sm font-semibold">
            {update.title}
          </h3>
          <p className="text-muted-foreground text-xs">
            {format.dateTime(new Date(update.publishedAt), {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          type="button"
          data-cy="chat-product-update-dismiss"
          onClick={() => onDismiss(update.id)}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1"
        >
          <X className="size-4" />
          <span className="sr-only">{t('chat.productUpdates.dismiss')}</span>
        </button>
      </div>

      {/* The catalog carries an optional long body and a mandatory summary, so
          the summary is what an entry without a body shows — never an empty
          card. Both go through the same renderer because either may contain
          Markdown. */}
      <div data-cy="chat-product-update-body">
        <Markdown
          content={update.bodyMarkdown ?? update.summary}
          withProse
          className={{ root: 'prose prose-sm text-foreground max-w-none' }}
        />
      </div>

      {update.detailsUrl ? (
        <a
          href={update.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-cy="chat-product-update-details"
          className="text-primary inline-block text-sm underline"
        >
          {t('chat.productUpdates.details')}
          <span className="sr-only"> {t('chat.common.opensInNewTab')}</span>
        </a>
      ) : null}
    </li>
  )
}

export function ProductUpdatesModal({
  updates,
  isOpen,
  onClose,
  onSeen,
  onDismiss,
}: ProductUpdatesModalProps) {
  const t = useTranslations()

  // The design-system `Modal` hardcodes `onOpenAutoFocus={(e) =>
  // e.preventDefault()}` with no prop to override it, so Radix never moves
  // focus into the dialog — the same workaround `disclaimer-modal.tsx` applies.
  // The feed opens with no single obvious action, so focus goes to the list
  // container rather than to one card's dismiss button. Restoring focus on
  // close is not handled here and not handled by Radix either — measured in the
  // browser, focus lands on `<body>`. `product-updates-menu-item.tsx` refocuses
  // deliberately once the dialog is gone; that code is load-bearing, not a
  // redundant duplicate of a Radix behaviour.
  //
  // Focusing from an effect keyed on `isOpen` is too early: Radix mounts the
  // dialog content through its presence machinery in a later commit, so the ref
  // is still empty when that effect runs and focus stays outside the dialog.
  // Focusing from the ref callback instead runs exactly when the node attaches.
  const focusContent = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isOpen) node.focus()
    },
    [isOpen]
  )

  return (
    <Modal
      data={{ cy: 'chat-product-updates-modal' }}
      title={t('chat.productUpdates.title')}
      className={{
        content:
          'min-h-content max-h-[85vh] w-full min-w-[min(24rem,90vw)] max-w-2xl overflow-y-auto',
      }}
      open={isOpen}
      onClose={onClose}
    >
      <div ref={focusContent} tabIndex={-1} className="outline-none">
        <ul className="space-y-3">
          {updates.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              onSeen={onSeen}
              onDismiss={onDismiss}
            />
          ))}
        </ul>
      </div>
    </Modal>
  )
}
