import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
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
      onClose={onClose}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
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
      primaryLoading={removeCatalogObjectAssignment.isLoading}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
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
          void utils.sharing.catalogCollections.invalidate()
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
