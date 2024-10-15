import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface RunningLiveQuizLinkProps {
  liveQuiz: Partial<Session>
}

function RunningLiveQuizLink({ liveQuiz }: RunningLiveQuizLinkProps) {
  const t = useTranslations()

  return (
    <div className="text-primary-100 flex flex-row items-center gap-2">
      <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-4" />
      <Link legacyBehavior passHref href={`/sessions/${liveQuiz.id}/cockpit`}>
        <a data-cy={`open-cockpit-session-${liveQuiz.name}`}>
          {t('manage.course.runningSession')}
        </a>
      </Link>
    </div>
  )
}

export default RunningLiveQuizLink
