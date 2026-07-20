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
              // check if the deletion was successful
              if (!data?.deleteCatalogCollection) return

              // remove the catalog collection from the list
              cache.updateQuery(
                { query: GetCatalogCollectionsListDocument },
                (data) => {
                  if (!data?.getCatalogCollectionsList) return data
                  return {
                    ...data,
                    getCatalogCollectionsList:
                      data.getCatalogCollectionsList.filter(
                        (collection) => collection.id !== catalogCollectionId
                      ),
                  }
                }
              )
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
