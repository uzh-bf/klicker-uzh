import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { WizardMode } from '../../sessions/creation/SessionCreation'

interface EditLiveQuizButtonProps {
  liveQuiz: Partial<Session>
}

function EditLiveQuizButton({ liveQuiz }: EditLiveQuizButtonProps) {
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
            sessionId: liveQuiz.id,
            editMode: WizardMode.LiveQuiz,
          },
        })
      }
      data={{ cy: `edit-live-quiz-${liveQuiz.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faPencil} />
      </Button.Icon>
      <Button.Label>{t('manage.sessions.editSession')}</Button.Label>
    </Button>
  )
}

export default EditLiveQuizButton
