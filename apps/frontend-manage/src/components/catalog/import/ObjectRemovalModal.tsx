import { useMutation } from '@apollo/client'
import {
  CatalogObject,
  GetCatalogObjectsDocument,
  RemoveCatalogObjectAssignmentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectRemovalModal({
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
      title={t('manage.catalog.removeObjectTitle')}
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
        <div className="mt-2 flex flex-row justify-end gap-2">
          <Button
            onClick={onClose}
            className={{ root: 'w-auto' }}
            data={{ cy: 'cancel-removal' }}
          >
            {t('shared.generic.cancel')}
          </Button>
          <Button
            loading={loading}
            onClick={async () => {
              const res = await removeCatalogObjectAssignment({
                variables: {
                  assignmentId: object.assignmentId,
                },
                update: (cache, { data }) => {
                  // check if request was successful
                  const success = data?.removeCatalogObjectAssignment
                  if (!success) return

                  // update list of answer collections
                  const catalogObjects = cache.readQuery({
                    query: GetCatalogObjectsDocument,
                  })

                  if (catalogObjects?.getCatalogObjects) {
                    cache.writeQuery({
                      query: GetCatalogObjectsDocument,
                      data: {
                        getCatalogObjects:
                          catalogObjects?.getCatalogObjects.filter(
                            (obj) => obj.assignmentId !== object.assignmentId
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
            className={{
              root: 'w-auto border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white',
            }}
            data={{ cy: 'confirm-removal' }}
          >
            {t('manage.catalog.removeObjectConfirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ObjectRemovalModal
