import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface EvaluationLinkLiveQuizProps {
  liveQuiz: Partial<Session>
}

function EvaluationLinkLiveQuiz({ liveQuiz }: EvaluationLinkLiveQuizProps) {
  const t = useTranslations()

  return (
    <div className="text-primary-100 flex flex-row items-center gap-2">
      <FontAwesomeIcon icon={faUpRightFromSquare} />
      <Link
        href={`/quizzes/${liveQuiz.id}/evaluation`}
        target="_blank"
        rel="noopener noreferrer"
        passHref
        legacyBehavior
      >
        <a data-cy={`open-evaluation-session-${liveQuiz.name}`}>
          {t('shared.generic.evaluation')}
        </a>
      </Link>
    </div>
  )
}

export default EvaluationLinkLiveQuiz
