import { CatalogObject, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import RequestCancellationErrorToast from '../../resources/answerCollections/RequestCancellationErrorToast'
import CancelRequestAnswerCollectionModal from '../../resources/answerCollections/RequestCancellationModal'
import RequestCancellationSuccessToast from '../../resources/answerCollections/RequestCancellationSuccessToast'

function ObjectRequestCancellationModal({
  object,
  open,
  onClose,
}: {
  object: CatalogObject
  open: boolean
  onClose: () => void
}) {
  const [successToast, setSuccessToast] = useState(false)
  const [failureToast, setFailureToast] = useState(false)

  const SuccessFailureToasts = () => (
    <>
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

  if (object.objectType === CatalogObjectType.AnswerCollection) {
    return (
      <>
        <CancelRequestAnswerCollectionModal
          id={object.id!}
          open={open}
          onClose={onClose}
          onSuccess={() => setSuccessToast(true)}
          onFailure={() => setFailureToast(true)}
        />
        <SuccessFailureToasts />
      </>
    )
  }

  return null
}

export default ObjectRequestCancellationModal
