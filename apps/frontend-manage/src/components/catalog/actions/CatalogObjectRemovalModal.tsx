import { useMutation } from '@apollo/client'
import {
  CatalogObject,
  GetCatalogObjectsDocument,
  ObjectType,
  RemoveCatalogObjectAssignmentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogObjectRemovalModal({
  object,
  catalogCollectionId,
  onClose,
}: {
  object: CatalogObject
  catalogCollectionId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [removeCatalogObjectAssignment, { loading }] = useMutation(
    RemoveCatalogObjectAssignmentDocument
  )

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
      primaryLoading={loading}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
        const { data: res } = await removeCatalogObjectAssignment({
          variables: {
            assignmentId: object.id,
          },
          update: (cache, { data }) => {
            // check if request was successful
            const success = data?.removeCatalogObjectAssignment
            if (!success) return

            cache.updateQuery(
              {
                query: GetCatalogObjectsDocument,
                variables: { catalogCollectionId },
              },
              (data) => {
                if (!data?.getCatalogObjects) return data
                return {
                  ...data,
                  getCatalogObjects: data.getCatalogObjects.filter(
                    (obj) => obj.id !== object.id
                  ),
                }
              }
            )
          },
        })

        const success = res?.removeCatalogObjectAssignment ?? false
        if (success) {
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
