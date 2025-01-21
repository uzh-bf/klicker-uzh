import { faDownload, faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionCreationForm from './AnswerCollectionCreationForm'
import CollectionErrorToast from './CollectionErrorToast'
import CollectionSuccessToast from './CollectionSuccessToast'

function AnswerCollectionCreation() {
  const t = useTranslations()
  const [creationOpen, setCreationOpen] = useState(false)
  const [browsingOpen, setBrowsingOpen] = useState(false)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
      {!creationOpen && !browsingOpen ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Button
            className={{ root: 'w-full sm:w-1/2' }}
            onClick={() => setCreationOpen(true)}
            data={{ cy: 'create-answer-collection' }}
          >
            <FontAwesomeIcon icon={faPlusCircle} />
            {t('manage.resources.newAnswerCollection')}
          </Button>
          <Button
            className={{ root: 'w-full sm:w-1/2' }}
            onClick={() => setBrowsingOpen(true)}
            data={{ cy: 'add-shared-answer-collection' }}
          >
            <FontAwesomeIcon icon={faDownload} />
            {t('manage.resources.addSharedAnswerCollection')}
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
