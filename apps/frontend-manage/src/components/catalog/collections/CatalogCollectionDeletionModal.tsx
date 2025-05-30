import { useMutation } from '@apollo/client'
import {
  DeleteCatalogCollectionDocument,
  GetCatalogCollectionsListDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CatalogCollectionDeletionErrorToast from './CatalogCollectionDeletionErrorToast'

interface CatalogCollectionDeletionModalProps {
  catalogCollectionId: string
  catalogCollectionName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function CatalogCollectionDeletionModal({
  catalogCollectionId,
  catalogCollectionName,
  open,
  onClose,
  onSuccess,
}: CatalogCollectionDeletionModalProps) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const [deleteCatalogCollection, { loading: deleting }] = useMutation(
    DeleteCatalogCollectionDocument
  )

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('manage.catalog.deleteCatalogCollectionTitle')}
        secondaryLabel={t('shared.generic.cancel')}
        onSecondaryAction={onClose}
        dataSecondaryAction={{ cy: 'cancel-delete-collection' }}
        primaryLabel={t('manage.catalog.deleteConfirm')}
        primaryButtonStyle="destructive"
        primaryLoading={deleting}
        onPrimaryAction={async () => {
          try {
            await deleteCatalogCollection({
              variables: { catalogCollectionId },
              update: (cache, { data }) => {
                if (!data?.deleteCatalogCollection) return

                const prevCollections = cache.readQuery({
                  query: GetCatalogCollectionsListDocument,
                })

                if (!prevCollections?.getCatalogCollectionsList) {
                  return
                }

                const newCollections =
                  prevCollections.getCatalogCollectionsList.filter(
                    (collection) =>
                      collection.id !== data.deleteCatalogCollection!
                  )

                cache.writeQuery({
                  query: GetCatalogCollectionsListDocument,
                  data: {
                    getCatalogCollectionsList: newCollections,
                  },
                })
              },
            })

            onSuccess()
            onClose()
          } catch (error) {
            console.error(error)
            setErrorToast(true)
          }
        }}
        dataPrimaryAction={{ cy: 'confirm-delete-collection' }}
        className={{ content: 'max-w-xl' }}
      >
        <div className="mb-2">
          {t('manage.catalog.deleteCatalogCollectionDescription', {
            name: catalogCollectionName,
          })}
        </div>
      </Modal>

      <CatalogCollectionDeletionErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogCollectionDeletionModal
