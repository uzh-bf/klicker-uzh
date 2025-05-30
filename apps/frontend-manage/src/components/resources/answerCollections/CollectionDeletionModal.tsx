import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  DeleteAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
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
  const [deleteAnswerCollection, { loading }] = useMutation(
    DeleteAnswerCollectionDocument,
    {
      variables: { collectionId: collection.id },
      optimisticResponse: {
        deleteAnswerCollection: collection.id,
      },
      refetchQueries: [{ query: GetAnswerCollectionsInfoDocument }],
    }
  )

  return (
    <Modal
      title={t('manage.resources.deleteAnswerCollection')}
      open={deletionModal}
      onClose={() => setDeletionModal(false)}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faTrashCan} />}
          <span>
            {t('manage.resources.confirmDeletion', { name: collection.name })}
          </span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      onPrimaryAction={async () => {
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
      dataPrimaryAction={{ cy: 'confirm-delete-answer-collection' }}
      dataCloseButton={{ cy: 'close-delete-answer-collection' }}
      className={{ footer: 'justify-end', content: 'max-w-2xl' }}
    >
      <div>
        {t('manage.resources.confirmCollectionDeletion', {
          name: collection.name,
        })}
      </div>
    </Modal>
  )
}

export default CollectionDeletionModal
