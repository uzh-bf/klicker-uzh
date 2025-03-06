import { useMutation } from '@apollo/client'
import {
  CatalogCollection,
  CatalogObjectType,
  ChangeCatalogCollectionObjectAccessDocument,
  GetCatalogCollectionsListDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogCollectionChangeAccessModal({
  catalogCollection,
  newAccess,
  open,
  onClose,
}: {
  catalogCollection: CatalogCollection
  newAccess: ObjectAccess
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [changeCatalogCollectionObjectAccess, { loading }] = useMutation(
    ChangeCatalogCollectionObjectAccessDocument
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
            objectType: t(
              `shared.types.${CatalogObjectType.CatalogCollection}`
            ),
            objectName: catalogCollection.name,
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
              const res = await changeCatalogCollectionObjectAccess({
                variables: {
                  catalogCollectionId: catalogCollection.id,
                  access: newAccess,
                },
                update: (cache, { data }) => {
                  // check if request was successful
                  const success = data?.changeCatalogCollectionObjectAccess
                  if (!success) return

                  // update list of answer collections
                  const queryData = cache.readQuery({
                    query: GetCatalogCollectionsListDocument,
                  })

                  if (queryData?.getCatalogCollectionsList) {
                    cache.writeQuery({
                      query: GetCatalogCollectionsListDocument,
                      data: {
                        getCatalogCollectionsList:
                          queryData?.getCatalogCollectionsList.map((obj) =>
                            obj.id === catalogCollection.id
                              ? { ...obj, access: newAccess }
                              : obj
                          ),
                      },
                    })
                  }
                },
              })

              if (res.data?.changeCatalogCollectionObjectAccess) {
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

export default CatalogCollectionChangeAccessModal
