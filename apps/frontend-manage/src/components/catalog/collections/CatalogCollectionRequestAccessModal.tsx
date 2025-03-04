import { useMutation } from '@apollo/client'
import {
  GetCatalogCollectionsListDocument,
  RequestCatalogCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CatalogCollectionRequestAccessErrorToast from './CatalogCollectionRequestAccessErrorToast'

interface CatalogCollectionRequestAccessModalProps {
  catalogCollectionId: string
  catalogCollectionName: string
  ownerShortname?: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function CatalogCollectionRequestAccessModal({
  catalogCollectionId,
  catalogCollectionName,
  ownerShortname,
  open,
  onClose,
  onSuccess,
}: CatalogCollectionRequestAccessModalProps) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const [requestCatalogCollection, { loading: requesting }] = useMutation(
    RequestCatalogCollectionDocument
  )

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('manage.catalog.requestCatalogCollectionAccess')}
      >
        <div>
          {t.rich('manage.catalog.requestCatalogCollectionAccessDescription', {
            name: catalogCollectionName,
            owner: ownerShortname || t('shared.generic.unknown'),
            b: (children) => <b>{children}</b>,
          })}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <Button onClick={onClose} data={{ cy: 'cancel-request-access' }}>
            {t('shared.generic.cancel')}
          </Button>
          <Button
            primary
            loading={requesting}
            onClick={async () => {
              try {
                await requestCatalogCollection({
                  variables: { catalogCollectionId },
                  update: (cache, { data }) => {
                    if (!data?.requestCatalogCollection) return

                    const prevCollections = cache.readQuery({
                      query: GetCatalogCollectionsListDocument,
                    })

                    if (!prevCollections?.getCatalogCollectionsList) {
                      return
                    }

                    const newCollections =
                      prevCollections.getCatalogCollectionsList.map(
                        (collection) =>
                          collection.id === catalogCollectionId
                            ? data.requestCatalogCollection!
                            : collection
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
            data={{ cy: 'confirm-request-access' }}
          >
            {t('manage.catalog.requestAccess')}
          </Button>
        </div>
      </Modal>

      <CatalogCollectionRequestAccessErrorToast
        open={errorToast}
        onClose={() => setErrorToast(false)}
      />
    </>
  )
}

export default CatalogCollectionRequestAccessModal
