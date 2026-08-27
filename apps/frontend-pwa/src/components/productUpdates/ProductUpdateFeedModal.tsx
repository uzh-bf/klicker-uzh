import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ProductUpdateCard from './ProductUpdateCard'
import { useProductUpdates } from './useProductUpdates'

function ProductUpdateFeedModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations()
  // The modal only exists behind an entry point that the layout renders for
  // eligible participants, so reading the feed here is always allowed.
  const { entries, loading, recordPresentation, markRead, dismiss } =
    useProductUpdates({ enabled: true })

  // The feed is the "what is new" surface, so a dismissed entry leaves it.
  const feedEntries = entries.filter((entry) => !entry.dismissed)

  return (
    <Modal
      open
      // Students mostly read on a phone, where a full-screen sheet leaves room
      // for a card with an image; the desktop width matches the other modals.
      fullScreen
      title={t('pwa.productUpdates.feedTitle')}
      onClose={onClose}
      className={{
        overlay: 'text-black',
        title: 'text-left text-xl md:text-2xl',
        content: 'md:h-max md:w-160 md:max-w-3xl',
      }}
      dataContent={{ cy: 'product-updates-feed' }}
    >
      <div className="flex flex-col gap-4">
        {feedEntries.length === 0 ? (
          <div className="text-slate-600" data-cy="product-updates-empty">
            {t('pwa.productUpdates.empty')}
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
            />
          ))
        )}
      </div>
    </Modal>
  )
}

export default ProductUpdateFeedModal
