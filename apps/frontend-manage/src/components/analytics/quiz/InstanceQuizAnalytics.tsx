import { InstanceQuizAnalytics as InstanceQuizAnalyticsType } from '@klicker-uzh/graphql/dist/ops'
import { Collapsible } from '@uzh-bf/design-system'
import { useState } from 'react'
import PerformanceRatesBarChart from '../performance/PerformanceRatesBarChart'

function InstanceQuizAnalytics({
  analytics,
  colors,
  initiallyOpen = false,
  showLegend = false,
}: {
  analytics: InstanceQuizAnalyticsType
  colors: {
    correct: string
    partial: string
    incorrect: string
  }
  initiallyOpen?: boolean
  showLegend?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <Collapsible
      open={open}
      onChange={() => setOpen((prev) => !prev)}
      staticContent={
        <PerformanceRatesBarChart
          title={analytics.elementName}
          rates={{
            correctRate: analytics.totalCorrectRate,
            partialRate: analytics.totalPartialRate,
            incorrectRate: analytics.totalErrorRate,
          }}
          colors={colors}
        />
      }
      className={{ root: 'w-full !pb-0 !pt-1' }}
    >
      CONTENT
    </Collapsible>
  )
}

export default InstanceQuizAnalytics
