import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { WizardMode } from '../../sessions/creation/SessionCreation'

interface EditPracticeQuizButtonProps {
  practiceQuiz: Partial<PracticeQuiz>
}

function EditPracticeQuizButton({ practiceQuiz }: EditPracticeQuizButtonProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Button
      basic
      className={{ root: 'text-primary' }}
      onClick={() =>
        router.push({
          pathname: '/',
          query: {
            sessionId: practiceQuiz.id,
            editMode: WizardMode.PracticeQuiz,
          },
        })
      }
      data={{ cy: `edit-practice-quiz-${practiceQuiz.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faPencil} />
      </Button.Icon>
      <Button.Label>{t('manage.course.editPracticeQuiz')}</Button.Label>
    </Button>
  )
}

export default EditPracticeQuizButton
