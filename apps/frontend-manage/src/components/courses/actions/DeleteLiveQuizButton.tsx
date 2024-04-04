import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteSessionDocument,
  GetSingleCourseDocument,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import LiveSessionDeletionModal from '../modals/LiveSessionDeletionModal'

interface DeleteLiveQuizButtonProps {
  liveQuiz: Partial<Session>
}

function DeleteLiveQuizButton({ liveQuiz }: DeleteLiveQuizButtonProps) {
  const t = useTranslations()
  const [deletionModal, setDeletionModal] = useState(false)
  const [deleteSession] = useMutation(DeleteSessionDocument, {
    variables: { id: liveQuiz.id || '' },
    refetchQueries: [GetSingleCourseDocument],
  })

  return (
    <>
      <Button
        basic
        className={{ root: 'text-red-600' }}
        onClick={() => setDeletionModal(true)}
        data={{ cy: `delete-live-quiz-${liveQuiz.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faTrashCan} />
        </Button.Icon>
        <Button.Label>{t('manage.sessions.deleteSession')}</Button.Label>
      </Button>
      <LiveSessionDeletionModal
        deleteSession={deleteSession}
        title={liveQuiz.name || ''}
        open={deletionModal}
        setOpen={setDeletionModal}
        message={t('manage.sessions.liveQuizDeletionHint')}
      />
    </>
  )
}

export default DeleteLiveQuizButton
