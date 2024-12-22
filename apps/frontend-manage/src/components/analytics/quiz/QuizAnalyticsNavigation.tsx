import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function QuizAnalyticsNavigation({ courseId }: { courseId: string }) {
  const t = useTranslations()

  return (
    <div className="flex w-full flex-row justify-between">
      <Link
        href={`/analytics/${courseId}/quizzes`}
        className="mb-6 flex flex-row items-center gap-2"
      >
        <FontAwesomeIcon icon={faChevronLeft} size="lg" />
        <div className="flex flex-row items-center gap-0.5">
          {t('manage.analytics.backToActivitySelection')}
        </div>
      </Link>
    </div>
  )
}

export default QuizAnalyticsNavigation
