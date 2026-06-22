import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function AnswerCollectionDuplicationModal({
  collectionId,
  onClose,
  onSuccess,
}: {
  collectionId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const duplicateAnswerCollection =
    trpc.resources.duplicateAnswerCollection.useMutation()
  const loading = duplicateAnswerCollection.isLoading
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.resources.duplicationFailure'),
      options: { duration: 10000 },
    })

  return (
    <Modal
      open
      onClose={handleClose}
      title={t('manage.resources.duplicateCollection')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-duplication' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faCopy} />}
          <span>{t('manage.resources.duplicateCollection')}</span>
        </div>
      }
      primaryLoading={loading}
      primaryDisabled={loading}
      onPrimaryAction={async () => {
        try {
          const result = await duplicateAnswerCollection.mutateAsync({
            id: collectionId,
          })

          if (result.answerCollection) {
            await utils.resources.answerCollectionsInfo.invalidate()
            onClose()
            onSuccess()
          } else {
            onErrorToast()
          }
        } catch (error) {
          console.error('Error duplicating collection:', error)
          onErrorToast()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-duplication' }}
      className={{ content: 'max-w-2xl' }}
      dataCloseButton={{ cy: 'close-duplication-modal' }}
    >
      <div className="mb-2">{t('manage.resources.duplicationNote')}</div>
      <ul className="list-disc pl-5">
        <li>{t('manage.resources.duplicationNote1')}</li>
        <li>{t('manage.resources.duplicationNote2')}</li>
        <li>{t('manage.resources.duplicationNote3')}</li>
      </ul>
    </Modal>
  )
}

export default AnswerCollectionDuplicationModal
