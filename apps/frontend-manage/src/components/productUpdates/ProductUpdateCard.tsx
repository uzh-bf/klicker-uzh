import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import type { LocalizedText, ProductUpdate } from '@klicker-uzh/product-updates'
import { Button, H3, Tag } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { trackProductUpdate } from './tracking'
import type { ProductUpdateState } from './useProductUpdates'

function useLocalized() {
  const locale = useLocale()
  const language = locale === 'de' ? 'de' : 'en'

  return (text: LocalizedText) => text[language]
}

function ProductUpdateCard({
  update,
  state,
  onPresent,
  onRead,
  onDismiss,
}: {
  update: ProductUpdate
  state?: ProductUpdateState
  onPresent: (updateId: string) => void
  onRead: (updateId: string) => void
  // Omitted where dismissal makes no sense, such as an already dismissed entry
  // in the persistent archive.
  onDismiss?: (updateId: string) => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const localized = useLocalized()
  const cardRef = useRef<HTMLDivElement>(null)
  // Reporting happens at most once per mount of this card, so reopening the
  // feed counts as a new presentation while scrolling past twice does not.
  const reported = useRef(false)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    // The whole card content is visible at once, so a card that reaches the
    // viewport has been presented and read. Cards below the fold stay unread
    // until the reader actually scrolls to them — opening the feed alone must
    // never mark everything read.
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting || reported.current) continue

          reported.current = true
          observer.disconnect()
          onPresent(update.id)
          onRead(update.id)
          trackProductUpdate('Presented', update.id)
          trackProductUpdate('Opened', update.id)
        }
      },
      { threshold: 0.4 }
    )

    observer.observe(card)

    return () => observer.disconnect()
  }, [onPresent, onRead, update.id])

  const onCtaClick = useCallback(() => {
    if (!update.cta) return

    trackProductUpdate('CTA Clicked', update.id)

    if (update.cta.href.startsWith('/')) {
      void router.push(update.cta.href)
    } else {
      window.open(update.cta.href, '_blank', 'noopener,noreferrer')
    }
  }, [router, update.cta, update.id])

  const body = update.bodyMarkdown ? localized(update.bodyMarkdown) : undefined

  return (
    <div
      ref={cardRef}
      className={twMerge(
        'flex flex-col gap-2 rounded-lg border border-solid border-slate-300 p-4',
        state?.dismissedAt && 'bg-slate-50 text-slate-500'
      )}
      data-cy={`product-update-${update.id}`}
    >
      <div className="flex flex-row flex-wrap items-center gap-2">
        <H3 className={{ root: 'mb-0' }}>{localized(update.title)}</H3>
        {update.maturity !== 'released' && (
          <Tag
            label={t(`manage.productUpdates.maturity.${update.maturity}`)}
            className={{ root: 'bg-orange-200' }}
            data={{ cy: `product-update-maturity-${update.id}` }}
          />
        )}
        <div className="ml-auto text-sm text-slate-500">
          {dayjs(update.publishedAt).format('DD.MM.YYYY')}
        </div>
      </div>

      <div>{localized(update.summary)}</div>

      {update.image && (
        <Image
          src={update.image.src}
          alt={localized(update.image.alt)}
          width={800}
          height={450}
          className="h-auto w-full rounded"
        />
      )}

      {body && <Markdown content={body} className={{ root: 'prose-sm' }} />}

      <div className="flex flex-row flex-wrap items-center gap-2">
        {update.cta && (
          <Button
            onClick={onCtaClick}
            data={{ cy: `product-update-cta-${update.id}` }}
          >
            {localized(update.cta.label)}
          </Button>
        )}
        {update.detailsUrl && (
          <a
            href={update.detailsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackProductUpdate('Details Opened', update.id)}
            className="text-sm text-blue-600 hover:underline"
            data-cy={`product-update-details-${update.id}`}
          >
            {t('manage.productUpdates.readMore')}
            <FontAwesomeIcon
              icon={faArrowUpRightFromSquare}
              className="ml-1.5"
              size="sm"
            />
          </a>
        )}
        {onDismiss && (
          <Button
            basic
            onClick={() => {
              trackProductUpdate('Dismissed', update.id)
              onDismiss(update.id)
            }}
            className={{ root: 'ml-auto text-sm text-slate-500' }}
            data={{ cy: `product-update-dismiss-${update.id}` }}
          >
            {t('manage.productUpdates.dismiss')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ProductUpdateCard
