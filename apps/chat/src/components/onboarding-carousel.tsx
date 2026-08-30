'use client'

import { Button, Modal } from '@uzh-bf/design-system'
import {
  Coins,
  type LucideIcon,
  MessagesSquare,
  Paperclip,
  Quote,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// The cards are the tour: five things about this chat that are true on every
// screen, in the order a newcomer meets them. They live in code like every
// other tour, and their copy lives under `chat.onboarding` in the shared
// message files — `<id>Title` and `<id>Body` per card.
const CARD_IDS = [
  'modes',
  'sources',
  'attachments',
  'history',
  'credits',
] as const

const CARD_ICONS: Record<(typeof CARD_IDS)[number], LucideIcon> = {
  modes: Sparkles,
  sources: Quote,
  attachments: Paperclip,
  history: MessagesSquare,
  credits: Coins,
}

interface OnboardingCarouselProps {
  isOpen: boolean
  onClose: () => void
}

export function OnboardingCarousel({
  isOpen,
  onClose,
}: OnboardingCarouselProps) {
  const t = useTranslations()
  const [index, setIndex] = useState(0)

  // Every opening starts at the first card, including a replay from the
  // sidebar: the component stays mounted between openings, so the step does
  // not reset on its own.
  useEffect(() => {
    if (isOpen) setIndex(0)
  }, [isOpen])

  // The design-system `Modal` hardcodes `onOpenAutoFocus={(e) =>
  // e.preventDefault()}` with no prop to override it, so Radix never moves
  // focus into the dialog — the same workaround `product-updates-modal.tsx`
  // and `disclaimer-modal.tsx` apply. Focusing from an effect keyed on
  // `isOpen` is too early, because Radix mounts the content in a later commit
  // and the ref is still empty; the ref callback runs exactly when the node
  // attaches. Focus goes to the card container rather than to one button, so
  // the card is read before its actions.
  const focusContent = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isOpen) node.focus()
    },
    [isOpen]
  )

  const cardId = CARD_IDS[index]!
  const CardIcon = CARD_ICONS[cardId]
  const isLastCard = index === CARD_IDS.length - 1

  return (
    <Modal
      data={{ cy: 'chat-onboarding-modal' }}
      title={t('chat.onboarding.title')}
      className={{
        content:
          'min-h-content max-h-[85vh] w-full min-w-[min(24rem,90vw)] max-w-xl overflow-y-auto',
      }}
      open={isOpen}
      onClose={onClose}
    >
      <div ref={focusContent} tabIndex={-1} className="space-y-6 outline-none">
        <div
          data-cy="chat-onboarding-card"
          data-card={cardId}
          className="flex gap-4 rounded-lg border p-4"
        >
          <CardIcon
            aria-hidden="true"
            className="text-primary mt-0.5 size-6 shrink-0"
          />
          <div className="space-y-1">
            <h3 className="text-foreground text-base font-semibold">
              {t(`chat.onboarding.${cardId}Title`)}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(`chat.onboarding.${cardId}Body`)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* The dots show the position at a glance; the sentence next to them
              is what a screen reader announces when the card changes. */}
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex gap-1.5">
              {CARD_IDS.map((id, dotIndex) => (
                <span
                  key={id}
                  className={twMerge(
                    'size-2 rounded-full',
                    dotIndex === index ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              ))}
            </span>
            <span
              data-cy="chat-onboarding-progress"
              aria-live="polite"
              className="text-muted-foreground text-xs"
            >
              {t('chat.onboarding.progress', {
                current: index + 1,
                total: CARD_IDS.length,
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              data-cy="chat-onboarding-skip"
              onClick={onClose}
              className={{ root: 'border-transparent' }}
            >
              {t('chat.onboarding.skip')}
            </Button>
            <Button
              data-cy="chat-onboarding-previous"
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              disabled={index === 0}
            >
              {t('chat.onboarding.previous')}
            </Button>
            <Button
              data-cy="chat-onboarding-next"
              onClick={() =>
                isLastCard ? onClose() : setIndex((current) => current + 1)
              }
              className={{
                root: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-transparent font-semibold',
              }}
            >
              {isLastCard
                ? t('chat.onboarding.done')
                : t('chat.onboarding.next')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
