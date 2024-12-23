import { faChartSimple } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

function PerformanceDashboardLabel() {
  const t = useTranslations()

  return (
    <>
      <FontAwesomeIcon className="mr-1" icon={faChartSimple} />
      <div>{t('manage.analytics.performanceDashboard')}</div>
    </>
  )
}

export default PerformanceDashboardLabel
