import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { trpc } from '../../../lib/trpc'

type DeletableAnswerCollection = {
  id: number
  name: string
}

function CollectionDeletionModal({
  collection,
  setDeletionModal,
}: {
  collection: DeletableAnswerCollection
  setDeletionModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const deleteAnswerCollection =
    trpc.resources.deleteAnswerCollection.useMutation()
  const loading = deleteAnswerCollection.isLoading
  const handleClose = () => {
    if (!loading) {
      setDeletionModal(false)
    }
  }

  return (
    <Modal
      open
      title={t('manage.resources.deleteAnswerCollection')}
      onClose={handleClose}
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
      primaryDisabled={loading}
      onPrimaryAction={async () => {
        try {
          const res = await deleteAnswerCollection.mutateAsync({
            collectionId: collection.id,
          })

          if (res.deletedAnswerCollectionId) {
            await utils.resources.answerCollectionsInfo.invalidate()
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
        } catch (error) {
          console.error('Error deleting answer collection:', error)
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
