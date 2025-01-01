import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { Modal, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionMetaForm from './AnswerCollectionMetaForm'

function AnswerCollectionEditModal({
  collection,
  open,
  onClose,
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [successToast, setSuccessToast] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.resources.answerCollection', { name: collection.name })}
    >
      <AnswerCollectionMetaForm
        collection={collection}
        setSuccessToast={setSuccessToast}
      />
      <Toast
        type="success"
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
      >
        {t('manage.resources.successfulCollectionEdit')}
      </Toast>
    </Modal>
  )
}

export default AnswerCollectionEditModal
