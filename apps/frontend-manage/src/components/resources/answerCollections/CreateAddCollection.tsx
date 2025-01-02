import { faDownload, faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionCreation from './AnswerCollectionCreation'
import AnswerCollectionImport from './AnswerCollectionImport'
import CollectionErrorToast from './CollectionErrorToast'
import CollectionSuccessToast from './CollectionSuccessToast'
import ImportRequestSuccessToast from './ImportRequestSuccessToast'

function CreateAddCollection() {
  const t = useTranslations()
  const [creationOpen, setCreationOpen] = useState(false)
  const [browsingOpen, setBrowsingOpen] = useState(false)
  const [successToast, setSuccessToast] = useState(false)
  const [importRequestSuccess, setImportRequestSuccess] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
      {!creationOpen && !browsingOpen ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Button
            className={{ root: 'w-full sm:w-1/2' }}
            onClick={() => setCreationOpen(true)}
          >
            <FontAwesomeIcon icon={faPlusCircle} />
            {t('manage.resources.newAnswerCollection')}
          </Button>
          <Button
            className={{ root: 'w-full sm:w-1/2' }}
            onClick={() => setBrowsingOpen(true)}
          >
            <FontAwesomeIcon icon={faDownload} />
            {t('manage.resources.addSharedAnswerCollection')}
          </Button>
        </div>
      ) : null}
      {creationOpen ? (
        <AnswerCollectionCreation
          onClose={() => setCreationOpen(false)}
          openSuccessToast={() => setSuccessToast(true)}
          openErrorToast={() => setErrorToast(true)}
        />
      ) : null}
      {browsingOpen ? (
        <AnswerCollectionImport
          onClose={() => setBrowsingOpen(false)}
          onSuccess={() => setImportRequestSuccess(true)}
        />
      ) : null}
      <ImportRequestSuccessToast
        open={importRequestSuccess}
        setOpen={setImportRequestSuccess}
      />
      <CollectionSuccessToast open={successToast} setOpen={setSuccessToast} />
      <CollectionErrorToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default CreateAddCollection
