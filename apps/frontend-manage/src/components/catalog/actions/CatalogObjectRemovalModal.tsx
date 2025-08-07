import { useMutation } from '@apollo/client'
import {
  CatalogObject,
  GetCatalogObjectsDocument,
  ObjectType,
  RemoveCatalogObjectAssignmentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
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
  // TODO: add query update
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
        const res = await removeCatalogObjectAssignment({
          variables: {
            assignmentId: object.id,
          },
          update: (cache, { data }) => {
            // check if request was successful
            const success = data?.removeCatalogObjectAssignment
            if (!success) return

            // update list of catalog objects
            const catalogObjects = cache.readQuery({
              query: GetCatalogObjectsDocument,
              variables: {
                catalogCollectionId,
              },
            })

            if (catalogObjects?.getCatalogObjects) {
              cache.writeQuery({
                query: GetCatalogObjectsDocument,
                variables: {
                  catalogCollectionId,
                },
                data: {
                  getCatalogObjects: catalogObjects?.getCatalogObjects.filter(
                    (obj) => obj.id !== object.id
                  ),
                },
              })
            }
          },
        })

        if (res.data?.removeCatalogObjectAssignment) {
          onClose()
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
