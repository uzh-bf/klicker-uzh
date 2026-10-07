import SharedProductUpdateFeedModal from '@klicker-uzh/shared-components/src/productUpdates/ProductUpdateFeedModal'
import { useProductUpdates } from './useProductUpdates'

function ProductUpdateFeedModal({ onClose }: { onClose: () => void }) {
  // The modal only exists behind an entry point that the layout renders for
  // eligible participants, so reading the feed here is always allowed.
  const feed = useProductUpdates({ enabled: true })

  return (
    <SharedProductUpdateFeedModal
      feed={feed}
      onClose={onClose}
      // Students mostly read on a phone, where a full-screen sheet leaves room
      // for a card with an image; the desktop width matches the other modals.
      fullScreen
      className={{
        overlay: 'text-black',
        content: 'md:h-max md:w-160 md:max-w-3xl',
      }}
    />
  )
}

export default ProductUpdateFeedModal
