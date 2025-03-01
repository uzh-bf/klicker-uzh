import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { LiveQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import PrimaryActionLink from './PrimaryActionLink'

interface RunningLiveQuizLinkProps {
  liveQuiz: Pick<LiveQuiz, 'id' | 'name'>
}

function RunningLiveQuizLink({ liveQuiz }: RunningLiveQuizLinkProps) {
  const t = useTranslations()

  return (
    <PrimaryActionLink
      href={`/quizzes/${liveQuiz.id}/cockpit`}
      label={t('manage.course.runningLiveQuiz')}
      icon={faArrowUpRightFromSquare}
      data={{ cy: `open-cockpit-live-quiz-${liveQuiz.name}` }}
    />
  )
}

export default RunningLiveQuizLink
