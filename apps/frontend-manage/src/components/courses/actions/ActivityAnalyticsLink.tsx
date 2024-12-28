import { faChartPie } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface ActivityAnalyticsLinkProps {
  courseId: string
  activityId: string
}

function ActivityAnalyticsLink({
  courseId,
  activityId,
}: ActivityAnalyticsLinkProps) {
  const t = useTranslations()

  return (
    <Link
      href={`/analytics/${courseId}/quizzes/${activityId}`}
      target="_blank"
      className="text-primary-100 flex flex-row items-center gap-1"
      data-cy={`open-analytics-async-activity`}
    >
      <FontAwesomeIcon icon={faChartPie} size="sm" className="w-4" />
      <div>{t('manage.courseList.activityAnalytics')}</div>
    </Link>
  )
}

export default ActivityAnalyticsLink
