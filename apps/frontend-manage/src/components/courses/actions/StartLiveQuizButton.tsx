import { useMutation } from '@apollo/client'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetUserRunningLiveQuizzesDocument,
  LiveQuiz,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface StartLiveQuizButtonProps {
  liveQuiz: Pick<LiveQuiz, 'id' | 'name'>
}

function StartLiveQuizButton({ liveQuiz }: StartLiveQuizButtonProps) {
  const t = useTranslations()
  const router = useRouter()
  const [startLiveQuiz, { loading: startingQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      update(cache) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes:
              liveQuiz.id && liveQuiz.name
                ? [
                    ...(data?.userRunningLiveQuizzes ?? []),
                    { id: liveQuiz.id, name: liveQuiz.name },
                  ]
                : (data?.userRunningLiveQuizzes ?? []),
          },
        })
      },
    }
  )

  return (
    <Button
      basic
      disabled={startingQuiz}
      onClick={async () => {
        try {
          await startLiveQuiz({
            variables: { id: liveQuiz.id || '' },
          })
          router.push(`/quizzes/${liveQuiz.id}/cockpit`)
        } catch (error) {
          console.log(error)
        }
      }}
      className={{ root: 'text-primary-100' }}
      data={{ cy: `start-live-quiz-${liveQuiz.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faPlay} />
      </Button.Icon>
      <Button.Label>{t('manage.liveQuizzes.startLiveQuiz')}</Button.Label>
    </Button>
  )
}

export default StartLiveQuizButton
