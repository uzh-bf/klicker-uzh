import { useMutation } from '@apollo/client'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session, StartSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface StartLiveQuizButtonProps {
  liveQuiz: Partial<Session>
}

function StartLiveQuizButton({ liveQuiz }: StartLiveQuizButtonProps) {
  const t = useTranslations()
  const router = useRouter()
  const [startSession] = useMutation(StartSessionDocument)

  return (
    <Button
      basic
      className={{ root: 'text-primary-100' }}
      onClick={async () => {
        try {
          await startSession({
            variables: { id: liveQuiz.id || '' },
          })
          router.push(`/quizzes/${liveQuiz.id}/cockpit`)
        } catch (error) {
          console.log(error)
        }
      }}
      data={{ cy: `start-live-quiz-${liveQuiz.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faPlay} />
      </Button.Icon>
      <Button.Label>{t('manage.sessions.startSession')}</Button.Label>
    </Button>
  )
}

export default StartLiveQuizButton
