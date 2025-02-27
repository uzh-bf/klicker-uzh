import { CatalogObject, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ImportAnswerCollectionModal from './ImportAnswerCollectionModal'

function ObjectImportModal({
  object,
  open,
  catalogCollectionId,
  onClose,
}: {
  object: CatalogObject
  open: boolean
  catalogCollectionId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [successToast, setSuccessToast] = useState(false)

  if (object.objectType === CatalogObjectType.AnswerCollection) {
    return (
      <>
        <ImportAnswerCollectionModal
          id={object.id!}
          open={open}
          catalogCollectionId={catalogCollectionId}
          onClose={onClose}
          onSuccess={() => setSuccessToast(true)}
        />
        <Toast
          dismissible
          openExternal={successToast}
          onCloseExternal={() => setSuccessToast(false)}
          type="success"
        >
          {t('manage.catalog.answerCollectionImportSuccess')}
        </Toast>
      </>
    )
  }

  return null
}

export default ObjectImportModal
