import ActivityDashboardLabel from '../overview/ActivityDashboardLabel'
import AnalyticsNavigation from '../overview/AnalyticsNavigation'
import PerformanceDashboardLabel from '../overview/PerformanceDashboardLabel'

function QuizSelectionNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefLeft={`/analytics/${courseId}/performance`}
      labelLeft={<PerformanceDashboardLabel />}
      hrefRight={`/analytics/${courseId}/activity`}
      labelRight={<ActivityDashboardLabel />}
      slug="quizzes"
    />
  )
}

export default QuizSelectionNavigation
