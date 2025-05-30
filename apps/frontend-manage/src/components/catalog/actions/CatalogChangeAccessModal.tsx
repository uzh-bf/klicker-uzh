import { useMutation } from '@apollo/client'
import {
  ChangeCatalogCollectionObjectAccessDocument,
  ChangeCatalogObjectAccessDocument,
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  ObjectAccess,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogChangeAccessModal({
  open,
  onClose,
  objectType,
  objectName,
  assignmentId,
  newAccess,
  catalogCollectionId,
}: {
  open: boolean
  onClose: () => void
  objectType: ObjectType
  objectName: string
  assignmentId?: number
  newAccess: ObjectAccess
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const [changeCatalogObjectAccess, { loading: changingCatalogObjectAccess }] =
    useMutation(ChangeCatalogObjectAccessDocument)
  const [
    changeCatalogCollectionObjectAccess,
    { loading: changingCatalogCollectionAccess },
  ] = useMutation(ChangeCatalogCollectionObjectAccessDocument)

  return (
    <Modal
      open={open}
      title={t('manage.catalog.changeAccessTitle')}
      onClose={onClose}
      primaryLabel={t('manage.catalog.changeAccessConfirm')}
      onPrimaryAction={async () => {
        let success = false

        try {
          // if assignment id is defined, the access level of a catalog object is changed
          if (typeof assignmentId !== 'undefined') {
            const res = await changeCatalogObjectAccess({
              variables: {
                assignmentId,
                access: newAccess,
              },
              update: (cache, { data }) => {
                // check if request was successful
                const success = data?.changeCatalogObjectAccess
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
                      getCatalogObjects: catalogObjects?.getCatalogObjects.map(
                        (obj) =>
                          obj.id === assignmentId
                            ? { ...obj, access: newAccess }
                            : obj
                      ),
                    },
                  })
                }
              },
            })
            success = res.data?.changeCatalogObjectAccess ?? false
          }
          // otherwise, the access level of a catalog collection is changed
          else if (typeof catalogCollectionId !== 'undefined') {
            const res = await changeCatalogCollectionObjectAccess({
              variables: {
                catalogCollectionId,
                access: newAccess,
              },
              update: (cache, { data }) => {
                // check if request was successful
                const success = data?.changeCatalogCollectionObjectAccess
                if (!success) return

                // update list of catalog collections
                const queryData = cache.readQuery({
                  query: GetCatalogCollectionsListDocument,
                })

                if (queryData?.getCatalogCollectionsList) {
                  cache.writeQuery({
                    query: GetCatalogCollectionsListDocument,
                    data: {
                      getCatalogCollectionsList:
                        queryData?.getCatalogCollectionsList.map((obj) =>
                          obj.id === catalogCollectionId
                            ? { ...obj, access: newAccess }
                            : obj
                        ),
                    },
                  })
                }
              },
            })
            success = res.data?.changeCatalogCollectionObjectAccess ?? false
          } else {
            console.error('No assignment id or catalog collection id provided')
            success = false
          }
        } catch (e) {
          console.error('Error changing object access', e)
          success = false
        }

        if (success) {
          onClose()
        } else {
          toast({
            type: 'error',
            message: t('manage.catalog.changeAccessError'),
            options: { duration: 4500 },
          })
        }
      }}
      primaryLoading={
        changingCatalogObjectAccess || changingCatalogCollectionAccess
      }
      dataPrimaryAction={{ cy: 'confirm-access-change' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-access-change' }}
      className={{ content: 'max-w-lg' }}
      data={{ cy: 'change-access-modal' }}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t('manage.catalog.changeAccessDescription', {
            objectType: t(`shared.types.${objectType}`),
            objectName: objectName,
            newAccess: t(`manage.catalog.access${newAccess}`),
          })}
        </div>
      </div>
    </Modal>
  )
}

export default CatalogChangeAccessModal
