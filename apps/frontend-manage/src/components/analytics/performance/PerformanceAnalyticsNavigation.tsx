import ActivityDashboardLabel from '../overview/ActivityDashboardLabel'
import AnalyticsNavigation from '../overview/AnalyticsNavigation'
import QuizDashboardLabel from '../overview/QuizDashboardLabel'

function PerformanceAnalyticsNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefLeft={`/analytics/${courseId}/activity`}
      labelLeft={<ActivityDashboardLabel />}
      hrefRight={`/analytics/${courseId}/quizzes`}
      labelRight={<QuizDashboardLabel />}
    />
  )
}

export default PerformanceAnalyticsNavigation
