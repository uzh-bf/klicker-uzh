import ActivityDashboardLabel from '../overview/ActivityDashboardLabel'
import AnalyticsNavigation from '../overview/AnalyticsNavigation'
import PerformanceDashboardLabel from '../overview/PerformanceDashboardLabel'

function QuizAnalyticsNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefLeft={`/analytics/${courseId}/performance`}
      labelLeft={<PerformanceDashboardLabel />}
      hrefRight={`/analytics/${courseId}/activity`}
      labelRight={<ActivityDashboardLabel />}
    />
  )
}

export default QuizAnalyticsNavigation
