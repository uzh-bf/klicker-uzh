import { useMutation } from '@apollo/client'
import {
  DeleteCatalogCollectionDocument,
  GetCatalogCollectionsListDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, ModalLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CatalogCollectionDeletionErrorToast from './CatalogCollectionDeletionErrorToast'

interface CatalogCollectionDeletionModalProps {
  catalogCollectionId: string
  catalogCollectionName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function CatalogCollectionDeletionModal({
  catalogCollectionId,
  catalogCollectionName,
  open,
  onClose,
  onSuccess,
}: CatalogCollectionDeletionModalProps) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const [deleteCatalogCollection, { loading: deleting }] = useMutation(
    DeleteCatalogCollectionDocument
  )

  return (
    <>
      <ModalLegacy
        open={open}
        onClose={onClose}
        title={t('manage.catalog.deleteCatalogCollectionTitle')}
      >
        <div>
          {t('manage.catalog.deleteCatalogCollectionDescription', {
            name: catalogCollectionName,
          })}
        </div>
        <div className="mt-4 flex justify-between space-x-2">
          <Button onClick={onClose} data={{ cy: 'cancel-delete-collection' }}>
            {t('shared.generic.cancel')}
          </Button>
          <Button
            destructive
            loading={deleting}
            onClick={async () => {
              try {
                await deleteCatalogCollection({
                  variables: { catalogCollectionId },
                  update: (cache, { data }) => {
                    if (!data?.deleteCatalogCollection) return

                    const prevCollections = cache.readQuery({
                      query: GetCatalogCollectionsListDocument,
                    })

                    if (!prevCollections?.getCatalogCollectionsList) {
                      return
                    }

                    const newCollections =
                      prevCollections.getCatalogCollectionsList.filter(
                        (collection) =>
                          collection.id !== data.deleteCatalogCollection!
                      )

                    cache.writeQuery({
                      query: GetCatalogCollectionsListDocument,
                      data: {
                        getCatalogCollectionsList: newCollections,
                      },
                    })
                  },
                })

                onSuccess()
                onClose()
              } catch (error) {
                console.error(error)
                setErrorToast(true)
              }
            }}
            data={{ cy: 'confirm-delete-collection' }}
          >
            <Button.Label>{t('manage.catalog.deleteConfirm')}</Button.Label>
          </Button>
        </div>
      </ModalLegacy>

      <CatalogCollectionDeletionErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogCollectionDeletionModal
