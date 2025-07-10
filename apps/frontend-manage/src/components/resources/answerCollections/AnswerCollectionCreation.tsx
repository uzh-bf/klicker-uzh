import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionCreationForm from './AnswerCollectionCreationForm'

function AnswerCollectionCreation() {
  const t = useTranslations()
  const [creationOpen, setCreationOpen] = useState(false)

  return (
    <>
      {!creationOpen ? (
        <div className="mb-4">
          <UserNotification type="info" className={{ root: 'mb-3' }}>
            {t('manage.resources.selectCreateAnswerCollection')}
          </UserNotification>
          <Button
            fluid
            onClick={() => setCreationOpen(true)}
            data={{ cy: 'create-answer-collection' }}
          >
            <Button.Icon icon={faPlusCircle} />
            <Button.Label>
              {t('manage.resources.newAnswerCollection')}
            </Button.Label>
          </Button>
        </div>
      ) : null}
      {creationOpen ? (
        <AnswerCollectionCreationForm onClose={() => setCreationOpen(false)} />
      ) : null}
    </>
  )
}

export default AnswerCollectionCreation
