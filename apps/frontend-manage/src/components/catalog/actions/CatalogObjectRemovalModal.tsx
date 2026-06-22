import { ObjectType } from '@lib/constants/sharingEnums'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'
import type { CatalogBrowserObject } from '../catalogBrowserTypes'

function CatalogObjectRemovalModal({
  object,
  catalogCollectionId,
  onClose,
}: {
  object: CatalogBrowserObject
  catalogCollectionId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const removeCatalogObjectAssignment =
    trpc.sharing.removeCatalogObjectAssignment.useMutation()
  const removing = removeCatalogObjectAssignment.isLoading
  const handleClose = () => {
    if (!removing) {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={
        (object.objectType === ObjectType.LiveQuiz ||
          object.objectType === ObjectType.PracticeQuiz ||
          object.objectType === ObjectType.MicroLearning ||
          object.objectType === ObjectType.GroupActivity) &&
        !!object.templateId
          ? t(`manage.catalog.remove${object.objectType}_TEMPLATEtitle`)
          : t(`manage.catalog.remove${object.objectType}title`)
      }
      onClose={handleClose}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-removal' }}
      primaryLabel={
        (object.objectType === ObjectType.LiveQuiz ||
          object.objectType === ObjectType.PracticeQuiz ||
          object.objectType === ObjectType.MicroLearning ||
          object.objectType === ObjectType.GroupActivity) &&
        !!object.templateId
          ? t(`manage.catalog.remove${object.objectType}_TEMPLATE`)
          : t(`manage.catalog.remove${object.objectType}`)
      }
      primaryLoading={removing}
      primaryDisabled={removing}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
        try {
          const res = await removeCatalogObjectAssignment.mutateAsync({
            assignmentId: object.id,
          })

          const success = res.removed
          if (success) {
            utils.sharing.catalogObjects.setData(
              { catalogCollectionId },
              (data) => {
                if (!data?.catalogObjects) return data

                return {
                  catalogObjects: data.catalogObjects.filter(
                    (obj) => obj.id !== object.id
                  ),
                }
              }
            )
            void utils.sharing.catalogCollections
              .invalidate()
              .catch(console.error)
            toast({
              type: 'success',
              message: t('manage.catalog.objectRemovalSuccess'),
            })
            onClose()
          } else {
            toast({
              type: 'error',
              message: t('manage.catalog.objectRemovalFailed'),
            })
          }
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('manage.catalog.objectRemovalFailed'),
          })
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-removal' }}
      className={{ content: 'w-full max-w-xl' }}
      data={{ cy: 'remove-object-modal' }}
    >
      <div>
        {t('manage.catalog.removeObjectDescription', {
          objectType: t(`shared.types.${object.objectType}`),
          objectName: object.name,
        })}
      </div>
    </Modal>
  )
}

export default CatalogObjectRemovalModal
