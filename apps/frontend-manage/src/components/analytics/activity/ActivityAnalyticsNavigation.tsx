import AnalyticsNavigation from '../overview/AnalyticsNavigation'
import PerformanceDashboardLabel from '../overview/PerformanceDashboardLabel'

function ActivityAnalyticsNavigation({ courseId }: { courseId: string }) {
  return (
    <AnalyticsNavigation
      hrefRight={`/analytics/${courseId}/performance`}
      labelRight={<PerformanceDashboardLabel />}
      slug="activity"
    />
  )
}

export default ActivityAnalyticsNavigation
