import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PracticeQuizDeletionModal from '../modals/PracticeQuizDeletionModal'

interface DeletedPracticeQuizButtonProps {
  practiceQuiz: Partial<PracticeQuiz>
}

function DeletePracticeQuizButton({
  practiceQuiz,
}: DeletedPracticeQuizButtonProps) {
  const t = useTranslations()
  const [deletionModal, setDeletionModal] = useState(false)

  return (
    <>
      <Button
        basic
        className={{ root: 'text-red-600' }}
        onClick={() => setDeletionModal(true)}
        data={{ cy: `delete-practice-quiz-${practiceQuiz.name}` }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faTrashCan} className="w-[1.1rem]" />
        </Button.Icon>
        <Button.Label>{t('manage.course.deletePracticeQuiz')}</Button.Label>
      </Button>
      <PracticeQuizDeletionModal
        elementId={practiceQuiz.id!}
        title={practiceQuiz.name!}
        open={deletionModal}
        setOpen={setDeletionModal}
      />
    </>
  )
}

export default DeletePracticeQuizButton
