import { faChartPie } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

function QuizDashboardLabel() {
  const t = useTranslations()

  return (
    <>
      <FontAwesomeIcon className="mr-1" icon={faChartPie} />
      <div>{t('manage.analytics.quizDashboard')}</div>
    </>
  )
}

export default QuizDashboardLabel
