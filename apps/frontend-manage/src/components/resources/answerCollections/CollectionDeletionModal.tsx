import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  DeleteAnswerCollectionDocument,
  GetAnswerCollectionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function CollectionDeletionModal({
  collection,
  deletionModal,
  setDeletionModal,
  setDeletionSuccess,
  setDeletionFailure,
}: {
  collection: AnswerCollection
  deletionModal: boolean
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [deleteAnswerCollection] = useMutation(DeleteAnswerCollectionDocument, {
    variables: { collectionId: collection.id },
    optimisticResponse: {
      deleteAnswerCollection: collection.id,
    },
    update: (cache, { data }) => {
      const res = data?.deleteAnswerCollection
      if (res === null || typeof res === 'undefined') return

      const prevQuery = cache.readQuery({
        query: GetAnswerCollectionsDocument,
      })
      const collections = prevQuery?.getAnswerCollections
      if (!collections) return

      cache.writeQuery({
        query: GetAnswerCollectionsDocument,
        data: {
          getAnswerCollections: {
            ...collections,
            answerCollections:
              collections.answerCollections.filter((c) => c.id !== res) ?? [],
          },
        },
      })
    },
  })

  return (
    <Modal
      title={t('manage.resources.deleteAnswerCollection')}
      open={deletionModal}
      onClose={() => setDeletionModal(false)}
      dataCloseButton={{ cy: 'close-delete-answer-collection' }}
    >
      <div>
        {t('manage.resources.confirmCollectionDeletion', {
          name: collection.name,
        })}
      </div>
      <Button
        onClick={async () => {
          const { data, errors } = await deleteAnswerCollection()

          if (
            typeof data?.deleteAnswerCollection !== 'undefined' &&
            data?.deleteAnswerCollection !== null &&
            !errors
          ) {
            setDeletionSuccess(true)
            setDeletionModal(false)
          } else {
            setDeletionFailure(true)
          }
        }}
        className={{
          root: 'float-right mt-4 flex flex-row gap-1.5 border border-red-600',
        }}
        data={{ cy: 'confirm-delete-answer-collection' }}
      >
        <FontAwesomeIcon icon={faTrashCan} />
        <div>
          {t('manage.resources.confirmDeletion', { name: collection.name })}
        </div>
      </Button>
    </Modal>
  )
}

export default CollectionDeletionModal
