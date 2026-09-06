import type { ProductUpdate } from '@klicker-uzh/product-updates'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import ProductUpdateCard from './ProductUpdateCard'
import type { UseProductUpdatesResult } from './useProductUpdates'

function ProductUpdateFeedModal({
  feed,
  onClose,
  fullScreen,
  className,
  children,
  onShowSpotlight,
  isSpotlightReachable,
}: {
  // The feed of the surface that opened the modal; the caller decides which
  // audience and surface it reads for.
  feed: UseProductUpdatesResult
  onClose: () => void
  fullScreen?: boolean
  className?: { overlay?: string; content?: string }
  // Rendered below the cards, for surface-specific links such as the entry to
  // a persistent archive of all updates.
  children?: ReactNode
  // Forwarded to every card; see ProductUpdateCard.
  onShowSpotlight?: (update: ProductUpdate) => void
  isSpotlightReachable?: (update: ProductUpdate) => boolean
}) {
  const t = useTranslations()
  const { entries, loading, recordPresentation, markRead, dismiss } = feed

  // The feed is the "what is new" surface, so a dismissed entry leaves it.
  const feedEntries = entries.filter((entry) => !entry.dismissed)

  return (
    <Modal
      open
      fullScreen={fullScreen}
      title={t('shared.productUpdates.feedTitle')}
      onClose={onClose}
      className={{
        overlay: className?.overlay,
        title: 'text-left text-xl md:text-2xl',
        content: className?.content,
      }}
      dataContent={{ cy: 'product-updates-feed' }}
    >
      <div className="flex flex-col gap-4">
        {feedEntries.length === 0 ? (
          <div className="text-slate-600" data-cy="product-updates-empty">
            {t('shared.productUpdates.empty')}
          </div>
        ) : (
          feedEntries.map((entry) => (
            <ProductUpdateCard
              key={entry.update.id}
              update={entry.update}
              dismissed={entry.dismissed}
              statesLoaded={!loading}
              onPresent={recordPresentation}
              onRead={markRead}
              onDismiss={dismiss}
              onShowSpotlight={onShowSpotlight}
              isSpotlightReachable={isSpotlightReachable}
            />
          ))
        )}

        {children}
      </div>
    </Modal>
  )
}

export default ProductUpdateFeedModal
