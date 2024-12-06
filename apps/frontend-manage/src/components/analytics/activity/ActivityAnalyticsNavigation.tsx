import AnalyticsNavigation from '../overview/AnalyticsNavigation'
import PerformanceDashboardLabel from '../overview/PerformanceDashboardLabel'
import QuizDashboardLabel from '../overview/QuizDashboardLabel'

function ActivityAnalyticsNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefLeft={`/analytics/${courseId}/quizzes`}
      labelLeft={<QuizDashboardLabel />}
      hrefRight={`/analytics/${courseId}/performance`}
      labelRight={<PerformanceDashboardLabel />}
    />
  )
}

export default ActivityAnalyticsNavigation
