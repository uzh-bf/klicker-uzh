import { useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DuplicateAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

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
  const [duplicateAnswerCollection, { loading }] = useMutation(
    DuplicateAnswerCollectionDocument
  )

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.resources.duplicationFailure'),
      options: { duration: 10000 },
    })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.resources.duplicateCollection')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-duplication' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faCopy} />}
          <span>{t('manage.resources.duplicateCollection')}</span>
        </div>
      }
      primaryLoading={loading}
      onPrimaryAction={async () => {
        try {
          const result = await duplicateAnswerCollection({
            variables: { id: collectionId },
            update: (cache, { data }) => {
              if (!data?.duplicateAnswerCollection) return

              const queryData = cache.readQuery({
                query: GetAnswerCollectionsInfoDocument,
              })
              const previousCollections = queryData?.getAnswerCollectionsInfo
              if (!previousCollections) return

              cache.writeQuery({
                query: GetAnswerCollectionsInfoDocument,
                data: {
                  getAnswerCollectionsInfo: [
                    ...previousCollections,
                    data.duplicateAnswerCollection,
                  ],
                },
              })
            },
          })

          if (result.data?.duplicateAnswerCollection) {
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
