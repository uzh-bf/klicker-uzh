import ActivityDashboardLabel from '../overview/ActivityDashboardLabel'
import AnalyticsNavigation from '../overview/AnalyticsNavigation'

function PerformanceAnalyticsNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefLeft={`/analytics/${courseId}/activity`}
      labelLeft={<ActivityDashboardLabel />}
      slug="performance"
    />
  )
}

export default PerformanceAnalyticsNavigation
