import { useMutation } from '@apollo/client'
import {
  CatalogObject,
  GetCatalogObjectsDocument,
  ObjectType,
  RemoveCatalogObjectAssignmentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogObjectRemovalModal({
  object,
  open,
  catalogCollectionId,
  onClose,
}: {
  object: CatalogObject
  open: boolean
  catalogCollectionId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [removeCatalogObjectAssignment, { loading }] = useMutation(
    RemoveCatalogObjectAssignmentDocument
  )

  return (
    <Modal
      open={open}
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
      className={{ content: 'w-full max-w-lg' }}
      data={{ cy: 'remove-object-modal' }}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t('manage.catalog.removeObjectDescription', {
            objectType: t(`shared.types.${object.objectType}`),
            objectName: object.name,
          })}
        </div>
        <div className="mt-2 flex flex-row justify-between gap-2">
          <Button
            onClick={onClose}
            className={{ root: 'w-auto' }}
            data={{ cy: 'cancel-removal' }}
          >
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            destructive
            loading={loading}
            onClick={async () => {
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
                        getCatalogObjects:
                          catalogObjects?.getCatalogObjects.filter(
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
            data={{ cy: 'confirm-removal' }}
          >
            <Button.Label>
              {(object.objectType === ObjectType.LiveQuiz ||
                object.objectType === ObjectType.PracticeQuiz ||
                object.objectType === ObjectType.MicroLearning ||
                object.objectType === ObjectType.GroupActivity) &&
              !!object.templateId
                ? t(`manage.catalog.remove${object.objectType}_TEMPLATE`)
                : t(`manage.catalog.remove${object.objectType}`)}
            </Button.Label>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CatalogObjectRemovalModal
