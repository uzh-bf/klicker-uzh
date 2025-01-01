import { faDownload, faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionCreation from './AnswerCollectionCreation'

function CreateAddCollection() {
  const t = useTranslations()
  const [creationOpen, setCreationOpen] = useState(false) // TODO: add form for creation
  const [browsingOpen, setBrowsingOpen] = useState(false) // TODO: add form for browsing shared collections

  return (
    <>
      {!creationOpen && !browsingOpen ? (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
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
        <AnswerCollectionCreation onClose={() => setCreationOpen(false)} />
      ) : null}
    </>
  )
}

export default CreateAddCollection
