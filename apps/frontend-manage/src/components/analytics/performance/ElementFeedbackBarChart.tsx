import {
  ActivityFeedback,
  InstanceFeedback,
} from '@klicker-uzh/graphql/dist/ops'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import StackedBarChartLabel from '../StackedBarChartLabel'

interface ElementFeedbackBarChartProps {
  title: string
  feedback: InstanceFeedback | ActivityFeedback
  colors: {
    downvotes: string
    upvotes: string
  }
}

function ElementFeedbackBarChart({
  title,
  feedback,
  colors,
}: ElementFeedbackBarChartProps) {
  const downvotesPercentage = Math.round(feedback.downvoteRate * 100)
  const upvotesPercentage = Math.round(feedback.upvoteRate * 100)

  return (
    <div className="flex h-8 items-center gap-4">
      <div className="w-48 overflow-hidden text-ellipsis whitespace-nowrap">
        {title}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={35}>
          <BarChart data={[feedback]} layout="vertical">
            <XAxis type="number" domain={[0, 1]} hide />
            <YAxis type="category" hide />
            {downvotesPercentage > 0 && (
              <Bar
                dataKey="downvoteRate"
                stackId="1"
                fill={colors.downvotes}
                label={(props) => (
                  <StackedBarChartLabel
                    {...props}
                    value={downvotesPercentage}
                  />
                )}
              />
            )}
            {upvotesPercentage > 0 && (
              <Bar
                dataKey="upvoteRate"
                stackId="1"
                fill={colors.upvotes}
                label={(props) => (
                  <StackedBarChartLabel {...props} value={upvotesPercentage} />
                )}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mr-2.5 text-sm text-gray-500">
        (N = {feedback.participantCount})
      </div>
    </div>
  )
}

export default ElementFeedbackBarChart
