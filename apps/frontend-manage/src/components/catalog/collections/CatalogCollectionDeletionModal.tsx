import { useMutation } from '@apollo/client'
import {
  DeleteCatalogCollectionDocument,
  GetCatalogCollectionsListDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionDeletionModalProps {
  catalogCollectionId: string
  catalogCollectionName: string
  onClose: () => void
  onSuccess: () => void
}

function CatalogCollectionDeletionModal({
  catalogCollectionId,
  catalogCollectionName,
  onClose,
  onSuccess,
}: CatalogCollectionDeletionModalProps) {
  const t = useTranslations()
  // TODO: add query update
  const [deleteCatalogCollection, { loading: deleting }] = useMutation(
    DeleteCatalogCollectionDocument
  )

  return (
    <Modal
      open
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
          toast({
            type: 'error',
            message: t('manage.catalog.deletionFailed'),
          })
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
  )
}

export default CatalogCollectionDeletionModal
