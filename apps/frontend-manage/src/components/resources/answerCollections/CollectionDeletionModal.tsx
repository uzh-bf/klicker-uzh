import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  DeleteAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function CollectionDeletionModal({
  collection,
  setDeletionModal,
}: {
  collection: AnswerCollection
  setDeletionModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  // TODO: add query update
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
      open
      title={t('manage.resources.deleteAnswerCollection')}
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
          toast({
            type: 'success',
            message: t('manage.resources.deletionSuccessful'),
            options: { duration: 3000 },
          })
          setDeletionModal(false)
        } else {
          toast({
            type: 'error',
            message: t('manage.resources.deletionFailed'),
            options: { duration: 3000 },
          })
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
