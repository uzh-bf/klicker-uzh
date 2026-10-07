import SharedProductUpdateFeedModal from '@klicker-uzh/shared-components/src/productUpdates/ProductUpdateFeedModal'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useProductUpdates } from './useProductUpdates'

function ProductUpdateFeedModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations()
  const router = useRouter()
  const feed = useProductUpdates()

  return (
    <SharedProductUpdateFeedModal
      feed={feed}
      onClose={onClose}
      className={{
        overlay: 'my-auto text-black',
        content: 'h-max max-w-3xl pb-1',
      }}
    >
      {/* The feed drops dismissed entries; the /updates page keeps the full
          history. */}
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
    </SharedProductUpdateFeedModal>
  )
}

export default ProductUpdateFeedModal
