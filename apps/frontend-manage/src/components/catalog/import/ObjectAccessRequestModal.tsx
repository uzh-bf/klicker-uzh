import { CatalogObject, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import RequestAnswerCollectionModal from './RequestAnswerCollectionModal'

function ObjectAccessRequestModal({
  object,
  open,
  onClose,
}: {
  object: CatalogObject
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [successModal, setSuccessModal] = useState(false)

  if (object.objectType === CatalogObjectType.AnswerCollection) {
    return (
      <>
        <RequestAnswerCollectionModal
          id={object.id!}
          open={open}
          onClose={onClose}
          onSuccess={() => setSuccessModal(true)}
        />
        <Toast
          dismissible
          openExternal={successModal}
          onCloseExternal={() => setSuccessModal(false)}
          type="success"
        >
          {t('manage.catalog.answerCollectionRequestSuccess')}
        </Toast>
      </>
    )
  }

  return null
}

export default ObjectAccessRequestModal
