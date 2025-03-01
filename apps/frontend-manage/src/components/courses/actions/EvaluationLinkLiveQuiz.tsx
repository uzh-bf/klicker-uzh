import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { LiveQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import PrimaryActionLink from './PrimaryActionLink'

interface EvaluationLinkLiveQuizProps {
  liveQuiz: Pick<LiveQuiz, 'id' | 'name'>
}

function EvaluationLinkLiveQuiz({ liveQuiz }: EvaluationLinkLiveQuizProps) {
  const t = useTranslations()

  return (
    <PrimaryActionLink
      href={`/quizzes/${liveQuiz.id}/evaluation`}
      target="_blank"
      rel="noopener noreferrer"
      label={t('shared.generic.evaluation')}
      icon={faUpRightFromSquare}
      data={{ cy: `open-evaluation-live-quiz-${liveQuiz.name}` }}
    />
  )
}

export default EvaluationLinkLiveQuiz
