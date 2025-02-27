import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AnswerCollectionCreationForm from './AnswerCollectionCreationForm'
import CollectionErrorToast from './CollectionErrorToast'
import CollectionSuccessToast from './CollectionSuccessToast'

function AnswerCollectionCreation() {
  const t = useTranslations()
  const router = useRouter()

  const [creationOpen, setCreationOpen] = useState(false)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
      {!creationOpen ? (
        <div className="mb-4">
          <UserNotification type="info" className={{ root: 'mb-3' }}>
            {t('manage.resources.selectCreateAnswerCollection')}
          </UserNotification>
          <Button
            className={{ root: 'w-full' }}
            onClick={() => setCreationOpen(true)}
            data={{ cy: 'create-answer-collection' }}
          >
            <FontAwesomeIcon icon={faPlusCircle} />
            {t('manage.resources.newAnswerCollection')}
          </Button>
        </div>
      ) : null}
      {creationOpen ? (
        <AnswerCollectionCreationForm
          onClose={() => setCreationOpen(false)}
          openSuccessToast={() => setSuccessToast(true)}
          openErrorToast={() => setErrorToast(true)}
        />
      ) : null}
      <CollectionSuccessToast open={successToast} setOpen={setSuccessToast} />
      <CollectionErrorToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default AnswerCollectionCreation
