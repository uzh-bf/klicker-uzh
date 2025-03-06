import { useMutation, useQuery } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  CancelAnswerCollectionRequestDocument,
  GetCatalogObjectsDocument,
  GetSingleAnswerCollectionCatalogDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

// TODO: generalize this modal and only insert small part with customization depending on the object type (if necessary)
function RequestCancellationModal({
  id,
  open,
  catalogCollectionId,
  onClose,
  onSuccess,
  onFailure,
}: {
  id: number
  open: boolean
  catalogCollectionId?: string
  onClose: () => void
  onSuccess: () => void
  onFailure: () => void
}) {
  const t = useTranslations()

  // fetch answer collection
  const { data, loading } = useQuery(GetSingleAnswerCollectionCatalogDocument, {
    variables: {
      collectionId: id,
      catalogCollectionId,
    },
  })
  const collection = data?.getSingleAnswerCollectionCatalog

  const [cancelAnswerCollectionRequest, { loading: mutationLoading }] =
    useMutation(CancelAnswerCollectionRequestDocument, {
      variables: { collectionId: id },
      optimisticResponse: {
        cancelAnswerCollectionRequest: true,
      },
      update: (cache, { data }) => {
        // check if request was successful
        const cancelledCollection = data?.cancelAnswerCollectionRequest
        if (!cancelledCollection) return

        // update list of answer collections
        const catalogObjects = cache.readQuery({
          query: GetCatalogObjectsDocument,
          variables: {
            catalogCollectionId,
          },
        })

        if (catalogObjects?.getCatalogObjects) {
          const updatedObjects = catalogObjects?.getCatalogObjects.map(
            (obj) => {
              if (obj.id === id) {
                return { ...obj, isRequested: false }
              }

              return obj
            }
          )

          cache.writeQuery({
            query: GetCatalogObjectsDocument,
            variables: {
              catalogCollectionId,
            },
            data: {
              getCatalogObjects: updatedObjects,
            },
          })
        }
      },
    })

  return (
    <Modal
      title={t('manage.resources.cancelSharingRequest')}
      open={open}
      onClose={onClose}
      dataCloseButton={{ cy: 'close-cancel-sharing-request' }}
    >
      {loading || !collection ? (
        <Loader />
      ) : (
        <>
          <div>
            {t('manage.resources.confirmCancelRequest', {
              name: data?.getSingleAnswerCollectionCatalog?.name,
            })}
          </div>
          <Button
            destructive
            onClick={async () => {
              const { data, errors } = await cancelAnswerCollectionRequest()

              if (
                typeof data?.cancelAnswerCollectionRequest !== 'undefined' &&
                data?.cancelAnswerCollectionRequest !== null &&
                !errors
              ) {
                onSuccess()
                onClose()
              } else {
                onFailure()
              }
            }}
            loading={mutationLoading}
            className={{
              root: 'float-right mt-3',
            }}
            data={{ cy: 'confirm-cancel-sharing-request' }}
          >
            <Button.Icon icon={faTrashCan} />
            <Button.Label>
              {t('manage.resources.confirmCancellation', {
                name: collection.name,
              })}
            </Button.Label>
          </Button>
        </>
      )}
    </Modal>
  )
}

export default RequestCancellationModal
