import { Modal } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import ProductUpdateCard from './ProductUpdateCard'
import { useProductUpdates } from './useProductUpdates'

function ProductUpdateFeedModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations()
  const router = useRouter()
  const { entries, recordPresentation, markRead, dismiss } = useProductUpdates()

  // The feed is the "what is new" surface, so a dismissed entry leaves it. The
  // /updates page keeps the full history.
  const feedEntries = entries.filter((entry) => !entry.dismissed)

  return (
    <Modal
      open
      title={t('manage.productUpdates.feedTitle')}
      onClose={onClose}
      className={{
        overlay: 'my-auto text-black',
        title: 'text-left text-xl md:text-2xl',
        content: 'h-max max-w-3xl pb-1',
      }}
      dataContent={{ cy: 'product-updates-feed' }}
    >
      <div className="flex flex-col gap-4">
        {feedEntries.length === 0 ? (
          <div className="text-slate-600" data-cy="product-updates-empty">
            {t('manage.productUpdates.empty')}
          </div>
        ) : (
          feedEntries.map((entry) => (
            <ProductUpdateCard
              key={entry.update.id}
              update={entry.update}
              state={entry.state}
              onPresent={recordPresentation}
              onRead={markRead}
              onDismiss={dismiss}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            void router.push('/updates')
          }}
          className="self-start text-sm text-blue-600 hover:underline"
          data-cy="product-updates-all"
        >
          {t('manage.productUpdates.showAll')}
        </button>
      </div>
    </Modal>
  )
}

export default ProductUpdateFeedModal
