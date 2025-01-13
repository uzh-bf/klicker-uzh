import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  CancelAnswerCollectionRequestDocument,
  GetAnswerCollectionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function RequestCancellationModal({
  collection,
  cancellationModal,
  setCancellationModal,
  setCancellationSuccess,
  setCancellationFailure,
}: {
  collection: AnswerCollection
  cancellationModal: boolean
  setCancellationModal: (value: boolean) => void
  setCancellationSuccess: (value: boolean) => void
  setCancellationFailure: (value: boolean) => void
}) {
  const t = useTranslations()

  const [cancelAnswerCollectionRequest] = useMutation(
    CancelAnswerCollectionRequestDocument,
    {
      variables: { collectionId: collection.id },
      optimisticResponse: {
        cancelAnswerCollectionRequest: true,
      },
      update: (cache, { data }) => {
        const res = data?.cancelAnswerCollectionRequest
        if (res === null || typeof res === 'undefined') return

        const prevQuery = cache.readQuery({
          query: GetAnswerCollectionsDocument,
        })
        const collections = prevQuery?.getAnswerCollections
        if (!collections) return

        cache.writeQuery({
          query: GetAnswerCollectionsDocument,
          data: {
            getAnswerCollections: collections.filter(
              (c) => c.id !== collection.id
            ),
          },
        })
      },
    }
  )

  return (
    <Modal
      title={t('manage.resources.cancelSharingRequest')}
      open={cancellationModal}
      onClose={() => setCancellationModal(false)}
      dataCloseButton={{ cy: 'close-cancel-sharing-request' }}
    >
      <div>
        {t('manage.resources.confirmCancelRequest', {
          name: collection.name,
        })}
      </div>
      <Button
        onClick={async () => {
          const { data, errors } = await cancelAnswerCollectionRequest()

          if (
            typeof data?.cancelAnswerCollectionRequest !== 'undefined' &&
            data?.cancelAnswerCollectionRequest !== null &&
            !errors
          ) {
            setCancellationSuccess(true)
            setCancellationModal(false)
          } else {
            setCancellationFailure(true)
          }
        }}
        className={{
          root: 'float-right mt-4 flex flex-row gap-1.5 border border-red-600',
        }}
        data={{ cy: 'confirm-cancel-sharing-request' }}
      >
        <FontAwesomeIcon icon={faTrashCan} />
        <div>
          {t('manage.resources.confirmCancellation', { name: collection.name })}
        </div>
      </Button>
    </Modal>
  )
}

export default RequestCancellationModal
