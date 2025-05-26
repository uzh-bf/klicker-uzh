import { useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import {
  DuplicateAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AnswerCollectionDuplicationModal({
  collectionId,
  open,
  onClose,
}: {
  collectionId: number
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [duplicateAnswerCollection, { loading }] = useMutation(
    DuplicateAnswerCollectionDocument
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.resources.duplicateCollection')}
      onSecondaryAction={
        <Button onClick={onClose} data={{ cy: 'cancel-duplication' }}>
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
      onPrimaryAction={
        <Button
          primary
          loading={loading}
          onClick={async () => {
            await duplicateAnswerCollection({
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

            // close the modal after duplication
            onClose()
          }}
          data={{ cy: 'confirm-duplication' }}
        >
          <Button.Icon icon={faCopy} loading={loading} />
          <Button.Label>
            {t('manage.resources.duplicateCollection')}
          </Button.Label>
        </Button>
      }
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
