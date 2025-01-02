import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  CollectionAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CollectionAccessLabel from './CollectionAccessLabel'
import CollectionImportRequestModal from './CollectionImportRequestModal'

function AnswerCollectionImportItem({
  collection,
  onClose,
  onSuccess,
}: {
  collection: AnswerCollection
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [modalOpen, setModalOpen] = useState(false)
  const collectionAccessMap: Record<CollectionAccess, React.ReactNode | null> =
    {
      [CollectionAccess.Public]: (
        <CollectionAccessLabel
          accessType={CollectionAccess.Public}
          className="text-sm"
        />
      ),
      [CollectionAccess.Restricted]: (
        <CollectionAccessLabel
          accessType={CollectionAccess.Restricted}
          className="text-sm"
        />
      ),
      [CollectionAccess.Private]: null,
    }

  return (
    <>
      <Button
        basic
        onClick={() => setModalOpen(true)}
        className={{
          root: 'flex flex-row justify-between rounded border border-solid px-2 py-0.5 shadow-sm',
        }}
      >
        <div className="flex flex-col items-start">
          <div className="flex flex-row gap-5">
            <H4 className={{ root: 'mb-0' }}>{collection.name}</H4>
            {collectionAccessMap[collection.access]}
          </div>
          <div className="text-sm text-gray-500">
            {t('manage.resources.byOwner', {
              owner: collection.ownerShortname,
            })}
          </div>
        </div>
        <div className="text-primary-100 flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHandPointer} />
          <div>{t('manage.resources.requestImport')}</div>
        </div>
      </Button>
      <CollectionImportRequestModal
        open={modalOpen}
        collection={collection}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          onClose()
          onSuccess()
        }}
      />
    </>
  )
}

export default AnswerCollectionImportItem
