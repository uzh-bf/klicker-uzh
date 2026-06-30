import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

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
  const utils = trpc.useUtils()
  const deleteCatalogCollection =
    trpc.sharing.deleteCatalogCollection.useMutation()
  const loading = deleteCatalogCollection.isLoading
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={t('manage.catalog.deleteCatalogCollectionTitle')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-delete-collection' }}
      primaryLabel={t('manage.catalog.deleteConfirm')}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={loading}
      onPrimaryAction={async () => {
        try {
          const res = await deleteCatalogCollection.mutateAsync({
            catalogCollectionId,
          })

          if (!res.deletedCatalogCollectionId) {
            toast({
              type: 'error',
              message: t('manage.catalog.deletionFailed'),
            })
            return
          }

          utils.sharing.catalogCollections.setData(undefined, (data) => {
            if (!data?.catalogCollections) return data

            return {
              catalogCollections: data.catalogCollections.filter(
                (collection) => collection.id !== catalogCollectionId
              ),
            }
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
