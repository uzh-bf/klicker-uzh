import { faChartLine } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

function ActivityDashboardLabel() {
  const t = useTranslations()

  return (
    <>
      <FontAwesomeIcon className="mr-1" icon={faChartLine} />
      <div>{t('manage.analytics.activityDashboard')}</div>
    </>
  )
}

export default ActivityDashboardLabel
