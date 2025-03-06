import { useMutation } from '@apollo/client'
import {
  CatalogObject,
  ChangeCatalogObjectAccessDocument,
  GetCatalogObjectsDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectChangeAccessModal({
  object,
  newAccess,
  open,
  catalogCollectionId,
  onClose,
}: {
  object: CatalogObject
  newAccess: ObjectAccess
  open: boolean
  catalogCollectionId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [changeCatalogObjectAccess, { loading }] = useMutation(
    ChangeCatalogObjectAccessDocument
  )

  return (
    <Modal
      open={open}
      title={t('manage.catalog.changeAccessTitle')}
      onClose={onClose}
      className={{ content: 'w-full max-w-lg' }}
      data={{ cy: 'change-access-modal' }}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t('manage.catalog.changeAccessDescription', {
            objectType: t(`shared.types.${object.objectType}`),
            objectName: object.name,
            newAccess: t(`manage.catalog.access${newAccess}`),
          })}
        </div>
        <div className="mt-2 flex flex-row justify-end gap-2">
          <Button
            onClick={onClose}
            className={{ root: 'w-auto' }}
            data={{ cy: 'cancel-access-change' }}
          >
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            primary
            loading={loading}
            onClick={async () => {
              const res = await changeCatalogObjectAccess({
                variables: {
                  assignmentId: object.assignmentId,
                  access: newAccess,
                },
                update: (cache, { data }) => {
                  // check if request was successful
                  const success = data?.changeCatalogObjectAccess
                  if (!success) return

                  // update list of answer collections
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
                          catalogObjects?.getCatalogObjects.map((obj) =>
                            obj.assignmentId === object.assignmentId
                              ? { ...obj, access: newAccess }
                              : obj
                          ),
                      },
                    })
                  }
                },
              })

              if (res.data?.changeCatalogObjectAccess) {
                onClose()
              }
            }}
            data={{ cy: 'confirm-access-change' }}
          >
            <Button.Label>
              {t('manage.catalog.changeAccessConfirm')}
            </Button.Label>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ObjectChangeAccessModal
