import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { twMerge } from 'tailwind-merge'
import StackedBarChartLabel from '../StackedBarChartLabel'

interface PerformanceRatesBarChartProps {
  title: string
  effectiveN?: number
  rates: { incorrectRate: number; partialRate: number; correctRate: number }
  colors: {
    incorrect: string
    partial: string
    correct: string
  }
  className?: {
    title?: string
  }
}

function PerformanceRatesBarChart({
  title,
  effectiveN,
  rates,
  colors,
  className,
}: PerformanceRatesBarChartProps) {
  const roundedErrorRate = Math.round(rates.incorrectRate * 100)
  const roundedPartialRate = Math.round(rates.partialRate * 100)
  const roundedCorrectRate = 100 - roundedErrorRate - roundedPartialRate

  return (
    <div className="flex h-8 items-center gap-4">
      <div
        className={twMerge(
          'w-48 overflow-hidden text-ellipsis whitespace-nowrap',
          className?.title
        )}
      >
        {title}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={35}>
          <BarChart data={[rates]} layout="vertical">
            <XAxis type="number" domain={[0, 1]} hide />
            <YAxis type="category" hide />
            {roundedErrorRate > 0 && (
              <Bar
                dataKey="incorrectRate"
                stackId="1"
                fill={colors.incorrect}
                label={(props) => (
                  <StackedBarChartLabel {...props} value={roundedErrorRate} />
                )}
              />
            )}
            {roundedPartialRate > 0 && (
              <Bar
                dataKey="partialRate"
                stackId="1"
                fill={colors.partial}
                label={(props) => (
                  <StackedBarChartLabel {...props} value={roundedPartialRate} />
                )}
              />
            )}
            {roundedCorrectRate > 0 && (
              <Bar
                dataKey="correctRate"
                stackId="1"
                fill={colors.correct}
                label={(props) => (
                  <StackedBarChartLabel {...props} value={roundedCorrectRate} />
                )}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {typeof effectiveN === 'number' ? (
        <div className="mr-2.5 text-sm text-gray-500">(N = {effectiveN})</div>
      ) : null}
    </div>
  )
}

export default PerformanceRatesBarChart
