import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'

const answerCollectionObjectType = 'ANSWER_COLLECTION'

function AnswerCollectionRemovalModal({
  id,
  name,
  onClose,
}: {
  id: number
  name: string
  onClose: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const removeAnswerCollection =
    trpc.resources.removeAnswerCollection.useMutation()
  const loading = removeAnswerCollection.isLoading
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  const onRemovalError = () =>
    toast({
      type: 'error',
      message: t('manage.sharing.removalFailed'),
      options: { duration: 3000 },
    })

  return (
    <Modal
      open
      title={t(`manage.sharing.remove${answerCollectionObjectType}`)}
      onClose={handleClose}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faX} />}
          <span>{t('manage.sharing.confirmRemoval')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={loading}
      onPrimaryAction={async () => {
        try {
          const res = await removeAnswerCollection.mutateAsync({
            id,
          })

          if (res.removedAnswerCollectionId !== null) {
            await utils.resources.answerCollectionsInfo
              .invalidate()
              .catch(console.error)
            toast({
              type: 'success',
              message: t('manage.sharing.removalSuccessful'),
              options: { duration: 3000 },
            })
            onClose()
          } else {
            onRemovalError()
          }
        } catch (error) {
          onRemovalError()
          console.error(error)
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-remove-object' }}
      dataCloseButton={{ cy: 'close-remove-object' }}
      className={{ content: 'max-w-xl', footer: 'justify-end' }}
    >
      {t(`manage.sharing.confirmRemoval${answerCollectionObjectType}`, {
        objectName: name,
      })}
    </Modal>
  )
}

export default AnswerCollectionRemovalModal
