import { useMutation, useQuery } from '@apollo/client'
import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCatalogObjectsDocument,
  GetSingleAnswerCollectionCatalogDocument,
  ObjectAccess,
  RequestAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, Toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function RequestAnswerCollectionModal({
  id,
  open,
  onClose,
  onSuccess,
}: {
  id: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [showError, setShowError] = useState(false)

  // fetch answer collection
  const { data, loading } = useQuery(GetSingleAnswerCollectionCatalogDocument, {
    variables: {
      collectionId: id,
    },
  })

  const [requestAnswerCollection, { loading: requestLoading }] = useMutation(
    RequestAnswerCollectionDocument,
    {
      variables: { collectionId: id },
      update: (cache, { data }) => {
        // check if request was successful
        const requestedCollection = data?.requestAnswerCollection
        if (!requestedCollection) return

        // update lists of answer collections
        const catalogObjects = cache.readQuery({
          query: GetCatalogObjectsDocument,
        })

        if (catalogObjects?.getCatalogObjects) {
          const updatedObjects = catalogObjects?.getCatalogObjects.map(
            (obj) => {
              if (obj.id === id) {
                return requestedCollection
              }

              return obj
            }
          )

          cache.writeQuery({
            query: GetCatalogObjectsDocument,
            data: {
              getCatalogObjects: updatedObjects,
            },
          })
        }
      },
    }
  )

  const collection = data?.getSingleAnswerCollectionCatalog

  return (
    <Modal
      open={open}
      onClose={(e) => {
        e?.stopPropagation()
        onClose()
      }}
      title={t('manage.catalog.requestAccess')}
      className={{ content: 'text-sm' }}
    >
      {loading || !collection ? (
        <Loader />
      ) : (
        <>
          {collection.access === ObjectAccess.Public ? (
            <UserNotification
              type="warning"
              message={t('manage.catalog.requestPublicResource')}
              className={{ root: 'mb-2' }}
            />
          ) : null}
          <div>
            {t.rich('manage.resources.requestAccessMessage', {
              name: collection.name,
              owner: collection.ownerShortname,
              b: (text) => <b>{text}</b>,
            })}
          </div>
          <div className="border-uzh-grey-100 mt-2 rounded border border-solid p-2">
            <Markdown
              content={`**Description:** ${collection.description}`}
              data={{ cy: 'request-answer-collection-description' }}
            />
          </div>
          <div className="mt-3 flex flex-row justify-between">
            <Button
              className={{ root: 'h-8 border-red-600 text-base' }}
              data={{ cy: 'cancel-answer-collection-request' }}
              onClick={(e) => {
                e?.stopPropagation()
                onClose()
              }}
            >
              <FontAwesomeIcon icon={faBan} />
              {t('shared.generic.cancel')}
            </Button>
            <Button
              className={{ root: 'border-primary-80 h-8 text-base' }}
              onClick={async (e) => {
                e?.stopPropagation()
                const res = await requestAnswerCollection()
                if (res.data?.requestAnswerCollection) {
                  onSuccess()
                  onClose()
                } else {
                  setShowError(true)
                }
              }}
              loading={requestLoading}
              data={{ cy: 'confirm-answer-collection-request' }}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              {t('manage.resources.requestAccess')}
            </Button>
          </div>
          <Toast
            openExternal={showError}
            onCloseExternal={() => setShowError(false)}
          >
            {t('manage.resources.requestError')}
          </Toast>
        </>
      )}
    </Modal>
  )
}

export default RequestAnswerCollectionModal
