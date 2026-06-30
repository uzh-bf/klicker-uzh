import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [removalPending, setRemovalPending] = useState(false)
  const loading = removeAnswerCollection.isLoading || removalPending
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
  const onRefreshError = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
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
        setRemovalPending(true)
        try {
          const res = await removeAnswerCollection.mutateAsync({
            id,
          })

          if (res.removedAnswerCollectionId !== null) {
            try {
              await utils.resources.answerCollectionsInfo.invalidate()
            } catch (error) {
              console.error(
                'Error refreshing answer collections after removal:',
                error
              )
              onRefreshError()
              setRemovalPending(false)
              return
            }
            toast({
              type: 'success',
              message: t('manage.sharing.removalSuccessful'),
              options: { duration: 3000 },
            })
            onClose()
            return
          } else {
            onRemovalError()
          }
        } catch (error) {
          onRemovalError()
          console.error(error)
        }
        setRemovalPending(false)
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
