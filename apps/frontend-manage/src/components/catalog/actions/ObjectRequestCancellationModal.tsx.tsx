import { CatalogObject, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import RequestCancellationErrorToast from '../../resources/answerCollections/RequestCancellationErrorToast'
import RequestCancellationModal from '../../resources/answerCollections/RequestCancellationModal'
import RequestCancellationSuccessToast from '../../resources/answerCollections/RequestCancellationSuccessToast'

function ObjectRequestCancellationModal({
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
  const [successToast, setSuccessToast] = useState(false)
  const [failureToast, setFailureToast] = useState(false)

  if (object.objectType === CatalogObjectType.AnswerCollection) {
    return (
      <>
        <RequestCancellationModal
          id={object.id!}
          open={open}
          catalogCollectionId={catalogCollectionId}
          onClose={onClose}
          onSuccess={() => setSuccessToast(true)}
          onFailure={() => setFailureToast(true)}
        />
        <RequestCancellationSuccessToast
          open={successToast}
          onClose={() => setSuccessToast(false)}
        />
        <RequestCancellationErrorToast
          open={failureToast}
          onClose={() => setFailureToast(false)}
        />
      </>
    )
  }

  return null
}

export default ObjectRequestCancellationModal
