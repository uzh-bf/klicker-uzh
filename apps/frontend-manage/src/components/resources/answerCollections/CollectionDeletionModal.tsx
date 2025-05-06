import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  AnswerCollection,
  DeleteAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
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
    refetchQueries: [{ query: GetAnswerCollectionsInfoDocument }],
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
        destructive
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
          root: 'float-right mt-4',
        }}
        data={{ cy: 'confirm-delete-answer-collection' }}
      >
        <Button.Icon icon={faTrashCan} />
        <Button.Label>
          {t('manage.resources.confirmDeletion', { name: collection.name })}
        </Button.Label>
      </Button>
    </Modal>
  )
}

export default CollectionDeletionModal
